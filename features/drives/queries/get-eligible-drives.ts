"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStudentEligibleForDrive } from "./drive-eligibility";
import type { Drive } from "@prisma/client";

export interface StudentDrivesParams {
  page?: number;
  pageSize?: number;
  status?: "open" | "all";
  search?: string;
}

export interface StudentDrivesResult {
  data: Drive[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * Get eligible drives for authenticated student
 * Server-side eligibility filtering - student only sees drives they qualify for
 */
export async function getEligibleDrives(
  params: StudentDrivesParams = {}
): Promise<StudentDrivesResult> {
  // Verify authentication and get student
  const { user, student } = await requireStudent();

  // Get student with academic info
  const studentWithAcademic = await prisma.student.findUnique({
    where: { id: student.id },
    include: {
      academic: true,
    },
  });

  if (!studentWithAcademic || !studentWithAcademic.academic) {
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

  // Filter by full eligibility criteria (including department check)
  const eligibleDrives = allDrives.filter((drive) =>
    isStudentEligibleForDrive(studentWithAcademic, drive)
  );

  const totalCount = eligibleDrives.length;

  // Apply pagination after filtering
  const paginatedDrives = eligibleDrives.slice(skip, skip + pageSize);

  return {
    data: paginatedDrives,
    page,
    pageSize,
    totalCount,
    hasMore: skip + paginatedDrives.length < totalCount,
  };
}
