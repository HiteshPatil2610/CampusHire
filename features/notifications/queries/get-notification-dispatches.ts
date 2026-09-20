import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { canRetryDispatch } from "../domain/dispatch-registry";
import { eventDefinition } from "../domain/events";

/** Shown for a dispatch still in flight, or abandoned mid-run. */
const IN_FLIGHT_LABEL = "Still running. If it stays here for more than ten minutes it can be re-sent.";

export interface DispatchRow {
  id: string;
  key: string;
  event: string;
  eventLabel: string;
  status: string;
  attempts: number;
  recipientCount: number;
  lastError: string | null;
  departmentCode: string | null;
  triggeredBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
  canRetry: boolean;
  note: string | null;
}

/**
 * The delivery record of every notification fan-out, newest first.
 *
 * In-app notifications are the only channel CampusHire has, so "sent" means
 * the notification rows were written — no email is involved. A failed
 * delivery is what a Super Admin can act on, so those come with the error
 * and a retry.
 *
 * Authorization: SUPER_ADMIN only.
 */
export async function getNotificationDispatches(
  filters: { status?: string; limit?: number } = {}
): Promise<{ rows: DispatchRow[]; failed: number }> {
  await requireSuperAdmin();

  const status = ["PENDING", "SENT", "FAILED", "RETRYING"].includes(String(filters.status))
    ? (filters.status as "PENDING" | "SENT" | "FAILED" | "RETRYING")
    : undefined;
  const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  const [dispatches, failed, departments] = await Promise.all([
    prisma.notificationDispatch.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: "desc" },
      take,
      include: { triggeredBy: { select: { name: true, email: true } } },
    }),
    prisma.notificationDispatch.count({ where: { status: "FAILED" } }),
    prisma.department.findMany({ select: { id: true, code: true } }),
  ]);
  const codeById = new Map(departments.map((department) => [department.id, department.code]));

  return {
    failed,
    rows: dispatches.map((dispatch) => ({
      id: dispatch.id,
      key: dispatch.key,
      event: dispatch.event,
      eventLabel: eventDefinition(dispatch.event).label,
      status: dispatch.status,
      attempts: dispatch.attempts,
      recipientCount: dispatch.recipientCount,
      lastError: dispatch.lastError,
      departmentCode: dispatch.departmentId ? codeById.get(dispatch.departmentId) ?? null : null,
      triggeredBy: dispatch.triggeredBy
        ? dispatch.triggeredBy.name ?? dispatch.triggeredBy.email
        : null,
      createdAt: dispatch.createdAt,
      completedAt: dispatch.completedAt,
      updatedAt: dispatch.updatedAt,
      canRetry: dispatch.status !== "SENT" && canRetryDispatch(dispatch.event),
      note:
        dispatch.status === "SENT"
          ? null
          : dispatch.status === "FAILED"
            ? "Nobody may have been notified. Re-sending skips anyone who already was."
            : IN_FLIGHT_LABEL,
    })),
  };
}
