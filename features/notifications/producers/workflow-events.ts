import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  deliverNotification,
  deliverNotificationSafely,
  departmentAdminRecipients,
  superAdminRecipients,
} from "@/lib/notifications";
import { startOfIndianDay } from "../domain/application-event";

/**
 * Notifications for the people who run drives: department admins and Super
 * Admins. None of these reaches a student — students hear about a drive only
 * when their department publishes it (`notifyEligibleStudentsOfDrive`).
 *
 * Every recipient is resolved here from the drive or department in question;
 * an event about one department reaches that department's admins and no
 * other's. Each is keyed so a repeated action notifies once, and each runs
 * after its change is committed and never fails it.
 */

const SUPER_DRIVES = "/super-admin-dashboard/drives";
const adminDrive = (driveId: string) => `/admin-dashboard/drives/${driveId}`;

/**
 * A master drive was assigned to departments. Each newly assigned
 * department's admins are told once per assignment (keyed by the department
 * drive's id, so a reassignment after an unassignment notifies again); the
 * other Super Admins hear that it happened.
 */
export async function notifyDriveAssigned(params: {
  driveId: string;
  actorId: string;
  departmentIds?: string[];
}): Promise<void> {
  try {
    const drive = await prisma.drive.findUnique({
      where: { id: params.driveId },
      select: {
        companyName: true,
        roleName: true,
        departmentConfigs: {
          where: {
            status: "ASSIGNED",
            ...(params.departmentIds ? { departmentId: { in: params.departmentIds } } : {}),
          },
          select: { id: true, departmentId: true, department: { select: { code: true } } },
        },
      },
    });
    if (!drive || drive.departmentConfigs.length === 0) return;

    for (const config of drive.departmentConfigs) {
      await deliverNotification(prisma, {
        event: "DRIVE_ASSIGNED",
        role: "DEPT_ADMIN",
        recipients: await departmentAdminRecipients(config.departmentId),
        content: {
          title: `New drive to configure — ${drive.companyName}`,
          message: `The placement office assigned ${drive.companyName} (${drive.roleName}) to your department. Configure it and publish it to your students.`,
          actionUrl: adminDrive(params.driveId),
        },
        dedupeKey: `drive-assigned:${config.id}`,
        resourceType: "Drive",
        resourceId: params.driveId,
      });
    }

    const codes = drive.departmentConfigs.map((config) => config.department.code).sort();
    await deliverNotification(prisma, {
      event: "DRIVE_ASSIGNMENT",
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients(params.actorId),
      content: {
        title: `${drive.companyName} assigned`,
        message: `${drive.companyName} (${drive.roleName}) is assigned to ${codes.join(", ")}.`,
        actionUrl: SUPER_DRIVES,
      },
      dedupeKey: `drive-assignment:${params.driveId}:${hashOf(drive.departmentConfigs.map((c) => c.id).sort().join(","))}`,
      resourceType: "Drive",
      resourceId: params.driveId,
    });
  } catch (error) {
    console.error("notifyDriveAssigned failed:", error);
  }
}

/**
 * The Super Admin nudges every department that has not published a drive
 * yet. At most one reminder per department drive per day.
 */
export async function remindDepartmentsToConfigure(params: {
  driveId: string;
  actorId: string;
}): Promise<{ departments: number; notified: number }> {
  const drive = await prisma.drive.findUnique({
    where: { id: params.driveId },
    select: {
      companyName: true,
      roleName: true,
      departmentConfigs: {
        where: { status: { in: ["ASSIGNED", "CONFIGURED"] } },
        select: { id: true, departmentId: true, status: true },
      },
    },
  });
  if (!drive) return { departments: 0, notified: 0 };

  const { key } = startOfIndianDay();
  let notified = 0;
  for (const config of drive.departmentConfigs) {
    const { delivered } = await deliverNotification(prisma, {
      event: "DRIVE_CONFIG_REMINDER",
      role: "DEPT_ADMIN",
      recipients: await departmentAdminRecipients(config.departmentId),
      content: {
        title: `Reminder: ${drive.companyName} is waiting for you`,
        message:
          config.status === "ASSIGNED"
            ? `${drive.companyName} (${drive.roleName}) has not been configured for your department yet.`
            : `${drive.companyName} (${drive.roleName}) is configured but not yet published to your students.`,
        actionUrl: adminDrive(params.driveId),
      },
      dedupeKey: `config-reminder:${config.id}:${key}`,
      resourceType: "Drive",
      resourceId: params.driveId,
    });
    notified += delivered;
  }
  return { departments: drive.departmentConfigs.length, notified };
}

/**
 * A department's configuration became complete: its admins can publish, and
 * the Super Admins see the department is done. Once per department drive.
 */
export async function notifyDepartmentDriveReady(params: {
  driveId: string;
  departmentDriveId: string;
  departmentId: string;
  departmentCode: string;
  companyName: string;
  roleName: string;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "DRIVE_READY_TO_PUBLISH",
    role: "DEPT_ADMIN",
    recipients: await departmentAdminRecipients(params.departmentId).catch(() => []),
    content: {
      title: `${params.companyName} is ready to publish`,
      message: `Everything required for ${params.roleName} is filled in. Publish it when you are ready — only then do your students see it.`,
      actionUrl: adminDrive(params.driveId),
    },
    dedupeKey: `ready-to-publish:${params.departmentDriveId}`,
    resourceType: "Drive",
    resourceId: params.driveId,
  });

  await deliverNotificationSafely({
    event: "DEPARTMENT_CONFIGURED",
    role: "SUPER_ADMIN",
    recipients: await superAdminRecipients().catch(() => []),
    content: {
      title: `${params.departmentCode} configured ${params.companyName}`,
      message: `${params.departmentCode} has completed the configuration of ${params.companyName} (${params.roleName}) and can publish it.`,
      actionUrl: SUPER_DRIVES,
    },
    dedupeKey: `department-configured:${params.departmentDriveId}`,
    resourceType: "Drive",
    resourceId: params.driveId,
  });
}

/** A department published a drive to its students. */
export async function notifyDepartmentDrivePublished(params: {
  driveId: string;
  departmentDriveId: string;
  departmentCode: string;
  companyName: string;
  roleName: string;
  studentsNotified: number;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "DEPARTMENT_DRIVE_PUBLISHED",
    role: "SUPER_ADMIN",
    recipients: await superAdminRecipients().catch(() => []),
    content: {
      title: `${params.departmentCode} published ${params.companyName}`,
      message: `${params.companyName} (${params.roleName}) is live in ${params.departmentCode}; ${params.studentsNotified} eligible student${params.studentsNotified === 1 ? " was" : "s were"} notified.`,
      actionUrl: SUPER_DRIVES,
    },
    dedupeKey: `department-published:${params.departmentDriveId}`,
    resourceType: "Drive",
    resourceId: params.driveId,
  });
}

/**
 * The Super Admin changed a master drive that departments run. Their admins
 * get one notification per drive per day, refreshed with the latest change.
 */
export async function notifyMasterDriveUpdated(params: {
  driveId: string;
  summary: string;
}): Promise<void> {
  try {
    const drive = await prisma.drive.findUnique({
      where: { id: params.driveId },
      select: {
        companyName: true,
        departmentConfigs: {
          where: { status: { notIn: ["CANCELLED", "ARCHIVED"] } },
          select: { departmentId: true },
        },
      },
    });
    if (!drive || drive.departmentConfigs.length === 0) return;

    const admins = await prisma.departmentAdmin.findMany({
      where: {
        departmentId: { in: drive.departmentConfigs.map((config) => config.departmentId) },
        status: "ACTIVE",
      },
      select: { userId: true },
    });
    const { key } = startOfIndianDay();

    await deliverNotification(prisma, {
      event: "MASTER_DRIVE_UPDATED",
      role: "DEPT_ADMIN",
      recipients: admins,
      content: {
        title: `${drive.companyName} was updated by the placement office`,
        message: params.summary,
        actionUrl: adminDrive(params.driveId),
      },
      dedupeKey: `master-updated:${params.driveId}:${key}`,
      resourceType: "Drive",
      resourceId: params.driveId,
      collapse: true,
    });
  } catch (error) {
    console.error("notifyMasterDriveUpdated failed:", error);
  }
}

/** A department asked to change a published drive's stages. */
export async function notifyPipelineChangeRequested(params: {
  requestId: string;
  driveId: string;
  departmentCode: string;
  companyName: string;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "PIPELINE_CHANGE_REQUESTED",
    role: "SUPER_ADMIN",
    recipients: await superAdminRecipients().catch(() => []),
    content: {
      title: `Stage change requested — ${params.companyName}`,
      message: `${params.departmentCode} asked to change the recruitment stages of ${params.companyName}. It needs your review.`,
      actionUrl: "/super-admin-dashboard/pipeline-requests",
    },
    dedupeKey: `pipeline-requested:${params.requestId}`,
    resourceType: "PipelineChangeRequest",
    resourceId: params.requestId,
  });
}

/** The Super Admin decided a department's stage change request. */
export async function notifyPipelineChangeReviewed(params: {
  requestId: string;
  driveId: string;
  departmentId: string;
  companyName: string;
  approved: boolean;
  note: string | null;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "PIPELINE_CHANGE_REVIEWED",
    role: "DEPT_ADMIN",
    recipients: await departmentAdminRecipients(params.departmentId).catch(() => []),
    content: {
      title: params.approved
        ? `Stage change approved — ${params.companyName}`
        : `Stage change rejected — ${params.companyName}`,
      message: params.approved
        ? `The new recruitment stages for ${params.companyName} are now active.${params.note ? ` Note: ${params.note}` : ""}`
        : `The stages of ${params.companyName} stay as they were. Reason: ${params.note ?? "not given"}`,
      actionUrl: `${adminDrive(params.driveId)}?tab=pipeline`,
    },
    priority: params.approved ? "SUCCESS" : "WARNING",
    dedupeKey: `pipeline-reviewed:${params.requestId}`,
    resourceType: "PipelineChangeRequest",
    resourceId: params.requestId,
  });
}

/**
 * A student asked for access. The department's admins review it; a
 * department with no admin cannot, so the Super Admins are told instead.
 */
export async function notifyAccessRequested(params: {
  requestId: string;
  departmentId: string;
  studentName: string;
  submittedAt: Date;
}): Promise<void> {
  try {
    const [admins, department] = await Promise.all([
      departmentAdminRecipients(params.departmentId),
      prisma.department.findUnique({ where: { id: params.departmentId }, select: { code: true } }),
    ]);
    // A resubmission after a decline is a new request, so the key carries
    // when it was made.
    const dedupeKey = `access-request:${params.requestId}:${params.submittedAt.getTime()}`;

    if (admins.length > 0) {
      await deliverNotification(prisma, {
        event: "ACCESS_REQUEST",
        role: "DEPT_ADMIN",
        recipients: admins,
        content: {
          title: "New student access request",
          message: `${params.studentName} asked for access to your department. Review it on the import page.`,
          actionUrl: "/admin-dashboard/students/import",
        },
        dedupeKey,
        resourceType: "StudentAccessRequest",
        resourceId: params.requestId,
      });
      return;
    }

    await deliverNotification(prisma, {
      event: "ACCESS_REQUEST_ESCALATED",
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients(),
      content: {
        title: `Access request for ${department?.code ?? "a department"} with no admin`,
        message: `${params.studentName} asked for access to ${department?.code ?? "a department"}, which has no department admin to review it. Assign an admin.`,
        actionUrl: "/super-admin-dashboard/admins",
      },
      dedupeKey,
      resourceType: "StudentAccessRequest",
      resourceId: params.requestId,
    });
  } catch (error) {
    console.error("notifyAccessRequested failed:", error);
  }
}

/** A student opted in or out of placement: their department's admins. */
export async function notifyStudentParticipationChanged(params: {
  studentId: string;
  studentName: string;
  departmentId: string;
  optedIn: boolean;
}): Promise<void> {
  const { key } = startOfIndianDay();
  await deliverNotificationSafely({
    event: "STUDENT_UPDATE",
    role: "DEPT_ADMIN",
    recipients: await departmentAdminRecipients(params.departmentId).catch(() => []),
    content: {
      title: params.optedIn ? "Student opted in to placement" : "Student opted out of placement",
      message: params.optedIn
        ? `${params.studentName} is participating in campus placement again.`
        : `${params.studentName} opted out of campus placement and will not be shown new drives.`,
      actionUrl: "/admin-dashboard/students",
    },
    dedupeKey: `participation:${params.studentId}:${params.optedIn ? "in" : "out"}:${key}`,
    resourceType: "Student",
    resourceId: params.studentId,
  });
}

/**
 * Someone was made a department admin: they are told (it is waiting for them
 * when they sign in), and the other Super Admins hear about it.
 */
export async function notifyAdminInvited(params: {
  adminUserId: string;
  adminName: string;
  departmentName: string;
  actorId: string;
}): Promise<void> {
  await deliverNotificationSafely({
    event: "ACCOUNT_UPDATE",
    role: "DEPT_ADMIN",
    recipients: [{ userId: params.adminUserId }],
    content: {
      title: `You are an admin of ${params.departmentName}`,
      message: `You can now run ${params.departmentName}'s drives, students and announcements.`,
      actionUrl: "/admin-dashboard",
    },
    dedupeKey: `admin-invited:${params.adminUserId}:${params.departmentName}`,
    resourceType: "User",
    resourceId: params.adminUserId,
  });

  await deliverNotificationSafely({
    event: "ADMIN_INVITED",
    role: "SUPER_ADMIN",
    recipients: await superAdminRecipients(params.actorId).catch(() => []),
    content: {
      title: `${params.adminName} invited as ${params.departmentName} admin`,
      message: `${params.adminName} was made an admin of ${params.departmentName}.`,
      actionUrl: "/super-admin-dashboard/admins",
    },
    dedupeKey: `admin-invited:${params.adminUserId}:${params.departmentName}`,
    resourceType: "User",
    resourceId: params.adminUserId,
  });
}

/**
 * The first time a department admin opens CampusHire after being made one.
 * The compare-and-set on `firstSeenAt` makes this happen once per admin.
 */
export async function recordDepartmentAdminFirstSeen(userId: string): Promise<void> {
  try {
    const claimed = await prisma.departmentAdmin.updateMany({
      where: { userId, firstSeenAt: null, status: "ACTIVE" },
      data: { firstSeenAt: new Date() },
    });
    if (claimed.count === 0) return;

    const admin = await prisma.departmentAdmin.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { user: { select: { name: true, email: true } }, department: { select: { name: true } } },
    });
    if (!admin) return;

    await deliverNotification(prisma, {
      event: "ADMIN_ACCEPTED_INVITATION",
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients(),
      content: {
        title: `${admin.user.name ?? admin.user.email} joined as ${admin.department.name} admin`,
        message: `${admin.user.name ?? admin.user.email} signed in for the first time as an admin of ${admin.department.name}.`,
        actionUrl: "/super-admin-dashboard/admins",
      },
      dedupeKey: `admin-accepted:${userId}`,
      resourceType: "User",
      resourceId: userId,
    });
  } catch (error) {
    console.error("recordDepartmentAdminFirstSeen failed:", error);
  }
}

function hashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
