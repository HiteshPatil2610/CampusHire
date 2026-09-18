"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/audit";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import {
  createCentralDriveSchema,
  type CreateCentralDriveInput,
} from "../schemas/central-drive";
import { withEligibleDepartmentLinks } from "../utils/eligible-departments";
import { buildCentralDriveData } from "../domain/drive-write-data";
import { assertDeadlineInFuture } from "../domain/drive-window";
import {
  auditDriveWrite,
  createDriveWithEligibility,
} from "../domain/persist-drive";

export interface CreateCentralDriveResult {
  success: boolean;
  driveId?: string;
  error?: string;
}

/**
 * Create an institution-wide central (master) drive.
 *
 * Authorization: SUPER_ADMIN only. `departmentId` and `isCentralDrive` are set
 * from the domain's `driveKindColumns` and never read from the client.
 */
export async function createCentralDrive(
  input: CreateCentralDriveInput
): Promise<CreateCentralDriveResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = createCentralDriveSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const data = validated.data;

    const deadline = assertDeadlineInFuture(
      new Date(data.applicationDeadline)
    );
    if (!deadline.ok) {
      return { success: false, error: deadline.error };
    }

    // Only departments that actually exist and are active can be made eligible
    const departments = await prisma.department.findMany({
      where: { id: { in: data.eligibleDepartments }, isActive: true },
      select: { id: true, code: true },
    });

    if (departments.length === 0) {
      return {
        success: false,
        error: "Select at least one active department for this drive",
      };
    }

    const eligibleDepartmentIds = departments.map((d) => d.id);

    const drive = await createDriveWithEligibility(
      { ...buildCentralDriveData(data), createdByUserId: superAdmin.id },
      eligibleDepartmentIds
    );

    await auditDriveWrite({
      action: AuditAction.CREATE,
      driveId: drive.id,
      kind: "CENTRAL",
      companyName: drive.companyName,
      roleName: drive.roleName,
      eligibleDepartmentCodes: departments.map((d) => d.code),
    });

    // Tell the students who can actually apply, across every eligible
    // department. Best-effort: never fails the drive creation.
    await notifyEligibleStudentsOfDrive(
      withEligibleDepartmentLinks(drive, eligibleDepartmentIds)
    );

    return { success: true, driveId: drive.id };
  } catch (error) {
    console.error("Create central drive error:", error);
    return {
      success: false,
      error: "Failed to create central drive. Please try again.",
    };
  }
}
