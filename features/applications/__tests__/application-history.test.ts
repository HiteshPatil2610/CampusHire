import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMyApplications } from "../queries/get-my-applications";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    driveApplication: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("getMyApplications", () => {
  const mockDrive = {
    id: "drive-1",
    departmentId: "dept-1",
    companyName: "TechCorp",
    roleName: "Software Engineer",
    jobDescriptionUrl: null,
    packageOffered: 12.0,
    selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
    driveDate: new Date("2026-12-01"),
    applicationDeadline: new Date("2026-11-15"),
    applyMethod: "IN_APP" as const,
    externalApplyUrl: null,
    minCGPA: 7.0,
    maxActiveBacklogs: 1,
    eligibleDepartments: JSON.stringify(["dept-1"]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApplications = [
    {
      id: "app-1",
      studentId: "student-1",
      driveId: "drive-1",
      appliedAt: new Date("2026-09-01"),
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
      drive: mockDrive,
    },
    {
      id: "app-2",
      studentId: "student-1",
      driveId: "drive-2",
      appliedAt: new Date("2026-08-25"),
      createdAt: new Date("2026-08-25"),
      updatedAt: new Date("2026-08-25"),
      drive: {
        ...mockDrive,
        id: "drive-2",
        companyName: "InnovateLabs",
        roleName: "Data Scientist",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should return paginated applications for a student", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(mockApplications);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result).toEqual({
        data: mockApplications,
        page: 1,
        pageSize: 25,
        totalCount: 2,
      });

      expect(prisma.driveApplication.count).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
      });

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
        include: { drive: true },
        orderBy: { appliedAt: "desc" },
        skip: 0,
        take: 25,
      });
    });

    it("should return empty result for student with no applications", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(0);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);

      const result = await getMyApplications("student-2", 1, 25);

      expect(result).toEqual({
        data: [],
        page: 1,
        pageSize: 25,
        totalCount: 0,
      });
    });

    it("should include drive information in each application", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(1);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([mockApplications[0]]);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result.data[0].drive).toBeDefined();
      expect(result.data[0].drive.companyName).toBe("TechCorp");
      expect(result.data[0].drive.roleName).toBe("Software Engineer");
    });
  });

  describe("Pagination", () => {
    it("should calculate correct offset for page 1", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(50);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);

      await getMyApplications("student-1", 1, 25);

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        })
      );
    });

    it("should calculate correct offset for page 2", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(50);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);

      await getMyApplications("student-1", 2, 25);

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    it("should handle custom page size", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(100);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);

      await getMyApplications("student-1", 1, 10);

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });

    it("should use default page and pageSize if not provided", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(10);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);

      await getMyApplications("student-1");

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        })
      );
    });
  });

  describe("Ordering", () => {
    it("should order applications by appliedAt descending (newest first)", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(mockApplications);

      await getMyApplications("student-1", 1, 25);

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { appliedAt: "desc" },
        })
      );
    });
  });

  describe("Ownership Isolation", () => {
    it("should only query applications for specified student", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(mockApplications);

      await getMyApplications("student-1", 1, 25);

      expect(prisma.driveApplication.count).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
      });

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: "student-1" },
        })
      );
    });

    it("should not return another student's applications", async () => {
      const student2Applications = [
        {
          ...mockApplications[0],
          id: "app-3",
          studentId: "student-2",
        },
      ];

      vi.mocked(prisma.driveApplication.count).mockResolvedValue(1);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(student2Applications);

      const result = await getMyApplications("student-2", 1, 25);

      expect(result.data[0].studentId).toBe("student-2");
      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: "student-2" },
        })
      );
    });
  });
});
