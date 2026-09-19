"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditEntityType } from "@/lib/audit";
import { isCentralDrive } from "../domain/drive-kind";

export interface DriveActivityItem {
  id: string;
  action: string;
  /** What happened, as a short sentence. */
  summary: string;
  actorEmail: string;
  createdAt: Date;
}

const MAX_ITEMS = 50;

/** A readable sentence from an audit row's action and metadata. */
function summarize(action: string, entityType: string, metadata: Record<string, unknown> | null): string {
  const dept = typeof metadata?.departmentCode === "string" ? metadata.departmentCode : null;
  const of = dept ? ` (${dept})` : "";
  const reason = typeof metadata?.reason === "string" ? ` — ${metadata.reason}` : "";
  const event = typeof metadata?.event === "string" ? metadata.event : null;

  if (entityType === AuditEntityType.PIPELINE_CHANGE_REQUEST) {
    if (action === "REQUEST") return `Recruitment stage change proposed${of}${reason}`;
    if (action === "APPROVE") return `Recruitment stage change approved${of}`;
    if (action === "REJECT") return `Recruitment stage change rejected${of}`;
  }
  if (entityType === AuditEntityType.RECRUITMENT_PIPELINE) {
    return `Recruitment stages updated${of}`;
  }
  if (action === "CANCEL") {
    return metadata?.scope === "master-drive"
      ? `Drive cancelled in every department${reason}`
      : `Drive cancelled${of}${reason}`;
  }
  if (action === "EXTEND_DEADLINE") return `Application deadline extended${of}${reason}`;
  if (action === "ASSIGN") return "Assigned to departments";
  if (action === "UNASSIGN") return `Department unassigned${of}`;
  if (action === "CREATE") return "Master drive created";

  switch (event) {
    case "department-drive-published":
      return `Published to students${of}`;
    case "department-drive-status-changed":
      return `Department drive ${String(metadata?.toStatus ?? "updated").toLowerCase()}${of}`;
    case "master-drive-status-changed":
      return `Master drive ${String(metadata?.toStatus ?? "updated").toLowerCase()}`;
    case "department-edit-permissions-changed":
      return "Department edit permissions changed";
    case "master-pipeline-changed":
      return "Master recruitment stages changed";
  }
  if (metadata?.scope === "department-config") return `Configuration saved${of}`;
  return `${action.toLowerCase()}${of}`;
}

/**
 * The real audit trail of one master drive and its department drives, newest
 * first: creation, assignment, configuration saves, publishing, status changes,
 * cancellation, deadline extensions and recruitment-stage requests.
 *
 * Read from `AuditLog`, so it shows what was recorded when it was recorded —
 * never a story reconstructed from current statuses.
 *
 * Authorization: SUPER_ADMIN only, central drives only.
 */
export async function getDriveActivity(driveId: string): Promise<DriveActivityItem[]> {
  await requireSuperAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: String(driveId) },
    select: { id: true, isCentralDrive: true },
  });
  if (!drive || !isCentralDrive(drive)) return [];

  // The drive's own rows, plus pipeline rows that name it in their metadata
  // (their entity is the pipeline version or the request, not the drive).
  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: AuditEntityType.DRIVE, entityId: drive.id },
        {
          entityType: {
            in: [AuditEntityType.RECRUITMENT_PIPELINE, AuditEntityType.PIPELINE_CHANGE_REQUEST],
          },
          metadata: { contains: `"driveId":"${drive.id}"` },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    include: { user: { select: { email: true } } },
  });

  return rows.map((row) => {
    let metadata: Record<string, unknown> | null = null;
    try {
      metadata = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null;
    } catch {
      metadata = null;
    }
    return {
      id: row.id,
      action: row.action,
      summary: summarize(row.action, row.entityType, metadata),
      actorEmail: row.user.email,
      createdAt: row.createdAt,
    };
  });
}
