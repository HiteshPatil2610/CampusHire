"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveStatus } from "../utils/drive-status";
import type { Drive } from "@prisma/client";

export interface AdminDrivesParams {
  page?: number;
  pageSize?: number;
  status?: "open" | "closed" | "all";
  search?: string;
}

export type DriveWithCount = Drive & {
  _count: {
    applications: number;
  };
};

export interface AdminDrivesResult {
  data: DriveWithCount[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * Get drives for department admin (own department only)
 * Supports pagination, filtering, and search
 */
export async function getAdminDrives(
  params: AdminDrivesParams = {}
): Promise<AdminDrivesResult> {
  // Verify authentication and get department admin context
  const { user, admin, department } = await requireDepartmentAdmin();

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 25, 100);
  const skip = (page - 1) * pageSize;
  const status = params.status || "all";
  const search = params.search?.trim();

  // Build where clause
  const where: any = {
    departmentId: department.id, // Only admin's department
  };

  // Status filter
  if (status === "open") {
    where.applicationDeadline = { gt: new Date() };
  } else if (status === "closed") {
    where.applicationDeadline = { lte: new Date() };
  }

  // Search filter
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { roleName: { contains: search, mode: "insensitive" } },
    ];
  }

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, drives] = await Promise.all([
    prisma.drive.count({ where }),
    prisma.drive.findMany({
      where,
      orderBy: [
        { applicationDeadline: "desc" }, // Most recent deadline first
        { createdAt: "desc" },
      ],
      skip,
      take: pageSize,
      include: {
        _count: { select: { applications: true } },
      },
    }),
  ]);

  return {
    data: drives,
    page,
    pageSize,
    totalCount,
    hasMore: skip + drives.length < totalCount,
  };
}
