"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { serializePackageOffered } from "../utils/serialize-drive";
import { DEPT_STATUS_SELECT, summarizeDepartmentStatuses } from "../utils/dept-status-summary";
import type { CentralDriveListItem } from "./get-central-drives";

/**
 * Fetch a single central drive by id.
 *
 * Authorization: SUPER_ADMIN only. Department-posted drives are not reachable
 * through this query — they are not the Super Admin's to manage.
 */
export async function getCentralDriveById(
  driveId: string
): Promise<CentralDriveListItem | null> {
  await requireSuperAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: {
      _count: { select: { applications: true } },
      ...eligibleDepartmentLinksInclude,
      departmentConfigs: DEPT_STATUS_SELECT,
    },
  });

  if (!drive || !drive.isCentralDrive) {
    return null;
  }

  const { departmentConfigs, ...rest } = drive;
  return {
    ...serializePackageOffered(rest),
    ...summarizeDepartmentStatuses(departmentConfigs),
  };
}
