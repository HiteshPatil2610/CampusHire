import { prisma } from "@/lib/prisma";

/**
 * Get unread notification count for authenticated user
 * 
 * Authorization: User sees only their own unread count (enforced by caller)
 * 
 * @param userId - Authenticated user ID
 * @returns Count of unread notifications
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}
