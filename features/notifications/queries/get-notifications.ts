import type { NotificationCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { GetNotificationsInput } from "../schemas/notification";

/**
 * A user's notifications: theirs only, newest first, and never one that has
 * expired (a closed drive's "new drive", an archived announcement).
 *
 * Both filters run in the database so the page count matches what is shown.
 * Authorization is the caller's: every call passes the authenticated user's
 * own id, and nothing here takes a user id from a request.
 */
export async function getNotifications(
  userId: string,
  input: Omit<GetNotificationsInput, "category"> & {
    category?: GetNotificationsInput["category"];
  }
) {
  const { page, pageSize, isRead, category = "all" } = input;
  const skip = (page - 1) * pageSize;
  const now = new Date();

  const where: Prisma.NotificationWhereInput = {
    userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(isRead !== undefined ? { isRead } : {}),
    ...(category !== "all" ? { category: category as NotificationCategory } : {}),
  };

  const [totalCount, notifications, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({
      where: { userId, isRead: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }),
  ]);

  return { data: notifications, page, pageSize, totalCount, unreadCount };
}

/** How many unread notifications the user has in each category. */
export async function getCategoryCounts(userId: string): Promise<Record<string, number>> {
  const now = new Date();
  const groups = await prisma.notification.groupBy({
    by: ["category"],
    where: {
      userId,
      isRead: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((group) => [group.category, group._count._all]));
}
