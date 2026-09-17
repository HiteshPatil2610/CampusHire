"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Drive } from "@prisma/client";

export type DriveWithCount = Drive & {
  _count: { applications: number };
};

/**
 * Central drives (posted by the Super Admin) that include the current
 * department admin's department in their eligible-department list.
 *
 * Read-only from the department admin's side — editing a central drive
 * stays with the Super Admin via updateCentralDrive.
 *
 * Authorization: DEPT_ADMIN only, scoped to their own department.
 */
export async function getCentralDrivesForDepartment(): Promise<DriveWithCount[]> {
  const { department } = await requireDepartmentAdmin();

  const centralDrives = await prisma.drive.findMany({
    where: {
      isCentralDrive: true,
      eligibleDepartmentLinks: { some: { departmentId: department.id } },
    },
    orderBy: [{ applicationDeadline: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { applications: true } },
    },
  });

  return centralDrives;
}
