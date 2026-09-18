"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { removeDepartmentAssignment } from "../domain/department-assignment";

const unassignSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  departmentId: z.string().min(1, "Department is required"),
});

export type UnassignDriveDepartmentInput = z.infer<typeof unassignSchema>;

export type UnassignDriveDepartmentResult =
  | { success: true }
  | { success: false; error: string; applicationCount?: number };

/**
 * Remove one department's assignment from a master drive.
 *
 * Refused when that department's students hold applications to the drive.
 * An application is a historical record of something a student actually did;
 * unassigning must never be a back door to deleting it, which is also why
 * `DriveApplication.drive` is `onDelete: Restrict`. The department stays
 * assigned and the caller is told how many applications are in the way.
 *
 * When it does proceed, both halves of the assignment — the eligibility edge
 * and the department instance — are removed in one transaction, so the pair
 * never half-survives.
 *
 * Authorization: SUPER_ADMIN only.
 */
export async function unassignDriveDepartment(
  input: UnassignDriveDepartmentInput
): Promise<UnassignDriveDepartmentResult> {
  try {
    await requireSuperAdmin();

    const validated = unassignSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, departmentId } = validated.data;

    const [drive, department] = await Promise.all([
      prisma.drive.findUnique({
        where: { id: driveId },
        select: { id: true, companyName: true, roleName: true },
      }),
      prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, code: true },
      }),
    ]);

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const outcome = await prisma.$transaction((tx) =>
      removeDepartmentAssignment(tx, driveId, departmentId)
    );

    if (!outcome.removed) {
      return {
        success: false,
        applicationCount: outcome.applicationCount,
        error:
          `${department.code} cannot be unassigned: ${outcome.applicationCount} ` +
          `student${outcome.applicationCount === 1 ? " has" : "s have"} already applied. ` +
          `Their applications are kept, so the department stays assigned.`,
      };
    }

    await createAuditLog({
      action: AuditAction.UNASSIGN,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: drive.companyName,
        roleName: drive.roleName,
        unassignedDepartmentCode: department.code,
      },
    });

    revalidatePath("/super-admin-dashboard/drives");
    revalidatePath("/admin-dashboard/drives");

    return { success: true };
  } catch (error) {
    console.error("Unassign drive department error:", error);
    return {
      success: false,
      error: "Failed to unassign the department. Please try again.",
    };
  }
}
