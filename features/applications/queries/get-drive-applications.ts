"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import type {
  DriveApplication,
  Student,
  StudentAcademic,
  Department,
} from "@prisma/client";

export type DriveApplicationItem = DriveApplication & {
  student: Student & {
    academic: StudentAcademic | null;
    department: Pick<Department, "id" | "name" | "code">;
  };
};

export interface GetDriveApplicationsParams {
  driveId: string;
  page?: number;
  pageSize?: number;
}

export interface DriveApplicationsResult {
  data: DriveApplicationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Get paginated list of applications for a specific drive.
 * Authorization: dept admin only, drive must belong to their department.
 */
export async function getDriveApplications(
  params: GetDriveApplicationsParams
): Promise<DriveApplicationsResult> {
  const { department } = await requireDepartmentAdmin();

  // Verify the drive belongs to this admin's department
  const drive = await prisma.drive.findUnique({
    where: { id: params.driveId },
    select: { departmentId: true },
  });

  if (!drive) {
    throw new Error("Drive not found");
  }

  if (drive.departmentId !== department.id) {
    throw new AuthorizationError(
      "You do not have permission to view applications for this drive"
    );
  }

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;

  const totalCount = await prisma.driveApplication.count({
    where: { driveId: params.driveId },
  });

  const data = await prisma.driveApplication.findMany({
    where: { driveId: params.driveId },
    skip,
    take: pageSize,
    orderBy: { appliedAt: "desc" },
    include: {
      student: {
        include: {
          academic: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return { data, page, pageSize, totalCount };
}
