import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMyApplications } from "../queries/get-my-applications";
import { Prisma } from "@prisma/client";

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
    packageOffered: new Prisma.Decimal("12.00"),
    selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
    driveDate: new Date("2026-12-01"),
    applicationDeadline: new Date("2026-11-15"),
    applyMethod: "IN_APP" as const,
    externalApplyUrl: null,
    minCGPA: 7.0,
    maxActiveBacklogs: 1,
    eligibleDepartments: JSON.stringify(["dept-1"]),
    companyLogoUrl: null,
    packageDisplay: "12 LPA",
    venue: null,
    reportingTime: null,
    contactPerson: null,
    contactPhone: null,
    pptLink: null,
    applicationFields: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApplications = [
    {
      id: "app-1",
      studentId: "student-1",
      driveId: "drive-1",
      appliedAt: new Date("2026-09-01"),
      stage: "APPLIED" as const,
      status: "IN_PROGRESS" as const,
      submittedDetails: null,
      consentAcceptedAt: null,
      stageUpdatedAt: null,
      stageUpdatedById: null,
      currentStageId: null,
      snapshotCgpa: null,
      snapshotBacklogs: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
      // As Prisma returns it: the drive plus the applicant's department's
      // instance (none here, so everything is inherited from the master).
      drive: { ...mockDrive, departmentConfigs: [] as never[] },
    },
    {
      id: "app-2",
      studentId: "student-1",
      driveId: "drive-2",
      appliedAt: new Date("2026-08-25"),
      stage: "APPLIED" as const,
      status: "IN_PROGRESS" as const,
      submittedDetails: null,
      consentAcceptedAt: null,
      stageUpdatedAt: null,
      stageUpdatedById: null,
      currentStageId: null,
      snapshotCgpa: null,
      snapshotBacklogs: null,
      createdAt: new Date("2026-08-25"),
      updatedAt: new Date("2026-08-25"),
      drive: {
        ...mockDrive,
        id: "drive-2",
        companyName: "InnovateLabs",
        roleName: "Data Scientist",
        departmentConfigs: [] as never[],
      },
    },
  ];

  /** What the query returns for a row: the drive resolved for the applicant's department. */
  const asResolved = (row: (typeof mockApplications)[number]) => {
    const { departmentConfigs, ...master } = row.drive;
    void departmentConfigs;
    return {
      ...row,
      // No pipeline stage on these rows: nothing to show the student yet.
      stageLabel: null,
      driveCancelled: false,
      drive: {
        ...master,
        seatingAllocation: null,
        specialInstructions: null,
        coordinatorEmail: null,
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cancelled drives", () => {
    it("keeps the application and marks the drive cancelled for the student", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
        {
          ...mockApplications[0],
          drive: { ...mockApplications[0].drive, departmentConfigs: [{ status: "CANCELLED" } as never] },
        },
        {
          ...mockApplications[1],
          drive: { ...mockApplications[1].drive, lifecycleStatus: "CANCELLED" },
        },
      ] as never);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result.data.map((row) => [row.id, row.driveCancelled])).toEqual([
        ["app-1", true],
        ["app-2", true],
      ]);
    });
  });

  describe("recruitment stage, read-only for the student", () => {
    it("shows a visible stage by name and a hidden one only as in progress", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
        { ...mockApplications[0], currentStage: { name: "Technical Interview", visibleToStudents: true } },
        { ...mockApplications[1], currentStage: { name: "Internal panel review", visibleToStudents: false } },
      ] as never);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result.data.map((row) => row.stageLabel)).toEqual(["Technical Interview", "In progress"]);
      expect(JSON.stringify(result.data)).not.toContain("Internal panel review");
    });
  });

  describe("Basic Functionality", () => {
    it("should return paginated applications for a student", async () => {
      vi.mocked(prisma.driveApplication.count).mockResolvedValue(2);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(mockApplications);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result).toEqual({
        data: mockApplications.map(asResolved),
        page: 1,
        pageSize: 25,
        totalCount: 2,
      });

      expect(prisma.driveApplication.count).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
      });

      expect(prisma.driveApplication.findMany).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
        include: {
          // The stage, and whether the student may see its name.
          currentStage: { select: { name: true, visibleToStudents: true } },
          drive: {
            include: {
              // Only the applicant's own department's instance is loaded.
              departmentConfigs: {
                where: { department: { students: { some: { id: "student-1" } } } },
              },
            },
          },
        },
        orderBy: { appliedAt: "desc" },
        skip: 0,
        take: 25,
      });
    });

    it("shows each application under the applicant's department's version of the drive", async () => {
      const overridden = {
        ...mockApplications[0],
        drive: {
          ...mockApplications[0].drive,
          departmentConfigs: [
            { roleName: "Backend Developer", applicationDeadline: null } as never,
          ],
        },
      };

      vi.mocked(prisma.driveApplication.count).mockResolvedValue(1);
      vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([overridden]);

      const result = await getMyApplications("student-1", 1, 25);

      expect(result.data[0].drive.roleName).toBe("Backend Developer");
      // Everything the department did not override is still the master's.
      expect(result.data[0].drive.companyName).toBe("TechCorp");
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
