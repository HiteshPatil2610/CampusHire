"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";
import { AuditEntityType } from "@/lib/audit";

export interface OperationsActivityItem {
  id: string;
  kind: "APPLICATION" | "STAGE" | "PLACEMENT" | "DRIVE";
  summary: string;
  actor: string;
  createdAt: Date;
}

const MAX_ITEMS = 100;
/** Ids passed to one `IN` — enough for a department's applicants to one drive. */
const MAX_IDS = 2000;

const parse = (raw: string | null): Record<string, unknown> | null => {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * What has happened on a department's drive, newest first, from the audit log:
 * applications submitted, stage moves (single and bulk), placements made and
 * revoked, and the drive's own events for this department (published,
 * configured, cancelled, deadline extended).
 *
 * The audit log is the source, so this shows what was recorded when — never a
 * story rebuilt from current state. Every row is scoped to this department:
 * application and placement rows are found through this department's own
 * applications and placements, and drive rows through its department code, so
 * another department's activity on the same master drive never appears.
 *
 * Authorization: DEPT_ADMIN; the department comes from the session.
 */
export async function getDriveOperationsActivity(
  driveId: string
): Promise<OperationsActivityItem[]> {
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: String(driveId) },
    select: {
      id: true,
      departmentId: true,
      isCentralDrive: true,
      eligibleDepartmentLinks: { where: { departmentId: department.id }, select: { departmentId: true } },
    },
  });
  const runs =
    drive &&
    (drive.departmentId === department.id ||
      (drive.isCentralDrive && drive.eligibleDepartmentLinks.length > 0));
  if (!drive || !runs) throw new AuthorizationError("Drive not found");

  const [applications, placements] = await Promise.all([
    prisma.driveApplication.findMany({
      where: { driveId: drive.id, student: { departmentId: department.id } },
      select: { id: true, student: { select: { name: true } } },
      take: MAX_IDS,
    }),
    prisma.studentPlacement.findMany({
      where: { driveId: drive.id, student: { departmentId: department.id } },
      select: { id: true, student: { select: { name: true } } },
      take: MAX_IDS,
    }),
  ]);
  const applicantName = new Map(applications.map((row) => [row.id, row.student.name]));
  const placedName = new Map(placements.map((row) => [row.id, row.student.name]));

  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        {
          entityType: AuditEntityType.DRIVE,
          entityId: drive.id,
          metadata: { contains: `"departmentCode":"${department.code}"` },
        },
        { entityType: AuditEntityType.DRIVE_APPLICATION, entityId: { in: [...applicantName.keys()] } },
        { entityType: AuditEntityType.STUDENT_PLACEMENT, entityId: { in: [...placedName.keys()] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    include: { user: { select: { email: true } } },
  });

  return rows.map((row): OperationsActivityItem => {
    const metadata = parse(row.metadata);
    const base = { id: row.id, actor: row.user.email, createdAt: row.createdAt };

    if (row.entityType === AuditEntityType.DRIVE_APPLICATION) {
      const student = applicantName.get(row.entityId ?? "") ?? "A student";
      if (row.action === "APPLY") {
        return { ...base, kind: "APPLICATION", summary: `${student} applied` };
      }
      if (row.action === "TRANSITION") {
        const to = String(metadata?.toStageName ?? "a new stage");
        const status = metadata?.toStatus;
        return {
          ...base,
          kind: "STAGE",
          summary:
            status === "SELECTED"
              ? `${student} selected`
              : status === "REJECTED"
                ? `${student} rejected at ${to}`
                : `${student} moved to ${to}`,
        };
      }
      return { ...base, kind: "APPLICATION", summary: `${student}: ${row.action.toLowerCase()}` };
    }

    if (row.entityType === AuditEntityType.STUDENT_PLACEMENT) {
      const student = placedName.get(row.entityId ?? "") ?? "A student";
      return {
        ...base,
        kind: "PLACEMENT",
        summary:
          row.action === "REVOKE"
            ? `${student}'s placement revoked${metadata?.reason ? ` — ${String(metadata.reason)}` : ""}`
            : `${student} placed`,
      };
    }

    // The drive's own rows, this department's.
    const event = typeof metadata?.event === "string" ? metadata.event : null;
    let summary: string;
    if (event === "bulk-stage-move") {
      summary = `Bulk move to ${String(metadata?.toStage ?? "a stage")}: ${String(metadata?.moved ?? 0)} moved, ${String(metadata?.failed ?? 0)} failed`;
    } else if (event === "department-drive-published") {
      summary = "Published to students";
    } else if (event === "department-drive-status-changed") {
      summary = `Drive ${String(metadata?.toStatus ?? "updated").toLowerCase()}`;
    } else if (row.action === "CANCEL") {
      summary = `Drive cancelled${metadata?.reason ? ` — ${String(metadata.reason)}` : ""}`;
    } else if (row.action === "EXTEND_DEADLINE") {
      summary = "Application deadline extended";
    } else if (metadata?.scope === "department-config") {
      summary = "Configuration saved";
    } else {
      summary = row.action.toLowerCase();
    }
    return { ...base, kind: "DRIVE", summary };
  });
}
