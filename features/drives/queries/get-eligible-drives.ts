"use server";

import { cache } from "react";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import {
  isStudentAcademicallyEligibleForDrive,
  isStudentEligibleForDrive,
} from "./drive-eligibility";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "../domain/resolve-department-drive";
import type { ApplicationFieldConfig } from "../domain/application-form";
import type { DriveForStudent } from "../domain/resolve-department-drive";
import type { EffectiveEligibilityRule } from "../domain/eligibility-rules";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive, Prisma } from "@prisma/client";
import { isDriveOpen } from "../utils/drive-status";

export interface StudentDrivesParams {
  page?: number;
  pageSize?: number;
  status?: "open" | "all";
  search?: string;
}

export interface StudentDrivesResult {
  /**
   * Each drive as this student's department runs it, carrying the rule set
   * that was applied — so pages rendering a checklist use the same rules the
   * list was filtered with.
   */
  data: (WithSerializedPackage<DriveForStudent<Drive & HasEligibleDepartmentLinks>> & {
    eligibilityRules: EffectiveEligibilityRule[];
    /** This department's resolved application form, in order. */
    applicationForm: ApplicationFieldConfig[];
  })[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * What eligibility reads about the student — their academic record and their
 * skills — in one round trip, memoised per request. Eligibility is checked on
 * several paths in a single render and each one used to re-read it.
 */
const getEligibilityRecords = cache(async (studentId: string) => {
  const row = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      academic: true,
      skills: { select: { skillName: true } },
      // Placement decides first: a placed student sees no drive as eligible.
      placements: ACTIVE_PLACEMENTS_SELECT,
    },
  });
  return {
    academic: row?.academic ?? null,
    skills: row?.skills ?? [],
    placements: row?.placements ?? [],
  };
});

/**
 * Get eligible drives for authenticated student
 * Server-side eligibility filtering - student only sees drives they qualify for
 */
export async function getEligibleDrives(
  params: StudentDrivesParams = {}
): Promise<StudentDrivesResult> {
  // Verify authentication and get student. `requireStudent` is request-cached,
  // so this costs nothing when the caller has already authenticated.
  const { student } = await requireStudent();

  // The academic record and skills are what the rules read; the student row
  // itself is already in hand. Nothing here comes from the client.
  const records = await getEligibilityRecords(student.id);
  const studentWithAcademic = { ...student, ...records };

  if (!studentWithAcademic.academic) {
    // Student hasn't completed academic profile - no eligible drives
    return {
      data: [],
      page: 1,
      pageSize: params.pageSize || 25,
      totalCount: 0,
      hasMore: false,
    };
  }

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 25, 100);
  const skip = (page - 1) * pageSize;
  const status = params.status || "open";
  const search = params.search?.trim();

  const departmentId = studentWithAcademic.departmentId;

  // SQL narrows on *exact membership only*: the drive runs in this student's
  // department, that department has published it, and the master is not
  // archived. It deliberately does NOT filter on CGPA, backlogs, deadline or
  // role name any more — those are now per-department overridable, and a
  // prefilter on the master's values would under-match: a department that
  // lowers the bar to 6.5 on a master set at 7.0 would have its 6.8 students
  // silently excluded before the resolver ever saw the drive. A prefilter may
  // over-match; it must never under-match (architecture.md, "Filter in SQL").
  // The candidate set is one department's published drives, so the exact
  // checks below run over tens of rows, not the whole table.
  const where: Prisma.DriveWhereInput = {
    // A real FK membership check via DriveEligibleDepartment, replacing the
    // old JSON-text `contains` prefilter (which could over-match on an ID
    // that was a substring of another, relying on the in-memory recheck below
    // to reject those). Without some filter here every student's dashboard
    // read every drive row in the system.
    eligibleDepartmentLinks: {
      some: { departmentId },
    },
    // A student sees their own department's instance, and only once that
    // department has published it. An ASSIGNED or CONFIGURED instance is
    // half-built — showing it would put partially configured data in front of
    // students, which is exactly what the lifecycle exists to prevent.
    // CLOSED, CANCELLED and ARCHIVED are administratively over and equally
    // hidden.
    departmentConfigs: {
      some: { departmentId, status: "PUBLISHED" },
    },
    // Archiving or cancelling a master drive withdraws it everywhere,
    // whatever state each department's instance was left in. DRAFT is
    // deliberately *not* excluded: the Super Admin authors in DRAFT, and each
    // department's own publish is what releases the drive to its students.
    lifecycleStatus: { notIn: ["ARCHIVED", "CANCELLED"] },
  };

  // One query: the candidate masters with their default rules, plus this
  // department's instance of each and *its* rules (and nobody else's — the
  // include is scoped to the student's department).
  const candidates = await prisma.drive.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      ...eligibleDepartmentLinksInclude,
      eligibilityRules: true,
      formFields: true,
      departmentConfigs: {
        where: { departmentId },
        include: { eligibilityRules: true, formFields: true },
      },
    },
  });

  // Resolve first, then decide — every rule below is this department's: its
  // rule set, its deadline, its role title. The application form is resolved
  // alongside so the review card shows exactly what `applyToDrive` will check.
  const resolved = candidates.map(({ departmentConfigs, formFields, ...master }) => {
    const instance = departmentConfigs[0] ?? null;
    return {
      ...resolveDepartmentDriveWithRules(master, instance),
      applicationForm: resolveDepartmentApplicationForm(
        { formFields, applicationFields: master.applicationFields },
        instance
      ).fields,
    };
  });

  const now = new Date();
  const needle = search?.toLowerCase();

  const eligibleDrives = resolved
    .filter((drive) =>
      status === "open"
        ? isStudentEligibleForDrive(studentWithAcademic, drive)
        : isStudentAcademicallyEligibleForDrive(studentWithAcademic, drive)
    )
    .filter(
      (drive) =>
        !needle ||
        drive.companyName.toLowerCase().includes(needle) ||
        drive.roleName.toLowerCase().includes(needle)
    )
    // Closest (resolved) deadline first, still-open drives ahead of past ones.
    .sort((a, b) => {
      const aOpen = isDriveOpen(a, now);
      const bOpen = isDriveOpen(b, now);
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return a.applicationDeadline.getTime() - b.applicationDeadline.getTime();
    });

  const totalCount = eligibleDrives.length;
  const paginatedDrives = eligibleDrives.slice(skip, skip + pageSize);

  return {
    data: paginatedDrives.map((drive) => serializePackageOffered(drive)),
    page,
    pageSize,
    totalCount,
    hasMore: skip + paginatedDrives.length < totalCount,
  };
}
