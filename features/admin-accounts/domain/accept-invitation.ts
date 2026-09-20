import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely, superAdminRecipients } from "@/lib/notifications";

/**
 * Turning an accepted Clerk invitation into department admin authorization.
 *
 * Clerk owns the sign-up; what it hands back is the invitation's public
 * metadata, which the Super Admin set when they invited. That is what is
 * trusted here — never the email address the person typed, and never a role
 * claim from the client. The invitation must still be open and must still
 * point at the department it was issued for.
 *
 * Runs from two places, because either can arrive first: the Clerk
 * `user.created` webhook, and `getOrCreateUser` when someone reaches the app
 * before the webhook does. It is idempotent — the second one finds the work
 * already done.
 */

export interface InvitationMetadata {
  role?: unknown;
  departmentId?: unknown;
  invitedName?: unknown;
}

/** The department an invitation's metadata names, if it names one properly. */
export function invitedDepartmentIdFrom(metadata: InvitationMetadata | null | undefined): string | null {
  if (!metadata || metadata.role !== "DEPT_ADMIN") return null;
  const departmentId = metadata.departmentId;
  return typeof departmentId === "string" && departmentId.length > 0 ? departmentId : null;
}

export function invitedNameFrom(metadata: InvitationMetadata | null | undefined): string | null {
  const name = metadata?.invitedName;
  return typeof name === "string" && name.trim().length > 0 ? name.trim().slice(0, 200) : null;
}

export interface AcceptanceOutcome {
  applied: boolean;
  departmentId?: string;
  reason?: "NO_INVITATION" | "ALREADY_ADMIN" | "DEPARTMENT_INACTIVE" | "NOT_INVITED";
}

/**
 * Make a signed-up user the department admin their invitation names.
 *
 * `userId` is a CampusHire user that already exists (created by the webhook
 * or by `getOrCreateUser`). The invitation is matched on the department from
 * the metadata *and* the email, so a metadata blob alone cannot promote an
 * address nobody invited.
 */
export async function applyAdminInvitation(params: {
  userId: string;
  email: string;
  metadata: InvitationMetadata | null | undefined;
}): Promise<AcceptanceOutcome> {
  const departmentId = invitedDepartmentIdFrom(params.metadata);
  if (!departmentId) return { applied: false, reason: "NOT_INVITED" };

  const email = params.email.toLowerCase().trim();

  const [invitation, existingAdmin] = await Promise.all([
    prisma.adminInvitation.findFirst({
      where: { email, departmentId, status: "INVITED" },
      orderBy: { invitedAt: "desc" },
      include: { department: { select: { code: true, isActive: true } } },
    }),
    prisma.departmentAdmin.findUnique({ where: { userId: params.userId } }),
  ]);

  // No open invitation for this address and department: the metadata proves
  // nothing on its own.
  if (!invitation) return { applied: false, reason: "NO_INVITATION" };
  if (!invitation.department.isActive) return { applied: false, reason: "DEPARTMENT_INACTIVE" };
  if (existingAdmin) return { applied: false, reason: "ALREADY_ADMIN" };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Only one acceptance wins, however many times this runs.
    const claim = await tx.adminInvitation.updateMany({
      where: { id: invitation.id, status: "INVITED" },
      data: { status: "ACCEPTED", acceptedAt: now, acceptedByUserId: params.userId },
    });
    if (claim.count === 0) throw new Error("already accepted");

    await tx.user.update({
      where: { id: params.userId },
      data: {
        role: "DEPT_ADMIN",
        // The name the Super Admin invited them under, unless they gave one.
        ...(invitation.name ? { name: invitation.name } : {}),
      },
    });

    await tx.departmentAdmin.create({
      data: {
        userId: params.userId,
        departmentId,
        status: "ACTIVE",
        // They are here: the invitation is accepted and they have arrived.
        firstSeenAt: now,
      } satisfies Prisma.DepartmentAdminUncheckedCreateInput,
    });

    await createAuditLogInTransaction(
      tx,
      {
        action: AuditAction.APPROVE,
        entityType: AuditEntityType.ADMIN_INVITATION,
        entityId: invitation.id,
        metadata: {
          event: "invitation-accepted",
          email,
          departmentCode: invitation.department.code,
          userId: params.userId,
        },
      },
      params.userId
    );
  });

  // The Super Admins asked for this person; tell them it happened.
  await deliverNotificationSafely({
    event: "ADMIN_ACCEPTED_INVITATION",
    role: "SUPER_ADMIN",
    recipients: await superAdminRecipients().catch(() => []),
    content: {
      title: `${invitation.name} accepted the ${invitation.department.code} admin invitation`,
      message: `${email} signed up and now administers ${invitation.department.code}.`,
      actionUrl: "/super-admin-dashboard/admins",
    },
    dedupeKey: `admin-accepted:${params.userId}`,
    resourceType: "AdminInvitation",
    resourceId: invitation.id,
  });

  return { applied: true, departmentId };
}
