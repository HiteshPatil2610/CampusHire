"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyDriveAssigned } from "@/features/notifications/producers/workflow-events";
import { isCentralDrive } from "../domain/drive-kind";
import { ensureDepartmentsAssigned } from "../domain/department-assignment";

const assignSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  departmentIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one department")
    .max(50, "Too many departments"),
});

export type AssignDriveDepartmentsInput = z.infer<typeof assignSchema>;

export type AssignDriveDepartmentsResult =
  | {
      success: true;
      /** Departments that gained an assignment on this call. */
      assigned: string[];
      /** Departments that were already assigned — idempotent no-ops. */
      alreadyAssigned: string[];
      /** Requested departments that do not exist or are inactive. */
      skipped: string[];
    }
  | { success: false; error: string };

/**
 * Assign a master drive to one or more departments.
 *
 * For each selected department this creates, in a single transaction, both the
 * eligibility edge (`DriveEligibleDepartment`) and the department instance
 * (`DriveDepartmentConfig`) at status `ASSIGNED`. The department's admin picks
 * it up from there.
 *
 * Idempotent: a department that is already assigned is reported back rather
 * than duplicated, and its existing instance — status and whatever its admin
 * configured — is left untouched.
 *
 * Authorization: SUPER_ADMIN only. Assignment is how a drive reaches more than
 * one department, which is precisely the operation a department admin must not
 * have (see `resolveDeptAdminEligibleDepartments`).
 */
export async function assignDriveToDepartments(
  input: AssignDriveDepartmentsInput
): Promise<AssignDriveDepartmentsResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = assignSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, departmentIds } = validated.data;

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      select: { id: true, companyName: true, roleName: true, isCentralDrive: true },
    });

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    // A department-owned drive reaches exactly the department that posted it.
    // Assigning it elsewhere would route one department's drive to another
    // department's students through the back door.
    if (!isCentralDrive(drive)) {
      return {
        success: false,
        error:
          "Only a central drive can be assigned to departments. A department drive reaches its own department only.",
      };
    }

    // Only departments that actually exist and are active can be assigned.
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds }, isActive: true },
      select: { id: true, code: true },
    });

    if (departments.length === 0) {
      return {
        success: false,
        error: "None of the selected departments exist or are active",
      };
    }

    const validIds = departments.map((d) => d.id);
    const skipped = departmentIds.filter((id) => !validIds.includes(id));

    const outcome = await prisma.$transaction((tx) =>
      ensureDepartmentsAssigned(tx, driveId, validIds)
    );

    const codeById = new Map(departments.map((d) => [d.id, d.code]));
    const codesOf = (ids: string[]) => ids.map((id) => codeById.get(id) ?? id);

    await createAuditLog({
      action: AuditAction.ASSIGN,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: drive.companyName,
        roleName: drive.roleName,
        assignedDepartmentCodes: codesOf(outcome.assigned),
        alreadyAssignedDepartmentCodes: codesOf(outcome.alreadyAssigned),
        skippedDepartmentIds: skipped,
      },
    });

    // The newly assigned departments' admins have work to do. No student is
    // told anything until a department publishes.
    if (outcome.assigned.length > 0) {
      await notifyDriveAssigned({
        driveId,
        actorId: superAdmin.id,
        departmentIds: outcome.assigned,
      });
    }

    revalidatePath("/super-admin-dashboard/drives");
    revalidatePath("/admin-dashboard/drives");

    return {
      success: true,
      assigned: outcome.assigned,
      alreadyAssigned: outcome.alreadyAssigned,
      skipped,
    };
  } catch (error) {
    console.error("Assign drive to departments error:", error);
    return {
      success: false,
      error: "Failed to assign the drive. Please try again.",
    };
  }
}
