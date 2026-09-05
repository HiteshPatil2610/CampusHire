import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDepartment } from "../actions/create-department";
import { updateDepartment } from "../actions/update-department";
import { toggleDepartmentStatus } from "../actions/toggle-department-status";
import { getDepartments } from "../queries/get-departments";
import { getDepartmentDetail } from "../queries/get-department-detail";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    department: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

describe("Department CRUD Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDepartment", () => {
    it("should allow Super Admin to create a department", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.create).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createDepartment({
        name: "Computer Science",
        code: "CS",
        isActive: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Computer Science");
        expect(result.data.code).toBe("CS");
      }
      expect(requireSuperAdmin).toHaveBeenCalledOnce();
    });

    it("should reject duplicate department code", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const error = new Error("Unique constraint failed");
      (error as any).code = "P2002";
      (error as any).meta = { target: ["code"] };
      vi.mocked(prisma.department.create).mockRejectedValueOnce(error);

      const result = await createDepartment({
        name: "Computer Science",
        code: "CS",
        isActive: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already exists");
      }
    });

    it("should normalize department code to uppercase", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.create).mockResolvedValueOnce({
        id: "dept-1",
        name: "Electronics",
        code: "ECE",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createDepartment({
        name: "Electronics",
        code: "ece", // lowercase
        isActive: true,
      });

      expect(result.success).toBe(true);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: {
          name: "Electronics",
          code: "ECE", // should be uppercase
          isActive: true,
        },
      });
    });

    it("should reject invalid code format", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createDepartment({
        name: "Test Department",
        code: "cs!", // invalid character
        isActive: true,
      });

      expect(result.success).toBe(false);
      expect(prisma.department.create).not.toHaveBeenCalled();
    });
  });

  describe("updateDepartment", () => {
    it("should allow Super Admin to update department", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.update).mockResolvedValueOnce({
        id: "dept-1",
        name: "Computer Science & Engineering",
        code: "CSE",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await updateDepartment({
        id: "dept-1",
        name: "Computer Science & Engineering",
        code: "CSE",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Computer Science & Engineering");
      }
    });

    it("should reject update with duplicate code", async () => {
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

      const error = new Error("Unique constraint failed");
      (error as any).code = "P2002";
      (error as any).meta = { target: ["code"] };
      vi.mocked(prisma.department.update).mockRejectedValueOnce(error);

      const result = await updateDepartment({
        id: "cl123456789012345678901",
        code: "ECE", // already exists
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already exists");
      }
    });

    it("should handle department not found", async () => {
      vi.mocked(requireSuperAdmin).mockResolvedValueOnce({
        id: "super-admin-id",
        clerkId: "clerk-super-admin",
        email: "super@college.edu",
        role: "SUPER_ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce(null);

      const result = await updateDepartment({
        id: "cl123456789012345678901",
        name: "Updated Name",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Department not found");
      }
    });
  });

  describe("toggleDepartmentStatus", () => {
    it("should activate department", async () => {
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
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.department.update).mockResolvedValueOnce({
        id: "cl123456789012345678901",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await toggleDepartmentStatus({
        id: "cl123456789012345678901",
        isActive: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should deactivate department (soft delete)", async () => {
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
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
      // Verify update was called (not delete)
      expect(prisma.department.update).toHaveBeenCalled();
    });
  });

  describe("getDepartments", () => {
    it("should return paginated departments with counts", async () => {
      vi.mocked(prisma.department.count).mockResolvedValueOnce(2);

      vi.mocked(prisma.department.findMany).mockResolvedValueOnce([
        {
          id: "dept-1",
          name: "Computer Science",
          code: "CS",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { admins: 2, students: 150, drives: 8 },
        },
        {
          id: "dept-2",
          name: "Electronics",
          code: "ECE",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { admins: 1, students: 120, drives: 5 },
        },
      ] as any);

      const result = await getDepartments({
        page: 1,
        pageSize: 25,
        includeInactive: false,
      });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.totalCount).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].adminCount).toBe(2);
      expect(result.data[0].studentCount).toBe(150);
      expect(result.data[0].driveCount).toBe(8);
    });

    it("should filter out inactive departments by default", async () => {
      vi.mocked(prisma.department.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.department.findMany).mockResolvedValueOnce([]);

      await getDepartments({
        page: 1,
        pageSize: 25,
        includeInactive: false,
      });

      expect(prisma.department.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it("should include inactive departments when requested", async () => {
      vi.mocked(prisma.department.count).mockResolvedValueOnce(3);
      vi.mocked(prisma.department.findMany).mockResolvedValueOnce([]);

      await getDepartments({
        page: 1,
        pageSize: 25,
        includeInactive: true,
      });

      expect(prisma.department.count).toHaveBeenCalledWith({
        where: {},
      });
    });
  });

  describe("getDepartmentDetail", () => {
    it("should return department details with admin list", async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: "cl123456789012345678901",
        name: "Computer Science",
        code: "CS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        admins: [
          {
            id: "cl987654321098765432109",
            userId: "cl111111111111111111111",
            departmentId: "cl123456789012345678901",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: "cl111111111111111111111",
              email: "admin@college.edu",
              clerkId: "clerk-user-1",
              createdAt: new Date(),
            },
          },
        ],
        _count: { admins: 1, students: 150, drives: 8 },
      } as any);

      const result = await getDepartmentDetail({ id: "cl123456789012345678901" });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Computer Science");
      expect(result?.adminCount).toBe(1);
      expect(result?.studentCount).toBe(150);
      expect(result?.admins).toHaveLength(1);
    });

    it("should return null for non-existent department", async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce(null);

      const result = await getDepartmentDetail({ id: "cl123456789012345678901" });

      expect(result).toBeNull();
    });
  });
});
