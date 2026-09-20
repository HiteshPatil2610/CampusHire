import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Inviting a department admin, and what an acceptance is trusted on.
 *
 * CampusHire issues no credential: the invitation goes through Clerk. What
 * is checked here is that an address already known to the system is never
 * silently overwritten, that an acceptance needs an invitation that was
 * actually issued — not merely a metadata blob or a matching email — and
 * that the resulting authorization is recorded with its history.
 */

vi.mock("@/lib/prisma", () => {
  const tx = {
    adminInvitation: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    departmentAdmin: { create: vi.fn(), updateMany: vi.fn() },
    user: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      adminInvitation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      departmentAdmin: { findUnique: vi.fn() },
      department: { findUnique: vi.fn() },
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { INVITE: "INVITE", RESEND: "RESEND", REVOKE: "REVOKE", APPROVE: "APPROVE" },
  AuditEntityType: { ADMIN_INVITATION: "AdminInvitation" },
}));

vi.mock("@/lib/notifications", () => ({
  deliverNotificationSafely: vi.fn(async () => ({ delivered: 1 })),
  superAdminRecipients: vi.fn(async () => []),
}));

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://campushire.test" } }));

const clerkInvitations = {
  createInvitation: vi.fn(async (_input?: unknown) => ({ id: "clerk-inv-1" })),
  revokeInvitation: vi.fn(async (_id?: string) => ({})),
};
const clerkUsers = {
  getUserList: vi.fn(async (_query?: unknown) => ({ totalCount: 0, data: [] })),
};
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({ invitations: clerkInvitations, users: clerkUsers })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createAuditLogInTransaction } from "@/lib/audit";
import {
  inviteDepartmentAdmin,
  resendAdminInvitation,
  revokeAdminInvitation,
} from "../actions/manage-admin-invitations";
import { applyAdminInvitation } from "../domain/accept-invitation";
import { checkInvitationConflict } from "../domain/invitation-conflicts";

const CSE = "dept-cse";
const tx = (prisma as unknown as { __tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> })
  .__tx;

const invite = { email: "New.Admin@College.edu", name: "New Admin", departmentId: CSE };

beforeEach(() => {
  vi.clearAllMocks();
  clerkInvitations.createInvitation.mockResolvedValue({ id: "clerk-inv-1" } as never);
  clerkUsers.getUserList.mockResolvedValue({ totalCount: 0, data: [] } as never);
  vi.mocked(prisma.department.findUnique).mockResolvedValue({
    id: CSE,
    name: "Computer Science",
    code: "CSE",
    isActive: true,
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null as never);
  tx.adminInvitation.create.mockResolvedValue({ id: "inv-1" } as never);
});

describe("inviting", () => {
  it("sends a Clerk invitation carrying the role and department, and records it", async () => {
    const result = await inviteDepartmentAdmin(invite);

    expect(result.success).toBe(true);
    const sent = clerkInvitations.createInvitation.mock.calls[0][0] as {
      emailAddress: string;
      publicMetadata: Record<string, unknown>;
    };
    expect(sent.emailAddress).toBe("new.admin@college.edu");
    expect(sent.publicMetadata).toMatchObject({ role: "DEPT_ADMIN", departmentId: CSE });

    const stored = tx.adminInvitation.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(stored.data).toMatchObject({
      email: "new.admin@college.edu",
      departmentId: CSE,
      status: "INVITED",
      clerkInvitationId: "clerk-inv-1",
      invitedById: "super-1",
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "INVITE",
    });
  });

  it("creates no password and no account of its own", async () => {
    await inviteDepartmentAdmin(invite);

    // Nothing but the invitation is written, and Clerk is asked to invite —
    // never to create a user.
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.departmentAdmin.create).not.toHaveBeenCalled();
    const sent = JSON.stringify(clerkInvitations.createInvitation.mock.calls[0][0]);
    expect(sent.toLowerCase()).not.toContain("password");
  });

  it("refuses an inactive department", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: CSE,
      name: "Computer Science",
      code: "CSE",
      isActive: false,
    } as never);

    const result = await inviteDepartmentAdmin(invite);

    expect(result.success).toBe(false);
    expect(clerkInvitations.createInvitation).not.toHaveBeenCalled();
  });

  it("refuses a second invitation to the same address", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue({ id: "inv-old" } as never);

    const result = await inviteDepartmentAdmin(invite);

    expect(result).toMatchObject({ success: false, conflict: "PENDING_INVITATION" });
    expect(clerkInvitations.createInvitation).not.toHaveBeenCalled();
  });

  it("refuses an address that is already an admin, and says what to do instead", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "DEPT_ADMIN",
      student: null,
      departmentAdmin: { status: "ACTIVE", department: { code: "IT" } },
    } as never);

    const result = await inviteDepartmentAdmin(invite);

    expect(result).toMatchObject({ success: false, conflict: "ALREADY_ADMIN" });
    expect(result.success === false && result.error).toContain("IT");
  });

  it("refuses an address that belongs to a student, without touching it", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      role: "STUDENT",
      student: { id: "student-1" },
      departmentAdmin: null,
    } as never);

    const result = await inviteDepartmentAdmin(invite);

    expect(result).toMatchObject({ success: false, conflict: "EXISTING_STUDENT" });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(clerkInvitations.createInvitation).not.toHaveBeenCalled();
  });

  it("does not record an invitation Clerk refused to send", async () => {
    clerkInvitations.createInvitation.mockRejectedValue({
      errors: [{ code: "duplicate_record" }],
    } as never);

    const result = await inviteDepartmentAdmin(invite);

    expect(result).toMatchObject({ success: false, conflict: "CLERK_ACCOUNT" });
    expect(tx.adminInvitation.create).not.toHaveBeenCalled();
  });
});

describe("resending and withdrawing", () => {
  const pending = {
    id: "inv-1",
    email: "new.admin@college.edu",
    name: "New Admin",
    departmentId: CSE,
    status: "INVITED",
    clerkInvitationId: "clerk-inv-1",
    resendCount: 0,
    department: { code: "CSE", name: "Computer Science", isActive: true },
  };

  it("replaces the live link rather than adding a second one", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(pending as never);
    clerkInvitations.createInvitation.mockResolvedValue({ id: "clerk-inv-2" } as never);

    const result = await resendAdminInvitation({ invitationId: "inv-1" });

    expect(result.success).toBe(true);
    expect(clerkInvitations.revokeInvitation).toHaveBeenCalledWith("clerk-inv-1");
    expect(tx.adminInvitation.update.mock.calls[0][0]).toMatchObject({
      data: { clerkInvitationId: "clerk-inv-2", resendCount: { increment: 1 } },
    });
  });

  it("will not resend one that was already accepted", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue({
      ...pending,
      status: "ACCEPTED",
    } as never);

    const result = await resendAdminInvitation({ invitationId: "inv-1" });

    expect(result.success).toBe(false);
    expect(clerkInvitations.createInvitation).not.toHaveBeenCalled();
  });

  it("withdraws the link before marking it revoked", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(pending as never);
    tx.adminInvitation.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await revokeAdminInvitation({ invitationId: "inv-1" });

    expect(result.success).toBe(true);
    expect(clerkInvitations.revokeInvitation).toHaveBeenCalledWith("clerk-inv-1");
    expect(tx.adminInvitation.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "inv-1", status: "INVITED" },
      data: { status: "REVOKED", revokedById: "super-1" },
    });
  });

  it("does not mark it revoked if the link could not be withdrawn", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(pending as never);
    clerkInvitations.revokeInvitation.mockRejectedValue(new Error("clerk down") as never);

    const result = await revokeAdminInvitation({ invitationId: "inv-1" });

    expect(result.success).toBe(false);
    expect(tx.adminInvitation.updateMany).not.toHaveBeenCalled();
  });
});

describe("accepting", () => {
  const metadata = { role: "DEPT_ADMIN", departmentId: CSE, invitedName: "New Admin" };
  const openInvitation = {
    id: "inv-1",
    name: "New Admin",
    department: { code: "CSE", isActive: true },
  };

  beforeEach(() => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(openInvitation as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(null as never);
    tx.adminInvitation.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("promotes the user and records the authorization", async () => {
    const outcome = await applyAdminInvitation({
      userId: "user-3",
      email: "New.Admin@College.edu",
      metadata,
    });

    expect(outcome).toMatchObject({ applied: true, departmentId: CSE });
    expect(tx.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: "user-3" },
      data: { role: "DEPT_ADMIN" },
    });
    expect(tx.departmentAdmin.create.mock.calls[0][0]).toMatchObject({
      data: { userId: "user-3", departmentId: CSE, status: "ACTIVE" },
    });
    // Looked up by the invited address, lower-cased, not by whatever case
    // they typed at sign-up.
    expect(vi.mocked(prisma.adminInvitation.findFirst).mock.calls[0][0]).toMatchObject({
      where: { email: "new.admin@college.edu", departmentId: CSE, status: "INVITED" },
    });
  });

  it("promotes nobody without an open invitation, whatever the metadata says", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null as never);

    const outcome = await applyAdminInvitation({
      userId: "user-4",
      email: "stranger@college.edu",
      metadata,
    });

    expect(outcome).toEqual({ applied: false, reason: "NO_INVITATION" });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.departmentAdmin.create).not.toHaveBeenCalled();
  });

  it("ignores metadata that does not name a department admin invitation", async () => {
    const outcome = await applyAdminInvitation({
      userId: "user-5",
      email: "someone@college.edu",
      metadata: { role: "SUPER_ADMIN", departmentId: CSE },
    });

    expect(outcome).toEqual({ applied: false, reason: "NOT_INVITED" });
    expect(prisma.adminInvitation.findFirst).not.toHaveBeenCalled();
  });

  it("does nothing the second time, so the webhook and the app cannot both apply it", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({ id: "admin-1" } as never);

    const outcome = await applyAdminInvitation({
      userId: "user-3",
      email: "new.admin@college.edu",
      metadata,
    });

    expect(outcome).toEqual({ applied: false, reason: "ALREADY_ADMIN" });
    expect(tx.departmentAdmin.create).not.toHaveBeenCalled();
  });

  it("refuses when the department has since been deactivated", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue({
      ...openInvitation,
      department: { code: "CSE", isActive: false },
    } as never);

    const outcome = await applyAdminInvitation({
      userId: "user-3",
      email: "new.admin@college.edu",
      metadata,
    });

    expect(outcome).toEqual({ applied: false, reason: "DEPARTMENT_INACTIVE" });
  });
});

describe("the conflict rule itself", () => {
  const base = {
    user: null,
    hasStudentRecord: false,
    admin: null,
    pendingInvitation: false,
    clerkAccountExists: false,
  };

  it("allows an address nobody knows", () => {
    expect(checkInvitationConflict(base)).toEqual({ ok: true });
  });

  it("names the reason for every way an address is already known", () => {
    expect(checkInvitationConflict({ ...base, pendingInvitation: true })).toMatchObject({
      reason: "PENDING_INVITATION",
    });
    expect(
      checkInvitationConflict({ ...base, admin: { status: "ACTIVE", departmentCode: "CSE" } })
    ).toMatchObject({ reason: "ALREADY_ADMIN" });
    expect(
      checkInvitationConflict({ ...base, admin: { status: "DISABLED", departmentCode: "CSE" } })
    ).toMatchObject({ reason: "DISABLED_ADMIN" });
    expect(checkInvitationConflict({ ...base, user: { role: "SUPER_ADMIN" } })).toMatchObject({
      reason: "SUPER_ADMIN",
    });
    expect(
      checkInvitationConflict({ ...base, user: { role: "STUDENT" }, hasStudentRecord: true })
    ).toMatchObject({ reason: "EXISTING_STUDENT" });
    expect(checkInvitationConflict({ ...base, user: { role: "STUDENT" } })).toMatchObject({
      reason: "EXISTING_USER",
    });
    expect(checkInvitationConflict({ ...base, clerkAccountExists: true })).toMatchObject({
      reason: "CLERK_ACCOUNT",
    });
  });

  it("puts a waiting invitation before anything else, so resending is the advice", () => {
    const conflict = checkInvitationConflict({
      ...base,
      pendingInvitation: true,
      admin: { status: "ACTIVE", departmentCode: "CSE" },
    });

    expect(conflict).toMatchObject({ reason: "PENDING_INVITATION" });
  });

  it("explains a disabled admin rather than inviting them again", () => {
    const conflict = checkInvitationConflict({
      ...base,
      admin: { status: "DISABLED", departmentCode: "IT" },
    });

    expect(conflict.ok).toBe(false);
    expect(conflict.ok === false && conflict.message).toContain("Reactivate");
  });
});
