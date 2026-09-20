import { z } from "zod";

/** The notification centre's tabs, as they arrive in the URL. */
export const NOTIFICATION_FILTERS = [
  "all",
  "unread",
  "DRIVE",
  "APPLICATION",
  "RECRUITMENT",
  "ANNOUNCEMENT",
  "SYSTEM",
] as const;

export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

export function parseNotificationFilter(value: unknown): NotificationFilter {
  const candidate = String(value ?? "all").toUpperCase();
  if (candidate === "ALL") return "all";
  if (candidate === "UNREAD") return "unread";
  return (NOTIFICATION_FILTERS as readonly string[]).includes(candidate)
    ? (candidate as NotificationFilter)
    : "all";
}

/**
 * Schema for querying notifications with pagination and filters.
 */
export const getNotificationsSchema = z.object({
  page: z.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be 100 or less")
    .default(25),
  isRead: z.boolean().optional(),
  /**
   * Category filter, applied in the database so pagination counts match the
   * rows shown.
   */
  category: z
    .enum(["all", "DRIVE", "APPLICATION", "RECRUITMENT", "ANNOUNCEMENT", "SYSTEM"])
    .default("all"),
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;

/** Schema for marking a notification read or unread. */
export const markNotificationReadSchema = z.object({
  notificationId: z.string().cuid("Invalid notification ID"),
  read: z.boolean().default(true),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
