"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { withdrawApplicationSchema } from "../schemas/application";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * Result type for the withdraw action
 */
export type WithdrawApplicationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Withdraw a student's application to a drive.
 *
 * Business rules enforced server-side:
 * 1. Authenticated student role
 * 2. Ownership - a student can only withdraw their own application
 * 3. The application deadline must not have passed (withdrawal locks after it)
 * 4. The application must not already be past the APPLIED stage
 *
 * Withdrawal deletes the row so the student is free to re-apply while the
 * drive is still open, matching the unique [studentId, driveId] constraint.
 */
export async function withdrawApplication(
  driveId: string
): Promise<WithdrawApplicationResult> {
  try {
    const validated = withdrawApplicationSchema.safeParse({ driveId });
    if (!validated.success) {
      return { success: false, error: "Invalid drive ID" };
    }

    let auth;
    try {
      auth = await requireStudent();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }

    // Scope the lookup to the caller's own student record - ownership is never
    // taken from the client.
    const application = await prisma.driveApplication.findUnique({
      where: {
        studentId_driveId: {
          studentId: auth.student.id,
          driveId: validated.data.driveId,
        },
      },
      include: { drive: true },
    });

    if (!application) {
      return { success: false, error: "You have not applied to this drive" };
    }

    if (getDriveStatus(application.drive.applicationDeadline) !== "open") {
      return {
        success: false,
        error:
          "The application deadline has passed. This application can no longer be withdrawn.",
      };
    }

    if (application.stage !== "APPLIED") {
      return {
        success: false,
        error:
          "Your application has progressed past the application stage and is locked.",
      };
    }

    await prisma.driveApplication.delete({
      where: { id: application.id },
    });

    await createAuditLog({
      action: AuditAction.WITHDRAW,
      entityType: AuditEntityType.DRIVE_APPLICATION,
      entityId: application.id,
      metadata: {
        driveId: application.driveId,
        studentId: application.studentId,
        companyName: application.drive.companyName,
        roleName: application.drive.roleName,
      },
    });

    revalidatePath("/student-dashboard");
    revalidatePath("/student-dashboard/drives");
    revalidatePath("/student-dashboard/applications");

    return { success: true };
  } catch (error) {
    console.error("Error withdrawing application:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
