import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { invitationExpiresAt, isInvitationExpired } from "../domain/invitation-policy";

/**
 * Everyone who administers a department, and everyone who has been invited
 * to: one screen, because "who can get in" is one question.
 *
 * Read-only, SUPER_ADMIN only. An admin's state is derived from what is
 * stored — an invitation that has not been accepted is INVITED, a live
 * authorization is ACTIVE, a withdrawn one is DISABLED — so nothing here can
 * disagree with what `requireDepartmentAdmin` decides.
 */

export type AdminAccountState = "INVITED" | "ACTIVE" | "DISABLED";

export interface AdminAccountRow {
  /** The DepartmentAdmin id, or the invitation id for someone not yet here. */
  id: string;
  state: AdminAccountState;
  userId: string | null;
  email: string;
  name: string | null;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  departmentIsActive: boolean;
  invitedAt: Date | null;
  invitedByName: string | null;
  resendCount: number;
  acceptedAt: Date | null;
  firstSeenAt: Date | null;
  disabledAt: Date | null;
  disabledByName: string | null;
  disableReason: string | null;
  /** Set for an invitation row, so it can be resent or revoked. */
  invitationId: string | null;
  /** When the invitation's current link stops working (invitation rows only). */
  inviteExpiresAt: Date | null;
  /** The link has lapsed: resend to issue a new one. */
  inviteExpired: boolean;
}

export interface AdminAccountsResult {
  rows: AdminAccountRow[];
  counts: { active: number; disabled: number; invited: number };
}

const personName = (person: { name: string | null; email: string } | null | undefined) =>
  person ? person.name ?? person.email : null;

export async function getAdminAccounts(
  filters: { departmentId?: string } = {}
): Promise<AdminAccountsResult> {
  await requireSuperAdmin();

  const departmentId = filters.departmentId?.slice(0, 64) || undefined;

  const [admins, invitations] = await Promise.all([
    prisma.departmentAdmin.findMany({
      where: departmentId ? { departmentId } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, email: true, name: true } },
        department: { select: { id: true, code: true, name: true, isActive: true } },
        disabledBy: { select: { name: true, email: true } },
      },
    }),
    prisma.adminInvitation.findMany({
      where: { status: "INVITED", ...(departmentId ? { departmentId } : {}) },
      orderBy: { invitedAt: "desc" },
      include: {
        department: { select: { id: true, code: true, name: true, isActive: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  // The invitation each admin arrived by, for "invited on" on their row.
  const acceptedInvitations = await prisma.adminInvitation.findMany({
    where: { status: "ACCEPTED", acceptedByUserId: { in: admins.map((admin) => admin.userId) } },
    select: { acceptedByUserId: true, invitedAt: true, acceptedAt: true, resendCount: true, invitedBy: { select: { name: true, email: true } } },
  });
  const byUser = new Map(
    acceptedInvitations.map((invitation) => [invitation.acceptedByUserId!, invitation])
  );

  const adminRows: AdminAccountRow[] = admins.map((admin) => {
    const invitation = byUser.get(admin.userId);
    return {
      id: admin.id,
      state: admin.status === "ACTIVE" ? "ACTIVE" : "DISABLED",
      userId: admin.userId,
      email: admin.user.email,
      name: admin.user.name,
      departmentId: admin.department.id,
      departmentCode: admin.department.code,
      departmentName: admin.department.name,
      departmentIsActive: admin.department.isActive,
      invitedAt: invitation?.invitedAt ?? null,
      invitedByName: personName(invitation?.invitedBy),
      resendCount: invitation?.resendCount ?? 0,
      acceptedAt: invitation?.acceptedAt ?? null,
      firstSeenAt: admin.firstSeenAt,
      disabledAt: admin.disabledAt,
      disabledByName: personName(admin.disabledBy),
      disableReason: admin.disableReason,
      invitationId: null,
      inviteExpiresAt: null,
      inviteExpired: false,
    };
  });

  const invitationRows: AdminAccountRow[] = invitations.map((invitation) => ({
    id: invitation.id,
    state: "INVITED",
    userId: null,
    email: invitation.email,
    name: invitation.name,
    departmentId: invitation.department.id,
    departmentCode: invitation.department.code,
    departmentName: invitation.department.name,
    departmentIsActive: invitation.department.isActive,
    invitedAt: invitation.invitedAt,
    invitedByName: personName(invitation.invitedBy),
    resendCount: invitation.resendCount,
    acceptedAt: null,
    firstSeenAt: null,
    disabledAt: null,
    disabledByName: null,
    disableReason: null,
    invitationId: invitation.id,
    inviteExpiresAt: invitationExpiresAt(invitation),
    inviteExpired: isInvitationExpired(invitation),
  }));

  // Waiting first: an invitation nobody has accepted is the row that needs
  // attention.
  const rows = [...invitationRows, ...adminRows];

  return {
    rows,
    counts: {
      active: adminRows.filter((row) => row.state === "ACTIVE").length,
      disabled: adminRows.filter((row) => row.state === "DISABLED").length,
      invited: invitationRows.length,
    },
  };
}
