"use server";

import { SEMESTER_MARKS_SELECT } from "@/features/drives/domain/eligibility-evaluator";
import { cache } from "react";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import {
  isStudentAcademicallyEligibleForDrive,
  isStudentEligibleForDrive,
} from "./drive-eligibility";
import { loadStudentDriveCandidates } from "../domain/student-drive-candidates";
import type { ApplicationFieldConfig } from "../domain/application-form";
import type { DriveForStudent } from "../domain/resolve-department-drive";
import type { EffectiveEligibilityRule } from "../domain/eligibility-rules";
import type { HasEligibleDepartmentLinks } from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive } from "@prisma/client";
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
      // Semesters with marks: the final-year marks gate reads them.
      semesterMarks: SEMESTER_MARKS_SELECT,
    },
  });
  return {
    academic: row?.academic ?? null,
    skills: row?.skills ?? [],
    placements: row?.placements ?? [],
    semesterMarks: row?.semesterMarks ?? [],
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

  // SQL narrows to this department's published drives (membership and
  // lifecycle only — never a business rule); every rule is then decided per
  // resolved drive by the evaluator. The same candidates the profile-save
  // re-check uses (`domain/student-drive-candidates.ts`).
  const resolved = await loadStudentDriveCandidates(departmentId);
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
