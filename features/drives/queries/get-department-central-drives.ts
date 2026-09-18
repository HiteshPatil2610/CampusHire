"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive, DriveDepartmentConfig } from "@prisma/client";

export type DepartmentCentralDrive = WithSerializedPackage<Drive> & HasEligibleDepartmentLinks & {
  /**
   * This department's own configuration for the drive. Null until the admin
   * saves one — other departments' configurations are never loaded here.
   */
  config: DriveDepartmentConfig | null;
  /** Applications from this department's students only. */
  departmentApplicantCount: number;
};

export interface DepartmentCentralDrivesResult {
  drives: DepartmentCentralDrive[];
  departmentCodesById: Record<string, string>;
  studentCount: number;
}

/**
 * Central drives (posted by the Super Admin) that list the calling admin's
 * department as eligible, each paired with that department's own logistics and
 * application-field configuration.
 *
 * Authorization: DEPT_ADMIN only, scoped to their own department.
 */
export async function getDepartmentCentralDrives(): Promise<DepartmentCentralDrivesResult> {
  const { department } = await requireDepartmentAdmin();

  const [centralDrives, departments, studentCount] = await Promise.all([
    prisma.drive.findMany({
      where: {
        isCentralDrive: true,
        eligibleDepartmentLinks: { some: { departmentId: department.id } },
      },
      orderBy: [{ driveDate: "desc" }, { createdAt: "desc" }],
      include: {
        departmentConfigs: { where: { departmentId: department.id } },
        _count: {
          select: {
            applications: {
              where: { student: { departmentId: department.id } },
            },
          },
        },
        ...eligibleDepartmentLinksInclude,
      },
    }),
    prisma.department.findMany({ select: { id: true, code: true } }),
    prisma.student.count({ where: { departmentId: department.id } }),
  ]);

  return {
    drives: centralDrives.map(({ departmentConfigs, _count, ...drive }) => ({
      ...serializePackageOffered(drive),
      config: departmentConfigs[0] ?? null,
      departmentApplicantCount: _count.applications,
    })),
    departmentCodesById: Object.fromEntries(
      departments.map((dept) => [dept.id, dept.code])
    ),
    studentCount,
  };
}
