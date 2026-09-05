"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { driveSchema, type DriveInput } from "../schemas/drive";

export interface CreateDriveResult {
  success: boolean;
  driveId?: string;
  error?: string;
}

/**
 * Create a new placement drive
 * Requires DEPT_ADMIN role and automatically associates with admin's department
 */
export async function createDrive(input: DriveInput): Promise<CreateDriveResult> {
  try {
    // Verify authentication and get department admin context
    const { user, admin, department } = await requireDepartmentAdmin();

    // Validate input
    const validated = driveSchema.parse(input);

    // Ensure deadline is in future for new drives
    const deadline = new Date(validated.applicationDeadline);
    if (deadline <= new Date()) {
      return {
        success: false,
        error: "Application deadline must be in the future",
      };
    }

    // Create drive
    const drive = await prisma.drive.create({
      data: {
        departmentId: department.id, // Always use authenticated admin's department
        companyName: validated.companyName,
        roleName: validated.roleName,
        jobDescriptionUrl: validated.jobDescriptionUrl || null,
        packageOffered: validated.packageOffered,
        selectionRounds: JSON.stringify(validated.selectionRounds),
        driveDate: new Date(validated.driveDate),
        applicationDeadline: deadline,
        applyMethod: validated.applyMethod,
        externalApplyUrl: validated.externalApplyUrl || null,
        minCGPA: validated.minCGPA,
        maxActiveBacklogs: validated.maxActiveBacklogs,
        eligibleDepartments: JSON.stringify(validated.eligibleDepartments),
      },
    });

    return {
      success: true,
      driveId: drive.id,
    };
  } catch (error) {
    console.error("Create drive error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to create drive. Please try again.",
    };
  }
}
