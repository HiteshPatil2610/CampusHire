"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveStatus } from "../utils/drive-status";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive, DepartmentDriveStatus } from "@prisma/client";

export type OwnDriveListItem = WithSerializedPackage<Drive> & {
  _count: { applications: number };
  /** Computed open/closed from the deadline. */
  driveOpen: boolean;
};

export interface DepartmentOwnDrivesResult {
  drives: OwnDriveListItem[];
  totalCount: number;
}

/**
 * Department-owned drives (non-central drives posted by this dept admin),
 * newest first.
 *
 * Authorization: DEPT_ADMIN, scoped to their own department.
 */
export async function getDepartmentOwnDrives(): Promise<DepartmentOwnDrivesResult> {
  const { department } = await requireDepartmentAdmin();

  const [totalCount, drives] = await Promise.all([
    prisma.drive.count({ where: { departmentId: department.id, isCentralDrive: false } }),
    prisma.drive.findMany({
      where: { departmentId: department.id, isCentralDrive: false },
      orderBy: [{ createdAt: "desc" }],
      include: { _count: { select: { applications: true } } },
    }),
  ]);

  return {
    drives: drives.map((drive) => ({
      ...serializePackageOffered(drive),
      driveOpen: getDriveStatus(drive.applicationDeadline) === "open",
    })),
    totalCount,
  };
}
