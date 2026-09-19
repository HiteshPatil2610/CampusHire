"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { driveSchema, type DriveInput } from "../schemas/drive";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";
import { isCentralDrive } from "../domain/drive-kind";
import { toDepartmentDriveUpdateData } from "../domain/drive-write-data";
import { updateDriveWithEligibility } from "../domain/persist-drive";
import { legacyMasterRules } from "../domain/eligibility-rules";
import { withTargetedBatchYears } from "../domain/batch-targeting";
import { parseSubmittedFormJson } from "../domain/application-form-schema";
import { applicationFormKey } from "../domain/application-form";
import { resolveDepartmentApplicationForm } from "../domain/resolve-department-drive";

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
      include: { formFields: true, _count: { select: { applications: true } } },
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

    // Selection rounds are the recruitment pipeline once it exists — changing
    // them here would bypass the Super Admin's approval of pipeline changes.
    const roundsChanged =
      JSON.stringify(validated.selectionRounds) !== existingDrive.selectionRounds;
    if (roundsChanged) {
      const pipelines = await prisma.recruitmentPipelineVersion.count({
        where: { departmentDrive: { driveId }, status: "ACTIVE" },
      });
      if (pipelines > 0) {
        return {
          success: false,
          error:
            "Selection rounds are managed by this drive's recruitment pipeline. Propose a change from the drive's Recruitment page. No changes were saved.",
        };
      }
    }

    const form = parseSubmittedFormJson(validated.applicationFields);
    if (!form.ok) {
      return { success: false, error: form.error };
    }

    // A department-owned drive is published the moment it is posted, so its
    // form freezes on the first application rather than on publish: students
    // have answered it. Resubmitting the same form with other edits is fine —
    // only what a student would see is compared.
    if (
      form.fields &&
      existingDrive._count.applications > 0 &&
      applicationFormKey(form.fields) !==
        applicationFormKey(resolveDepartmentApplicationForm(existingDrive, null).fields)
    ) {
      return {
        success: false,
        error:
          "Students have already applied to this drive, so its application form can no longer change. No changes were saved.",
      };
    }

    const outcome = await updateDriveWithEligibility(
      driveId,
      toDepartmentDriveUpdateData(validated),
      scope.eligibleDepartments,
      {
        legacy: legacyMasterRules(validated.minCGPA, validated.maxActiveBacklogs),
        extras: withTargetedBatchYears([], validated.batchYears),
      },
      "PUBLISHED",
      form.fields
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
