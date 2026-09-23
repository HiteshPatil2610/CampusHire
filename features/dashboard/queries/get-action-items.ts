import type { RecruitmentStageType, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, requireSuperAdmin } from "@/lib/auth";
import { evaluateDepartmentDriveReadiness } from "@/features/notifications/producers/department-readiness";
import { getAnnouncementFeed } from "@/features/announcements/queries/get-announcements";
import {
  buildAdminActionItems,
  buildStudentActionItems,
  buildSuperAdminActionItems,
  hoursUntil,
  type ActionItem,
} from "../domain/action-items";

/**
 * The data behind each role's "action required" panel.
 *
 * Every query is scoped by the caller's own authority — a department admin's
 * to their department (from the session), a student's to their own record —
 * and only asks about things that are still open, so a completed action has
 * nothing left to show. The department admin and Super Admin functions take
 * no id from a request at all.
 */

const CLOSING_WINDOW_HOURS = 72;
/** Drives listed individually; beyond this the panel would stop being a shortlist. */
const MAX_LISTED = 5;

const stageKind = (type: RecruitmentStageType): "test" | "interview" | "other" => {
  if (["APTITUDE", "CODING", "ASSESSMENT", "PRESENTATION"].includes(type)) return "test";
  if (
    ["TECHNICAL_INTERVIEW", "HR_INTERVIEW", "MANAGERIAL_INTERVIEW", "GROUP_DISCUSSION"].includes(type)
  ) {
    return "interview";
  }
  return "other";
};

/**
 * A student's items. The eligible drives come in already judged by the
 * evaluator (the dashboard has them), so nothing here decides eligibility.
 */
export async function getStudentActionItems(params: {
  user: User;
  studentId: string;
  profileCompletion: number;
  hasAcademicRecord: boolean;
  eligibleDrives: {
    driveId: string;
    companyName: string;
    roleName: string;
    applicationStartDate: Date;
    deadline: Date;
    applied: boolean;
  }[];
}): Promise<ActionItem[]> {
  const [applications, announcements] = await Promise.all([
    prisma.driveApplication.findMany({
      where: {
        studentId: params.studentId,
        status: "IN_PROGRESS",
        drive: { lifecycleStatus: { notIn: ["CANCELLED", "ARCHIVED"] } },
      },
      select: {
        driveId: true,
        drive: { select: { companyName: true } },
        currentStage: { select: { name: true, stageType: true, scheduledAt: true, location: true } },
      },
      take: 30,
    }),
    getAnnouncementFeed(params.user, { pageSize: 10 }).catch(() => ({ rows: [] })),
  ]);

  return buildStudentActionItems({
    now: new Date(),
    profileCompletion: params.profileCompletion,
    hasAcademicRecord: params.hasAcademicRecord,
    eligibleDrives: params.eligibleDrives,
    upcomingStages: applications.flatMap((application) =>
      application.currentStage
        ? [
            {
              driveId: application.driveId,
              companyName: application.drive.companyName,
              stageName: application.currentStage.name,
              stageKind: stageKind(application.currentStage.stageType),
              scheduledAt: application.currentStage.scheduledAt,
              location: application.currentStage.location,
            },
          ]
        : []
    ),
    announcements: announcements.rows
      .filter((row) => row.priority === "URGENT" || row.priority === "ACTION_REQUIRED")
      .map((row) => ({ id: row.id, title: row.title, priority: row.priority })),
  });
}

/** A department admin's items, for their own department. */
export async function getAdminActionItems(): Promise<ActionItem[]> {
  const { user, department } = await requireDepartmentAdmin();
  const now = new Date();
  const soon = new Date(now.getTime() + CLOSING_WINDOW_HOURS * 60 * 60 * 1000);
  const notCancelled = { lifecycleStatus: { notIn: ["CANCELLED", "ARCHIVED"] as ("CANCELLED" | "ARCHIVED")[] } };

  const [pendingAccessRequests, assigned, configured, unreadStageDecisions, toReview, closing] =
    await Promise.all([
      prisma.studentAccessRequest.count({
        where: { departmentId: department.id, status: "PENDING" },
      }),
      prisma.driveDepartmentConfig.findMany({
        where: { departmentId: department.id, status: "ASSIGNED", drive: notCancelled },
        select: { driveId: true, drive: { select: { companyName: true } } },
        take: MAX_LISTED,
      }),
      prisma.driveDepartmentConfig.findMany({
        where: { departmentId: department.id, status: "CONFIGURED", drive: notCancelled },
        select: { driveId: true, drive: { select: { companyName: true } } },
        take: MAX_LISTED,
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          event: "PIPELINE_CHANGE_REVIEWED",
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.driveApplication.groupBy({
        by: ["driveId"],
        where: {
          student: { departmentId: department.id },
          status: "IN_PROGRESS",
          currentStage: { is: { stageType: "APPLICATION" } },
          drive: notCancelled,
        },
        _count: { _all: true },
        orderBy: { _count: { driveId: "desc" } },
        take: MAX_LISTED,
      }),
      prisma.driveDepartmentConfig.findMany({
        where: {
          departmentId: department.id,
          status: "PUBLISHED",
          // Already taking applications, and closing soon.
          drive: { ...notCancelled, applicationStartDate: { lte: now } },
          OR: [
            { applicationDeadline: { gt: now, lte: soon } },
            { applicationDeadline: null, drive: { applicationDeadline: { gt: now, lte: soon } } },
          ],
        },
        select: {
          driveId: true,
          applicationDeadline: true,
          drive: { select: { companyName: true, applicationDeadline: true } },
        },
        take: MAX_LISTED,
      }),
    ]);

  // "Configured" is not the same as "ready to publish": the readiness check —
  // the one the Publish button uses — decides which of them can go out.
  const readiness = await Promise.all(
    configured.map(async (config) => ({
      config,
      state: await evaluateDepartmentDriveReadiness({
        driveId: config.driveId,
        departmentId: department.id,
      }).catch(() => null),
    }))
  );

  const reviewNames = toReview.length
    ? await prisma.drive.findMany({
        where: { id: { in: toReview.map((row) => row.driveId) } },
        select: { id: true, companyName: true },
      })
    : [];
  const nameById = new Map(reviewNames.map((drive) => [drive.id, drive.companyName]));

  return buildAdminActionItems({
    now,
    pendingAccessRequests,
    needsConfiguration: [
      ...assigned.map((config) => ({ driveId: config.driveId, companyName: config.drive.companyName })),
      // Configured but not yet complete still needs work from the admin.
      ...readiness
        .filter(({ state }) => state && !state.ready)
        .map(({ config }) => ({ driveId: config.driveId, companyName: config.drive.companyName })),
    ],
    readyToPublish: readiness
      .filter(({ state }) => state?.ready)
      .map(({ config }) => ({ driveId: config.driveId, companyName: config.drive.companyName })),
    unreadStageDecisions,
    applicationsToReview: toReview.map((row) => ({
      driveId: row.driveId,
      companyName: nameById.get(row.driveId) ?? "a drive",
      count: row._count._all,
    })),
    closingSoon: closing
      .map((config) => ({
        driveId: config.driveId,
        companyName: config.drive.companyName,
        deadline: config.applicationDeadline ?? config.drive.applicationDeadline,
      }))
      .filter((drive) => hoursUntil(drive.deadline, now) >= 0),
  });
}

/** The Super Admin's items, across the institution. */
export async function getSuperAdminActionItems(): Promise<ActionItem[]> {
  const superAdmin = await requireSuperAdmin();
  const now = new Date();
  const notCancelled = { lifecycleStatus: { notIn: ["CANCELLED", "ARCHIVED"] as ("CANCELLED" | "ARCHIVED")[] } };

  const [
    pendingInvitations,
    awaiting,
    pendingPipelineRequests,
    milestones,
    failedDeliveries,
    unreadSystemAlerts,
  ] = await Promise.all([
    prisma.adminInvitation.count({ where: { status: "INVITED" } }),
    prisma.driveDepartmentConfig.groupBy({
      by: ["driveId"],
      where: { status: "ASSIGNED", drive: notCancelled },
      _count: { _all: true },
      orderBy: { _count: { driveId: "desc" } },
      take: MAX_LISTED,
    }),
    prisma.pipelineChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.notification.findMany({
      where: {
        userId: superAdmin.id,
        event: "APPLICATION_MILESTONE",
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true },
    }),
    prisma.notificationDispatch.count({ where: { status: "FAILED" } }),
    prisma.notification.count({
      where: {
        userId: superAdmin.id,
        event: "SYSTEM_ALERT",
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
  ]);

  const drives = awaiting.length
    ? await prisma.drive.findMany({
        where: { id: { in: awaiting.map((row) => row.driveId) } },
        select: { id: true, companyName: true },
      })
    : [];
  const nameById = new Map(drives.map((drive) => [drive.id, drive.companyName]));

  return buildSuperAdminActionItems({
    pendingInvitations,
    awaitingConfiguration: awaiting.map((row) => ({
      driveId: row.driveId,
      companyName: nameById.get(row.driveId) ?? "a drive",
      departments: row._count._all,
    })),
    pendingPipelineRequests,
    milestones,
    failedDeliveries,
    unreadSystemAlerts,
  });
}
