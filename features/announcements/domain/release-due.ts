import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { notifyAnnouncementPublished } from "@/features/notifications/producers/announcement-events";

/**
 * Release scheduled announcements whose time has come.
 *
 * CampusHire has no scheduler, so this runs opportunistically: the
 * notification bell calls it (through `materializeDueNotifications`) on the
 * next visit by anyone. A cron could call this same function instead — it
 * needs no request context and is safe to run concurrently.
 *
 * The status change is a compare-and-set, so two visits cannot both release
 * the same announcement, and the fan-out is keyed by the announcement, so
 * even if they did, nobody is notified twice. The author is the actor in the
 * audit trail: it is their announcement going out, not the viewer's.
 */

/** How many are released per call; a backlog drains over the next visits. */
const BATCH = 10;

export async function releaseDueAnnouncements(now: Date = new Date()): Promise<number> {
  const due = await prisma.announcement.findMany({
    where: { status: "SCHEDULED", publishAt: { lte: now } },
    select: { id: true, title: true, authorId: true },
    orderBy: { publishAt: "asc" },
    take: BATCH,
  });
  if (due.length === 0) return 0;

  let released = 0;
  for (const announcement of due) {
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.announcement.updateMany({
        where: { id: announcement.id, status: "SCHEDULED" },
        data: { status: "PUBLISHED" },
      });
      if (claim.count === 0) return false;

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.PUBLISH,
          entityType: AuditEntityType.ANNOUNCEMENT,
          entityId: announcement.id,
          metadata: { title: announcement.title, event: "scheduled-release" },
        },
        announcement.authorId
      );
      return true;
    });
    if (!claimed) continue;

    await notifyAnnouncementPublished({
      announcementId: announcement.id,
      actorId: announcement.authorId,
    });
    released += 1;
  }

  return released;
}
