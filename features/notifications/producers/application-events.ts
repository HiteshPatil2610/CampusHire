import { prisma } from "@/lib/prisma";
import {
  deliverNotificationSafely,
  departmentAdminRecipients,
  superAdminRecipients,
} from "@/lib/notifications";
import { reachedMilestone, startOfIndianDay } from "../domain/application-event";

/**
 * Notifications that follow an application being submitted, and a placement
 * being recorded or withdrawn by hand. (A stage move notifies inside its own
 * transaction, in `moveApplication`.)
 *
 * Each runs after the change is committed and never fails it.
 */

/**
 * After a student applies: their confirmation, their department admins' daily
 * summary for the drive, and — at 10, 25, 50 … applications — the Super
 * Admins.
 */
export async function notifyApplicationSubmitted(params: {
  applicationId: string;
  studentUserId: string;
  departmentId: string;
  driveId: string;
  companyName: string;
  roleName: string;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "APPLICATION_SUBMITTED",
    role: "STUDENT",
    recipients: [{ userId: params.studentUserId }],
    content: {
      title: "Application Submitted",
      message: `You successfully applied to ${params.companyName} - ${params.roleName}`,
      actionUrl: "/student-dashboard/applications",
    },
    dedupeKey: `application-submitted:${params.applicationId}`,
    resourceType: "Application",
    resourceId: params.applicationId,
  });

  try {
    const { start, key } = startOfIndianDay();
    const [today, total] = await Promise.all([
      prisma.driveApplication.count({
        where: {
          driveId: params.driveId,
          student: { departmentId: params.departmentId },
          appliedAt: { gte: start },
        },
      }),
      prisma.driveApplication.count({ where: { driveId: params.driveId } }),
    ]);

    // One row per drive per day per admin, refreshed with the running count.
    await deliverNotificationSafely({
      event: "NEW_APPLICATIONS",
      role: "DEPT_ADMIN",
      recipients: await departmentAdminRecipients(params.departmentId),
      content: {
        title: `New applications — ${params.companyName}`,
        message: `${today} application${today === 1 ? "" : "s"} today for ${params.roleName}.`,
        actionUrl: `/admin-dashboard/drives/${params.driveId}?tab=applications`,
      },
      dedupeKey: `new-applications:${params.driveId}:${key}`,
      resourceType: "Drive",
      resourceId: params.driveId,
      collapse: true,
    });

    const milestone = reachedMilestone(total);
    if (milestone !== null) {
      await deliverNotificationSafely({
        event: "APPLICATION_MILESTONE",
        role: "SUPER_ADMIN",
        recipients: await superAdminRecipients(),
        content: {
          title: `${params.companyName} reached ${milestone} applications`,
          message: `${total} students have applied to ${params.companyName} across all departments.`,
          actionUrl: `/super-admin-dashboard/drives/${params.driveId}/applications`,
        },
        dedupeKey: `application-milestone:${params.driveId}:${milestone}`,
        resourceType: "Drive",
        resourceId: params.driveId,
      });
    }
  } catch (error) {
    console.error("notifyApplicationSubmitted follow-ups failed:", error);
  }
}

/** A placement recorded by hand (an offer made outside CampusHire). */
export async function notifyPlacementRecorded(params: {
  placementId: string;
  studentId: string;
  companyName: string;
  roleName: string;
}): Promise<void> {
  const student = await prisma.student
    .findUnique({ where: { id: params.studentId }, select: { userId: true } })
    .catch(() => null);
  if (!student?.userId) return;

  await deliverNotificationSafely({
    event: "PLACEMENT_RECORDED",
    role: "STUDENT",
    recipients: [{ userId: student.userId }],
    content: {
      title: `Placement recorded — ${params.companyName}`,
      message: `Your placement as ${params.roleName} at ${params.companyName} has been recorded. You will no longer be shown new placement drives.`,
      actionUrl: "/student-dashboard",
    },
    dedupeKey: `placement-recorded:${params.placementId}`,
    resourceType: "StudentPlacement",
    resourceId: params.placementId,
  });
}

/** A placement withdrawn — the student is eligible for new drives again. */
export async function notifyPlacementRevoked(params: {
  placementId: string;
  studentId: string;
  companyName: string;
  reason: string;
}): Promise<void> {
  const student = await prisma.student
    .findUnique({ where: { id: params.studentId }, select: { userId: true } })
    .catch(() => null);
  if (!student?.userId) return;

  await deliverNotificationSafely({
    event: "PLACEMENT_REVOKED",
    role: "STUDENT",
    recipients: [{ userId: student.userId }],
    content: {
      title: `Placement withdrawn — ${params.companyName}`,
      message: `Your placement at ${params.companyName} was withdrawn. Reason: ${params.reason}. You can apply to new drives again.`,
      actionUrl: "/student-dashboard/drives",
    },
    dedupeKey: `placement-revoked:${params.placementId}`,
    resourceType: "StudentPlacement",
    resourceId: params.placementId,
  });
}
