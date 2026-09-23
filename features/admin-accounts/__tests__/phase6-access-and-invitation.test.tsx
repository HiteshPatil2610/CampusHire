import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Phase 6 — revoking a department admin's access (Item 22) and inviting one
 * with a secure set-password link (Item 23).
 *
 * Clerk is the identity provider: it sends the invitation email, owns the
 * single-use sign-up ticket, and has the invitee choose their password. These
 * tests pin what CampusHire asks of Clerk and what CampusHire itself decides —
 * the role and department on acceptance, the expiry, single use, ending the
 * sessions of a removed admin, and refusing them everywhere afterwards.
 */

const clerk = {
  invitations: { createInvitation: vi.fn(), revokeInvitation: vi.fn() },
  users: { getUserList: vi.fn(async () => ({ totalCount: 0, data: [] })) },
  sessions: { getSessionList: vi.fn(), revokeSession: vi.fn() },
};

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => clerk),
  auth: vi.fn(async () => ({ userId: "clerk-admin" })),
}));
vi.mock("@clerk/nextjs", () => ({
  SignUp: () => "<clerk-sign-up/>",
  SignIn: () => "<clerk-sign-in/>",
  SignOutButton: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    department: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    adminInvitation: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    departmentAdmin: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
    getOrCreateUser: vi.fn(),
    getCurrentUser: vi.fn(),
    getActiveDepartmentAdmin: vi.fn(),
  };
});
vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(),
  AuditAction: { INVITE: "INVITE", RESEND: "RESEND", REVOKE: "REVOKE", APPROVE: "APPROVE", DISABLE: "DISABLE" },
  AuditEntityType: { ADMIN_INVITATION: "AdminInvitation", DEPARTMENT_ADMIN: "DepartmentAdmin" },
}));
vi.mock("@/lib/notifications", () => ({
  deliverNotificationSafely: vi.fn(),
  superAdminRecipients: vi.fn(async () => []),
}));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://campushire.test", SUPPORT_CONTACT_EMAIL: "placement@college.test" } }));
vi.mock("@/lib/blob", () => ({ uploadCompanyLogo: vi.fn(async () => ({ success: true, url: "https://blob.test/logo.png" })) }));
vi.mock("@/features/settings/queries/get-settings", () => ({
  getInstitutionSettings: vi.fn(async () => ({ institutionName: "BVCOE" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ host: "preview.test" })) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` });
  }),
}));
vi.mock("@/components/shared/app-shell", () => ({ default: ({ children }: { children: unknown }) => children }));

import { prisma } from "@/lib/prisma";
import { getActiveDepartmentAdmin, getCurrentUser, getOrCreateUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { inviteDepartmentAdmin, resendAdminInvitation } from "../actions/manage-admin-invitations";
import { applyAdminInvitation } from "../domain/accept-invitation";
import { disableDepartmentAdmin } from "../actions/set-admin-status";
import { INVITATION_TTL_DAYS, invitationExpiresAt, isInvitationExpired } from "../domain/invitation-policy";
import AdminLayout from "@/app/(admin)/layout";
import AccessRevokedPage from "@/app/access-revoked/page";
import AcceptInvitationPage from "@/app/(auth)/accept-invitation/page";
import { POST as uploadLogo } from "@/app/api/admin/drives/logo/route";

const DEPT = { id: "dept-comp", code: "COMP", name: "Computer Engineering", isActive: true };
const EMAIL = "new.admin@college.test";
const DAY = 24 * 60 * 60 * 1000;

const openInvitation = (over: object = {}) => ({
  id: "inv-1",
  email: EMAIL,
  name: "Priya Admin",
  departmentId: DEPT.id,
  status: "INVITED",
  invitedAt: new Date(Date.now() - DAY),
  resentAt: null,
  resendCount: 0,
  clerkInvitationId: "clerk-inv-1",
  department: { ...DEPT },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
  vi.mocked(prisma.department.findUnique).mockResolvedValue(DEPT as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.adminInvitation.create).mockImplementation((async ({ data }: { data: object }) => ({ id: "inv-1", ...data })) as never);
  clerk.invitations.createInvitation.mockResolvedValue({ id: "clerk-inv-1" });
  clerk.sessions.getSessionList.mockResolvedValue({ data: [{ id: "sess-laptop" }, { id: "sess-phone" }], totalCount: 2 });
  clerk.sessions.revokeSession.mockResolvedValue({});
});

afterEach(() => {
  (env as { NEXT_PUBLIC_APP_URL?: string }).NEXT_PUBLIC_APP_URL = "https://campushire.test";
});

// ---------------------------------------------------------------------------
// Part B — the invitation
// ---------------------------------------------------------------------------

describe("inviting a department admin", () => {
  it("1–2. asks Clerk to email a single-use link that expires, to CampusHire's own accept page", async () => {
    const result = await inviteDepartmentAdmin({ email: EMAIL, name: "Priya Admin", departmentId: DEPT.id });

    expect(result.success).toBe(true);
    expect(clerk.invitations.createInvitation).toHaveBeenCalledWith({
      emailAddress: EMAIL,
      redirectUrl: "https://campushire.test/accept-invitation",
      // Clerk sends the email; the link lapses.
      notify: true,
      expiresInDays: INVITATION_TTL_DAYS,
      ignoreExisting: false,
      publicMetadata: { role: "DEPT_ADMIN", departmentId: DEPT.id, invitedName: "Priya Admin" },
    });
    expect(prisma.adminInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: EMAIL, departmentId: DEPT.id, status: "INVITED", clerkInvitationId: "clerk-inv-1" }),
    });
  });

  it("never creates, stores or sends a password", async () => {
    await inviteDepartmentAdmin({ email: EMAIL, name: "Priya Admin", departmentId: DEPT.id });

    const sent = JSON.stringify(clerk.invitations.createInvitation.mock.calls) + JSON.stringify(vi.mocked(prisma.adminInvitation.create).mock.calls);
    expect(sent).not.toMatch(/password/i);
    expect(clerk.users).not.toHaveProperty("createUser");
  });

  it("links back to the address it was sent from when no app URL is configured", async () => {
    (env as { NEXT_PUBLIC_APP_URL?: string }).NEXT_PUBLIC_APP_URL = undefined;

    await inviteDepartmentAdmin({ email: EMAIL, name: "Priya Admin", departmentId: DEPT.id });

    expect(clerk.invitations.createInvitation.mock.calls[0][0]).toMatchObject({
      redirectUrl: "https://preview.test/accept-invitation",
    });
  });

  it("a resend revokes the old link, issues a new one, and restarts the clock", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(openInvitation() as never);
    clerk.invitations.createInvitation.mockResolvedValue({ id: "clerk-inv-2" });

    const result = await resendAdminInvitation({ invitationId: "inv-1" });

    expect(result.success).toBe(true);
    expect(clerk.invitations.revokeInvitation).toHaveBeenCalledWith("clerk-inv-1");
    expect(clerk.invitations.createInvitation.mock.calls[0][0]).toMatchObject({ expiresInDays: INVITATION_TTL_DAYS, notify: true });
    expect(prisma.adminInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clerkInvitationId: "clerk-inv-2", resentAt: expect.any(Date) }) })
    );
    // The new link's clock starts at the resend.
    const resentAt = new Date("2026-09-24T10:00:00Z");
    expect(invitationExpiresAt({ invitedAt: new Date("2026-09-01T10:00:00Z"), resentAt })).toEqual(
      new Date(resentAt.getTime() + INVITATION_TTL_DAYS * DAY)
    );
  });
});

describe("the page the invitation link opens", () => {
  const render = async (params: Record<string, string>) =>
    renderToStaticMarkup(await AcceptInvitationPage({ searchParams: Promise.resolve(params) }));

  it("3. with a ticket, explains the invitation and hands over to Clerk's sign-up to set a password", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);

    const html = await render({ __clerk_ticket: "tkt_123", __clerk_status: "sign_up" });

    expect(html).toContain("Set up your CampusHire admin account");
    expect(html).toContain("Choose a password");
    expect(html).toContain("clerk-sign-up");
  });

  it("without a ticket, says the link is incomplete, expired or used, and how to get a new one", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);

    const html = await render({});

    expect(html).toContain("expired or already been used");
    expect(html).toContain("resend the");
    expect(html).not.toContain("clerk-sign-up");
  });
});

describe("accepting the invitation", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(openInvitation() as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.adminInvitation.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  const accept = () =>
    applyAdminInvitation({
      userId: "user-new",
      email: EMAIL.toUpperCase(),
      metadata: { role: "DEPT_ADMIN", departmentId: DEPT.id, invitedName: "Priya Admin" },
    });

  it("4–6. makes them a department admin of exactly the invited department", async () => {
    const outcome = await accept();

    expect(outcome).toEqual({ applied: true, departmentId: DEPT.id });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-new" },
      data: expect.objectContaining({ role: "DEPT_ADMIN" }),
    });
    expect(prisma.departmentAdmin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-new", departmentId: DEPT.id, status: "ACTIVE" }),
    });
    // Matched on the invited address and department, not on metadata alone.
    expect(vi.mocked(prisma.adminInvitation.findFirst).mock.calls[0][0]).toMatchObject({
      where: { email: EMAIL, departmentId: DEPT.id, status: "INVITED" },
    });
  });

  it("10. refuses an invitation past its expiry, writing nothing", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(
      openInvitation({ invitedAt: new Date(Date.now() - (INVITATION_TTL_DAYS + 1) * DAY) }) as never
    );

    expect(await accept()).toEqual({ applied: false, reason: "EXPIRED" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.departmentAdmin.create).not.toHaveBeenCalled();
    expect(isInvitationExpired({ invitedAt: new Date(Date.now() - (INVITATION_TTL_DAYS + 1) * DAY), resentAt: null })).toBe(true);
  });

  it("10. honours a resent invitation whose original link has lapsed", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(
      openInvitation({ invitedAt: new Date(Date.now() - 30 * DAY), resentAt: new Date(Date.now() - DAY) }) as never
    );

    expect((await accept()).applied).toBe(true);
  });

  it("11. a used invitation cannot be used again", async () => {
    expect((await accept()).applied).toBe(true);

    // Now accepted: no open invitation remains for the address.
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null as never);
    vi.clearAllMocks();
    expect(await accept()).toEqual({ applied: false, reason: "NO_INVITATION" });
    expect(prisma.departmentAdmin.create).not.toHaveBeenCalled();
  });

  it("11. two acceptances racing: only one wins", async () => {
    vi.mocked(prisma.adminInvitation.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    await expect(accept()).rejects.toThrow("already accepted");
    expect(prisma.departmentAdmin.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Part A — revoking access
// ---------------------------------------------------------------------------

const adminRow = (over: object = {}) => ({
  id: "admin-1",
  userId: "user-admin",
  departmentId: DEPT.id,
  status: "ACTIVE",
  user: { id: "user-admin", clerkId: "clerk-admin", email: "admin@college.test", name: "Ravi Admin", role: "DEPT_ADMIN" },
  department: DEPT,
  ...over,
});

describe("removing a department admin", () => {
  beforeEach(() => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(adminRow() as never);
    vi.mocked(prisma.departmentAdmin.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("7. marks them DISABLED — the account and history are kept, nothing is deleted", async () => {
    const result = await disableDepartmentAdmin({ userId: "user-admin", reason: "Left the college" });

    expect(result.success).toBe(true);
    expect(prisma.departmentAdmin.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-admin", status: "ACTIVE" },
      data: expect.objectContaining({ status: "DISABLED", disabledById: "super-1", disableReason: "Left the college" }),
    });
    expect(prisma).not.toHaveProperty("departmentAdmin.delete");
  });

  it("8. ends every live Clerk session they have, at once", async () => {
    const result = await disableDepartmentAdmin({ userId: "user-admin" });

    expect(clerk.sessions.getSessionList).toHaveBeenCalledWith({ userId: "clerk-admin", status: "active", limit: 100 });
    expect(clerk.sessions.revokeSession.mock.calls.map(([id]) => id)).toEqual(["sess-laptop", "sess-phone"]);
    expect(result).toMatchObject({ success: true, message: expect.stringContaining("Signed out of 2 active sessions") });
  });

  it("8. still removes them if Clerk cannot be reached, and says the database refuses them regardless", async () => {
    clerk.sessions.getSessionList.mockRejectedValueOnce(new Error("clerk down"));

    const result = await disableDepartmentAdmin({ userId: "user-admin" });

    expect(result).toMatchObject({ success: true, message: expect.stringContaining("refused on every request regardless") });
    expect(prisma.departmentAdmin.updateMany).toHaveBeenCalled();
  });

  it("ends no session when the removal itself did not happen", async () => {
    vi.mocked(prisma.departmentAdmin.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    expect((await disableDepartmentAdmin({ userId: "user-admin" })).success).toBe(false);
    expect(clerk.sessions.revokeSession).not.toHaveBeenCalled();
  });
});

describe("a revoked admin signing in again", () => {
  const signedInAs = (role: string, status: "ACTIVE" | "DISABLED" | null) => {
    vi.mocked(getOrCreateUser).mockResolvedValue({ id: "user-admin", role } as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue((status ? { status } : null) as never);
  };

  it("9. is sent from any admin page to the Access Revoked page", async () => {
    signedInAs("DEPT_ADMIN", "DISABLED");

    await expect(AdminLayout({ children: "dashboard" })).rejects.toThrow("NEXT_REDIRECT:/access-revoked");
  });

  it("an active admin gets the admin area as before", async () => {
    signedInAs("DEPT_ADMIN", "ACTIVE");

    expect(await AdminLayout({ children: "dashboard" })).toBeTruthy();
  });

  it("9. sees a clear Access Revoked page with a contact — and no internal details", async () => {
    signedInAs("DEPT_ADMIN", "DISABLED");

    const html = renderToStaticMarkup(await AccessRevokedPage());

    expect(html).toContain("Access revoked");
    expect(html).toContain("has been revoked by the Super Admin");
    expect(html).toContain('href="mailto:placement@college.test');
    expect(html).toContain("BVCOE placement office");
    expect(html).toContain("Sign out");
    // Not the reason recorded, not the department.
    expect(html).not.toContain("Left the college");
    expect(html).not.toContain("Computer Engineering");
  });

  it("the Access Revoked page is only for revoked admins", async () => {
    signedInAs("DEPT_ADMIN", "ACTIVE");
    await expect(AccessRevokedPage()).rejects.toThrow("NEXT_REDIRECT:/");

    signedInAs("STUDENT", null);
    await expect(AccessRevokedPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("9. cannot use an admin API with the role alone", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-admin", role: "DEPT_ADMIN" } as never);
    vi.mocked(getActiveDepartmentAdmin).mockResolvedValue(null);
    const form = new FormData();
    form.set("file", new File(["x"], "logo.png", { type: "image/png" }));

    const response = await uploadLogo(new Request("https://campushire.test/api/admin/drives/logo", { method: "POST", body: form }) as never);

    expect(response.status).toBe(403);
  });

  it("an active admin can still use it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-admin", role: "DEPT_ADMIN" } as never);
    vi.mocked(getActiveDepartmentAdmin).mockResolvedValue({ departmentId: DEPT.id } as never);
    const form = new FormData();
    form.set("file", new File(["x"], "logo.png", { type: "image/png" }));

    const response = await uploadLogo(new Request("https://campushire.test/api/admin/drives/logo", { method: "POST", body: form }) as never);

    expect(response.status).toBe(200);
  });
});
