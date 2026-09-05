"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  removeDepartmentAdminSchema,
  type RemoveDepartmentAdminInput,
} from "../schemas/admin";

/**
 * Remove department admin assignment
 * 
 * Authorization: SUPER_ADMIN only
 * 
 * Workflow:
 * 1. Verify DepartmentAdmin record exists
 * 2. Delete DepartmentAdmin record
 * 3. Update user role to STUDENT (safe default)
 * 4. Sync role to Clerk metadata
 * 
 * Does NOT delete:
 * - Clerk identity
 * - CampusHire User record
 * - Historical data created by the admin
 * 
 * @param input - User ID
 * @returns Success status or error
 */
export async function removeDepartmentAdmin(input: RemoveDepartmentAdminInput) {
  try {
    // Verify Super Admin authorization
    await requireSuperAdmin();

    // Validate input
    const validated = removeDepartmentAdminSchema.parse(input);

    // Check if user has admin assignment
    const admin = await prisma.departmentAdmin.findUnique({
      where: { userId: validated.userId },
      include: {
        user: true,
      },
    });

    if (!admin) {
      return {
        success: false as const,
        error: "Department Admin assignment not found",
      };
    }

    // Prevent removing SUPER_ADMIN (should not have DepartmentAdmin record anyway)
    if (admin.user.role === "SUPER_ADMIN") {
      return {
        success: false as const,
        error: "Cannot remove Super Admin account",
      };
    }

    // Perform atomic removal
    const result = await prisma.$transaction(async (tx) => {
      // Delete DepartmentAdmin record
      await tx.departmentAdmin.delete({
        where: { userId: validated.userId },
      });

      // Update user role to STUDENT (safe default)
      const updatedUser = await tx.user.update({
        where: { id: validated.userId },
        data: { role: "STUDENT" },
      });

      return updatedUser;
    });

    // Sync role to Clerk metadata
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(result.clerkId, {
        publicMetadata: {
          role: "STUDENT",
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
      data: {
        userId: validated.userId,
        message: "Department Admin removed successfully",
      },
    };
  } catch (error) {
    console.error("Error removing department admin:", error);

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
      error: "Failed to remove department admin. Please try again.",
    };
  }
}
