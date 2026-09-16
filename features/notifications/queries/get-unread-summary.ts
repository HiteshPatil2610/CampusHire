import { prisma } from "@/lib/prisma";
import { getNotificationPriority } from "../utils/notification-priority";

export interface UnreadSummary {
  count: number;
  /** True when at least one unread notification is a critical-tier item. */
  hasCritical: boolean;
}

/**
 * Unread count plus whether any of them are urgent.
 *
 * The bell previously showed a bare dot, so a student with twelve unread
 * announcements looked exactly as urgent as one with a single unread offer.
 *
 * Only the rows that could possibly be critical are loaded — priority is
 * derived in TypeScript, so narrowing by type in SQL avoids both pulling the
 * whole table and duplicating the ranking rule in a query.
 */
export async function getUnreadSummary(userId: string): Promise<UnreadSummary> {
  const [count, criticalCandidates] = await Promise.all([
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        // Critical can only arise from an application outcome or a profile gap.
        type: { in: ["APPLICATION", "PROFILE"] },
      },
      select: { type: true, title: true, resourceType: true },
      take: 50,
    }),
  ]);

  const hasCritical = criticalCandidates.some(
    (n) => getNotificationPriority(n) === "critical"
  );

  return { count, hasCritical };
}
