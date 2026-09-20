"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely } from "@/lib/notifications";

/**
 * Disabling, reactivating and moving a department admin.
 *
 * Disabling is not deletion: the `DepartmentAdmin` row stays, and with it the
 * drives they published, the applications they moved and every audit entry
 * naming them. What goes is the authorization — `requireDepartmentAdmin`
 * refuses a disabled row, so every department-scoped action refuses them from
 * that moment.
 *
 * Authorization: SUPER_ADMIN only.
 */

const statusSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

const departmentSchema = z.object({
  userId: z.string().min(1),
  departmentId: z.string().min(1),
});

export type AdminStatusResult =
  | { success: true; message: string }
  | { success: false; error: string };

function revalidateAdminViews() {
  revalidatePath("/super-admin-dashboard/admins");
  revalidatePath("/super-admin-dashboard/departments");
  revalidatePath("/admin-dashboard");
}

async function loadAdmin(userId: string) {
  return prisma.departmentAdmin.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      department: { select: { id: true, code: true, name: true, isActive: true } },
    },
  });
}

/** Take away a department admin's access, keeping everything they did. */
export async function disableDepartmentAdmin(
  input: z.infer<typeof statusSchema>
): Promise<AdminStatusResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = statusSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const admin = await loadAdmin(validated.data.userId);
    if (!admin) return { success: false, error: "Department admin not found." };
    if (admin.status === "DISABLED") {
      return { success: false, error: "This admin is already disabled." };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const claim = await tx.departmentAdmin.updateMany({
        where: { userId: admin.userId, status: "ACTIVE" },
        data: {
          status: "DISABLED",
          disabledAt: now,
          disabledById: superAdmin.id,
          disableReason: validated.data.reason || null,
        },
      });
      if (claim.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.DISABLE,
          entityType: AuditEntityType.DEPARTMENT_ADMIN,
          entityId: admin.id,
          metadata: {
            email: admin.user.email,
            departmentCode: admin.department.code,
            reason: validated.data.reason || null,
          },
        },
        superAdmin.id
      );
    });

    // Their account still exists, so tell them why it stopped working.
    await deliverNotificationSafely({
      event: "ACCOUNT_UPDATE",
      role: "DEPT_ADMIN",
      recipients: [{ userId: admin.userId }],
      content: {
        title: "Your department admin access was disabled",
        message: validated.data.reason
          ? `Your access to ${admin.department.name} was disabled. Reason: ${validated.data.reason}`
          : `Your access to ${admin.department.name} was disabled by the placement office.`,
      },
      dedupeKey: `admin-disabled:${admin.id}:${now.getTime()}`,
      resourceType: "DepartmentAdmin",
      resourceId: admin.id,
    });

    revalidateAdminViews();
    return {
      success: true,
      message: `${admin.user.name ?? admin.user.email} can no longer administer ${admin.department.code}. Their history is unchanged.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This admin changed while you were working. Reload the page." };
    }
    console.error("disableDepartmentAdmin error:", error);
    return { success: false, error: "Could not disable this admin. Please try again." };
  }
}

/** Give a disabled admin their department back. */
export async function reactivateDepartmentAdmin(
  input: { userId: string }
): Promise<AdminStatusResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = statusSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const admin = await loadAdmin(validated.data.userId);
    if (!admin) return { success: false, error: "Department admin not found." };
    if (admin.status === "ACTIVE") {
      return { success: false, error: "This admin is already active." };
    }
    if (!admin.department.isActive) {
      return {
        success: false,
        error: `${admin.department.code} is inactive. Activate the department before reactivating its admin.`,
      };
    }
    // Their role may have been changed while they were disabled.
    if (admin.user.role === "SUPER_ADMIN") {
      return { success: false, error: "This account is now a Super Admin and needs no department." };
    }

    await prisma.$transaction(async (tx) => {
      const claim = await tx.departmentAdmin.updateMany({
        where: { userId: admin.userId, status: "DISABLED" },
        data: { status: "ACTIVE", disabledAt: null, disabledById: null, disableReason: null },
      });
      if (claim.count === 0) throw new Error("changed");

      // A demoted account gets its admin role back with its authorization.
      if (admin.user.role !== "DEPT_ADMIN") {
        await tx.user.update({ where: { id: admin.userId }, data: { role: "DEPT_ADMIN" } });
      }

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.REACTIVATE,
          entityType: AuditEntityType.DEPARTMENT_ADMIN,
          entityId: admin.id,
          metadata: { email: admin.user.email, departmentCode: admin.department.code },
        },
        superAdmin.id
      );
    });

    await deliverNotificationSafely({
      event: "ACCOUNT_UPDATE",
      role: "DEPT_ADMIN",
      recipients: [{ userId: admin.userId }],
      content: {
        title: `Your access to ${admin.department.name} was restored`,
        message: `You can administer ${admin.department.name} again.`,
        actionUrl: "/admin-dashboard",
      },
      dedupeKey: `admin-reactivated:${admin.id}:${Date.now()}`,
      resourceType: "DepartmentAdmin",
      resourceId: admin.id,
    });

    revalidateAdminViews();
    return {
      success: true,
      message: `${admin.user.name ?? admin.user.email} administers ${admin.department.code} again.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This admin changed while you were working. Reload the page." };
    }
    console.error("reactivateDepartmentAdmin error:", error);
    return { success: false, error: "Could not reactivate this admin. Please try again." };
  }
}

/**
 * Move an admin to another department. What they did in the old one stays
 * exactly as it was — drives, applications and audit entries are history, not
 * property of the current assignment.
 */
export async function changeAdminDepartment(
  input: z.infer<typeof departmentSchema>
): Promise<AdminStatusResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = departmentSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const [admin, department] = await Promise.all([
      loadAdmin(validated.data.userId),
      prisma.department.findUnique({
        where: { id: validated.data.departmentId },
        select: { id: true, code: true, name: true, isActive: true },
      }),
    ]);

    if (!admin) return { success: false, error: "Department admin not found." };
    if (!department) return { success: false, error: "Department not found." };
    if (!department.isActive) {
      return { success: false, error: "That department is inactive. Activate it first." };
    }
    if (admin.departmentId === department.id) {
      return { success: false, error: `They already administer ${department.code}.` };
    }

    await prisma.$transaction(async (tx) => {
      const claim = await tx.departmentAdmin.updateMany({
        where: { userId: admin.userId, departmentId: admin.departmentId },
        data: { departmentId: department.id },
      });
      if (claim.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.ASSIGN,
          entityType: AuditEntityType.DEPARTMENT_ADMIN,
          entityId: admin.id,
          metadata: {
            event: "department-changed",
            email: admin.user.email,
            fromDepartmentCode: admin.department.code,
            toDepartmentCode: department.code,
          },
        },
        superAdmin.id
      );
    });

    await deliverNotificationSafely({
      event: "ACCOUNT_UPDATE",
      role: "DEPT_ADMIN",
      recipients: [{ userId: admin.userId }],
      content: {
        title: `You now administer ${department.name}`,
        message: `The placement office moved you from ${admin.department.name} to ${department.name}.`,
        actionUrl: "/admin-dashboard",
      },
      dedupeKey: `admin-department:${admin.id}:${department.id}`,
      resourceType: "DepartmentAdmin",
      resourceId: admin.id,
    });

    revalidateAdminViews();
    return {
      success: true,
      message: `${admin.user.name ?? admin.user.email} moved from ${admin.department.code} to ${department.code}. Their earlier work stays with ${admin.department.code}.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This admin changed while you were working. Reload the page." };
    }
    console.error("changeAdminDepartment error:", error);
    return { success: false, error: "Could not change the department. Please try again." };
  }
}
