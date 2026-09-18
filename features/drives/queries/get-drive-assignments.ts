"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DepartmentDriveStatus } from "@prisma/client";

/**
 * The explicit Master Drive ↔ Department ↔ Department Drive mapping.
 *
 * One row per department the drive could run in, so the Super Admin sees the
 * whole picture on one screen: which departments are assigned, what state each
 * instance is in, how many of that department's students have applied, and
 * therefore which assignments can still be removed.
 *
 * Authorization: SUPER_ADMIN only — this is the assignment console.
 */

export interface DepartmentAssignmentRow {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  isActive: boolean;
  /** Null when this department is not assigned to the drive. */
  departmentDriveId: string | null;
  status: DepartmentDriveStatus | null;
  assignedAt: Date | null;
  isAssigned: boolean;
  /** Applications to this drive from this department's students. */
  applicationCount: number;
  /**
   * An assignment can only be withdrawn while no application depends on it —
   * computed here so the console can disable the control rather than let the
   * action refuse after the click.
   */
  canUnassign: boolean;
}

export interface DriveAssignmentsResult {
  driveId: string;
  companyName: string;
  roleName: string;
  isCentralDrive: boolean;
  rows: DepartmentAssignmentRow[];
}

export async function getDriveAssignments(
  driveId: string
): Promise<DriveAssignmentsResult | null> {
  await requireSuperAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    select: {
      id: true,
      companyName: true,
      roleName: true,
      isCentralDrive: true,
    },
  });

  if (!drive) return null;

  // Independent reads for one screen, so they go out together.
  const [departments, instances, applicationCounts] = await Promise.all([
    prisma.department.findMany({
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    }),
    prisma.driveDepartmentConfig.findMany({
      where: { driveId },
      select: {
        id: true,
        departmentId: true,
        status: true,
        assignedAt: true,
      },
    }),
    // Applications grouped by the applicant's department. There is no
    // departmentId on DriveApplication, so this counts through Student.
    prisma.student.groupBy({
      by: ["departmentId"],
      where: { applications: { some: { driveId } } },
      _count: { _all: true },
    }),
  ]);

  const instanceByDepartment = new Map(
    instances.map((instance) => [instance.departmentId, instance])
  );
  const countByDepartment = new Map(
    applicationCounts.map((row) => [row.departmentId, row._count._all])
  );

  const rows: DepartmentAssignmentRow[] = departments.map((department) => {
    const instance = instanceByDepartment.get(department.id) ?? null;
    const applicationCount = countByDepartment.get(department.id) ?? 0;

    return {
      departmentId: department.id,
      departmentName: department.name,
      departmentCode: department.code,
      isActive: department.isActive,
      departmentDriveId: instance?.id ?? null,
      status: instance?.status ?? null,
      assignedAt: instance?.assignedAt ?? null,
      isAssigned: instance !== null,
      applicationCount,
      canUnassign: instance !== null && applicationCount === 0,
    };
  });

  return {
    driveId: drive.id,
    companyName: drive.companyName,
    roleName: drive.roleName,
    isCentralDrive: drive.isCentralDrive,
    rows,
  };
}
