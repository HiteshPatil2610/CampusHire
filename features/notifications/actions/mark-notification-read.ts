"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { markNotificationReadSchema } from "../schemas/notification";

/**
 * Result type for mark notification as read action
 */
export type MarkNotificationReadResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Mark a notification as read
 * 
 * Authorization:
 * - User must be authenticated
 * - User can only mark their own notifications as read
 * 
 * @param notificationId - Notification ID to mark as read
 * @returns Result with success or error
 */
export async function markNotificationRead(
  notificationId: string
): Promise<MarkNotificationReadResult> {
  try {
    // 1. Validate input
    const validated = markNotificationReadSchema.safeParse({ notificationId });
    if (!validated.success) {
      return {
        success: false,
        error: "Invalid notification ID",
      };
    }

    // 2. Authenticate
    let user;
    try {
      user = await requireAuth();
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "Authentication failed",
      };
    }

    // 3. Verify notification exists and belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: validated.data.notificationId },
      select: { id: true, userId: true, isRead: true },
    });

    if (!notification) {
      return {
        success: false,
        error: "Notification not found",
      };
    }

    // 4. Verify ownership (critical security check)
    if (notification.userId !== user.id) {
      return {
        success: false,
        error: "You don't have permission to mark this notification as read",
      };
    }

    // 5. Mark as read (idempotent - if already read, no error)
    await prisma.notification.update({
      where: { id: validated.data.notificationId },
      data: { isRead: true },
    });

    return {
      success: true,
    };

  } catch (error) {
    // Log unexpected errors but don't expose details to user
    console.error("Error marking notification as read:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
