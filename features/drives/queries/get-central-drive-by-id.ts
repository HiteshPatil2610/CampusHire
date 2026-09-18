"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { serializePackageOffered } from "../utils/serialize-drive";
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
    },
  });

  if (!drive || !drive.isCentralDrive) {
    return null;
  }

  return serializePackageOffered(drive);
}
