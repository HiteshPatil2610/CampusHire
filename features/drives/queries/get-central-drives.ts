"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveStatus } from "../utils/drive-status";
import type { Drive } from "@prisma/client";

export type CentralDriveListItem = Drive & {
  _count: { applications: number };
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
      orderBy: [{ driveDate: "asc" }],
      skip,
      take: pageSize,
      include: {
        _count: { select: { applications: true } },
      },
    }),
  ]);

  // Open drives first, then by soonest drive date — status is always computed,
  // never stored.
  const sorted = [...drives].sort((a, b) => {
    const aOpen = getDriveStatus(a.applicationDeadline) === "open";
    const bOpen = getDriveStatus(b.applicationDeadline) === "open";

    if (aOpen !== bOpen) {
      return aOpen ? -1 : 1;
    }

    return a.driveDate.getTime() - b.driveDate.getTime();
  });

  return { data: sorted, page, pageSize, totalCount };
}
