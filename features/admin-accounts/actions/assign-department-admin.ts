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
import { notifyAdminInvited } from "@/features/notifications/producers/workflow-events";
import { retireStudentAccess } from "../utils/retire-student-record";

/**
 * Thrown inside the assignment transaction to roll it back when the account's
 * student record carries application history. Carries the helper's own
 * explanation straight through to the admin who tried the promotion.
 */
class StudentRecordInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentRecordInUseError";
  }
}

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
      // This account stops being a student: retire its roster row, and take
      // it off the approval queue if it was still waiting there. Both must
      // happen in the same transaction as the promotion, or a failure
      // half-way leaves an admin who is also a student.
      const { retirement, withdrawal } = await retireStudentAccess(
        tx,
        validated.userId
      );

      // A student record with application history is not ours to delete —
      // aborting the promotion is the deliberate resolution the helper asks
      // for, and the transaction rolls back with it.
      if (retirement.action === "refuse") {
        throw new StudentRecordInUseError(retirement.reason);
      }

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
          // Already a user of CampusHire, so they have arrived already: their
          // next sign-in is not an invitation being accepted.
          firstSeenAt: new Date(),
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
          // The deleted rows leave no trace of their own, so the trail is here.
          retiredStudentRecord: retirement.applied,
          withdrewPendingAccessRequest: withdrawal.applied,
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

    await notifyAdminInvited({
      adminUserId: result.updatedUser.id,
      adminName: result.updatedUser.name ?? result.updatedUser.email,
      departmentName: result.admin.department.name,
      actorId: currentUser.id,
    });

    // Revalidate admin pages
    revalidatePath("/super-admin-dashboard/admin-accounts");
    revalidatePath("/super-admin-dashboard/departments");

    return {
      success: true as const,
      data: result.admin,
    };
  } catch (error) {
    // Not a failure — the promotion was refused on purpose, and the reason is
    // written for the admin who attempted it.
    if (error instanceof StudentRecordInUseError) {
      return { success: false as const, error: error.message };
    }

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
