import type { Notification, NotificationCategory, NotificationPriority } from "@prisma/client";
import {
  ATTENTION_PRIORITIES,
  CATEGORY_LABELS,
  NOTIFICATION_EVENTS,
  PRIORITY_ORDER,
  safeActionUrl,
} from "../domain/events";

/**
 * How a notification is presented.
 *
 * Priority and category are stored, set from the event registry when the
 * notification is written, so a caller cannot produce a mis-ranked
 * notification and every screen ranks the same way. This module only maps
 * those values to colours, labels and order.
 */

export type { NotificationPriority };

/** Presentation per tier. Colours are the semantic tokens in `ui-context.md`. */
export const PRIORITY_PRESENTATION: Record<
  NotificationPriority,
  { badgeClass: string; label: string; rank: number }
> = {
  URGENT: { badgeClass: "badge-red", label: "Urgent", rank: 0 },
  ACTION_REQUIRED: { badgeClass: "badge-accent", label: "Action required", rank: 1 },
  WARNING: { badgeClass: "badge-amber", label: "Important", rank: 2 },
  INFO: { badgeClass: "badge-purple", label: "Info", rank: 3 },
  SUCCESS: { badgeClass: "badge-green", label: "Good news", rank: 4 },
};

/** The minimum shape needed to rank and label a notification. */
export interface RankableNotification {
  category: NotificationCategory;
  priority: NotificationPriority;
  event: Notification["event"];
}

export function getNotificationPriority(notification: RankableNotification): NotificationPriority {
  return notification.priority;
}

/** Whether an unread notification belongs in "Needs your attention". */
export function needsAttention(notification: RankableNotification & { isRead: boolean }): boolean {
  return !notification.isRead && ATTENTION_PRIORITIES.includes(notification.priority);
}

/** Sort rank; lower sorts first. */
export function priorityRank(notification: RankableNotification): number {
  return PRIORITY_PRESENTATION[notification.priority].rank;
}

/**
 * Order notifications for a triage surface: unread before read, then by
 * priority, then newest first. A dashboard widget shows a handful of rows,
 * and an offer must not sit below three announcements.
 */
export function sortByPriority<
  T extends RankableNotification & { isRead: boolean; createdAt: Date },
>(notifications: T[]): T[] {
  return [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;

    const rankDiff = priorityRank(a) - priorityRank(b);
    if (rankDiff !== 0) return rankDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Where clicking a notification goes: the link its producer built for this
 * recipient's role, and only if it is an in-app path. Returns null when
 * there is nothing to open, so the row renders as text rather than as a link
 * to nowhere.
 */
export function getNotificationHref(
  notification: Pick<Notification, "actionUrl">
): string | null {
  return safeActionUrl(notification.actionUrl);
}

/** Short label for the row: what happened, not the raw enum. */
export function getNotificationTypeLabel(notification: RankableNotification): string {
  if (notification.event) return NOTIFICATION_EVENTS[notification.event].label;
  return CATEGORY_LABELS[notification.category];
}

export { PRIORITY_ORDER, CATEGORY_LABELS };
