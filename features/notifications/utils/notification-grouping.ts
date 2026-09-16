import type { Notification } from "@prisma/client";
import { getNotificationPriority, sortByPriority } from "./notification-priority";

/**
 * Sectioning for the full notifications page.
 *
 * A single flat reverse-chronological list makes a student scroll past
 * yesterday's announcements to find out they have an offer. "Needs your
 * attention" is pulled out first regardless of age; everything else falls
 * into time buckets so older items stay reachable without dominating.
 */

export const SECTION_ORDER = [
  "attention",
  "today",
  "week",
  "older",
] as const;

export type NotificationSectionKey = (typeof SECTION_ORDER)[number];

export const SECTION_LABELS: Record<NotificationSectionKey, string> = {
  attention: "Needs your attention",
  today: "Today",
  week: "Earlier this week",
  older: "Older",
};

export interface NotificationSection {
  key: NotificationSectionKey;
  label: string;
  items: Notification[];
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Split notifications into display sections.
 *
 * `now` is injectable so the bucketing is testable without freezing the clock.
 * An unread critical/attention item is lifted into the attention section no
 * matter how old it is; once read, it drops back into its time bucket so the
 * section does not accumulate items the student already handled.
 */
export function groupNotifications(
  notifications: Notification[],
  now: Date = new Date()
): NotificationSection[] {
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const buckets: Record<NotificationSectionKey, Notification[]> = {
    attention: [],
    today: [],
    week: [],
    older: [],
  };

  for (const notification of notifications) {
    const priority = getNotificationPriority(notification);
    const needsAttention =
      !notification.isRead &&
      (priority === "critical" || priority === "attention");

    if (needsAttention) {
      buckets.attention.push(notification);
      continue;
    }

    const created = new Date(notification.createdAt);
    if (created >= todayStart) {
      buckets.today.push(notification);
    } else if (created >= weekStart) {
      buckets.week.push(notification);
    } else {
      buckets.older.push(notification);
    }
  }

  return SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    // The attention section is ranked by urgency; time buckets stay
    // chronological, which is what a reader expects inside "Today".
    items:
      key === "attention"
        ? sortByPriority(buckets[key])
        : buckets[key].slice().sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
  })).filter((section) => section.items.length > 0);
}
