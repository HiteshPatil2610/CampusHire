import { prisma } from "@/lib/prisma";
import type { GetNotificationsInput } from "../schemas/notification";

/**
 * Get paginated notifications for authenticated user
 * 
 * Authorization: User sees only their own notifications (enforced by caller)
 * 
 * @param userId - Authenticated user ID
 * @param input - Query parameters with pagination and filters
 * @returns Paginated notification results
 */
export async function getNotifications(
  userId: string,
  input: GetNotificationsInput
) {
  const { page, pageSize, isRead } = input;

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: any = {
    userId, // Always scope to authenticated user
  };

  // Optional: filter by read/unread
  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  // Get total count
  const totalCount = await prisma.notification.count({ where });

  // Get paginated data
  const notifications = await prisma.notification.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { createdAt: "desc" }, // Newest first
  });

  return {
    data: notifications,
    page,
    pageSize,
    totalCount,
  };
}
