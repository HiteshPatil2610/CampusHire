import { Prisma, type NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely, superAdminRecipients } from "@/lib/notifications";
import { eventDefinition } from "./events";

/**
 * Fan-outs: one event that notifies many people.
 *
 * Each fan-out has a key (for example `drive-published:<drive>:<department>`)
 * and a `NotificationDispatch` row under it, which is both its idempotency
 * record and its delivery record:
 *
 * - The first run creates the row and runs. A second run with the same key —
 *   a repeated publish, a retried request — finds the row and does nothing.
 * - A run that throws is marked FAILED with the error, audited, and the Super
 *   Admins are alerted. It can be retried (`retryNotificationDispatch`); the
 *   per-recipient dedupe keys mean the retry writes only what is missing.
 * - A run left PENDING/RETRYING for longer than `STALE_AFTER_MS` (the process
 *   died mid-run) may be claimed again.
 *
 * Claims are compare-and-set on (status, updatedAt), so two concurrent
 * attempts cannot both run.
 *
 * In-app notifications are the only channel. SENT means the rows were
 * written — nothing is emailed, and nothing here says it was.
 */

export interface DispatchSpec {
  key: string;
  event: NotificationEvent;
  /** Ids only: what a retry needs to resolve everything again. */
  payload: Record<string, unknown>;
  departmentId?: string | null;
  triggeredById?: string | null;
}

export type DispatchRun = (context: { dispatchId: string }) => Promise<number>;

export interface DispatchOutcome {
  status: "SENT" | "FAILED" | "SKIPPED";
  /** Notifications written by this run. */
  delivered: number;
  dispatchId: string | null;
}

export const STALE_AFTER_MS = 10 * 60 * 1000;

export async function runNotificationDispatch(
  spec: DispatchSpec,
  run: DispatchRun
): Promise<DispatchOutcome> {
  let claimed: { id: string; attempts: number } | null = null;

  try {
    claimed = await prisma.notificationDispatch.create({
      data: {
        key: spec.key,
        event: spec.event,
        payload: JSON.stringify(spec.payload),
        departmentId: spec.departmentId ?? null,
        triggeredById: spec.triggeredById ?? null,
        status: "PENDING",
      },
      select: { id: true, attempts: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error(`notification dispatch ${spec.key}: could not record`, error);
      return { status: "FAILED", delivered: 0, dispatchId: null };
    }
    claimed = await claimExisting(spec.key);
    if (!claimed) return { status: "SKIPPED", delivered: 0, dispatchId: null };
  }

  return execute(claimed, spec, run);
}

/**
 * Take over an existing dispatch if it may run again: FAILED, or abandoned
 * mid-run. A SENT or in-progress dispatch is left alone.
 */
async function claimExisting(key: string): Promise<{ id: string; attempts: number } | null> {
  const existing = await prisma.notificationDispatch.findUnique({
    where: { key },
    select: { id: true, status: true, attempts: true, updatedAt: true },
  });
  if (!existing) return null;

  const abandoned =
    (existing.status === "PENDING" || existing.status === "RETRYING") &&
    Date.now() - existing.updatedAt.getTime() > STALE_AFTER_MS;
  if (existing.status !== "FAILED" && !abandoned) return null;

  const claim = await prisma.notificationDispatch.updateMany({
    where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
    data: { status: "RETRYING", attempts: { increment: 1 } },
  });
  if (claim.count === 0) return null;
  return { id: existing.id, attempts: existing.attempts + 1 };
}

async function execute(
  dispatch: { id: string; attempts: number },
  spec: DispatchSpec,
  run: DispatchRun
): Promise<DispatchOutcome> {
  const label = eventDefinition(spec.event).label;

  try {
    const delivered = await run({ dispatchId: dispatch.id });
    const recipientCount = await prisma.notification.count({ where: { dispatchId: dispatch.id } });

    await prisma.notificationDispatch.update({
      where: { id: dispatch.id },
      data: { status: "SENT", recipientCount, completedAt: new Date(), lastError: null },
    });

    if (spec.triggeredById) {
      await createAuditLogInTransaction(
        prisma,
        {
          action: dispatch.attempts > 1 ? AuditAction.RETRY : AuditAction.NOTIFY,
          entityType: AuditEntityType.NOTIFICATION_DISPATCH,
          entityId: dispatch.id,
          metadata: { key: spec.key, event: spec.event, delivered, recipientCount, attempt: dispatch.attempts },
        },
        spec.triggeredById
      ).catch((error) => console.error("dispatch audit failed:", error));
    }

    return { status: "SENT", delivered, dispatchId: dispatch.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`notification dispatch ${spec.key} failed:`, error);

    await prisma.notificationDispatch
      .update({
        where: { id: dispatch.id },
        data: { status: "FAILED", lastError: message.slice(0, 2000) },
      })
      .catch((updateError) => console.error("could not mark dispatch failed:", updateError));

    if (spec.triggeredById) {
      await createAuditLogInTransaction(
        prisma,
        {
          action: AuditAction.NOTIFY_FAILED,
          entityType: AuditEntityType.NOTIFICATION_DISPATCH,
          entityId: dispatch.id,
          metadata: { key: spec.key, event: spec.event, attempt: dispatch.attempts, error: message.slice(0, 500) },
        },
        spec.triggeredById
      ).catch((auditError) => console.error("dispatch audit failed:", auditError));
    }

    // Tell the people who can retry it. Delivered directly, not through a
    // dispatch, so an alert can never recurse into another alert.
    await deliverNotificationSafely({
      event: "SYSTEM_ALERT",
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients().catch(() => []),
      content: {
        title: "Notifications were not delivered",
        message: `"${label}" notifications (attempt ${dispatch.attempts}) failed: ${message.slice(0, 200)}. Retry them from Notification deliveries.`,
        actionUrl: "/super-admin-dashboard/notification-deliveries",
      },
      dedupeKey: `dispatch-failed:${dispatch.id}:${dispatch.attempts}`,
      resourceType: "NotificationDispatch",
      resourceId: dispatch.id,
    });

    return { status: "FAILED", delivered: 0, dispatchId: dispatch.id };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
