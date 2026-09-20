"use server";

import { requireAuth } from "@/lib/auth";
import { getUnreadSummary } from "../queries/get-unread-summary";
import { releaseDueAnnouncements } from "@/features/announcements/domain/release-due";
import { recordDepartmentAdminFirstSeen } from "../producers/workflow-events";

export type UnreadSummaryResult =
  | { success: true; count: number; hasCritical: boolean }
  | { success: false; count: 0; hasCritical: false };

/**
 * Unread count and urgency for the notification bell.
 *
 * The bell is on every page, so this is also where the two cheapest
 * time-based jobs run: releasing a scheduled announcement whose time has
 * come, and recording a new admin's first sign-in. Both are single indexed
 * queries when there is nothing to do, and both are keyed so they happen
 * once however many people load a page. The heavier deadline reminders run
 * when the notification centre itself is opened.
 *
 * Returns a zeroed result rather than throwing — the bell is chrome, and a
 * failed count should never break the page it sits on.
 */
export async function getUnreadSummaryAction(): Promise<UnreadSummaryResult> {
  try {
    const user = await requireAuth();

    try {
      await releaseDueAnnouncements();
      if (user.role === "DEPT_ADMIN") await recordDepartmentAdminFirstSeen(user.id);
    } catch (error) {
      console.error("due notification work failed:", error);
    }

    const summary = await getUnreadSummary(user.id);
    return { success: true, ...summary };
  } catch (error) {
    console.error("Failed to fetch unread summary:", error);
    return { success: false, count: 0, hasCritical: false };
  }
}
