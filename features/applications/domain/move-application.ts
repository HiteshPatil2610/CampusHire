import { revalidatePath } from "next/cache";
import type { User, Department } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth";
import {
  createAuditLog,
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import { createNotification, NotificationType } from "@/lib/notifications";
import { STATUS_LABELS } from "../utils/application-progress";
import {
  legacyStageFor,
  validatePipelineTransition,
} from "@/features/recruitment/domain/pipeline";

/**
 * Moving one application to a stage of its drive's pipeline — the single
 * implementation behind both `updateApplicationStage` and the bulk action.
 *
 * Callers authenticate (a department admin) and validate the input's shape;
 * everything that decides whether the move is *allowed* is here, so a move in
 * a batch is judged exactly like a move on its own:
 *
 *  - the applicant belongs to the admin's department, and the admin runs the
 *    drive (otherwise an AuthorizationError — the caller decides how to
 *    report it)
 *  - the drive has not been cancelled
 *  - the target stage belongs to this department's instance of the drive and
 *    to its active pipeline version, and the transition is legal
 *    (`validatePipelineTransition`)
 *
 * With `dryRun` it stops after those checks and writes nothing — the
 * validation pass of a bulk move.
 *
 * Selecting (status SELECTED) creates the student's placement in the same
 * transaction; every move is recorded in `ApplicationStageEvent`.
 */

export type MoveApplicationResult =
  | { success: true }
  | { success: false; error: string };

export interface MoveApplicationInput {
  applicationId: string;
  stageId: string;
  status: "IN_PROGRESS" | "SELECTED" | "REJECTED";
  note?: string;
}

export interface MoveApplicationOptions {
  /** Check only; write nothing and notify nobody. */
  dryRun?: boolean;
  /** Skip the per-move path revalidation (a bulk move revalidates once). */
  revalidate?: boolean;
}

export async function moveApplication(
  actor: { user: Pick<User, "id">; department: Pick<Department, "id"> },
  input: MoveApplicationInput,
  options: MoveApplicationOptions = {}
): Promise<MoveApplicationResult> {
  const { user, department } = actor;
  const { applicationId, stageId, status, note } = input;

  const application = await prisma.driveApplication.findUnique({
    where: { id: applicationId },
    include: {
      student: { select: { id: true, departmentId: true, userId: true } },
      currentStage: { select: { id: true, name: true, pipelineVersionId: true } },
      drive: {
        select: {
          id: true,
          companyName: true,
          roleName: true,
          packageOffered: true,
          packageDisplay: true,
          departmentId: true,
          isCentralDrive: true,
          lifecycleStatus: true,
          eligibleDepartmentLinks: {
            where: { departmentId: department.id },
            select: { departmentId: true },
          },
          // The applicant is in this admin's department (checked below), so
          // this department's instance is the one the student applied to.
          departmentConfigs: {
            where: { departmentId: department.id },
            select: { id: true, roleName: true, status: true },
          },
        },
      },
    },
  });

  if (!application) {
    return { success: false, error: "Application not found." };
  }

  // The applicant must be one of this admin's own students. This alone is
  // the department-scoping guarantee — it holds for central drives too.
  if (application.student.departmentId !== department.id) {
    throw new AuthorizationError("You do not have permission to update this application");
  }

  // And the admin must actually run this drive.
  const ownsDrive = application.drive.departmentId === department.id;
  const runsCentralDrive =
    application.drive.isCentralDrive && application.drive.eligibleDepartmentLinks.length > 0;

  if (!ownsDrive && !runsCentralDrive) {
    throw new AuthorizationError(
      "You do not have permission to update applications for this drive"
    );
  }

  // This department's instance of the drive — the pipeline the applicant is
  // recruited through.
  const instance = application.drive.departmentConfigs[0];
  if (!instance) {
    return { success: false, error: "This drive has no recruitment pipeline for your department." };
  }

  // A cancelled drive is not going to happen: its applications stay exactly
  // as they were when it was cancelled.
  if (instance.status === "CANCELLED" || application.drive.lifecycleStatus === "CANCELLED") {
    return {
      success: false,
      error: "This drive has been cancelled, so its applications no longer move.",
    };
  }

  // The target stage, and proof it belongs to this instance's pipeline.
  const target = await prisma.recruitmentStage.findUnique({
    where: { id: stageId },
    select: {
      id: true,
      name: true,
      stageType: true,
      isEnabled: true,
      pipelineVersionId: true,
      pipelineVersion: { select: { driveDepartmentConfigId: true, version: true } },
    },
  });
  if (!target || target.pipelineVersion.driveDepartmentConfigId !== instance.id) {
    return { success: false, error: "That stage is not part of this drive's recruitment pipeline." };
  }

  const active = await prisma.recruitmentPipelineVersion.findFirst({
    where: { driveDepartmentConfigId: instance.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!active) {
    return { success: false, error: "This drive has no recruitment pipeline for your department." };
  }

  const transition = validatePipelineTransition({
    currentStatus: application.status,
    currentStage: application.currentStage,
    target,
    activeVersionId: active.id,
    nextStatus: status,
  });

  if (!transition.valid) {
    return { success: false, error: transition.error };
  }

  if (options.dryRun) {
    return { success: true };
  }

  // Dual-written for everything that still reads the four-step enum.
  const stage = legacyStageFor(target.stageType);

  // The role this student applied for — their department's override if it
  // set one, otherwise the master's.
  const roleName = instance.roleName ?? application.drive.roleName;
  const now = new Date();

  // The stage change and, on selection, the placement it creates — together.
  await prisma.$transaction(async (tx) => {
    await tx.driveApplication.update({
      where: { id: applicationId },
      data: {
        currentStageId: target.id,
        stage,
        status,
        stageUpdatedAt: now,
        stageUpdatedById: user.id,
      },
    });

    // The move, in the history, under the version it happened in.
    await tx.applicationStageEvent.create({
      data: {
        applicationId,
        pipelineVersionId: target.pipelineVersionId,
        fromStageId: application.currentStage?.id ?? null,
        toStageId: target.id,
        fromStatus: application.status,
        toStatus: status,
        actorId: user.id,
        note: note || null,
      },
    });

    if (status === "SELECTED") {
      const placement = await tx.studentPlacement.create({
        data: {
          studentId: application.student.id,
          source: "APPLICATION",
          applicationId,
          driveId: application.drive.id,
          companyName: application.drive.companyName,
          roleName,
          packageOffered: application.drive.packageOffered,
          packageDisplay: application.drive.packageDisplay,
          placedAt: now,
          recordedById: user.id,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.CREATE,
          entityType: AuditEntityType.STUDENT_PLACEMENT,
          entityId: placement.id,
          metadata: {
            source: "APPLICATION",
            studentId: application.student.id,
            applicationId,
            driveId: application.drive.id,
            companyName: application.drive.companyName,
            roleName,
          },
        },
        user.id
      );
    }
  });

  await createAuditLog({
    action: AuditAction.TRANSITION,
    entityType: AuditEntityType.DRIVE_APPLICATION,
    entityId: applicationId,
    metadata: {
      driveId: application.drive.id,
      studentId: application.student.id,
      pipelineVersion: target.pipelineVersion.version,
      fromStageName: application.currentStage?.name ?? null,
      toStageName: target.name,
      fromStage: application.stage,
      toStage: stage,
      note: note || null,
      fromStatus: application.status,
      toStatus: status,
    },
  });

  // Tell the student their application moved. A pending (bulk-imported)
  // student has no User row yet, so there is nobody to notify.
  if (application.student.userId) {
    await createNotification({
      userId: application.student.userId,
      type: NotificationType.APPLICATION,
      title: `${application.drive.companyName} — ${target.name}`,
      message:
        status === "IN_PROGRESS"
          ? `Your application for ${roleName} has moved to the ${target.name} stage.`
          : `Your application for ${roleName} is now marked ${STATUS_LABELS[status]}.`,
      resourceType: "Drive",
      resourceId: application.drive.id,
    });
  }

  if (options.revalidate !== false) {
    revalidateApplicationViews(application.drive.id);
  }

  return { success: true };
}

export function revalidateApplicationViews(driveId: string) {
  revalidatePath(`/admin-dashboard/drives/${driveId}`);
  revalidatePath(`/admin-dashboard/drives/${driveId}/applications`);
  revalidatePath("/admin-dashboard/students");
  revalidatePath("/admin-dashboard");
  revalidatePath("/student-dashboard");
}
