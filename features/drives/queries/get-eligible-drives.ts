"use server";

import { cache } from "react";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isStudentAcademicallyEligibleForDrive,
  isStudentEligibleForDrive,
} from "./drive-eligibility";
import { applyDepartmentConfig } from "../utils/department-config-overlay";
import type { DriveForStudent } from "../utils/department-config-overlay";
import type { Drive } from "@prisma/client";

export interface StudentDrivesParams {
  page?: number;
  pageSize?: number;
  status?: "open" | "all";
  search?: string;
}

export interface StudentDrivesResult {
  data: DriveForStudent[];
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
    // `eligibleDepartments` is a JSON array of department IDs stored as text,
    // so a substring match is a *narrowing* prefilter, never a widening one:
    // any drive that passes `isStudentAcademicallyEligibleForDrive` below must
    // contain this ID. It can over-match (an ID that is a substring of
    // another), and the exact JSON check that follows still rejects those.
    // Without it every student's dashboard read every drive row in the system.
    eligibleDepartments: { contains: studentWithAcademic.departmentId },
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
  });

  const matchesEligibility =
    status === "open"
      ? (drive: Drive) => isStudentEligibleForDrive(studentWithAcademic, drive)
      : (drive: Drive) =>
          isStudentAcademicallyEligibleForDrive(studentWithAcademic, drive);

  const eligibleDrives = allDrives.filter((drive) =>
    matchesEligibility(drive)
  );

  const totalCount = eligibleDrives.length;

  // Apply pagination after filtering
  const paginatedDrives = eligibleDrives.slice(skip, skip + pageSize);

  // A central drive's venue, coordinator and required fields are configured per
  // department, so show this student their own department's setup.
  const configs = await prisma.driveDepartmentConfig.findMany({
    where: {
      departmentId: studentWithAcademic.departmentId,
      driveId: { in: paginatedDrives.map((drive) => drive.id) },
    },
  });
  const configByDriveId = new Map(
    configs.map((config) => [config.driveId, config])
  );

  return {
    data: paginatedDrives.map((drive) =>
      applyDepartmentConfig(drive, configByDriveId.get(drive.id))
    ),
    page,
    pageSize,
    totalCount,
    hasMore: skip + paginatedDrives.length < totalCount,
  };
}
