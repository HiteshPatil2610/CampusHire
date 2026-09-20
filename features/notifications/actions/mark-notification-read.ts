"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { markNotificationReadSchema } from "../schemas/notification";

export type MarkNotificationReadResult = { success: true } | { success: false; error: string };

/**
 * Mark one notification read, or unread again.
 *
 * Authorization: the signed-in user, and only their own notifications — the
 * update is scoped by userId, so another user's id simply matches nothing
 * and reads as "not found".
 */
export async function markNotificationRead(
  notificationId: string,
  read = true
): Promise<MarkNotificationReadResult> {
  try {
    const validated = markNotificationReadSchema.safeParse({ notificationId, read });
    if (!validated.success) {
      return { success: false, error: "Invalid notification ID" };
    }

    let user;
    try {
      user = await requireAuth();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }

    const updated = await prisma.notification.updateMany({
      where: { id: validated.data.notificationId, userId: user.id },
      data: validated.data.read
        ? { isRead: true, readAt: new Date() }
        : { isRead: false, readAt: null },
    });

    if (updated.count === 0) {
      return { success: false, error: "Notification not found" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
