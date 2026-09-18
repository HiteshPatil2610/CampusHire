"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { driveSchema, type DriveInput } from "../schemas/drive";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { withEligibleDepartmentLinks } from "../utils/eligible-departments";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";
import { buildDepartmentDriveData } from "../domain/drive-write-data";
import { assertDeadlineInFuture } from "../domain/drive-window";
import { createDriveWithEligibility } from "../domain/persist-drive";

export interface CreateDriveResult {
  success: boolean;
  driveId?: string;
  error?: string;
}

/**
 * Create a department-owned master drive.
 *
 * Authorization: DEPT_ADMIN. Both the owning department and the set of
 * departments the drive reaches come from the authenticated session — see
 * `resolveDeptAdminEligibleDepartments`. Reaching several departments is the
 * Super Admin's central-drive flow, not this one.
 */
export async function createDrive(input: DriveInput): Promise<CreateDriveResult> {
  try {
    const { department } = await requireDepartmentAdmin();

    const validated = driveSchema.parse(input);

    // The department list is the session's, not the request's.
    const scope = resolveDeptAdminEligibleDepartments(
      validated.eligibleDepartments,
      department.id
    );
    if (!scope.ok) {
      return { success: false, error: scope.error };
    }

    const deadline = assertDeadlineInFuture(
      new Date(validated.applicationDeadline)
    );
    if (!deadline.ok) {
      return { success: false, error: deadline.error };
    }

    // A department posting its own drive is already its author, so its
    // instance starts PUBLISHED rather than ASSIGNED — there is no separate
    // party to hand it to. Only the Super Admin's assignment flow produces
    // ASSIGNED instances.
    const drive = await createDriveWithEligibility(
      buildDepartmentDriveData(validated, department.id),
      scope.eligibleDepartments,
      "PUBLISHED"
    );

    // Tell the students who can actually apply. Best-effort: a failed
    // fan-out must not fail a drive that was created successfully.
    await notifyEligibleStudentsOfDrive(
      withEligibleDepartmentLinks(drive, scope.eligibleDepartments)
    );

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
