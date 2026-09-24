import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Queries that a browser can reach.
 *
 * A function that touches the database is not made safe by the page it is
 * rendered beside. `getAvailableUsers` is called straight from the admin
 * accounts screen, which is a client component, so it is a server action and
 * must carry its own authorization — this is the regression test for a
 * version that carried none.
 *
 * Also here: a refusal must not tell the caller anything a permitted answer
 * would not have. `getStudentDetailForAdmin` must say the same thing about a
 * student id that does not exist and a student id in another department, or
 * an admin can use it to enumerate the other departments' rosters. Since
 * Phase 9 (Item 21), a Super Admin may read any student here too — the
 * institution-wide directory's "Student detail" link — without that
 * loosening what a department admin may reach.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    departmentAdmin: { findMany: vi.fn(async () => []) },
    user: { findMany: vi.fn(async () => []) },
    student: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
  requireDepartmentAdmin: vi.fn(),
  requireAnyRole: vi.fn(),
  getActiveDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message = "Insufficient permissions") {
      super(message);
      this.name = "AuthorizationError";
    }
  },
}));

vi.mock("../../students/queries/get-profile", () => ({
  getStudentProfile: vi.fn(async (id: string) => ({ id })),
}));

import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  requireAnyRole,
  getActiveDepartmentAdmin,
  AuthorizationError,
} from "@/lib/auth";
import { getAvailableUsers } from "../queries/get-available-users";
import { getStudentDetailForAdmin } from "@/features/students/actions/get-student-detail-for-admin";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("getAvailableUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.departmentAdmin.findMany).mockResolvedValue([]);
    asMock(prisma.user.findMany).mockResolvedValue([]);
  });

  it("refuses anyone who is not the Super Admin", async () => {
    asMock(requireSuperAdmin).mockRejectedValue(new AuthorizationError());

    await expect(getAvailableUsers({ search: "", limit: 10 })).rejects.toThrow(
      AuthorizationError
    );
    // Nothing was read.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("asks for authorization before it reads anything", async () => {
    const order: string[] = [];
    asMock(requireSuperAdmin).mockImplementation(async () => {
      order.push("auth");
      return { id: "super-1", role: "SUPER_ADMIN" };
    });
    asMock(prisma.departmentAdmin.findMany).mockImplementation(async () => {
      order.push("read");
      return [];
    });

    await getAvailableUsers({ search: "", limit: 10 });
    expect(order).toEqual(["auth", "read"]);
  });

  it("only offers students who hold no admin row", async () => {
    asMock(requireSuperAdmin).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });
    asMock(prisma.departmentAdmin.findMany).mockResolvedValue([
      { userId: "user-admin" },
    ]);

    await getAvailableUsers({ search: "", limit: 10 });

    const where = asMock(prisma.user.findMany).mock.calls[0][0].where;
    expect(where.role).toEqual({ in: ["STUDENT"] });
    expect(where.id).toEqual({ notIn: ["user-admin"] });
  });

  it("never returns a Clerk id to the browser", async () => {
    asMock(requireSuperAdmin).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });

    await getAvailableUsers({ search: "", limit: 10 });

    const select = asMock(prisma.user.findMany).mock.calls[0][0].select;
    expect(select).toEqual({ id: true, email: true });
  });

  it("refuses a limit outside the schema's range", async () => {
    asMock(requireSuperAdmin).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });

    await expect(getAvailableUsers({ search: "", limit: 5000 })).rejects.toThrow();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("getStudentDetailForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(requireAnyRole).mockResolvedValue({ id: "user-1", role: "DEPT_ADMIN" });
    asMock(getActiveDepartmentAdmin).mockResolvedValue({ departmentId: "dept-cse", status: "ACTIVE" });
  });

  it("says the same thing about an id that does not exist and one in another department", async () => {
    asMock(prisma.student.findUnique).mockResolvedValue(null);
    const missing = await getStudentDetailForAdmin("nope").catch((error) => error);

    asMock(prisma.student.findUnique).mockResolvedValue({ departmentId: "dept-it" });
    const foreign = await getStudentDetailForAdmin("student-it").catch((error) => error);

    expect(missing).toBeInstanceOf(AuthorizationError);
    expect(foreign).toBeInstanceOf(AuthorizationError);
    expect(foreign.message).toBe(missing.message);
  });

  it("returns the profile for a student of the admin's own department", async () => {
    asMock(prisma.student.findUnique).mockResolvedValue({ departmentId: "dept-cse" });

    await expect(getStudentDetailForAdmin("student-cse")).resolves.toEqual({
      id: "student-cse",
    });
  });

  it("refuses a disabled admin before it reads the student", async () => {
    asMock(requireAnyRole).mockRejectedValue(
      new AuthorizationError("Your department admin access has been disabled.")
    );

    await expect(getStudentDetailForAdmin("student-cse")).rejects.toThrow(
      AuthorizationError
    );
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  // Phase 9, Item 21: the Super Admin's institution-wide "Student detail" link.
  it("a Super Admin may read a student in any department, without the department check", async () => {
    asMock(requireAnyRole).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });
    asMock(prisma.student.findUnique).mockResolvedValue({ departmentId: "dept-it" });

    await expect(getStudentDetailForAdmin("student-it")).resolves.toEqual({ id: "student-it" });
    // Never even looked at the student's department for a Super Admin.
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("refuses anyone who is neither a department admin nor a Super Admin", async () => {
    asMock(requireAnyRole).mockRejectedValue(new AuthorizationError());

    await expect(getStudentDetailForAdmin("student-cse")).rejects.toThrow(AuthorizationError);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });
});
