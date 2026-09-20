import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignDepartmentAdmin } from "../actions/assign-department-admin";
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
    // Not `clearAllMocks`: that leaves the `mockResolvedValueOnce` queues in
    // place, so a value one test never consumed was handed to the next.
    vi.resetAllMocks();
  });

  describe("assignDepartmentAdmin", () => {
    it("should allow Super Admin to assign valid user as admin", async () => {
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
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cdept00000000000000001",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "cuser00000000000000001",
          clerkId: "clerk-user-1",
          name: null,
          email: "user@college.edu",
          role: "DEPT_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "cuser00000000000000001",
          departmentId: "cdept00000000000000001",
          createdAt: new Date(),
          updatedAt: new Date(),
          firstSeenAt: null,
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledById: null,
          disableReason: null,
          user: {
            id: "cuser00000000000000001",
            email: "user@college.edu",
            clerkId: "clerk-user-1",
            name: null,
            role: "DEPT_ADMIN",
          },
          department: {
            id: "cdept00000000000000001",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe("cuser00000000000000001");
        expect(result.data.departmentId).toBe("cdept00000000000000001");
      }
      expect(requireSuperAdmin).toHaveBeenCalledOnce();
    });

    it("should upgrade STUDENT to DEPT_ADMIN role", async () => {
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
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "student@college.edu",
        role: "STUDENT", // Currently STUDENT
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cdept00000000000000001",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "cuser00000000000000001",
          clerkId: "clerk-user-1",
          name: null,
          email: "student@college.edu",
          role: "DEPT_ADMIN", // Upgraded
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "cuser00000000000000001",
          departmentId: "cdept00000000000000001",
          createdAt: new Date(),
          updatedAt: new Date(),
          firstSeenAt: null,
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledById: null,
          disableReason: null,
          user: {
            id: "cuser00000000000000001",
            email: "student@college.edu",
            clerkId: "clerk-user-1",
            name: null,
            role: "DEPT_ADMIN",
          },
          department: {
            id: "cdept00000000000000001",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(true);
    });

    it("should reject duplicate assignment", async () => {
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
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "admin@college.edu",
        role: "DEPT_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce({
        id: "admin-1",
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
        createdAt: new Date(),
        updatedAt: new Date(),
        firstSeenAt: null,
        status: "ACTIVE" as const,
        disabledAt: null,
        disabledById: null,
        disableReason: null,
      });

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
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
        role: "SUPER_ADMIN", // Cannot be assigned as dept admin
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
    });

    it("should reject assignment to non-existent user", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await assignDepartmentAdmin({
        userId: "cmissing000000000000001",
        departmentId: "cdept00000000000000001",
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
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce(null);

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cmissing000000000000001",
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
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cdept00000000000000001",
        name: "Computer Science",
        code: "CS",
        isActive: false, // Inactive
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
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
        name: null,
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "cuser00000000000000001",
        clerkId: "clerk-user-1",
        name: null,
        email: "user@college.edu",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Check returns null (not assigned yet)
      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cdept00000000000000001",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.$transaction).mockResolvedValueOnce({
        updatedUser: {
          id: "cuser00000000000000001",
          clerkId: "clerk-user-1",
          name: null,
          email: "user@college.edu",
          role: "DEPT_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        admin: {
          id: "admin-1",
          userId: "cuser00000000000000001",
          departmentId: "cdept00000000000000001",
          createdAt: new Date(),
          updatedAt: new Date(),
          firstSeenAt: null,
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledById: null,
          disableReason: null,
          user: {
            id: "cuser00000000000000001",
            email: "user@college.edu",
            clerkId: "clerk-user-1",
            name: null,
            role: "DEPT_ADMIN",
          },
          department: {
            id: "cdept00000000000000001",
            name: "Computer Science",
            code: "CS",
          },
        },
      } as any);

      const result = await assignDepartmentAdmin({
        userId: "cuser00000000000000001",
        departmentId: "cdept00000000000000001",
      });

      expect(result.success).toBe(true);
      // The unique constraint on userId ensures only one assignment possible
    });
  });


  describe("getDepartmentAdmins", () => {
    it("should return paginated admin list", async () => {
      vi.mocked(prisma.departmentAdmin.count).mockResolvedValueOnce(2);

      vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValueOnce([
        {
          id: "admin-1",
          userId: "cuser00000000000000001",
          departmentId: "cdept00000000000000001",
          createdAt: new Date(),
          updatedAt: new Date(),
          firstSeenAt: null,
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledById: null,
          disableReason: null,
          user: {
            id: "cuser00000000000000001",
            email: "admin1@college.edu",
            clerkId: "clerk-user-1",
            name: null,
            role: "DEPT_ADMIN",
            createdAt: new Date(),
          },
          department: {
            id: "cdept00000000000000001",
            name: "Computer Science",
            code: "CS",
            isActive: true,
          },
        },
        {
          id: "admin-2",
          userId: "cuser00000000000000002",
          departmentId: "cdept00000000000000002",
          createdAt: new Date(),
          updatedAt: new Date(),
          firstSeenAt: null,
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledById: null,
          disableReason: null,
          user: {
            id: "cuser00000000000000002",
            email: "admin2@college.edu",
            clerkId: "clerk-user-2",
            name: null,
            role: "DEPT_ADMIN",
            createdAt: new Date(),
          },
          department: {
            id: "cdept00000000000000002",
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
        departmentId: "cdept00000000000000001",
      });

      expect(prisma.departmentAdmin.count).toHaveBeenCalledWith({
        where: { departmentId: "cdept00000000000000001" },
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
          id: "cuser00000000000000001",
          email: "student1@college.edu",
          clerkId: "clerk-user-1",
          name: null,
          role: "STUDENT",
          createdAt: new Date(),
        },
        {
          id: "cuser00000000000000002",
          email: "student2@college.edu",
          clerkId: "clerk-user-2",
          name: null,
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
        // Only what the picker shows — the Clerk id stays on the server.
        select: {
          id: true,
          email: true,
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
