import { prisma } from "@/lib/prisma";
import { deliverNotification, superAdminRecipients } from "@/lib/notifications";
import { runNotificationDispatch } from "../domain/dispatch";

/**
 * The notifications an announcement generates.
 *
 * The announcement itself is the record; these only point at it. Recipients
 * come from the announcement's own targeting — the fields
 * `announcementReaches` reads — so nobody is notified about an announcement
 * they could not open. Keyed by the announcement, so publishing it (or
 * releasing a scheduled one twice, or retrying) notifies each person once.
 */

export async function notifyAnnouncementPublished(params: {
  announcementId: string;
  actorId?: string | null;
}): Promise<{ notified: number }> {
  const outcome = await runNotificationDispatch(
    {
      key: `announcement:${params.announcementId}`,
      event: "ANNOUNCEMENT",
      payload: { announcementId: params.announcementId },
      triggeredById: params.actorId ?? null,
    },
    ({ dispatchId }) => fanOutAnnouncement(params.announcementId, dispatchId)
  );
  return { notified: outcome.delivered };
}

export async function fanOutAnnouncement(
  announcementId: string,
  dispatchId: string
): Promise<number> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      title: true,
      content: true,
      audience: true,
      departmentId: true,
      batchYears: true,
      priority: true,
      expiresAt: true,
      status: true,
      authorId: true,
      department: { select: { code: true } },
      author: { select: { name: true, email: true, role: true } },
    },
  });
  // An announcement archived before its fan-out ran must not be delivered.
  if (!announcement || (announcement.status !== "PUBLISHED" && announcement.status !== "SCHEDULED")) {
    return 0;
  }

  const from = announcement.department
    ? `${announcement.department.code} placement team`
    : "the placement office";
  const summary = announcement.content.length > 160
    ? `${announcement.content.slice(0, 157)}…`
    : announcement.content;
  const common = {
    event: "ANNOUNCEMENT" as const,
    priority: announcement.priority,
    dedupeKey: `announcement:${announcement.id}`,
    resourceType: "Announcement",
    resourceId: announcement.id,
    expiresAt: announcement.expiresAt,
    dispatchId,
  };
  let delivered = 0;

  if (announcement.audience === "STUDENTS" || announcement.audience === "EVERYONE") {
    const students = await prisma.student.findMany({
      where: {
        isPending: false,
        userId: { not: null },
        ...(announcement.departmentId ? { departmentId: announcement.departmentId } : {}),
        ...(announcement.batchYears.length > 0 ? { batchYear: { in: announcement.batchYears } } : {}),
      },
      select: { userId: true },
    });
    const result = await deliverNotification(prisma, {
      ...common,
      role: "STUDENT",
      recipients: students.map((student) => ({ userId: student.userId! })),
      content: {
        title: announcement.title,
        message: `${summary} — from ${from}`,
        actionUrl: `/student-dashboard/announcements/${announcement.id}`,
      },
    });
    delivered += result.delivered;
  }

  if (announcement.audience === "ADMINS" || announcement.audience === "EVERYONE") {
    const admins = await prisma.departmentAdmin.findMany({
      where: announcement.departmentId ? { departmentId: announcement.departmentId } : {},
      select: { userId: true },
    });
    const result = await deliverNotification(prisma, {
      ...common,
      role: "DEPT_ADMIN",
      recipients: admins,
      content: {
        title: announcement.title,
        message: `${summary} — from ${from}`,
        actionUrl: `/admin-dashboard/announcements/${announcement.id}`,
      },
    });
    delivered += result.delivered;
  }

  // A department's announcement is also visible to the placement office,
  // which oversees every department.
  if (announcement.departmentId) {
    const result = await deliverNotification(prisma, {
      ...common,
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients(announcement.authorId),
      content: {
        title: `${announcement.department?.code ?? "A department"}: ${announcement.title}`,
        message: `${announcement.author.name ?? announcement.author.email} published an announcement. ${summary}`,
        actionUrl: `/super-admin-dashboard/announcements/${announcement.id}`,
      },
    });
    delivered += result.delivered;
  }

  return delivered;
}
