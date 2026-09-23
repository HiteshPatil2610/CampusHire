import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications";
import { getActiveDepartmentAdmin } from "@/lib/auth";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { releaseDueAnnouncements } from "@/features/announcements/domain/release-due";
import { recordDepartmentAdminFirstSeen } from "../producers/workflow-events";
import { loadDriveForAudience, resolveDriveAudience } from "./drive-recipients";

/**
 * Notifications that are due because of the clock rather than because
 * somebody did something: a deadline about to pass, a scheduled
 * announcement, a new admin's first sign-in.
 *
 * CampusHire runs no scheduler, so these are materialised on the next visit:
 * the notification bell calls this for the signed-in user. It is cheap when
 * there is nothing to do (one narrow count), every write is keyed so
 * repeated visits produce one notification, and any failure is swallowed —
 * this hangs off a page load and must never break it.
 *
 * A cron job could call the same function; nothing here depends on the
 * viewer except whose reminders are being worked out.
 */

/** How close a deadline has to be before a student is reminded. */
export const DEADLINE_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function materializeDueNotifications(user: User): Promise<void> {
  try {
    await releaseDueAnnouncements();
  } catch (error) {
    console.error("releaseDueAnnouncements failed:", error);
  }

  try {
    if (user.role === "STUDENT") await remindStudentOfClosingDrives(user.id);
    if (user.role === "DEPT_ADMIN") {
      await recordDepartmentAdminFirstSeen(user.id);
      await remindAdminOfClosingDrives(user.id);
    }
  } catch (error) {
    console.error(`materializeDueNotifications(${user.role as Role}) failed:`, error);
  }
}

/**
 * A student is reminded of a drive they can still apply to that closes
 * within a day. Eligibility comes from the same evaluator as everything
 * else; a student who already applied is not reminded.
 */
async function remindStudentOfClosingDrives(userId: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true, departmentId: true, isPending: true, optedIn: true },
  });
  if (!student || student.isPending || !student.optedIn) return;

  const now = new Date();
  const until = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_MS);

  // The cheap question first: is anything closing at all for this department?
  const closing = await prisma.driveDepartmentConfig.findMany({
    where: {
      departmentId: student.departmentId,
      status: "PUBLISHED",
      drive: { lifecycleStatus: { notIn: ["CANCELLED", "ARCHIVED"] } },
      OR: [
        { applicationDeadline: { gt: now, lte: until } },
        { applicationDeadline: null, drive: { applicationDeadline: { gt: now, lte: until } } },
      ],
    },
    select: {
      driveId: true,
      applicationDeadline: true,
      roleName: true,
      drive: { select: { companyName: true, roleName: true, applicationStartDate: true, applicationDeadline: true } },
    },
    take: 10,
  });
  if (closing.length === 0) return;

  const applied = await prisma.driveApplication.findMany({
    where: { studentId: student.id, driveId: { in: closing.map((row) => row.driveId) } },
    select: { driveId: true },
  });
  const appliedTo = new Set(applied.map((row) => row.driveId));

  for (const config of closing) {
    if (appliedTo.has(config.driveId)) continue;

    const drive = await loadDriveForAudience(config.driveId);
    if (!drive) continue;

    // The same audience the publish announcement reached: if they are not in
    // it, the listing does not offer them this drive either.
    const audience = await resolveDriveAudience(drive, [student.departmentId]);
    if (!audience.eligible.some((row) => row.userId === userId)) continue;

    const deadline = config.applicationDeadline ?? config.drive.applicationDeadline;
    // Only a drive taking applications now: not one that has not opened.
    if (getDriveStatus({ applicationStartDate: config.drive.applicationStartDate, applicationDeadline: deadline }) !== "open") continue;

    await deliverNotification(prisma, {
      event: "DRIVE_DEADLINE",
      role: "STUDENT",
      recipients: [{ userId }],
      content: {
        title: `Closing soon — ${config.drive.companyName}`,
        message: `Applications for ${config.roleName ?? config.drive.roleName} close on ${formatWhen(deadline)}. You have not applied yet.`,
        actionUrl: `/student-dashboard/drives/${config.driveId}`,
      },
      dedupeKey: `deadline-reminder:${config.driveId}:${deadline.toISOString()}`,
      resourceType: "Drive",
      resourceId: config.driveId,
      expiresAt: deadline,
    });
  }
}

/** A department admin is reminded that one of their drives closes within a day. */
async function remindAdminOfClosingDrives(userId: string): Promise<void> {
  const admin = await getActiveDepartmentAdmin(userId);
  if (!admin) return;

  const now = new Date();
  const until = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_MS);

  const closing = await prisma.driveDepartmentConfig.findMany({
    where: {
      departmentId: admin.departmentId,
      status: "PUBLISHED",
      drive: { lifecycleStatus: { notIn: ["CANCELLED", "ARCHIVED"] } },
      OR: [
        { applicationDeadline: { gt: now, lte: until } },
        { applicationDeadline: null, drive: { applicationDeadline: { gt: now, lte: until } } },
      ],
    },
    select: {
      driveId: true,
      applicationDeadline: true,
      roleName: true,
      drive: { select: { companyName: true, roleName: true, applicationStartDate: true, applicationDeadline: true } },
    },
    take: 10,
  });

  for (const config of closing) {
    const deadline = config.applicationDeadline ?? config.drive.applicationDeadline;
    await deliverNotification(prisma, {
      event: "ADMIN_DRIVE_DEADLINE",
      role: "DEPT_ADMIN",
      recipients: [{ userId }],
      content: {
        title: `Closing soon — ${config.drive.companyName}`,
        message: `Applications for ${config.roleName ?? config.drive.roleName} close on ${formatWhen(deadline)}.`,
        actionUrl: `/admin-dashboard/drives/${config.driveId}?tab=applications`,
      },
      dedupeKey: `admin-deadline-reminder:${config.driveId}:${deadline.toISOString()}`,
      resourceType: "Drive",
      resourceId: config.driveId,
      expiresAt: deadline,
    });
  }
}

function formatWhen(date: Date): string {
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}
