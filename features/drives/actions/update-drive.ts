"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { driveSchema, type DriveInput } from "../schemas/drive";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";
import { isCentralDrive } from "../domain/drive-kind";
import { toDepartmentDriveUpdateData } from "../domain/drive-write-data";
import { updateDriveWithEligibility } from "../domain/persist-drive";

export interface UpdateDriveResult {
  success: boolean;
  error?: string;
}

/**
 * Update a department-owned master drive.
 *
 * Authorization: DEPT_ADMIN, and the drive must be their own department's.
 * A central drive is refused outright — that stays with the Super Admin.
 */
export async function updateDrive(
  driveId: string,
  input: DriveInput
): Promise<UpdateDriveResult> {
  try {
    const { department } = await requireDepartmentAdmin();

    const existingDrive = await prisma.drive.findUnique({
      where: { id: driveId },
    });

    if (!existingDrive) {
      return {
        success: false,
        error: "Drive not found",
      };
    }

    // A central drive is the Super Admin's to edit, never a department's —
    // checked on the domain discriminant rather than on a null departmentId.
    if (isCentralDrive(existingDrive)) {
      return {
        success: false,
        error:
          "This is a central drive posted by the Super Admin and cannot be edited here.",
      };
    }

    if (existingDrive.departmentId !== department.id) {
      return {
        success: false,
        error: "You do not have permission to edit this drive",
      };
    }

    const validated = driveSchema.parse(input);

    // The department list is the session's, not the request's.
    const scope = resolveDeptAdminEligibleDepartments(
      validated.eligibleDepartments,
      department.id
    );
    if (!scope.ok) {
      return { success: false, error: scope.error };
    }

    const outcome = await updateDriveWithEligibility(
      driveId,
      toDepartmentDriveUpdateData(validated),
      scope.eligibleDepartments,
      "PUBLISHED"
    );

    // A department drive always reaches exactly its own department, so there
    // is nothing to remove and this branch is unreachable in practice. It is
    // handled rather than ignored so the contract holds if that ever changes.
    if (!outcome.ok) {
      return {
        success: false,
        error:
          "This drive has applications from a department that would be removed. No changes were saved.",
      };
    }

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
