"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { canTransitionDepartmentDrive } from "../domain/drive-lifecycle";

const publishSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
});

export type PublishDepartmentDriveResult =
  | { success: true; notified: number }
  | { success: false; error: string };

/**
 * Release a department's instance of a drive to its students.
 *
 * This is the moment the drive becomes real for that department:
 *
 *  - `status` → PUBLISHED, which is what the student queries filter on
 *  - `publishedAt` / `publishedByUserId` record who released it and when
 *  - `lockedAt` freezes the application form, so what students answered can
 *    never be re-interpreted afterwards
 *  - eligible students in *this department only* are notified
 *
 * Authorization: DEPT_ADMIN, and only for their own department's instance.
 * The department id comes from the session, never from the request, so there
 * is no way to publish another department's drive.
 */
export async function publishDepartmentDrive(
  input: z.infer<typeof publishSchema>
): Promise<PublishDepartmentDriveResult> {
  try {
    const { department, user } = await requireDepartmentAdmin();

    const validated = publishSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId } = validated.data;

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

    const transition = canTransitionDepartmentDrive(instance.status, "PUBLISHED");
    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      include: eligibleDepartmentLinksInclude,
    });

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    const now = new Date();

    await prisma.driveDepartmentConfig.update({
      where: { id: instance.id },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedByUserId: user.id,
        lockedAt: now,
      },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        event: "department-drive-published",
        departmentCode: department.code,
        companyName: drive.companyName,
        roleName: drive.roleName,
      },
    });

    // Scoped to this department: publishing is a per-department act, so the
    // other departments running the same master drive are not announced here.
    const { notified } = await notifyEligibleStudentsOfDrive(drive, {
      departmentIds: [department.id],
    });

    revalidatePath("/admin-dashboard/drives");
    revalidatePath("/student-dashboard/drives");

    return { success: true, notified };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("Publish department drive error:", error);
    return {
      success: false,
      error: "Failed to publish the drive. Please try again.",
    };
  }
}
