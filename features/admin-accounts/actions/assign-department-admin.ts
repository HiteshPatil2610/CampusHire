"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  assignDepartmentAdminSchema,
  type AssignDepartmentAdminInput,
} from "../schemas/admin";
import { Prisma } from "@prisma/client";
import { createAuditLogInTransaction, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * Assign a user as department admin
 * 
 * Authorization: SUPER_ADMIN only
 * 
 * Workflow:
 * 1. Verify user exists and is not SUPER_ADMIN
 * 2. Verify department exists and is active
 * 3. Check user is not already assigned
 * 4. Update user role to DEPT_ADMIN
 * 5. Create DepartmentAdmin record
 * 6. Create audit log
 * 7. Sync role to Clerk metadata
 * 
 * @param input - User ID and department ID
 * @returns Created admin assignment or error
 */
export async function assignDepartmentAdmin(input: AssignDepartmentAdminInput) {
  try {
    // Verify Super Admin authorization
    const currentUser = await requireSuperAdmin();

    // Validate input
    const validated = assignDepartmentAdminSchema.parse(input);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: validated.userId },
    });

    if (!user) {
      return {
        success: false as const,
        error: "User not found",
      };
    }

    // Prevent assigning SUPER_ADMIN as DEPT_ADMIN
    if (user.role === "SUPER_ADMIN") {
      return {
        success: false as const,
        error: "Cannot assign Super Admin to department admin role",
      };
    }

    // Check if user is already assigned as admin
    const existingAdmin = await prisma.departmentAdmin.findUnique({
      where: { userId: validated.userId },
    });

    if (existingAdmin) {
      return {
        success: false as const,
        error: "User is already assigned as Department Admin",
      };
    }

    // Check if department exists and is active
    const department = await prisma.department.findUnique({
      where: { id: validated.departmentId },
    });

    if (!department) {
      return {
        success: false as const,
        error: "Department not found",
      };
    }

    if (!department.isActive) {
      return {
        success: false as const,
        error: "Cannot assign admin to inactive department",
      };
    }

    // Perform atomic assignment with audit log
    const result = await prisma.$transaction(async (tx) => {
      // Update user role
      const updatedUser = await tx.user.update({
        where: { id: validated.userId },
        data: { role: "DEPT_ADMIN" },
      });

      // Create DepartmentAdmin record
      const admin = await tx.departmentAdmin.create({
        data: {
          userId: validated.userId,
          departmentId: validated.departmentId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              clerkId: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      // Create audit logs (role change + assignment)
      await createAuditLogInTransaction(tx, {
        action: AuditAction.ROLE_CHANGE,
        entityType: AuditEntityType.USER,
        entityId: updatedUser.id,
        metadata: {
          oldRole: user.role,
          newRole: "DEPT_ADMIN",
          email: user.email,
        },
      }, currentUser.id);

      await createAuditLogInTransaction(tx, {
        action: AuditAction.ASSIGN,
        entityType: AuditEntityType.DEPARTMENT_ADMIN,
        entityId: admin.id,
        metadata: {
          userId: validated.userId,
          departmentId: validated.departmentId,
          email: user.email,
          departmentName: department.name,
        },
      }, currentUser.id);

      return { updatedUser, admin };
    });

    // Sync role to Clerk metadata
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(result.updatedUser.clerkId, {
        publicMetadata: {
          role: "DEPT_ADMIN",
        },
      });
    } catch (clerkError) {
      console.error("Failed to sync role to Clerk:", clerkError);
      // Don't fail the operation - database is source of truth
    }

    // Revalidate admin pages
    revalidatePath("/super-admin-dashboard/admin-accounts");
    revalidatePath("/super-admin-dashboard/departments");

    return {
      success: true as const,
      data: result.admin,
    };
  } catch (error) {
    console.error("Error assigning department admin:", error);

    // Handle duplicate assignment (race condition)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false as const,
        error: "User is already assigned as Department Admin",
      };
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
      error: "Failed to assign department admin. Please try again.",
    };
  }
}
