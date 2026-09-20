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
  params: {
    page?: number;
    pageSize?: number;
    departmentCode?: string;
    /** Matches name, roll number or email. */
    search?: string;
    batchYear?: number;
    status?: "IN_PROGRESS" | "SELECTED" | "REJECTED" | "WITHDRAWN";
    placement?: "placed" | "unplaced";
    /** ISO dates (YYYY-MM-DD), inclusive, on the day the application was made. */
    appliedFrom?: string;
    appliedTo?: string;
  } = {}
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
  // Every filter comes from a URL, so each is checked before it reaches the
  // query.
  const search = params.search?.trim().slice(0, 100) || undefined;
  const batchYear =
    Number.isInteger(params.batchYear) && params.batchYear! > 1900 && params.batchYear! < 3000
      ? params.batchYear
      : undefined;
  const status =
    params.status && ["IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"].includes(params.status)
      ? params.status
      : undefined;
  const day = (value: string | undefined, end: boolean) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const appliedFrom = day(params.appliedFrom, false);
  const appliedTo = day(params.appliedTo, true);

  const studentFilter = {
      ...(params.departmentCode ? { department: { code: params.departmentCode } } : {}),
      ...(batchYear ? { batchYear } : {}),
      ...(params.placement === "placed"
        ? { placements: { some: ACTIVE_PLACEMENT_WHERE } }
        : params.placement === "unplaced"
          ? { placements: { none: ACTIVE_PLACEMENT_WHERE } }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { rollNumber: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
  };

  // With no student-level filter the clause is left out altogether, so an
  // unfiltered view is exactly `{ driveId }`.
  const where = {
    driveId,
    ...(status ? { status } : {}),
    ...(appliedFrom || appliedTo
      ? { appliedAt: { ...(appliedFrom ? { gte: appliedFrom } : {}), ...(appliedTo ? { lte: appliedTo } : {}) } }
      : {}),
    ...(Object.keys(studentFilter).length > 0 ? { student: studentFilter } : {}),
  };

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
