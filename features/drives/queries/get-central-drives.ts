"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveStatus } from "../utils/drive-status";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive } from "@prisma/client";
import {
  DEPT_STATUS_SELECT,
  summarizeDepartmentStatuses,
  type DriveDeptStatusSummary,
} from "../utils/dept-status-summary";

export type { DriveDeptStatusSummary };

export type CentralDriveListItem = WithSerializedPackage<Drive> &
  HasEligibleDepartmentLinks & {
    _count: { applications: number };
    /** One summary per assigned department, ordered by code. */
    deptStatusSummary: DriveDeptStatusSummary[];
    /** Quick counters derived from deptStatusSummary. */
    assignedCount: number;
    configuredCount: number;
    publishedCount: number;
    /** Closed, cancelled or archived department drives. */
    closedCount: number;
  };

export interface CentralDrivesParams {
  page?: number;
  pageSize?: number;
}

export interface CentralDrivesResult {
  data: CentralDriveListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * List central drives for the Super Admin, open drives first so the most
 * actionable ones sit at the top of the master list.
 *
 * Now includes a per-department status summary so the list can show the
 * "CSE — Assigned · IT — Published" hierarchy without a second query.
 *
 * Authorization: SUPER_ADMIN only.
 */
export async function getCentralDrives(
  params: CentralDrivesParams = {}
): Promise<CentralDrivesResult> {
  await requireSuperAdmin();

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 25, 100);
  const skip = (page - 1) * pageSize;

  const where = { isCentralDrive: true };

  const [totalCount, drives] = await Promise.all([
    prisma.drive.count({ where }),
    prisma.drive.findMany({
      where,
      orderBy: [{ nextStageDate: "asc" }],
      skip,
      take: pageSize,
      include: {
        _count: { select: { applications: true } },
        ...eligibleDepartmentLinksInclude,
        departmentConfigs: DEPT_STATUS_SELECT,
      },
    }),
  ]);

  // Open drives first, then by soonest next stage date — status is always computed,
  // never stored.
  const sorted = [...drives].sort((a, b) => {
    const aOpen = getDriveStatus(a) === "open";
    const bOpen = getDriveStatus(b) === "open";

    if (aOpen !== bOpen) {
      return aOpen ? -1 : 1;
    }

    return a.nextStageDate.getTime() - b.nextStageDate.getTime();
  });

  return {
    data: sorted.map(({ departmentConfigs, ...drive }) => ({
      ...serializePackageOffered(drive),
      ...summarizeDepartmentStatuses(departmentConfigs),
    })),
    page,
    pageSize,
    totalCount,
  };
}

/**
 * The Super Admin dashboard's "Central drives" card: drives the Super Admin
 * posted, newest first. Filtered by origin (`isCentralDrive`), so a drive a
 * department posted for itself never appears here (Item 16).
 */
export async function getRecentCentralDrives() {
  await requireSuperAdmin();
  return prisma.drive.findMany({
    where: { isCentralDrive: true },
    orderBy: { createdAt: "desc" },
    include: { department: true, ...eligibleDepartmentLinksInclude },
  });
}