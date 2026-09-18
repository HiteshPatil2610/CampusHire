"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { isCentralDrive } from "../domain/drive-kind";
import { canTransitionMaster } from "../domain/drive-lifecycle";

/**
 * Move a master drive through its own lifecycle: DRAFT → PUBLISHED → ARCHIVED.
 *
 * The master lifecycle is about the Super Admin's authoring process — a DRAFT
 * is still being composed and assigned. It does **not** decide what students
 * see: that is the department instance's `status`, because the same master
 * drive can be live in one department and still being configured in another.
 *
 * Authorization: SUPER_ADMIN only, and only for central drives. A
 * department-owned drive's lifecycle belongs to the department that posted it.
 */

const statusSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  status: z.enum(["PUBLISHED", "ARCHIVED"]),
});

export type SetMasterDriveStatusInput = z.infer<typeof statusSchema>;

export type SetMasterDriveStatusResult =
  | { success: true }
  | { success: false; error: string };

export async function setMasterDriveStatus(
  input: SetMasterDriveStatusInput
): Promise<SetMasterDriveStatusResult> {
  try {
    await requireSuperAdmin();

    const validated = statusSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, status } = validated.data;

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      select: {
        id: true,
        companyName: true,
        roleName: true,
        isCentralDrive: true,
        lifecycleStatus: true,
      },
    });

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    if (!isCentralDrive(drive)) {
      return {
        success: false,
        error:
          "This drive belongs to a department. Its lifecycle is managed by that department.",
      };
    }

    const transition = canTransitionMaster(drive.lifecycleStatus, status);
    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    // Publishing a master drive requires somewhere for it to run. Without an
    // assignment it would be "published" and reach nobody.
    if (status === "PUBLISHED") {
      const assignments = await prisma.driveDepartmentConfig.count({
        where: { driveId },
      });

      if (assignments === 0) {
        return {
          success: false,
          error:
            "Assign this drive to at least one department before publishing it.",
        };
      }
    }

    await prisma.drive.update({
      where: { id: driveId },
      data: { lifecycleStatus: status },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        event: "master-drive-status-changed",
        companyName: drive.companyName,
        roleName: drive.roleName,
        fromStatus: drive.lifecycleStatus,
        toStatus: status,
      },
    });

    revalidatePath("/super-admin-dashboard/drives");
    revalidatePath("/admin-dashboard/drives");

    return { success: true };
  } catch (error) {
    console.error("Set master drive status error:", error);
    return {
      success: false,
      error: "Failed to update the drive status. Please try again.",
    };
  }
}
