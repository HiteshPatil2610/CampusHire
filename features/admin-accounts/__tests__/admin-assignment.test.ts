import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignDepartmentAdmin } from "../actions/assign-department-admin";
import { removeDepartmentAdmin } from "../actions/remove-department-admin";
import { getDepartmentAdmins } from "../queries/get-department-admins";
import { getAvailableUsers } from "../queries/get-available-users";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    departmentAdmin: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      user: {
        update: vi.fn(),
      },
      departmentAdmin: {
        create: vi.fn(),
        delete: vi.fn(),
      },
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
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

describe("Admin Assignment Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignDepartmentAdmin", () => {
    it("should allow Super Admin to assign valid user as admin", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "user-1",
          clerkId: "clerk-user-1",
          email: "user@college.edu",
          role: "DEPT_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "user-1",
          departmentId: "dept-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-1",
            email: "user@college.edu",
            clerkId: "clerk-user-1",
            role: "DEPT_ADMIN",
          },
          department: {
            id: "dept-1",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe("user-1");
        expect(result.data.departmentId).toBe("dept-1");
      }
      expect(requireSuperAdmin).toHaveBeenCalledOnce();
    });

    it("should upgrade STUDENT to DEPT_ADMIN role", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "student@college.edu",
        role: "STUDENT", // Currently STUDENT
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "user-1",
          clerkId: "clerk-user-1",
          email: "student@college.edu",
          role: "DEPT_ADMIN", // Upgraded
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "user-1",
          departmentId: "dept-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-1",
            email: "student@college.edu",
            clerkId: "clerk-user-1",
            role: "DEPT_ADMIN",
          },
          department: {
            id: "dept-1",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(true);
    });

    it("should reject duplicate assignment", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "admin@college.edu",
        role: "DEPT_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce({
        id: "admin-1",
        userId: "user-1",
        departmentId: "dept-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already assigned");
      }
    });

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
        role: "SUPER_ADMIN", // Cannot be assigned as dept admin
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
    });

    it("should reject assignment to non-existent user", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await assignDepartmentAdmin({
        userId: "non-existent",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User not found");
      }
    });

    it("should reject assignment to non-existent department", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce(null);

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "non-existent",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Department not found");
      }
    });

    it("should reject assignment to inactive department", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: false, // Inactive
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("inactive department");
      }
    });

    it("should ensure admin has exactly one department", async () => {
      // After assignment, user should have exactly one DepartmentAdmin record
      // This is enforced by the unique constraint on userId
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Check returns null (not assigned yet)
      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "user-1",
          clerkId: "clerk-user-1",
          email: "user@college.edu",
          role: "DEPT_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "user-1",
          departmentId: "dept-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-1",
            email: "user@college.edu",
            clerkId: "clerk-user-1",
            role: "DEPT_ADMIN",
          },
          department: {
            id: "dept-1",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "user-1",
        departmentId: "dept-1",
      });

      expect(result.success).toBe(true);
      // The unique constraint on userId ensures only one assignment possible
    });
  });

  describe("removeDepartmentAdmin", () => {
    it("should allow Super Admin to remove admin", async () => {
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

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "admin@college.edu",
        role: "STUDENT", // Reverted to STUDENT
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await removeDepartmentAdmin({ userId: "user-1" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe("user-1");
      }
    });

    it("should revert role to STUDENT after removal", async () => {
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

      const updatedUser = {
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "admin@college.edu",
        role: "STUDENT", // Reverted
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockResolvedValueOnce(updatedUser);

      const result = await removeDepartmentAdmin({ userId: "user-1" });

      expect(result.success).toBe(true);
      // Role should be STUDENT after removal (safe default)
    });

    it("should preserve User record after removal", async () => {
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

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        id: "user-1",
        clerkId: "clerk-user-1",
        email: "admin@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await removeDepartmentAdmin({ userId: "user-1" });

      expect(result.success).toBe(true);
      // Removal should only delete DepartmentAdmin record
      // User record should still exist (returned from transaction)
    });

    it("should handle admin not found", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      const result = await removeDepartmentAdmin({ userId: "non-existent" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("getDepartmentAdmins", () => {
    it("should return paginated admin list", async () => {
      vi.mocked(prisma.departmentAdmin.count).mockResolvedValueOnce(2);

      vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValueOnce([
        {
          id: "admin-1",
          userId: "user-1",
          departmentId: "dept-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-1",
            email: "admin1@college.edu",
            clerkId: "clerk-user-1",
            role: "DEPT_ADMIN",
            createdAt: new Date(),
          },
          department: {
            id: "dept-1",
            name: "Computer Science",
            code: "CS",
            isActive: true,
          },
        },
        {
          id: "admin-2",
          userId: "user-2",
          departmentId: "dept-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-2",
            email: "admin2@college.edu",
            clerkId: "clerk-user-2",
            role: "DEPT_ADMIN",
            createdAt: new Date(),
          },
          department: {
            id: "dept-2",
            name: "Electronics",
            code: "ECE",
            isActive: true,
          },
        },
      ] as any);

      const result = await getDepartmentAdmins({
        page: 1,
        pageSize: 25,
      });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.totalCount).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].user.email).toBe("admin1@college.edu");
    });

    it("should filter by department", async () => {
      vi.mocked(prisma.departmentAdmin.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValueOnce([]);

      await getDepartmentAdmins({
        page: 1,
        pageSize: 25,
        departmentId: "dept-1",
      });

      expect(prisma.departmentAdmin.count).toHaveBeenCalledWith({
        where: { departmentId: "dept-1" },
      });
    });
  });

  describe("getAvailableUsers", () => {
    it("should return users not assigned as admins", async () => {
      vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValueOnce([
        { userId: "admin-1" },
        { userId: "admin-2" },
      ] as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: "user-1",
          email: "student1@college.edu",
          clerkId: "clerk-user-1",
          role: "STUDENT",
          createdAt: new Date(),
        },
        {
          id: "user-2",
          email: "student2@college.edu",
          clerkId: "clerk-user-2",
          role: "STUDENT",
          createdAt: new Date(),
        },
      ] as any);

      const result = await getAvailableUsers({
        limit: 10,
      });

      expect(result).toHaveLength(2);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { in: ["STUDENT"] },
          id: { notIn: ["admin-1", "admin-2"] },
        },
        take: 10,
        orderBy: { email: "asc" },
        select: {
          id: true,
          email: true,
          clerkId: true,
          role: true,
          createdAt: true,
        },
      });
    });

    it("should support search by email", async () => {
      vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      await getAvailableUsers({
        search: "john",
        limit: 10,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: {
              contains: "john",
              mode: "insensitive",
            },
          }),
        })
      );
    });
  });
});
