import { describe, it, expect } from "vitest";
import { isStudentEligibleForDrive, getIneligibilityReasons } from "../queries/drive-eligibility";
import type { HasEligibleDepartmentLinks } from "../utils/eligible-departments";
import type { Drive, Student, StudentAcademic } from "@prisma/client";

// Helper to create mock student
function createMockStudent(overrides?: Partial<Student & { academic: StudentAcademic }>): Student & { academic: StudentAcademic } {
  const baseStudent: Student = {
    id: "student-1",
    userId: "user-1",
    departmentId: "dept-cs",
    rollNumber: "CS2021001",
    name: "Test Student",
    email: "student@example.com",
    phoneNumber: null,
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

  const baseAcademic: StudentAcademic = {
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
    tenthBoard: null,
    tenthYear: null,
    tenthMarksheetUrl: null,
    twelfthBoard: null,
    twelfthYear: null,
    twelfthMarksheetUrl: null,
    pastBacklogCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    ...baseStudent,
    ...overrides,
    academic: overrides?.academic || baseAcademic,
  };
}

// Helper to create mock drive. `eligibleDepartmentIds` builds the
// `eligibleDepartmentLinks` relation the eligibility functions actually read;
// `eligibleDepartments` (the legacy JSON column) is kept in step with it for
// any code still reading the raw Drive row, but is not itself consulted.
function createMockDrive(
  overrides?: Partial<Drive> & { eligibleDepartmentIds?: string[] }
): Drive & HasEligibleDepartmentLinks {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const { eligibleDepartmentIds, ...driveOverrides } = overrides ?? {};
  const deptIds = eligibleDepartmentIds ?? ["dept-cs", "dept-it"];

  const baseDrive: Drive = {
    id: "drive-1",
    departmentId: "dept-admin-cs",
    createdByUserId: null,
    isCentralDrive: false,
    companyName: "Tech Corp",
    roleName: "Software Engineer",
    jobDescriptionUrl: null,
    jobDescriptionText: null,
    packageOffered: 12.0,
    selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
    driveDate: futureDate,
    applicationDeadline: new Date(futureDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before drive
    applyMethod: "EXTERNAL",
    externalApplyUrl: "https://example.com/apply",
    minCGPA: 7.0,
    maxActiveBacklogs: 0,
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

  return {
    ...baseDrive,
    ...driveOverrides,
    eligibleDepartmentLinks: deptIds.map((departmentId) => ({ departmentId })),
  };
}

describe("Drive Eligibility", () => {
  it("should return true when student meets all criteria", () => {
    const student = createMockStudent({
      departmentId: "dept-cs",
      academic: {
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
        tenthBoard: null,
        tenthYear: null,
        tenthMarksheetUrl: null,
        twelfthBoard: null,
        twelfthYear: null,
        twelfthMarksheetUrl: null,
        pastBacklogCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const drive = createMockDrive({
      minCGPA: 7.0,
      maxActiveBacklogs: 0,
      eligibleDepartmentIds: ["dept-cs", "dept-it"],
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(true);
  });

  it("should return false when student has no academic record", () => {
    const student: any = {
      ...createMockStudent(),
      academic: null,
    };
    const drive = createMockDrive();

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });

  it("should return false when drive is closed", () => {
    const student = createMockStudent();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const drive = createMockDrive({
      applicationDeadline: pastDate,
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });

  it("should return false when student department is not eligible", () => {
    const student = createMockStudent({
      departmentId: "dept-mech",
    });

    const drive = createMockDrive({
      eligibleDepartmentIds: ["dept-cs", "dept-it"],
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });

  it("should return false when student CGPA is below requirement", () => {
    const student = createMockStudent({
      academic: {
        id: "academic-1",
        studentId: "student-1",
        diplomaPercentage: null,
        diplomaBoard: null,
        diplomaYear: null,
        diplomaMarksheetUrl: null,
        tenthPercentage: 85,
        twelfthPercentage: 88,
        currentCGPA: 6.5, // Below requirement
        currentSemester: 6,
        activeBacklogs: 0,
        tenthBoard: null,
        tenthYear: null,
        tenthMarksheetUrl: null,
        twelfthBoard: null,
        twelfthYear: null,
        twelfthMarksheetUrl: null,
        pastBacklogCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const drive = createMockDrive({
      minCGPA: 7.0,
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });

  it("should return false when student has too many backlogs", () => {
    const student = createMockStudent({
      academic: {
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
        activeBacklogs: 2, // Exceeds limit
        tenthBoard: null,
        tenthYear: null,
        tenthMarksheetUrl: null,
        twelfthBoard: null,
        twelfthYear: null,
        twelfthMarksheetUrl: null,
        pastBacklogCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const drive = createMockDrive({
      maxActiveBacklogs: 0,
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });

  it("should allow student with backlogs when limit permits", () => {
    const student = createMockStudent({
      academic: {
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
        activeBacklogs: 1,
        tenthBoard: null,
        tenthYear: null,
        tenthMarksheetUrl: null,
        twelfthBoard: null,
        twelfthYear: null,
        twelfthMarksheetUrl: null,
        pastBacklogCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const drive = createMockDrive({
      maxActiveBacklogs: 2, // Allows up to 2
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(true);
  });

  it("should get correct ineligibility reasons", () => {
    const student = createMockStudent({
      departmentId: "dept-mech",
      academic: {
        id: "academic-1",
        studentId: "student-1",
        diplomaPercentage: null,
        diplomaBoard: null,
        diplomaYear: null,
        diplomaMarksheetUrl: null,
        tenthPercentage: 85,
        twelfthPercentage: 88,
        currentCGPA: 6.0,
        currentSemester: 6,
        activeBacklogs: 2,
        tenthBoard: null,
        tenthYear: null,
        tenthMarksheetUrl: null,
        twelfthBoard: null,
        twelfthYear: null,
        twelfthMarksheetUrl: null,
        pastBacklogCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const drive = createMockDrive({
      minCGPA: 7.0,
      maxActiveBacklogs: 0,
      eligibleDepartmentIds: ["dept-cs", "dept-it"],
    });

    const reasons = getIneligibilityReasons(student, drive);

    expect(reasons).toContain("Your department is not eligible");
    expect(reasons.some((r) => r.includes("CGPA requirement"))).toBe(true);
    expect(reasons.some((r) => r.includes("Maximum backlogs"))).toBe(true);
  });

  it("should return false when the drive has no eligible-department rows", () => {
    const student = createMockStudent();
    const drive = createMockDrive({
      eligibleDepartmentIds: [],
    });

    expect(isStudentEligibleForDrive(student, drive)).toBe(false);
  });
});
