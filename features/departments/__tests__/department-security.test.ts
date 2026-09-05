import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDepartment } from "../actions/create-department";
import { updateDepartment } from "../actions/update-department";
import { toggleDepartmentStatus } from "../actions/toggle-department-status";
import { AuthenticationError, AuthorizationError } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    department: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

describe("Department Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should block unauthenticated user from creating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await createDepartment({
        name: "Computer Science",
        code: "CS",
        isActive: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must be signed in");
      }
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it("should block unauthenticated user from updating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await updateDepartment({
        id: "dept-1",
        name: "Updated Name",
      });

      expect(result.success).toBe(false);
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("should block unauthenticated user from toggling status", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthenticationError("You must be signed in")
      );

      const result = await toggleDepartmentStatus({
        id: "dept-1",
        isActive: false,
      });

      expect(result.success).toBe(false);
      expect(prisma.department.update).not.toHaveBeenCalled();
    });
  });

  describe("Authorization", () => {
    it("should block STUDENT from creating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have STUDENT role."
        )
      );

      const result = await createDepartment({
        name: "Computer Science",
        code: "CS",
        isActive: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("SUPER_ADMIN");
      }
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it("should block DEPT_ADMIN from creating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have DEPT_ADMIN role."
        )
      );

      const result = await createDepartment({
        name: "Computer Science",
        code: "CS",
        isActive: true,
      });

      expect(result.success).toBe(false);
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it("should block DEPT_ADMIN from updating any department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have DEPT_ADMIN role."
        )
      );

      const result = await updateDepartment({
        id: "dept-1",
        name: "Updated Name",
      });

      expect(result.success).toBe(false);
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("should block STUDENT from updating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError(
          "This action requires SUPER_ADMIN role. You have STUDENT role."
        )
      );

      const result = await updateDepartment({
        id: "dept-1",
        name: "Updated Name",
      });

      expect(result.success).toBe(false);
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("should block non-admin from deactivating department", async () => {
      vi.mocked(requireSuperAdmin).mockRejectedValueOnce(
        new AuthorizationError("Insufficient permissions")
      );

      const result = await toggleDepartmentStatus({
        id: "dept-1",
        isActive: false,
      });

      expect(result.success).toBe(false);
      expect(prisma.department.update).not.toHaveBeenCalled();
    });
  });

  describe("Soft Delete", () => {
    it("should deactivate without deleting related records", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cl123456789012345678901",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.update).mockResolvedValueOnce({
        id: "cl123456789012345678901",
        name: "Computer Science",
        code: "CS",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await toggleDepartmentStatus({
        id: "cl123456789012345678901",
        isActive: false,
      });

      expect(result.success).toBe(true);
      // Should call update, not delete
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: "cl123456789012345678901" },
        data: { isActive: false },
      });
      // No delete should ever be called
      expect(vi.mocked(prisma.department).delete).toBeUndefined();
    });
  });
});
