import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignDepartmentAdmin } from "../actions/assign-department-admin";
import { AuthenticationError, AuthorizationError } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    departmentAdmin: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthenticationError";
    }
  },
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() => ({
    users: {
      updateUserMetadata: vi.fn(),
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

describe("Admin Assignment Security", () => {
  beforeEach(() => {
    // Not `clearAllMocks`: that leaves the `mockResolvedValueOnce` queues in
    // place, so a value one test never consumed was handed to the next.
    vi.resetAllMocks();
  });

  describe("Authentication", () => {
    it("should block unauthenticated user from assigning admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must be signed in");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

  });

  describe("Authorization", () => {
    it("should block STUDENT from assigning admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have STUDENT role."
        )
      );

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("SUPER_ADMIN");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should block DEPT_ADMIN from assigning admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have DEPT_ADMIN role."
        )
      );

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });


  });

  describe("Role Protection", () => {
    it("should prevent assigning SUPER_ADMIN as DEPT_ADMIN", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "csuper0000000000000001",
        clerkId: "clerk-super",
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN", // Should not be assigned
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await assignDepartmentAdmin({
        userId: "csuper0000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Cannot assign Super Admin");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

  });

});
