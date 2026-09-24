import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Disabling, reactivating and moving a department admin.
 *
 * Disabling is the alternative to deletion: the row stays, and so does
 * everything attached to it. What must be true is that the authorization is
 * gone from that moment — which is why `getActiveDepartmentAdmin` and
 * `requireDepartmentAdmin` are tested here too, since they are what every
 * department-scoped path actually asks.
 */

vi.mock("@/lib/prisma", () => {
  const tx = {
    departmentAdmin: { updateMany: vi.fn() },
    user: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      departmentAdmin: { findUnique: vi.fn() },
      department: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
  requireDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: {
    DISABLE: "DISABLE",
    REACTIVATE: "REACTIVATE",
    ASSIGN: "ASSIGN",
  },
  AuditEntityType: { DEPARTMENT_ADMIN: "DepartmentAdmin" },
}));

vi.mock("@/lib/notifications", () => ({
  deliverNotificationSafely: vi.fn(async () => ({ delivered: 1 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Disabling ends the admin's Clerk sessions (Phase 6, `end-sessions.ts`) —
// mocked here so this stays a unit test rather than a real call to Clerk's
// API on every run.
const clerk = { sessions: { getSessionList: vi.fn(), revokeSession: vi.fn() } };
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn(async () => clerk) }));

import { prisma } from "@/lib/prisma";
import { createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely } from "@/lib/notifications";
import {
  changeAdminDepartment,
  disableDepartmentAdmin,
  reactivateDepartmentAdmin,
} from "../actions/set-admin-status";

const CSE = "dept-cse";
const IT = "dept-it";
const tx = (prisma as unknown as { __tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> })
  .__tx;

const admin = (overrides: object = {}) => ({
  id: "admin-1",
  userId: "user-1",
  departmentId: CSE,
  status: "ACTIVE",
  user: { id: "user-1", clerkId: "clerk-user-1", email: "admin@college.edu", name: "CSE Admin", role: "DEPT_ADMIN" },
  department: { id: CSE, code: "CSE", name: "Computer Science", isActive: true },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  tx.departmentAdmin.updateMany.mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(admin() as never);
  clerk.sessions.getSessionList.mockResolvedValue({ data: [{ id: "sess-1" }] });
  clerk.sessions.revokeSession.mockResolvedValue({});
});

describe("disabling", () => {
  it("takes the authorization away and records who, when and why", async () => {
    const result = await disableDepartmentAdmin({ userId: "user-1", reason: "On leave" });

    expect(result.success).toBe(true);
    const update = tx.departmentAdmin.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(update.where).toMatchObject({ userId: "user-1", status: "ACTIVE" });
    expect(update.data).toMatchObject({
      status: "DISABLED",
      disabledById: "super-1",
      disableReason: "On leave",
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "DISABLE",
    });
    // Phase 6: signed out everywhere, not just refused on their next request.
    expect(clerk.sessions.getSessionList).toHaveBeenCalledWith({
      userId: "clerk-user-1",
      status: "active",
      limit: 100,
    });
    expect(clerk.sessions.revokeSession).toHaveBeenCalledWith("sess-1");
  });

  it("deletes nothing: no user, no admin row, no history", async () => {
    await disableDepartmentAdmin({ userId: "user-1" });

    const written = JSON.stringify(tx.departmentAdmin.updateMany.mock.calls[0][0]);
    expect(written).not.toContain("delete");
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("tells them, since their account still works", async () => {
    await disableDepartmentAdmin({ userId: "user-1", reason: "On leave" });

    expect(vi.mocked(deliverNotificationSafely).mock.calls[0][0]).toMatchObject({
      event: "ACCOUNT_UPDATE",
      role: "DEPT_ADMIN",
      recipients: [{ userId: "user-1" }],
    });
  });

  it("refuses one that is already disabled", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({ status: "DISABLED" }) as never
    );

    const result = await disableDepartmentAdmin({ userId: "user-1" });

    expect(result).toEqual({ success: false, error: "This admin is already disabled." });
    expect(tx.departmentAdmin.updateMany).not.toHaveBeenCalled();
  });
});

describe("reactivating", () => {
  beforeEach(() => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({ status: "DISABLED" }) as never
    );
  });

  it("clears the disabled state and says so", async () => {
    const result = await reactivateDepartmentAdmin({ userId: "user-1" });

    expect(result.success).toBe(true);
    expect(tx.departmentAdmin.updateMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "user-1", status: "DISABLED" },
      data: { status: "ACTIVE", disabledAt: null, disableReason: null },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "REACTIVATE",
    });
  });

  it("gives back the admin role to an account that was demoted meanwhile", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({
        status: "DISABLED",
        user: { id: "user-1", email: "a@b.c", name: null, role: "STUDENT" },
      }) as never
    );

    await reactivateDepartmentAdmin({ userId: "user-1" });

    expect(tx.user.update.mock.calls[0][0]).toMatchObject({ data: { role: "DEPT_ADMIN" } });
  });

  it("refuses while the department itself is inactive", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({
        status: "DISABLED",
        department: { id: CSE, code: "CSE", name: "Computer Science", isActive: false },
      }) as never
    );

    const result = await reactivateDepartmentAdmin({ userId: "user-1" });

    expect(result.success).toBe(false);
    expect(tx.departmentAdmin.updateMany).not.toHaveBeenCalled();
  });

  it("refuses for an account that is now a Super Admin", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({
        status: "DISABLED",
        user: { id: "user-1", email: "a@b.c", name: null, role: "SUPER_ADMIN" },
      }) as never
    );

    const result = await reactivateDepartmentAdmin({ userId: "user-1" });

    expect(result.success).toBe(false);
  });
});

describe("changing department", () => {
  beforeEach(() => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: IT,
      code: "IT",
      name: "Information Technology",
      isActive: true,
    } as never);
  });

  it("moves the authorization and leaves the old department's history alone", async () => {
    const result = await changeAdminDepartment({ userId: "user-1", departmentId: IT });

    expect(result.success).toBe(true);
    expect(tx.departmentAdmin.updateMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "user-1", departmentId: CSE },
      data: { departmentId: IT },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "ASSIGN",
      metadata: { fromDepartmentCode: "CSE", toDepartmentCode: "IT" },
    });
    expect(result.success && result.message).toContain("CSE");
  });

  it("refuses an inactive destination", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: IT,
      code: "IT",
      name: "Information Technology",
      isActive: false,
    } as never);

    const result = await changeAdminDepartment({ userId: "user-1", departmentId: IT });

    expect(result.success).toBe(false);
    expect(tx.departmentAdmin.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a move to the department they already administer", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: CSE,
      code: "CSE",
      name: "Computer Science",
      isActive: true,
    } as never);

    const result = await changeAdminDepartment({ userId: "user-1", departmentId: CSE });

    expect(result.success).toBe(false);
  });
});
