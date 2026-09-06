"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  updateDepartmentSchema,
  type UpdateDepartmentInput,
} from "../schemas/department";
import { Prisma } from "@prisma/client";
import { createAuditLog, AuditAction, AuditEntityType, getChangeMetadata } from "@/lib/audit";

/**
 * Update an existing department
 * 
 * Authorization: SUPER_ADMIN only
 * 
 * @param input - Department update data
 * @returns Updated department or error
 */
export async function updateDepartment(input: UpdateDepartmentInput) {
  try {
    // Verify Super Admin authorization
    const user = await requireSuperAdmin();

    // Validate input
    const validated = updateDepartmentSchema.parse(input);

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

    // Build update data (only include provided fields)
    const updateData: Prisma.DepartmentUpdateInput = {};
    const changedFields: string[] = [];
    
    if (validated.name !== undefined) {
      updateData.name = validated.name;
      changedFields.push("name");
    }
    if (validated.code !== undefined) {
      updateData.code = validated.code;
      changedFields.push("code");
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
      changedFields.push("isActive");
    }

    // Update department
    const department = await prisma.department.update({
      where: { id: validated.id },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DEPARTMENT,
      entityId: department.id,
      metadata: {
        ...getChangeMetadata(changedFields),
        name: department.name,
        code: department.code,
      },
    });

    // Revalidate departments pages
    revalidatePath("/super-admin-dashboard/departments");

    return {
      success: true as const,
      data: department,
    };
  } catch (error) {
    console.error("Error updating department:", error);

    // Handle duplicate code error
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[]) || [];
      if (target.includes("code")) {
        return {
          success: false as const,
          error: `A department with code '${input.code}' already exists`,
        };
      }
    }

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
      error: "Failed to update department. Please try again.",
    };
  }
}
