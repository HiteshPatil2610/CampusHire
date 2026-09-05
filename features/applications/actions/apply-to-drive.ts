"use server";

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { applyToDriveSchema } from "../schemas/application";
import { isStudentEligibleForDrive, getIneligibilityReasons } from "@/features/drives/queries/drive-eligibility";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { checkApplicationExists } from "../queries/check-application-exists";
import type { DriveApplication } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Result type for apply to drive action
 */
export type ApplyToDriveResult =
  | { success: true; application: DriveApplication }
  | { success: false; error: string; reasons?: string[] };

/**
 * Apply to a drive
 * 
 * This action enforces ALL business rules server-side:
 * 1. Authenticated student role
 * 2. Student ownership (cannot apply for another student)
 * 3. Drive exists
 * 4. Eligibility criteria met (re-checked server-side)
 * 5. Application deadline not passed (re-checked server-side)
 * 6. No existing application (checked at app level and DB constraint)
 * 
 * @param driveId - Drive ID to apply to
 * @returns Result with application or error
 */
export async function applyToDrive(
  driveId: string
): Promise<ApplyToDriveResult> {
  try {
    // 1. Validate input
    const validated = applyToDriveSchema.safeParse({ driveId });
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

    // 4. Verify drive exists
    const drive = await prisma.drive.findUnique({
      where: { id: validated.data.driveId },
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

    // 7. Check for existing application (UX improvement)
    const alreadyApplied = await checkApplicationExists(
      studentWithAcademic.id,
      drive.id
    );

    if (alreadyApplied) {
      return {
        success: false,
        error: "You have already applied to this drive",
      };
    }

    // 8. Create application
    // Note: Database unique constraint provides final protection against duplicates
    const application = await prisma.driveApplication.create({
      data: {
        studentId: studentWithAcademic.id,
        driveId: drive.id,
      },
    });

    return {
      success: true,
      application,
    };

  } catch (error) {
    // Handle Prisma unique constraint error gracefully
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Unique constraint violation
        return {
          success: false,
          error: "You have already applied to this drive",
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
