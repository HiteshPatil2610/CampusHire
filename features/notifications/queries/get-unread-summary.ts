import { prisma } from "@/lib/prisma";
import { ATTENTION_PRIORITIES } from "../domain/events";

export interface UnreadSummary {
  count: number;
  /** True when at least one unread notification needs the user to act. */
  hasCritical: boolean;
}

/**
 * Unread count plus whether any of them are urgent, for the bell.
 *
 * Priority is stored now (the event registry sets it), so this is two
 * counts rather than a scan: a student with twelve unread announcements
 * should not look as urgent as one with a single unread offer.
 */
export async function getUnreadSummary(userId: string): Promise<UnreadSummary> {
  const now = new Date();
  const unread = {
    userId,
    isRead: false,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const [count, critical] = await Promise.all([
    prisma.notification.count({ where: unread }),
    prisma.notification.count({
      where: { ...unread, priority: { in: [...ATTENTION_PRIORITIES] } },
    }),
  ]);

  return { count, hasCritical: critical > 0 };
}
