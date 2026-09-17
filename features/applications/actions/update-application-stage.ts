"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { createNotification, NotificationType } from "@/lib/notifications";
import {
  updateApplicationStageSchema,
  type UpdateApplicationStageInput,
} from "../schemas/application";
import {
  STAGE_LABELS,
  STATUS_LABELS,
  validateStageTransition,
} from "../utils/application-progress";

export type UpdateApplicationStageResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Advance a student's application through the selection process.
 *
 * This is the only write path for `DriveApplication.stage` and `.status`.
 * Both columns are owned by the department admin running the drive — a
 * student can see their progress but can never move it.
 *
 * Authorization: department admin, scoped to a drive they run and to an
 * applicant from their own department (central drives are shared across
 * departments, so the applicant scope is checked separately from the drive).
 */
export async function updateApplicationStage(
  input: UpdateApplicationStageInput
): Promise<UpdateApplicationStageResult> {
  try {
    const { department, user } = await requireDepartmentAdmin();

    const validated = updateApplicationStageSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid request",
      };
    }

    const { applicationId, stage, status } = validated.data;

    const application = await prisma.driveApplication.findUnique({
      where: { id: applicationId },
      include: {
        student: { select: { id: true, departmentId: true, userId: true } },
        drive: {
          select: {
            id: true,
            companyName: true,
            roleName: true,
            departmentId: true,
            isCentralDrive: true,
            eligibleDepartmentLinks: {
              where: { departmentId: department.id },
              select: { departmentId: true },
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
      throw new AuthorizationError(
        "You do not have permission to update this application"
      );
    }

    // And the admin must actually run this drive.
    const ownsDrive = application.drive.departmentId === department.id;
    const runsCentralDrive =
      application.drive.isCentralDrive &&
      application.drive.eligibleDepartmentLinks.length > 0;

    if (!ownsDrive && !runsCentralDrive) {
      throw new AuthorizationError(
        "You do not have permission to update applications for this drive"
      );
    }

    const transition = validateStageTransition({
      currentStage: application.stage,
      currentStatus: application.status,
      nextStage: stage,
      nextStatus: status,
    });

    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    await prisma.driveApplication.update({
      where: { id: applicationId },
      data: {
        stage,
        status,
        stageUpdatedAt: new Date(),
        stageUpdatedById: user.id,
      },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE_APPLICATION,
      entityId: applicationId,
      metadata: {
        driveId: application.drive.id,
        studentId: application.student.id,
        fromStage: application.stage,
        toStage: stage,
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
        title: `${application.drive.companyName} — ${STAGE_LABELS[stage]}`,
        message:
          status === "IN_PROGRESS"
            ? `Your application for ${application.drive.roleName} has moved to the ${STAGE_LABELS[stage]} stage.`
            : `Your application for ${application.drive.roleName} is now marked ${STATUS_LABELS[status]}.`,
        resourceType: "Drive",
        resourceId: application.drive.id,
      });
    }

    revalidatePath(`/admin-dashboard/drives/${application.drive.id}/applications`);
    revalidatePath("/admin-dashboard/students");
    revalidatePath("/admin-dashboard");
    revalidatePath("/student-dashboard");

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("updateApplicationStage error:", error);
    return { success: false, error: "Failed to update the application." };
  }
}
