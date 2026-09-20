"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { runNotificationDispatch } from "../domain/dispatch";
import { DISPATCH_RETRIES } from "../domain/dispatch-registry";

export type RetryDispatchResult =
  | { success: true; delivered: number; message: string }
  | { success: false; error: string };

/**
 * Run a failed fan-out again.
 *
 * The dispatch keeps only ids, so everything — the drive, the departments,
 * who is eligible — is resolved again now. People who were already notified
 * are skipped by their dedupe key, so a retry only fills the gaps.
 *
 * Authorization: SUPER_ADMIN. This is the one place a notification can be
 * sent without the underlying event happening again, so it stays with the
 * placement office.
 */
export async function retryNotificationDispatch(input: {
  dispatchId: string;
}): Promise<RetryDispatchResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const dispatch = await prisma.notificationDispatch.findUnique({
      where: { id: String(input.dispatchId) },
    });
    if (!dispatch) return { success: false, error: "Delivery not found." };
    if (dispatch.status === "SENT") {
      return { success: false, error: "This delivery already succeeded." };
    }

    const retry = DISPATCH_RETRIES[dispatch.event];
    if (!retry) {
      return {
        success: false,
        error: "This kind of notification cannot be re-sent automatically.",
      };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(dispatch.payload) as Record<string, unknown>;
    } catch {
      return { success: false, error: "This delivery's record is unreadable and cannot be re-sent." };
    }

    const outcome = await runNotificationDispatch(
      {
        key: dispatch.key,
        event: dispatch.event,
        payload,
        departmentId: dispatch.departmentId,
        triggeredById: superAdmin.id,
      },
      ({ dispatchId }) => retry(payload, dispatchId)
    );

    revalidatePath("/super-admin-dashboard/notification-deliveries");

    if (outcome.status === "SENT") {
      return {
        success: true,
        delivered: outcome.delivered,
        message:
          outcome.delivered > 0
            ? `Sent. ${outcome.delivered} notification${outcome.delivered === 1 ? "" : "s"} were written.`
            : "Sent. Everyone had already been notified.",
      };
    }
    if (outcome.status === "SKIPPED") {
      return { success: false, error: "This delivery is already running. Try again in a few minutes." };
    }
    return { success: false, error: "It failed again. The error is on the delivery record." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("retryNotificationDispatch error:", error);
    return { success: false, error: "Failed to re-send. Please try again." };
  }
}
