import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyToDrive } from "../actions/apply-to-drive";
import { Prisma } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
    },
    drive: {
      findUnique: vi.fn(),
    },
    driveApplication: {
      create: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireStudent: vi.fn(),
}));

vi.mock("../queries/check-application-exists", () => ({
  checkApplicationExists: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { checkApplicationExists } from "../queries/check-application-exists";

describe("applyToDrive", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_1",
    name: null,
    email: "student@example.com",
    role: "STUDENT" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudent = {
    id: "student-1",
    userId: "user-1",
    departmentId: "dept-1",
    rollNumber: "CS2021001",
    name: "Test Student",
    email: "student@example.com",
    phoneNumber: "1234567890",
    isPending: false,
    optedIn: true,
    entryType: 'REGULAR' as const,
    optedInLocked: false,
    profilePhotoUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    gender: null,
    dateOfBirth: null,
    address: null,
    personalEmail: null,
    batchYear: 2025,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuth = {
    user: mockUser,
    student: mockStudent,
  };

  const mockAcademic = {
    id: "academic-1",
    studentId: "student-1",
    diplomaPercentage: null,
    diplomaBoard: null,
    diplomaYear: null,
    diplomaMarksheetUrl: null,
    tenthPercentage: 85,
    twelfthPercentage: 88,
    currentCGPA: 8.5,
    currentSemester: 6,
    activeBacklogs: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDrive = {
    id: "clpq0000000000000000000",
    departmentId: "dept-1",
    createdByUserId: null,
    isCentralDrive: false,
    companyName: "TechCorp",
    roleName: "Software Engineer",
    jobDescriptionUrl: null,
    jobDescriptionText: null,
    packageOffered: 12.0,
    selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
    driveDate: new Date("2026-12-01"),
    applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
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

  const mockApplication = {
    id: "app-1",
    studentId: "student-1",
    driveId: "drive-1",
    appliedAt: new Date(),
    stage: "APPLIED" as const,
    status: "IN_PROGRESS" as const,
    submittedDetails: null,
    consentAcceptedAt: null,
    stageUpdatedAt: null,
    stageUpdatedById: null,
    snapshotCgpa: null,
    snapshotBacklogs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Success Cases", () => {
    it("should reject submission when the accuracy declaration is not ticked", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(false);

      const result = await applyToDrive("clpq0000000000000000000");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("confirm");
      }
      expect(prisma.driveApplication.create).not.toHaveBeenCalled();
    });

    it("should store only editable fields and drop locked institutional keys", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(false);
      vi.mocked(prisma.driveApplication.create).mockResolvedValue(
        mockApplication
      );

      await applyToDrive("clpq0000000000000000000", {
        consent: true,
        submittedDetails: {
          phone: "9876543210",
          // A client must never be able to overwrite a registrar-owned record
          cgpa: "10.0",
          rollNo: "FAKE-001",
          backlogs: "No Active",
        },
      });

      const created = vi.mocked(prisma.driveApplication.create).mock
        .calls[0][0] as any;
      const stored = JSON.parse(created.data.submittedDetails);

      expect(stored).toEqual({ phone: "9876543210" });
      // The snapshot keeps the server-read values, not the client's
      expect(created.data.snapshotCgpa).toBe(mockAcademic.currentCGPA);
      expect(created.data.snapshotBacklogs).toBe(mockAcademic.activeBacklogs);
    });

    it("should successfully create application for eligible student", async () => {
      // Setup mocks
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(false);
      vi.mocked(prisma.driveApplication.create).mockResolvedValue(mockApplication);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.application).toEqual(mockApplication);
      }
      expect(prisma.driveApplication.create).toHaveBeenCalledWith({
        data: {
          studentId: "student-1",
          driveId: "clpq0000000000000000000",
          snapshotCgpa: mockAcademic.currentCGPA,
          snapshotBacklogs: mockAcademic.activeBacklogs,
          submittedDetails: "{}",
          consentAcceptedAt: expect.any(Date),
        },
      });
    });
  });

  describe("Authentication & Authorization", () => {
    it("should reject unauthenticated user", async () => {
      vi.mocked(requireStudent).mockRejectedValue(new Error("Not authenticated"));

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("should reject if student profile missing", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Student profile not found");
      }
    });

    it("should reject if academic information missing", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: null,
      } as any);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Academic information incomplete");
      }
    });
  });

  describe("Input Validation", () => {
    it("should reject invalid drive ID format", async () => {
      const result = await applyToDrive("invalid-id", { consent: true });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid drive ID");
      }
    });
  });

  describe("Drive Validation", () => {
    it("should reject if drive not found", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(null);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Drive not found");
      }
    });
  });

  describe("Eligibility Enforcement", () => {
    it("should reject if CGPA below minimum", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: {
          ...mockAcademic,
          currentCGPA: 6.5, // Below minCGPA of 7.0
        },
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not eligible");
        expect(result.reasons).toBeDefined();
        expect(result.reasons?.some(r => r.includes("CGPA"))).toBe(true);
      }
    });

    it("should reject if active backlogs exceed maximum", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: {
          ...mockAcademic,
          activeBacklogs: 2, // Exceeds maxActiveBacklogs of 1
        },
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not eligible");
        expect(result.reasons).toBeDefined();
        expect(result.reasons?.some(r => r.includes("backlogs"))).toBe(true);
      }
    });

    it("should reject if department not eligible", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        departmentId: "dept-2", // Not in eligibleDepartments
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not eligible");
        expect(result.reasons).toBeDefined();
        expect(result.reasons?.some(r => r.includes("department"))).toBe(true);
      }
    });
  });

  describe("Deadline Enforcement", () => {
    it("should reject if application deadline passed", async () => {
      const closedDrive = {
        ...mockDrive,
        applicationDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };

      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(closedDrive);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        // Eligibility check includes deadline check, so either error is valid
        const errorIsAboutClosure = result.error.includes("closed") || result.error.includes("not eligible");
        expect(errorIsAboutClosure).toBe(true);
      }
    });
  });

  describe("Duplicate Prevention", () => {
    it("should reject if already applied (application-level check)", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(true);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already applied");
      }
    });

    it("should handle database unique constraint error gracefully", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(false);
      
      // Simulate database constraint error (race condition)
      const constraintError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "6.0.0",
        }
      );
      vi.mocked(prisma.driveApplication.create).mockRejectedValue(constraintError);

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already applied");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      vi.mocked(requireStudent).mockResolvedValue(mockAuth);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        ...mockStudent,
        academic: mockAcademic,
      } as any);
      vi.mocked(prisma.drive.findUnique).mockResolvedValue(mockDrive);
      vi.mocked(checkApplicationExists).mockResolvedValue(false);
      vi.mocked(prisma.driveApplication.create).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await applyToDrive("clpq0000000000000000000", { consent: true }); // Valid CUID format

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("unexpected error");
        // Should NOT expose internal error details
        expect(result.error).not.toContain("Database connection");
      }
    });
  });
});
