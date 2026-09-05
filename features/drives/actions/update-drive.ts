"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { driveSchema, type DriveInput } from "../schemas/drive";

export interface UpdateDriveResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing placement drive
 * Requires DEPT_ADMIN role and verifies drive belongs to admin's department
 */
export async function updateDrive(
  driveId: string,
  input: DriveInput
): Promise<UpdateDriveResult> {
  try {
    // Verify authentication and get department admin context
    const { user, admin, department } = await requireDepartmentAdmin();

    // Verify drive exists and belongs to admin's department
    const existingDrive = await prisma.drive.findUnique({
      where: { id: driveId },
    });

    if (!existingDrive) {
      return {
        success: false,
        error: "Drive not found",
      };
    }

    if (existingDrive.departmentId !== department.id) {
      return {
        success: false,
        error: "You do not have permission to edit this drive",
      };
    }

    // Validate input
    const validated = driveSchema.parse(input);

    // Update drive
    await prisma.drive.update({
      where: { id: driveId },
      data: {
        companyName: validated.companyName,
        roleName: validated.roleName,
        jobDescriptionUrl: validated.jobDescriptionUrl || null,
        packageOffered: validated.packageOffered,
        selectionRounds: JSON.stringify(validated.selectionRounds),
        driveDate: new Date(validated.driveDate),
        applicationDeadline: new Date(validated.applicationDeadline),
        applyMethod: validated.applyMethod,
        externalApplyUrl: validated.externalApplyUrl || null,
        minCGPA: validated.minCGPA,
        maxActiveBacklogs: validated.maxActiveBacklogs,
        eligibleDepartments: JSON.stringify(validated.eligibleDepartments),
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Update drive error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update drive. Please try again.",
    };
  }
}
