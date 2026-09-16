"use server";

import { requireAuth } from "@/lib/auth";
import { getUnreadSummary } from "../queries/get-unread-summary";

export type UnreadSummaryResult =
  | { success: true; count: number; hasCritical: boolean }
  | { success: false; count: 0; hasCritical: false };

/**
 * Unread count and urgency for the notification bell.
 *
 * Returns a zeroed result rather than throwing — the bell is chrome, and a
 * failed count should never break the page it sits on.
 */
export async function getUnreadSummaryAction(): Promise<UnreadSummaryResult> {
  try {
    const user = await requireAuth();
    const summary = await getUnreadSummary(user.id);

    return { success: true, ...summary };
  } catch (error) {
    console.error("Failed to fetch unread summary:", error);
    return { success: false, count: 0, hasCritical: false };
  }
}
