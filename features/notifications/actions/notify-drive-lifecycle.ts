import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications";
import { runNotificationDispatch } from "../domain/dispatch";
import {
  applicantRecipients,
  loadDriveForAudience,
  resolveDriveAudience,
} from "../domain/drive-recipients";

/**
 * Notifications for changes to drives students already know about: a
 * cancellation, a deadline extension, an edit to a live drive.
 *
 * Each is a fan-out with a key, so the same change never notifies twice, and
 * recipients are always resolved here, from the database. Failures are
 * recorded on the dispatch and never fail the change itself.
 */

const formatWhen = (date: Date) =>
  date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/**
 * Tell everyone affected that a drive was cancelled in these departments: the
 * students who applied (their application is kept, but the drive will not
 * happen), and — when the Super Admin cancelled it — those departments'
 * admins, who did not make the decision.
 */
export async function notifyDriveCancelled(params: {
  driveId: string;
  departmentIds: string[];
  companyName: string;
  reason: string;
  notifyDepartmentAdmins: boolean;
  actorId?: string;
}): Promise<{ notified: number }> {
  if (params.departmentIds.length === 0) return { notified: 0 };
  const departmentIds = [...new Set(params.departmentIds)].sort();
  const payload = {
    driveId: params.driveId,
    departmentIds,
    companyName: params.companyName,
    reason: params.reason,
    notifyDepartmentAdmins: params.notifyDepartmentAdmins,
  };

  const outcome = await runNotificationDispatch(
    {
      key: `drive-cancelled:${params.driveId}:${departmentIds.join(",")}`,
      event: "DRIVE_CANCELLED",
      payload,
      departmentId: departmentIds.length === 1 ? departmentIds[0] : null,
      triggeredById: params.actorId ?? null,
    },
    ({ dispatchId }) => fanOutDriveCancelled(payload, dispatchId)
  );
  return { notified: outcome.delivered };
}

export async function fanOutDriveCancelled(
  payload: {
    driveId: string;
    departmentIds: string[];
    companyName: string;
    reason: string;
    notifyDepartmentAdmins: boolean;
  },
  dispatchId: string
): Promise<number> {
  const dedupeKey = `drive-cancelled:${payload.driveId}`;
  const applicants = await applicantRecipients(payload.driveId, payload.departmentIds);

  const students = await deliverNotification(prisma, {
    event: "DRIVE_CANCELLED",
    role: "STUDENT",
    recipients: applicants.map((row) => ({ userId: row.userId })),
    content: {
      title: "Drive cancelled",
      message: `The ${payload.companyName} drive has been cancelled. Your application is kept on record. Reason: ${payload.reason}`,
      actionUrl: "/student-dashboard/applications",
    },
    dedupeKey,
    resourceType: "Drive",
    resourceId: payload.driveId,
    dispatchId,
  });

  let admins = { delivered: 0 };
  if (payload.notifyDepartmentAdmins) {
    const rows = await prisma.departmentAdmin.findMany({
      where: { departmentId: { in: payload.departmentIds }, status: "ACTIVE" },
      select: { userId: true },
    });
    admins = await deliverNotification(prisma, {
      event: "DRIVE_CANCELLED",
      role: "DEPT_ADMIN",
      recipients: rows,
      content: {
        title: "Drive cancelled by the Super Admin",
        message: `The ${payload.companyName} drive was cancelled for your department. Reason: ${payload.reason}`,
        actionUrl: `/admin-dashboard/drives/${payload.driveId}`,
      },
      dedupeKey,
      resourceType: "Drive",
      resourceId: payload.driveId,
      dispatchId,
    });
  }

  return students.delivered + admins.delivered;
}

/**
 * Tell one department that a drive's deadline moved later: its students who
 * applied, the students the drive is now open to (the same evaluator as the
 * publish announcement, against the extended deadline — the caller has
 * already saved it), and its admins, who did not make the change.
 */
export async function notifyDeadlineExtended(params: {
  driveId: string;
  companyName: string;
  roleName: string;
  newDeadline: Date;
  departmentId: string;
  actorId?: string;
}): Promise<{ notified: number }> {
  const payload = {
    driveId: params.driveId,
    companyName: params.companyName,
    roleName: params.roleName,
    newDeadline: params.newDeadline.toISOString(),
    departmentId: params.departmentId,
  };
  const outcome = await runNotificationDispatch(
    {
      key: `deadline-extended:${params.driveId}:${params.departmentId}:${payload.newDeadline}`,
      event: "DRIVE_DEADLINE",
      payload,
      departmentId: params.departmentId,
      triggeredById: params.actorId ?? null,
    },
    ({ dispatchId }) => fanOutDeadlineExtended(payload, dispatchId)
  );
  return { notified: outcome.delivered };
}

export async function fanOutDeadlineExtended(
  payload: { driveId: string; companyName: string; roleName: string; newDeadline: string; departmentId: string },
  dispatchId: string
): Promise<number> {
  const newDeadline = new Date(payload.newDeadline);
  const dedupeKey = `deadline-extended:${payload.driveId}:${payload.newDeadline}`;

  const drive = await loadDriveForAudience(payload.driveId);
  const [applicants, audience] = await Promise.all([
    applicantRecipients(payload.driveId, [payload.departmentId]),
    drive ? resolveDriveAudience(drive, [payload.departmentId]) : null,
  ]);
  const recipients = [
    ...applicants.map((row) => ({ userId: row.userId })),
    ...(audience?.eligible ?? []).map((row) => ({ userId: row.userId })),
  ];

  const students = await deliverNotification(prisma, {
    event: "DRIVE_DEADLINE",
    role: "STUDENT",
    recipients,
    content: {
      title: "Deadline extended",
      message: `Applications for ${payload.companyName} — ${payload.roleName} now close on ${formatWhen(newDeadline)}.`,
      actionUrl: `/student-dashboard/drives/${payload.driveId}`,
    },
    dedupeKey,
    resourceType: "Drive",
    resourceId: payload.driveId,
    expiresAt: newDeadline,
    dispatchId,
  });

  const adminRows = await prisma.departmentAdmin.findMany({
    where: { departmentId: payload.departmentId, status: "ACTIVE" },
    select: { userId: true },
  });
  const admins = await deliverNotification(prisma, {
    event: "ADMIN_DRIVE_DEADLINE",
    role: "DEPT_ADMIN",
    recipients: adminRows,
    content: {
      title: "Deadline extended by the Super Admin",
      message: `${payload.companyName} — ${payload.roleName} now closes on ${formatWhen(newDeadline)}.`,
      actionUrl: `/admin-dashboard/drives/${payload.driveId}`,
    },
    dedupeKey,
    resourceType: "Drive",
    resourceId: payload.driveId,
    dispatchId,
  });

  return students.delivered + admins.delivered;
}

/**
 * Tell the students of the departments where a drive is live that its details
 * changed: those who applied, and those it is open to. The same change (same
 * summary, same day) notifies once, however often it is saved.
 */
export async function notifyDriveUpdated(params: {
  driveId: string;
  summary: string;
  departmentIds?: string[];
  actorId?: string;
}): Promise<{ notified: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha256").update(params.summary).digest("hex").slice(0, 12);
  const departmentIds = params.departmentIds ? [...new Set(params.departmentIds)].sort() : null;
  const payload = { driveId: params.driveId, summary: params.summary, departmentIds, day, hash };

  const outcome = await runNotificationDispatch(
    {
      key: `drive-updated:${params.driveId}:${day}:${hash}`,
      event: "DRIVE_UPDATED",
      payload,
      triggeredById: params.actorId ?? null,
    },
    ({ dispatchId }) => fanOutDriveUpdated(payload, dispatchId)
  );
  return { notified: outcome.delivered };
}

export async function fanOutDriveUpdated(
  payload: { driveId: string; summary: string; departmentIds: string[] | null; day: string; hash: string },
  dispatchId: string
): Promise<number> {
  const drive = await loadDriveForAudience(payload.driveId);
  if (!drive) return 0;

  const audience = await resolveDriveAudience(drive, payload.departmentIds ?? undefined);
  const liveDepartments = [...audience.resolvedByDepartment.keys()];
  if (liveDepartments.length === 0) return 0;

  const applicants = await applicantRecipients(payload.driveId, liveDepartments);
  const result = await deliverNotification(prisma, {
    event: "DRIVE_UPDATED",
    role: "STUDENT",
    recipients: [
      ...applicants.map((row) => ({ userId: row.userId })),
      ...audience.eligible.map((row) => ({ userId: row.userId })),
    ],
    content: {
      title: `${drive.companyName} — drive updated`,
      message: payload.summary,
      actionUrl: `/student-dashboard/drives/${payload.driveId}`,
    },
    dedupeKey: `drive-updated:${payload.driveId}:${payload.day}:${payload.hash}`,
    resourceType: "Drive",
    resourceId: payload.driveId,
    dispatchId,
  });
  return result.delivered;
}
