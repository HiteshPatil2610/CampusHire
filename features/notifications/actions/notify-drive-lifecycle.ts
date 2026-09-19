import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Notifications for lifecycle events on drives that students already know
 * about: a cancellation, and a deadline extension.
 *
 * Recipients are always resolved here, from the database — never passed in.
 * Like every drive fan-out, failures are logged and swallowed: the lifecycle
 * change has already happened and must not be reported as failed because a
 * notification could not be written.
 */

/**
 * Tell everyone affected that a drive was cancelled in these departments:
 * the students who applied (their application is kept, but the drive will
 * not happen), and — when the Super Admin cancelled it — those departments'
 * admins, who did not make the decision.
 */
export async function notifyDriveCancelled(params: {
  driveId: string;
  departmentIds: string[];
  companyName: string;
  reason: string;
  notifyDepartmentAdmins: boolean;
}): Promise<{ notified: number }> {
  try {
    if (params.departmentIds.length === 0) return { notified: 0 };

    const [applicants, admins] = await Promise.all([
      prisma.driveApplication.findMany({
        where: {
          driveId: params.driveId,
          student: { departmentId: { in: params.departmentIds }, userId: { not: null } },
        },
        select: { student: { select: { userId: true } } },
      }),
      params.notifyDepartmentAdmins
        ? prisma.departmentAdmin.findMany({
            where: { departmentId: { in: params.departmentIds } },
            select: { userId: true },
          })
        : Promise.resolve([] as { userId: string }[]),
    ]);

    const data: Prisma.NotificationCreateManyInput[] = [
      ...applicants.map((row) => ({
        userId: row.student.userId!,
        type: "DRIVE",
        title: "Drive cancelled",
        message: `The ${params.companyName} drive has been cancelled. Your application is kept on record. Reason: ${params.reason}`,
        resourceType: "Drive",
        resourceId: params.driveId,
      })),
      ...admins.map((admin) => ({
        userId: admin.userId,
        type: "ADMIN",
        title: "Drive cancelled by the Super Admin",
        message: `The ${params.companyName} drive was cancelled for your department. Reason: ${params.reason}`,
        resourceType: "Drive",
        resourceId: params.driveId,
      })),
    ];

    if (data.length > 0) await prisma.notification.createMany({ data });
    return { notified: data.length };
  } catch (error) {
    console.error("notifyDriveCancelled error:", error);
    return { notified: 0 };
  }
}

/**
 * Tell one department's students that a drive's deadline moved later: those
 * who applied (so the new date is not a surprise), and those who have not,
 * among the students the drive is actually open to — the same audience the
 * publish announcement reached.
 */
export async function notifyDeadlineExtended(params: {
  driveId: string;
  companyName: string;
  roleName: string;
  newDeadline: Date;
  /** Users who may apply: eligible students of the department who have not. */
  eligibleUserIds: string[];
  departmentId: string;
}): Promise<{ notified: number }> {
  try {
    const applicants = await prisma.driveApplication.findMany({
      where: {
        driveId: params.driveId,
        student: { departmentId: params.departmentId, userId: { not: null } },
      },
      select: { student: { select: { userId: true } } },
    });

    const recipients = new Set([
      ...applicants.map((row) => row.student.userId!),
      ...params.eligibleUserIds,
    ]);
    if (recipients.size === 0) return { notified: 0 };

    const when = params.newDeadline.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    await prisma.notification.createMany({
      data: [...recipients].map((userId) => ({
        userId,
        type: "DRIVE",
        title: "Deadline extended",
        message: `Applications for ${params.companyName} — ${params.roleName} now close on ${when}.`,
        resourceType: "Drive",
        resourceId: params.driveId,
      })),
    });
    return { notified: recipients.size };
  } catch (error) {
    console.error("notifyDeadlineExtended error:", error);
    return { notified: 0 };
  }
}
