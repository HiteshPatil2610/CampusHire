"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { canTransitionDepartmentDrive } from "../domain/drive-lifecycle";

/**
 * Administrative close/archive for a department's instance of a drive.
 *
 * Publishing has its own action because it carries side effects (timestamps,
 * locking, notifications). This handles the terminal transitions, which are
 * pure status changes.
 *
 * **CLOSED is not "the deadline passed."** Whether a drive is open is still
 * derived from `applicationDeadline` at read time and never stored. CLOSED is
 * a department deciding to stop intake — it can happen before the deadline, or
 * after one has already expired.
 *
 * Authorization: DEPT_ADMIN, own department's instance only.
 */

const statusSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  status: z.enum(["CLOSED", "ARCHIVED"]),
});

export type SetDepartmentDriveStatusInput = z.infer<typeof statusSchema>;

export type SetDepartmentDriveStatusResult =
  | { success: true }
  | { success: false; error: string };

export async function setDepartmentDriveStatus(
  input: SetDepartmentDriveStatusInput
): Promise<SetDepartmentDriveStatusResult> {
  try {
    const { department } = await requireDepartmentAdmin();

    const validated = statusSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, status } = validated.data;

    const instance = await prisma.driveDepartmentConfig.findUnique({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      select: { id: true, status: true },
    });

    if (!instance) {
      throw new AuthorizationError(
        "This drive is not assigned to your department."
      );
    }

    const transition = canTransitionDepartmentDrive(instance.status, status);
    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    // `lockedAt` is deliberately not cleared: students applied against this
    // content, so it stays frozen through CLOSED and ARCHIVED.
    await prisma.driveDepartmentConfig.update({
      where: { id: instance.id },
      data: { status },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        event: "department-drive-status-changed",
        departmentCode: department.code,
        fromStatus: instance.status,
        toStatus: status,
      },
    });

    revalidatePath("/admin-dashboard/drives");
    revalidatePath("/student-dashboard/drives");

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("Set department drive status error:", error);
    return {
      success: false,
      error: "Failed to update the drive status. Please try again.",
    };
  }
}
