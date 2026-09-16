import type { Notification } from "@prisma/client";

/**
 * Notification priority and routing.
 *
 * Priority is DERIVED, never stored — the same approach `getDriveStatus()`
 * takes with open/closed and `placement-status.ts` takes with placement. A
 * stored `priority` column would have to be set correctly at every
 * `createNotification` call site, and the first caller that forgot would
 * silently produce a mis-ranked notification. Deriving it here means one
 * place decides and no caller can drift.
 *
 * The tiers reuse the semantic colour scale already defined in
 * `ui-context.md` rather than inventing notification-specific colours.
 */

/** Ordered most urgent first — the index doubles as the sort rank. */
export const PRIORITY_ORDER = [
  "critical",
  "attention",
  "info",
  "confirmation",
] as const;

export type NotificationPriority = (typeof PRIORITY_ORDER)[number];

/**
 * Resource kinds a notification can point at. Stored in
 * `Notification.resourceType`, which is a free-form string in the schema, so
 * unknown values must always be tolerated.
 */
export const RESOURCE_DRIVE = "Drive";
export const RESOURCE_APPLICATION = "Application";
export const RESOURCE_PROFILE = "Profile";
export const RESOURCE_ANNOUNCEMENT = "ANNOUNCEMENT";

/** Presentation for each tier. Colours map to the tokens in `ui-context.md`. */
export const PRIORITY_PRESENTATION: Record<
  NotificationPriority,
  { badgeClass: string; label: string; rank: number }
> = {
  critical: { badgeClass: "badge-red", label: "Action required", rank: 0 },
  attention: { badgeClass: "badge-amber", label: "Update", rank: 1 },
  info: { badgeClass: "badge-purple", label: "Info", rank: 2 },
  confirmation: { badgeClass: "badge-green", label: "Confirmed", rank: 3 },
};

/**
 * The minimum shape needed to rank a notification. Accepting a structural
 * type rather than the full Prisma row keeps this testable without
 * constructing a complete `Notification`.
 */
export interface RankableNotification {
  type: string;
  title: string;
  resourceType: string | null;
}

/**
 * An outcome notification is one where the application is now closed — the
 * student either has an offer or has been rejected. These are the two events
 * a student would be most upset to discover late, so they outrank everything.
 *
 * Matched on title because `update-application-stage.ts` encodes the outcome
 * there; `STATUS_LABELS` in `application-progress.ts` produces "Selected" and
 * "Rejected", and the stage labels produce "Offer".
 */
function isOutcome(title: string): boolean {
  return /\b(selected|rejected|offer)\b/i.test(title);
}

/**
 * Rank a notification into a priority tier.
 *
 * Pure, so the rule is unit-testable without a database, per the testing
 * standard in `code-standards.md`.
 */
export function getNotificationPriority(
  notification: RankableNotification
): NotificationPriority {
  const { type, title, resourceType } = notification;

  // A closed outcome on an application always wins.
  if (type === "APPLICATION" && isOutcome(title)) {
    return "critical";
  }

  // A profile gap blocks the student from applying at all.
  if (type === "PROFILE" || resourceType === RESOURCE_PROFILE) {
    return "critical";
  }

  // Stage moved but the application is still open — worth knowing today.
  if (type === "APPLICATION" && resourceType === RESOURCE_DRIVE) {
    return "attention";
  }

  // "Your application was submitted" — pure acknowledgement, nothing to do.
  if (type === "APPLICATION") {
    return "confirmation";
  }

  // A new drive, or a department announcement.
  if (type === "DRIVE" || type === "ADMIN" || type === "SYSTEM") {
    return "info";
  }

  return "info";
}

/** Sort rank; lower sorts first. */
export function priorityRank(notification: RankableNotification): number {
  return PRIORITY_PRESENTATION[getNotificationPriority(notification)].rank;
}

/**
 * Order notifications for a triage surface: unread before read, then by
 * priority, then newest first.
 *
 * The dashboard widget shows only a handful of rows, so a strict reverse
 * chronological sort can push an offer below three announcements. Read items
 * sink because the student has already dealt with them.
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
 * Where clicking a notification should take the student.
 *
 * Returns null when there is nothing meaningful to open, so the caller can
 * render a non-clickable row rather than a link to nowhere. A notification
 * the student cannot act on teaches them to ignore the panel.
 */
export function getNotificationHref(
  notification: Pick<Notification, "resourceType" | "resourceId" | "type">
): string | null {
  const { resourceType, resourceId } = notification;

  if (!resourceId) return null;

  switch (resourceType) {
    case RESOURCE_DRIVE:
      return `/student-dashboard/drives/${resourceId}`;
    case RESOURCE_APPLICATION:
      return "/student-dashboard/applications";
    case RESOURCE_PROFILE:
      return "/student-dashboard/profile";
    // An announcement's resourceId is the department, which has no
    // student-facing page — the notification text is the whole message.
    case RESOURCE_ANNOUNCEMENT:
      return null;
    default:
      return null;
  }
}

/** Human label for the row, replacing the raw enum string. */
export function getNotificationTypeLabel(
  notification: RankableNotification
): string {
  const { type, title, resourceType } = notification;

  if (type === "APPLICATION" && isOutcome(title)) return "Outcome";
  if (type === "APPLICATION" && resourceType === RESOURCE_DRIVE)
    return "Application update";
  if (type === "APPLICATION") return "Submitted";
  if (type === "DRIVE") return "New drive";
  if (type === "ADMIN") return "Announcement";
  if (type === "PROFILE") return "Profile";
  return "System";
}
