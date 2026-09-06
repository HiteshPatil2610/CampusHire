"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * Result type for mark all notifications as read action
 */
export type MarkAllNotificationsReadResult =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * Mark all notifications as read for authenticated user
 * 
 * Authorization:
 * - User must be authenticated
 * - Only affects user's own notifications
 * 
 * @returns Result with count of marked notifications or error
 */
export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  try {
    // 1. Authenticate
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

    // 2. Mark all unread notifications as read
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      success: true,
      count: result.count,
    };

  } catch (error) {
    // Log unexpected errors but don't expose details to user
    console.error("Error marking all notifications as read:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
