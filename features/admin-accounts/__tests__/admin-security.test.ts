import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignDepartmentAdmin } from "../actions/assign-department-admin";
import { removeDepartmentAdmin } from "../actions/remove-department-admin";
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
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should block unauthenticated user from assigning admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must be signed in");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should block unauthenticated user from removing admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await removeDepartmentAdmin({
        userId: "user-1",
      });

      expect(result.success).toBe(false);
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
        userId: "user-1",
        departmentId: "dept-1",
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
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should block DEPT_ADMIN from removing admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have DEPT_ADMIN role."
        )
      );

      const result = await removeDepartmentAdmin({
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should block STUDENT from removing admin", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have STUDENT role."
        )
      );

      const result = await removeDepartmentAdmin({
        userId: "user-1",
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
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "super-user",
        clerkId: "clerk-super",
        email: "super@college.edu",
        role: "SUPER_ADMIN", // Should not be assigned
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await assignDepartmentAdmin({
        userId: "super-user",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Cannot assign Super Admin");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should prevent removing SUPER_ADMIN account", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce({
        id: "admin-1",
        userId: "super-user",
        departmentId: "dept-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "super-user",
          clerkId: "clerk-super",
          email: "super@college.edu",
          role: "SUPER_ADMIN", // Should not be removed
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const result = await removeDepartmentAdmin({
        userId: "super-user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Cannot remove Super Admin");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("Identity Preservation", () => {
    it("should not delete Clerk identity when removing admin", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce({
        id: "admin-1",
        userId: "user-1",
        departmentId: "dept-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-1",
          clerkId: "clerk-user-1",
          email: "admin@college.edu",
          role: "DEPT_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      // User record still exists after removal
      const updatedUser = {
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "admin@college.edu",
        role: "STUDENT", // Reverted role
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockResolvedValueOnce(updatedUser);

      const result = await removeDepartmentAdmin({
        userId: "user-1",
      });

      expect(result.success).toBe(true);
      // Should only update role and delete DepartmentAdmin
      // Should NOT delete User or Clerk identity
    });
  });
});
