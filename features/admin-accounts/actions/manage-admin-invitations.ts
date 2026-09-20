"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely, superAdminRecipients } from "@/lib/notifications";
import { env } from "@/lib/env";
import { checkInvitationConflict } from "../domain/invitation-conflicts";

/**
 * Inviting a department admin.
 *
 * CampusHire never creates a credential. The invitation is issued through
 * Clerk, which sends the email and owns the sign-up; this module records who
 * was invited, to which department, by whom, and what became of it. No
 * password is generated, emailed or stored, and there is no second identity
 * system.
 *
 * The department and role travel in the Clerk invitation's public metadata,
 * so when the person signs up, the authorization comes from the invitation
 * the Super Admin issued — never from the email address they typed.
 *
 * Authorization: SUPER_ADMIN for every action here.
 */

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address").toLowerCase().trim(),
  name: z.string().trim().min(2, "Enter the admin's name").max(200),
  departmentId: z.string().min(1, "Choose a department"),
});

const invitationIdSchema = z.object({ invitationId: z.string().min(1) });

export type InviteAdminResult =
  | { success: true; invitationId: string; message: string }
  | { success: false; error: string; conflict?: string };

function revalidateAdminViews() {
  revalidatePath("/super-admin-dashboard/admins");
  revalidatePath("/super-admin-dashboard/departments");
}

/** Where Clerk sends someone who accepts. */
function acceptUrl(): string | undefined {
  const base = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return base ? `${base}/sign-up` : undefined;
}

export async function inviteDepartmentAdmin(
  input: z.infer<typeof inviteSchema>
): Promise<InviteAdminResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = inviteSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { email, name, departmentId } = validated.data;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true, isActive: true },
    });
    if (!department) return { success: false, error: "Department not found." };
    if (!department.isActive) {
      return { success: false, error: "That department is inactive. Activate it first." };
    }

    // Everything that could already know this address.
    const [user, pending] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          student: { select: { id: true } },
          departmentAdmin: { select: { status: true, department: { select: { code: true } } } },
        },
      }),
      prisma.adminInvitation.findFirst({
        where: { email, status: "INVITED" },
        select: { id: true },
      }),
    ]);

    const clerk = await clerkClient();
    let clerkAccountExists = false;
    if (!user) {
      // Only worth asking when CampusHire has never seen them.
      try {
        const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
        clerkAccountExists = existing.totalCount > 0;
      } catch (error) {
        console.error("Clerk user lookup failed:", error);
      }
    }

    const conflict = checkInvitationConflict({
      user: user ? { role: user.role } : null,
      hasStudentRecord: Boolean(user?.student),
      admin: user?.departmentAdmin
        ? {
            status: user.departmentAdmin.status,
            departmentCode: user.departmentAdmin.department.code,
          }
        : null,
      pendingInvitation: Boolean(pending),
      clerkAccountExists,
    });
    if (!conflict.ok) {
      return { success: false, error: conflict.message, conflict: conflict.reason };
    }

    // Clerk sends the email; the metadata is what acceptance is trusted on.
    let clerkInvitationId: string | null = null;
    try {
      const invitation = await clerk.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: acceptUrl(),
        ignoreExisting: false,
        publicMetadata: { role: "DEPT_ADMIN", departmentId: department.id, invitedName: name },
      });
      clerkInvitationId = invitation.id;
    } catch (error) {
      const code = (error as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      if (code === "duplicate_record") {
        return {
          success: false,
          error:
            "Clerk already has an invitation or an account for this email. Revoke the old invitation in Clerk, or assign the existing account instead.",
          conflict: "CLERK_ACCOUNT",
        };
      }
      console.error("Clerk invitation failed:", error);
      return { success: false, error: "Could not send the invitation. Please try again." };
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.adminInvitation.create({
        data: {
          email,
          name,
          departmentId: department.id,
          clerkInvitationId,
          invitedById: superAdmin.id,
          status: "INVITED",
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.INVITE,
          entityType: AuditEntityType.ADMIN_INVITATION,
          entityId: created.id,
          metadata: {
            email,
            name,
            departmentCode: department.code,
            clerkInvitationId,
          },
        },
        superAdmin.id
      );

      return created;
    });

    await deliverNotificationSafely({
      event: "ADMIN_INVITED",
      role: "SUPER_ADMIN",
      recipients: await superAdminRecipients(superAdmin.id).catch(() => []),
      content: {
        title: `${name} invited as ${department.name} admin`,
        message: `${email} was invited to administer ${department.name}. They become an admin when they accept.`,
        actionUrl: "/super-admin-dashboard/admins",
      },
      dedupeKey: `admin-invitation:${record.id}`,
      resourceType: "AdminInvitation",
      resourceId: record.id,
    });

    revalidateAdminViews();
    return {
      success: true,
      invitationId: record.id,
      message: `Invitation sent to ${email}. They become an admin of ${department.code} when they accept it.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("inviteDepartmentAdmin error:", error);
    return { success: false, error: "Could not send the invitation. Please try again." };
  }
}

/**
 * Send it again: the old Clerk invitation is revoked and a new one issued, so
 * only one link is ever live.
 */
export async function resendAdminInvitation(
  input: { invitationId: string }
): Promise<InviteAdminResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = invitationIdSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const invitation = await prisma.adminInvitation.findUnique({
      where: { id: validated.data.invitationId },
      include: { department: { select: { code: true, name: true, isActive: true } } },
    });
    if (!invitation) return { success: false, error: "Invitation not found." };
    if (invitation.status !== "INVITED") {
      return {
        success: false,
        error:
          invitation.status === "ACCEPTED"
            ? "This invitation has already been accepted."
            : "This invitation was revoked. Send a new one instead.",
      };
    }
    if (!invitation.department.isActive) {
      return { success: false, error: "That department is inactive. Activate it first." };
    }

    const clerk = await clerkClient();
    if (invitation.clerkInvitationId) {
      try {
        await clerk.invitations.revokeInvitation(invitation.clerkInvitationId);
      } catch (error) {
        // Already used or already revoked upstream: carry on and issue a new
        // one, which is what the Super Admin asked for.
        console.error("Revoking the old Clerk invitation failed:", error);
      }
    }

    let clerkInvitationId: string;
    try {
      const created = await clerk.invitations.createInvitation({
        emailAddress: invitation.email,
        redirectUrl: acceptUrl(),
        ignoreExisting: true,
        publicMetadata: {
          role: "DEPT_ADMIN",
          departmentId: invitation.departmentId,
          invitedName: invitation.name,
        },
      });
      clerkInvitationId = created.id;
    } catch (error) {
      console.error("Clerk invitation resend failed:", error);
      return { success: false, error: "Could not resend the invitation. Please try again." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: {
          clerkInvitationId,
          resentAt: new Date(),
          resendCount: { increment: 1 },
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.RESEND,
          entityType: AuditEntityType.ADMIN_INVITATION,
          entityId: invitation.id,
          metadata: {
            email: invitation.email,
            departmentCode: invitation.department.code,
            resendCount: invitation.resendCount + 1,
          },
        },
        superAdmin.id
      );
    });

    revalidateAdminViews();
    return {
      success: true,
      invitationId: invitation.id,
      message: `A new invitation was sent to ${invitation.email}. The earlier link no longer works.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("resendAdminInvitation error:", error);
    return { success: false, error: "Could not resend the invitation. Please try again." };
  }
}

/** Withdraw an invitation that has not been accepted. */
export async function revokeAdminInvitation(
  input: { invitationId: string }
): Promise<InviteAdminResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = invitationIdSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const invitation = await prisma.adminInvitation.findUnique({
      where: { id: validated.data.invitationId },
      include: { department: { select: { code: true } } },
    });
    if (!invitation) return { success: false, error: "Invitation not found." };
    if (invitation.status !== "INVITED") {
      return {
        success: false,
        error:
          invitation.status === "ACCEPTED"
            ? "This invitation has already been accepted. Disable the admin instead."
            : "This invitation is already revoked.",
      };
    }

    if (invitation.clerkInvitationId) {
      try {
        const clerk = await clerkClient();
        await clerk.invitations.revokeInvitation(invitation.clerkInvitationId);
      } catch (error) {
        console.error("Clerk revoke failed:", error);
        return {
          success: false,
          error: "Could not withdraw the invitation link. Please try again.",
        };
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const claim = await tx.adminInvitation.updateMany({
        where: { id: invitation.id, status: "INVITED" },
        data: { status: "REVOKED", revokedAt: now, revokedById: superAdmin.id },
      });
      if (claim.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.REVOKE,
          entityType: AuditEntityType.ADMIN_INVITATION,
          entityId: invitation.id,
          metadata: { email: invitation.email, departmentCode: invitation.department.code },
        },
        superAdmin.id
      );
    });

    revalidateAdminViews();
    return {
      success: true,
      invitationId: invitation.id,
      message: `The invitation to ${invitation.email} was withdrawn.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This invitation changed while you were working. Reload it." };
    }
    console.error("revokeAdminInvitation error:", error);
    return { success: false, error: "Could not withdraw the invitation. Please try again." };
  }
}
