"use server";

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { applyToDriveSchema } from "../schemas/application";
import { EDITABLE_FIELD_KEYS } from "../utils/application-review-fields";
import { isStudentEligibleForDrive, getIneligibilityReasons } from "@/features/drives/queries/drive-eligibility";
import { eligibleDepartmentLinksInclude } from "@/features/drives/utils/eligible-departments";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { checkApplicationExists } from "../queries/check-application-exists";
import type { DriveApplication } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { createApplicationSubmittedNotification } from "@/lib/notifications";

/**
 * Result type for apply to drive action
 */
export type ApplyToDriveResult =
  | { success: true; application: DriveApplication }
  | { success: false; error: string; reasons?: string[] };

/**
 * Apply to a drive.
 *
 * This action enforces ALL business rules server-side:
 * 1. Authenticated student role
 * 2. Student ownership (cannot apply for another student)
 * 3. Drive exists
 * 4. Eligibility criteria met (re-checked server-side)
 * 5. Application deadline not passed (re-checked server-side)
 * 6. No existing application (checked at app level and DB constraint)
 * 7. The accuracy/finality declaration was accepted
 *
 * **This is the only student-facing write path to `DriveApplication`, and it
 * only ever inserts.** An application is final once submitted: there is no
 * student action that edits its content and none that deletes it. The
 * `(studentId, driveId)` unique constraint is what makes that a guarantee
 * rather than a convention — a re-submission is refused here and, if two
 * requests race, refused again by the database.
 *
 * @param driveId - Drive ID to apply to
 * @returns Result with application or error
 */
export async function applyToDrive(
  driveId: string,
  options: { submittedDetails?: Record<string, string>; consent?: boolean } = {}
): Promise<ApplyToDriveResult> {
  try {
    // 1. Validate input
    const validated = applyToDriveSchema.safeParse({
      driveId,
      submittedDetails: options.submittedDetails ?? {},
      consent: options.consent ?? false,
    });
    if (!validated.success) {
      return {
        success: false,
        error: "Invalid drive ID",
      };
    }

    // 2. Authenticate and get student
    let auth;
    try {
      auth = await requireStudent();
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "Authentication failed",
      };
    }

    // 3. Verify student has academic info
    const studentWithAcademic = await prisma.student.findUnique({
      where: { id: auth.student.id },
      include: { academic: true },
    });

    if (!studentWithAcademic) {
      return {
        success: false,
        error: "Student profile not found. Please complete your profile.",
      };
    }

    if (!studentWithAcademic.academic) {
      return {
        success: false,
        error: "Academic information incomplete. Please complete your academic details.",
      };
    }

    // A lateral-entry student may register before a roll number is issued.
    // It identifies them on every roster and export a recruiter sees, so an
    // application cannot be submitted without one.
    if (!studentWithAcademic.rollNumber) {
      return {
        success: false,
        error:
          "Add your roll number in your profile before applying to a drive.",
      };
    }

    // 4. Verify drive exists
    const drive = await prisma.drive.findUnique({
      where: { id: validated.data.driveId },
      include: eligibleDepartmentLinksInclude,
    });

    if (!drive) {
      return {
        success: false,
        error: "Drive not found",
      };
    }

    // 5. Re-check eligibility server-side (CRITICAL: never trust client)
    const isEligible = isStudentEligibleForDrive(studentWithAcademic, drive);
    
    if (!isEligible) {
      const reasons = getIneligibilityReasons(studentWithAcademic, drive);
      return {
        success: false,
        error: "You are not eligible for this drive",
        reasons,
      };
    }

    // 6. Verify drive is still open (re-check deadline server-side)
    const driveStatus = getDriveStatus(drive.applicationDeadline);
    
    if (driveStatus !== "open") {
      return {
        success: false,
        error: "Applications for this drive are closed",
      };
    }

    // 7. Refuse a second submission. This is what makes a submitted
    // application immutable from the student's side: re-applying is the only
    // vector they have, and it is closed here and at the unique constraint.
    const alreadyApplied = await checkApplicationExists(
      studentWithAcademic.id,
      drive.id
    );

    if (alreadyApplied) {
      return {
        success: false,
        error:
          "You have already applied to this drive. Applications are final and cannot be edited or withdrawn.",
      };
    }

    // 8. Require the accuracy and finality declaration
    if (!validated.data.consent) {
      return {
        success: false,
        error:
          "Please confirm your details are accurate, and that you understand the application is final, before submitting.",
      };
    }

    // 9. Keep only the fields the applicant is allowed to change. Anything
    // else the client sent (a locked institutional record, say) is dropped
    // rather than trusted.
    const submittedDetails = Object.fromEntries(
      Object.entries(validated.data.submittedDetails).filter(([key]) =>
        EDITABLE_FIELD_KEYS.has(key)
      )
    );

    // 10. Create application
    // Note: Database unique constraint provides final protection against duplicates
    const application = await prisma.driveApplication.create({
      data: {
        studentId: studentWithAcademic.id,
        driveId: drive.id,
        snapshotCgpa: studentWithAcademic.academic.currentCGPA,
        snapshotBacklogs: studentWithAcademic.academic.activeBacklogs,
        submittedDetails: JSON.stringify(submittedDetails),
        consentAcceptedAt: new Date(),
      },
    });

    // 11. Create audit log
    await createAuditLog({
      action: AuditAction.APPLY,
      entityType: AuditEntityType.DRIVE_APPLICATION,
      entityId: application.id,
      metadata: {
        driveId: drive.id,
        studentId: studentWithAcademic.id,
        companyName: drive.companyName,
        roleName: drive.roleName,
      },
    });

    // 12. Create notification (best-effort, doesn't fail operation)
    await createApplicationSubmittedNotification(
      auth.user.id,
      drive.companyName,
      drive.roleName,
      drive.id
    );

    return {
      success: true,
      application,
    };

  } catch (error) {
    // Handle Prisma unique constraint error gracefully
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Unique constraint violation — two submissions raced past the check
        // above. The first one stands; an application is never overwritten.
        return {
          success: false,
          error:
            "You have already applied to this drive. Applications are final and cannot be edited or withdrawn.",
        };
      }
    }

    // Log unexpected errors but don't expose details to user
    console.error("Error applying to drive:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
