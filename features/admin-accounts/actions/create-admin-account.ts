"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

const createAdminAccountSchema = z.object({
  email:        z.string().email("Invalid email address").toLowerCase().trim(),
  name:         z.string().min(2).max(200).trim(),
  departmentId: z.string().cuid("Invalid department ID"),
  // A temporary password is generated — the admin resets it on first login.
  // Clerk's "Forgot Password" flow handles the reset.
});

export type CreateAdminAccountInput = z.infer<typeof createAdminAccountSchema>;

export type CreateAdminAccountResult =
  | { success: true; adminId: string; email: string }
  | { success: false; error: string };

/**
 * Create a new Clerk account for a dept admin and immediately assign them
 * to the specified department.
 *
 * Flow:
 * 1. Validate input
 * 2. Check email not already in use
 * 3. Verify department exists + is active
 * 4. Create Clerk user (skipPasswordRequirement = true, emailAddressVerified = true)
 * 5. Set Clerk publicMetadata.role = 'DEPT_ADMIN'
 * 6. Upsert CampusHire User record (clerkId, email, role=DEPT_ADMIN)
 * 7. Create DepartmentAdmin record
 * 8. Audit log
 *
 * Authorization: SUPER_ADMIN only
 */
export async function createAdminAccount(
  input: CreateAdminAccountInput
): Promise<CreateAdminAccountResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = createAdminAccountSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }

    const { email, name, departmentId } = validated.data;

    // Check email not already used in CampusHire
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "A user with this email already exists." };
    }

    // Verify department
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return { success: false, error: "Department not found." };
    }
    if (!department.isActive) {
      return { success: false, error: "Cannot assign admin to an inactive department." };
    }

    // Create Clerk user
    const clerk = await clerkClient();
    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: name.split(' ')[0],
        lastName:  name.split(' ').slice(1).join(' ') || undefined,
        // Skip requiring password on create — admin sets their own via Forgot Password
        skipPasswordRequirement: true,
        publicMetadata: { role: 'DEPT_ADMIN' },
      });
    } catch (clerkError: any) {
      // Clerk returns 422 if email already exists in Clerk
      if (clerkError?.status === 422 || clerkError?.errors?.[0]?.code === 'form_identifier_exists') {
        return { success: false, error: "An account with this email already exists." };
      }
      console.error("Clerk user creation error:", clerkError);
      return { success: false, error: "Failed to create user account. Please try again." };
    }

    // Upsert CampusHire User + create DepartmentAdmin
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where:  { clerkId: clerkUser.id },
        create: {
          clerkId: clerkUser.id,
          email,
          role: 'DEPT_ADMIN',
        },
        update: {
          role:  'DEPT_ADMIN',
          email,
        },
      });

      const admin = await tx.departmentAdmin.create({
        data: { userId: user.id, departmentId },
      });

      return { user, admin };
    });

    // Audit log
    await createAuditLog({
      action:     AuditAction.CREATE,
      entityType: AuditEntityType.DEPARTMENT_ADMIN,
      entityId:   result.admin.id,
      metadata: {
        email,
        name,
        departmentId,
        departmentName: department.name,
        createdBy:      superAdmin.id,
      },
    });

    return { success: true, adminId: result.admin.id, email };
  } catch (error) {
    console.error("createAdminAccount error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
