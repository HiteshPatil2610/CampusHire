import { z } from "zod";

/**
 * Schema for querying notifications with pagination and filters
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
   * Category filter, applied in the database. Previously the page fetched a
   * chronological page and filtered it in the client, so "Drives" could show
   * three rows out of a 25-row page while more matches sat on page two.
   */
  category: z.enum(["all", "drives", "system"]).default("all"),
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;

/**
 * Schema for marking a notification as read
 */
export const markNotificationReadSchema = z.object({
  notificationId: z.string().cuid("Invalid notification ID"),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
