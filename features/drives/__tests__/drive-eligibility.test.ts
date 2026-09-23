import { describe, it, expect } from "vitest";
import { isStudentEligibleForDrive, getIneligibilityReasons } from "../queries/drive-eligibility";
import type { HasEligibleDepartmentLinks } from "../utils/eligible-departments";
import { legacyMasterRules, type EligibilityRuleInput } from "../domain/eligibility-rules";
import { Prisma } from "@prisma/client";
import type { Drive, Student, StudentAcademic } from "@prisma/client";
import { FINAL_YEAR_PASSOUT, REQUIRED_MARKS } from "./final-year-fixtures";

// Helper to create mock student
function createMockStudent(
  overrides?: Partial<Student & { academic: StudentAcademic }>
): Student & {
  academic: StudentAcademic;
  skills: { skillName: string }[];
  placements: { revokedAt: Date | null }[];
  semesterMarks: { semester: number }[];
} {
  const baseStudent: Student = {
    id: "student-1",
    userId: "user-1",
    departmentId: "dept-cs",
    misNumber: "MIS2021001",
    prnNumber: null,
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
    // Final year: the final-year requirement passes.
    expectedPassoutYear: FINAL_YEAR_PASSOUT,
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
    skills: [],
    // Not placed: standing passes and the rules are evaluated.
    placements: [],
    // Semesters 1–6 on record: the marks requirement passes.
    semesterMarks: REQUIRED_MARKS,
  };
}

// Helper to create mock drive. `eligibleDepartmentIds` builds the
// `eligibleDepartmentLinks` relation the eligibility functions read.
function createMockDrive(
  overrides?: Partial<Drive> & { eligibleDepartmentIds?: string[] }
): Drive & HasEligibleDepartmentLinks & { eligibilityRules: EligibilityRuleInput[] } {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const { eligibleDepartmentIds, ...driveOverrides } = overrides ?? {};
  const deptIds = eligibleDepartmentIds ?? ["dept-cs", "dept-it"];

  const baseDrive: Drive = {
    id: "drive-1",
    departmentId: "dept-admin-cs",
    createdByUserId: null,
    isCentralDrive: false,
    lifecycleStatus: "PUBLISHED",
    departmentEditableFields: [] as string[],
    masterPipeline: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    requirements: null,
    skills: null,
    companyName: "Tech Corp",
    roleName: "Software Engineer",
    jobDescriptionUrl: null,
    jobDescriptionText: null,
    packageOffered: new Prisma.Decimal("12.00"),
    selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
    nextStageDate: futureDate,
    applicationStartDate: new Date("2026-01-01T00:00:00Z"),
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

  const drive = { ...baseDrive, ...driveOverrides };

  return {
    ...drive,
    eligibleDepartmentLinks: deptIds.map((departmentId) => ({ departmentId })),
    // The rule set these tests' CGPA / backlog columns imply — exactly what the
    // backfill writes for a drive with no other rules.
    eligibilityRules: legacyMasterRules(drive.minCGPA, drive.maxActiveBacklogs),
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
      applicationStartDate: new Date("2026-01-01T00:00:00Z"),
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

    // A department that is not assigned stops evaluation, like placement:
    // the drive's rules are not this student's to meet, so they are not listed.
    expect(getIneligibilityReasons(student, drive)).toEqual([
      "Your department is not eligible for this drive.",
    ]);

    // In an assigned department, every failing rule is reported.
    const reasons = getIneligibilityReasons({ ...student, departmentId: "dept-cs" }, drive);
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
