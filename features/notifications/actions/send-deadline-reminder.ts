"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { AuditAction, AuditEntityType, createAuditLog } from "@/lib/audit";
import { deliverNotification } from "@/lib/notifications";
import { runNotificationDispatch } from "../domain/dispatch";
import {
  applicantRecipients,
  loadDriveForAudience,
  resolveDriveAudience,
} from "../domain/drive-recipients";
import { startOfIndianDay } from "../domain/application-event";
import { isDriveOpen } from "@/features/drives/utils/drive-status";

/**
 * Remind the students who can still apply.
 *
 * This is the existing notification machinery, not a second reminder system:
 * the same audience (`resolveDriveAudience` — the evaluator, this
 * department's batch rules, placement exclusion), the same event
 * (`DRIVE_DEADLINE`) and the same per-student key the automatic "closing soon"
 * reminder uses, so a student who was already reminded automatically is not
 * reminded twice. It runs as a keyed fan-out, so it is recorded, retried on
 * failure and — by its daily key — sent at most once a day per drive.
 *
 * Only for a drive that is published in the caller's department, still open,
 * and not cancelled. Students who have already applied are never reminded.
 *
 * Authorization: DEPT_ADMIN (live authorization); the department comes from
 * the session.
 */

export type ReminderResult =
  | { success: true; notified: number; message: string }
  | { success: false; error: string };

/** The fan-out itself, also what a retry runs. */
export async function fanOutDeadlineReminder(
  payload: { driveId: string; departmentId: string },
  dispatchId: string
): Promise<number> {
  const drive = await loadDriveForAudience(payload.driveId);
  if (!drive) return 0;

  const audience = await resolveDriveAudience(drive, [payload.departmentId]);
  const resolved = audience.resolvedByDepartment.get(payload.departmentId);
  // Only a drive taking applications now: not one that has closed or not opened.
  if (!resolved || !isDriveOpen(resolved)) return 0;

  const applied = new Set(
    (await applicantRecipients(payload.driveId, [payload.departmentId])).map((row) => row.userId)
  );
  const recipients = audience.eligible
    .filter((student) => !applied.has(student.userId))
    .map((student) => ({ userId: student.userId }));

  const deadline = resolved.applicationDeadline;
  const when = deadline.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const result = await deliverNotification(prisma, {
    event: "DRIVE_DEADLINE",
    role: "STUDENT",
    recipients,
    content: {
      title: `Reminder — ${drive.companyName}`,
      message: `Applications for ${resolved.roleName} close on ${when}. You have not applied yet.`,
      actionUrl: `/student-dashboard/drives/${drive.id}`,
    },
    // The same key the automatic reminder uses: one reminder per student per
    // deadline, however it was triggered.
    dedupeKey: `deadline-reminder:${drive.id}:${deadline.toISOString()}`,
    resourceType: "Drive",
    resourceId: drive.id,
    expiresAt: deadline,
    dispatchId,
  });
  return result.delivered;
}

export async function sendDeadlineReminder(input: { driveId: string }): Promise<ReminderResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();
    const driveId = String(input.driveId ?? "");

    const instance = await prisma.driveDepartmentConfig.findUnique({
      where: { driveId_departmentId: { driveId, departmentId: department.id } },
      select: {
        status: true,
        applicationDeadline: true,
        drive: { select: { companyName: true, lifecycleStatus: true, applicationDeadline: true } },
      },
    });
    // Not found and not yours read the same.
    if (!instance) return { success: false, error: "Drive not found in your department." };
    if (instance.status !== "PUBLISHED" || instance.drive.lifecycleStatus === "CANCELLED") {
      return { success: false, error: "Only a published drive can be reminded about." };
    }
    const deadline = instance.applicationDeadline ?? instance.drive.applicationDeadline;
    if (deadline <= new Date()) {
      return { success: false, error: "Applications for this drive have closed." };
    }

    const { key } = startOfIndianDay();
    const outcome = await runNotificationDispatch(
      {
        key: `deadline-nudge:${driveId}:${department.id}:${key}`,
        event: "DRIVE_DEADLINE",
        payload: { kind: "reminder", driveId, departmentId: department.id },
        departmentId: department.id,
        triggeredById: user.id,
      },
      ({ dispatchId }) => fanOutDeadlineReminder({ driveId, departmentId: department.id }, dispatchId)
    );

    if (outcome.status === "SKIPPED") {
      return {
        success: false,
        error: "A reminder for this drive already went out today. Try again tomorrow.",
      };
    }
    if (outcome.status === "FAILED") {
      return { success: false, error: "The reminder could not be sent. The Super Admin can re-send it." };
    }

    await createAuditLog({
      action: AuditAction.REMIND,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        event: "deadline-reminder",
        companyName: instance.drive.companyName,
        departmentCode: department.code,
        notified: outcome.delivered,
      },
    });

    revalidatePath(`/admin-dashboard/drives/${driveId}`);
    return {
      success: true,
      notified: outcome.delivered,
      message:
        outcome.delivered > 0
          ? `Reminded ${outcome.delivered} eligible student${outcome.delivered === 1 ? "" : "s"} who have not applied.`
          : "Everyone who can apply has already applied or been reminded.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("sendDeadlineReminder error:", error);
    return { success: false, error: "Could not send the reminder. Please try again." };
  }
}
