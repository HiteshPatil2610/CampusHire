"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  toggleDepartmentStatusSchema,
  type ToggleDepartmentStatusInput,
} from "../schemas/department";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * Toggle department active/inactive status
 * 
 * Authorization: SUPER_ADMIN only
 * 
 * Deactivation is a soft delete - preserves all related records
 * 
 * @param input - Department ID and new status
 * @returns Updated department or error
 */
export async function toggleDepartmentStatus(input: ToggleDepartmentStatusInput) {
  try {
    // Verify Super Admin authorization
    const user = await requireSuperAdmin();

    // Validate input
    const validated = toggleDepartmentStatusSchema.parse(input);

    // Check if department exists
    const existing = await prisma.department.findUnique({
      where: { id: validated.id },
    });

    if (!existing) {
      return {
        success: false as const,
        error: "Department not found",
      };
    }

    // Update status
    const department = await prisma.department.update({
      where: { id: validated.id },
      data: { isActive: validated.isActive },
    });

    // Create audit log
    await createAuditLog({
      action: validated.isActive ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      entityType: AuditEntityType.DEPARTMENT,
      entityId: department.id,
      metadata: {
        name: department.name,
        code: department.code,
        isActive: department.isActive,
      },
    });

    // Revalidate departments pages
    revalidatePath("/super-admin-dashboard/departments");

    return {
      success: true as const,
      data: department,
    };
  } catch (error) {
    console.error("Error toggling department status:", error);

    // Handle validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false as const,
        error: error.message,
      };
    }

    // Handle authorization errors
    if (
      error instanceof Error &&
      (error.name === "AuthenticationError" ||
        error.name === "AuthorizationError")
    ) {
      return {
        success: false as const,
        error: error.message,
      };
    }

    return {
      success: false as const,
      error: "Failed to update department status. Please try again.",
    };
  }
}
