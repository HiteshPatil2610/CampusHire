"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PLACEMENT_WHERE } from "@/features/students/utils/placement-status";
import type {
  DriveApplication,
  Student,
  StudentAcademic,
  Department,
  RecruitmentStageType,
} from "@prisma/client";

export type SuperAdminApplicationItem = DriveApplication & {
  currentStage: {
    id: string;
    name: string;
    stageType: RecruitmentStageType;
  } | null;
  student: Student & {
    academic: StudentAcademic | null;
    department: Pick<Department, "id" | "name" | "code">;
    placements: { id: string; applicationId: string | null; companyName: string }[];
  };
};

export interface SuperAdminDriveApplicationsResult {
  companyName: string;
  roleName: string;
  applicationDeadline: Date;
  isCentralDrive: boolean;
  applications: SuperAdminApplicationItem[];
  totalCount: number;
  /** How many applicants per department, for the summary header. */
  byDepartment: { departmentCode: string; departmentName: string; count: number }[];
}

/**
 * All applications for a drive, across every department.
 * The super admin sees the complete picture — not one department's slice.
 *
 * Authorization: SUPER_ADMIN only.
 */
export async function getSuperAdminDriveApplications(
  driveId: string,
  params: { page?: number; pageSize?: number; departmentCode?: string } = {}
): Promise<SuperAdminDriveApplicationsResult> {
  await requireSuperAdmin();

  // A page number from a URL: whole and at least 1, never NaN.
  const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page!)) : 1;
  const pageSize = Math.min(params.pageSize ?? 50, 200);
  const skip = (page - 1) * pageSize;

  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    select: {
      companyName: true,
      roleName: true,
      applicationDeadline: true,
      isCentralDrive: true,
      departmentConfigs: {
        select: {
          applicationDeadline: true,
          roleName: true,
          departmentId: true,
          department: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!drive) throw new Error("Drive not found");

  // Optional department filter — when the super admin wants to drill into
  // one department rather than see all at once. The URL carries the
  // department's code; it is matched against a department that actually runs
  // this drive, so it can never widen what is shown.
  const where = params.departmentCode
    ? { driveId, student: { department: { code: params.departmentCode } } }
    : { driveId };

  const [totalCount, applications, grouped] = await Promise.all([
    prisma.driveApplication.count({ where }),
    prisma.driveApplication.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ student: { department: { code: "asc" } } }, { appliedAt: "asc" }],
      include: {
        currentStage: {
          select: { id: true, name: true, stageType: true },
        },
        student: {
          include: {
            academic: true,
            department: { select: { id: true, name: true, code: true } },
            placements: {
              where: ACTIVE_PLACEMENT_WHERE,
              select: { id: true, applicationId: true, companyName: true },
            },
          },
        },
      },
    }),
    // One groupBy for per-dept counts — no N+1 loop.
    prisma.student.groupBy({
      by: ["departmentId"],
      where: { applications: { some: { driveId } } },
      _count: { _all: true },
    }),
  ]);

  // Map dept IDs → code/name from the drive's configs.
  const deptMeta = new Map(
    drive.departmentConfigs.map((c) => [
      c.departmentId,
      { code: c.department.code, name: c.department.name },
    ])
  );

  const byDepartment = grouped
    .map((row) => {
      const meta = deptMeta.get(row.departmentId);
      return meta
        ? { departmentCode: meta.code, departmentName: meta.name, count: row._count._all }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.departmentCode.localeCompare(b.departmentCode));

  return {
    companyName: drive.companyName,
    roleName: drive.roleName,
    applicationDeadline: drive.applicationDeadline,
    isCentralDrive: drive.isCentralDrive,
    applications,
    totalCount,
    byDepartment,
  };
}
