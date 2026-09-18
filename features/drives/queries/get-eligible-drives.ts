"use server";

import { cache } from "react";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isStudentAcademicallyEligibleForDrive,
  isStudentEligibleForDrive,
} from "./drive-eligibility";
import { resolveDepartmentDrives } from "../domain/resolve-department-drive";
import type { DriveForStudent } from "../domain/resolve-department-drive";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive } from "@prisma/client";

export interface StudentDrivesParams {
  page?: number;
  pageSize?: number;
  status?: "open" | "all";
  search?: string;
}

export interface StudentDrivesResult {
  data: WithSerializedPackage<DriveForStudent<Drive & HasEligibleDepartmentLinks>>[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * The student's academic record, memoised per request. Eligibility is checked
 * on several paths in a single render and each one used to re-read it.
 */
const getAcademicForStudent = cache((studentId: string) =>
  prisma.studentAcademic.findUnique({ where: { studentId } })
);

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

  // Only the academic record is still missing, so fetch that rather than
  // re-reading the whole student row a third time in one request.
  const academic = await getAcademicForStudent(student.id);
  const studentWithAcademic = { ...student, academic };

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

  // Build where clause
  const where: any = {
    // Initial filters at query level for performance
    minCGPA: { lte: studentWithAcademic.academic.currentCGPA },
    maxActiveBacklogs: { gte: studentWithAcademic.academic.activeBacklogs },
    // A real FK membership check via DriveEligibleDepartment, replacing the
    // old JSON-text `contains` prefilter (which could over-match on an ID
    // that was a substring of another, relying on the in-memory recheck below
    // to reject those). Without some filter here every student's dashboard
    // read every drive row in the system.
    eligibleDepartmentLinks: {
      some: { departmentId: studentWithAcademic.departmentId },
    },
    // A student sees their own department's instance, and only once that
    // department has published it. An ASSIGNED or CONFIGURED instance is
    // half-built — showing it would put partially configured data in front of
    // students, which is exactly what the lifecycle exists to prevent.
    // CLOSED and ARCHIVED are administratively over and equally hidden.
    departmentConfigs: {
      some: {
        departmentId: studentWithAcademic.departmentId,
        status: "PUBLISHED",
      },
    },
  };

  // Status filter
  if (status === "open") {
    where.applicationDeadline = { gt: new Date() };
  }

  // Search filter
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { roleName: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get all potentially eligible drives
  const allDrives = await prisma.drive.findMany({
    where,
    orderBy: [
      { applicationDeadline: "asc" }, // Closest deadline first
      { createdAt: "desc" },
    ],
    include: eligibleDepartmentLinksInclude,
  });

  const matchesEligibility =
    status === "open"
      ? (drive: (typeof allDrives)[number]) =>
          isStudentEligibleForDrive(studentWithAcademic, drive)
      : (drive: (typeof allDrives)[number]) =>
          isStudentAcademicallyEligibleForDrive(studentWithAcademic, drive);

  const eligibleDrives = allDrives.filter((drive) =>
    matchesEligibility(drive)
  );

  const totalCount = eligibleDrives.length;

  // Apply pagination after filtering
  const paginatedDrives = eligibleDrives.slice(skip, skip + pageSize);

  // A central drive's venue, coordinator and required fields are configured per
  // department, so show this student their own department's instance.
  const instances = await prisma.driveDepartmentConfig.findMany({
    where: {
      departmentId: studentWithAcademic.departmentId,
      driveId: { in: paginatedDrives.map((drive) => drive.id) },
    },
  });

  return {
    data: resolveDepartmentDrives(paginatedDrives, instances).map((drive) =>
      serializePackageOffered(drive)
    ),
    page,
    pageSize,
    totalCount,
    hasMore: skip + paginatedDrives.length < totalCount,
  };
}
