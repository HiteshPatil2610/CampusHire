import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Academic record rules (profile logic fixes).
 *
 *  - Results only for finished semesters; the current one is never asked.
 *  - No CGPA before a semester has finished; once results exist it lies
 *    between the lowest and highest SGPA.
 *  - The current semester is one of the batch's current year's two.
 *  - A board CGPA is stored as its percentage, the CGPA kept beside it.
 *  - Entry type comes from the stored record, never the request.
 *  - Dates in the profile make sense (no future starts, ends after starts).
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUniqueOrThrow: vi.fn() },
    studentAcademic: { upsert: vi.fn() },
    semesterMark: { deleteMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth", () => ({ requireStudent: vi.fn() }));
vi.mock("../domain/after-profile-save", () => ({ afterStudentProfileSave: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { ZodError } from "zod";
import {
  allowedCurrentSemesters,
  cgpaConsistencyProblem,
  completedSemesters,
  isCgpaExpected,
  isCurrentSemesterStale,
  semesterResultProblem,
} from "../domain/academic-standing";
import { cgpaToPercentage, formatPreCollegeScore, scoreModeOf } from "../utils/score-conversion";
import { actionErrorMessage } from "../utils/action-error";
import {
  academicInfoSchema,
  certificationSchema,
  experienceSchema,
  personalInfoSchema,
  projectSchema,
} from "../schemas/profile";
import { updateAcademicInfo } from "../actions/profile-academic";
import { updateSemesterMarks } from "../actions/profile-semester-marks";
import { evaluateEligibility, type EligibilitySubject } from "@/features/drives/domain/eligibility-evaluator";

/** India time, as a UTC instant. */
const ist = (local: string) => new Date(new Date(`${local}Z`).getTime() - 330 * 60 * 1000);
// The 2026-27 academic year: the 2027 batch is in final year.
const SEP_2026 = ist("2026-09-26T12:00:00");
const JUL_2027 = ist("2027-07-02T12:00:00");

describe("board CGPA → percentage", () => {
  it("converts with CBSE's 9.5 factor, to two decimals, never above 100", () => {
    expect(cgpaToPercentage(9.2)).toBe(87.4);
    expect(cgpaToPercentage(7.35)).toBe(69.83);
    expect(cgpaToPercentage(10)).toBe(95);
    expect(cgpaToPercentage(10.6)).toBe(100);
  });

  it("shows a CGPA as entered, with the percentage it counts as", () => {
    expect(formatPreCollegeScore(87.4, 9.2)).toBe("9.2 CGPA (87.4%)");
    expect(formatPreCollegeScore(86, null)).toBe("86%");
    expect(formatPreCollegeScore(null, null)).toBeNull();
    expect(scoreModeOf(9.2)).toBe("CGPA");
    expect(scoreModeOf(null)).toBe("PERCENTAGE");
  });
});

describe("current semester is limited to the batch's year", () => {
  it("offers the two semesters of the year the batch is in", () => {
    expect(allowedCurrentSemesters("REGULAR", 2027, SEP_2026)).toEqual([7, 8]);
    expect(allowedCurrentSemesters("REGULAR", 2028, SEP_2026)).toEqual([5, 6]);
    expect(allowedCurrentSemesters("DIPLOMA", 2029, SEP_2026)).toEqual([3, 4]);
    expect(allowedCurrentSemesters("REGULAR", 2030, SEP_2026)).toEqual([1, 2]);
  });

  it("moves on July 1, and a graduated batch can only be in its last semester", () => {
    expect(allowedCurrentSemesters("REGULAR", 2027, JUL_2027)).toEqual([8]);
    expect(allowedCurrentSemesters("REGULAR", 2028, JUL_2027)).toEqual([7, 8]);
  });

  it("allows any semester the student could be in when the batch is unknown", () => {
    expect(allowedCurrentSemesters("REGULAR", null, SEP_2026)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(allowedCurrentSemesters("DIPLOMA", null, SEP_2026)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("never offers a lateral-entry student semester 1 or 2", () => {
    expect(allowedCurrentSemesters("DIPLOMA", 2030, SEP_2026)).toEqual([3]);
  });

  it("flags last year's value as stale after the cutover", () => {
    expect(isCurrentSemesterStale("REGULAR", 2027, 7, SEP_2026)).toBe(false);
    expect(isCurrentSemesterStale("REGULAR", 2027, 5, SEP_2026)).toBe(true);
    expect(isCurrentSemesterStale("REGULAR", 2028, 5, JUL_2027)).toBe(true);
    expect(isCurrentSemesterStale("REGULAR", 2028, null, JUL_2027)).toBe(false);
  });
});

describe("results only for finished semesters", () => {
  it("a semester-7 student has results for 1–6 — never the current one", () => {
    expect(completedSemesters("REGULAR", 7)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(semesterResultProblem("REGULAR", 7, 6)).toBeNull();
    expect(semesterResultProblem("REGULAR", 7, 7)).toMatch(/current semester/);
    expect(semesterResultProblem("REGULAR", 7, 8)).toMatch(/has not happened yet/);
  });

  it("a lateral-entry student starts at semester 3", () => {
    expect(completedSemesters("DIPLOMA", 5)).toEqual([3, 4]);
    expect(semesterResultProblem("DIPLOMA", 5, 2)).toMatch(/lateral-entry/);
  });

  it("no finished semester means no CGPA is expected", () => {
    expect(isCgpaExpected("REGULAR", 1)).toBe(false);
    expect(isCgpaExpected("REGULAR", 2)).toBe(true);
    expect(isCgpaExpected("DIPLOMA", 3)).toBe(false);
    expect(isCgpaExpected("DIPLOMA", 4)).toBe(true);
  });
});

describe("CGPA must fit the SGPAs", () => {
  const marks = [
    { semester: 1, sgpa: 7.5 },
    { semester: 2, sgpa: 8.5 },
  ];

  it("accepts a CGPA between the lowest and highest SGPA", () => {
    expect(cgpaConsistencyProblem("REGULAR", 3, 8.1, marks)).toBeNull();
    expect(cgpaConsistencyProblem("REGULAR", 3, 7.5, marks)).toBeNull();
  });

  it("refuses one outside that range", () => {
    expect(cgpaConsistencyProblem("REGULAR", 3, 9.5, marks)).toMatch(/between your lowest and highest SGPA \(7\.5–8\.5\)/);
    expect(cgpaConsistencyProblem("REGULAR", 3, 6, marks)).not.toBeNull();
  });

  it("does not judge while some finished semesters are missing", () => {
    expect(cgpaConsistencyProblem("REGULAR", 4, 9.5, marks)).toBeNull();
    expect(cgpaConsistencyProblem("REGULAR", 3, null, marks)).toBeNull();
  });
});

describe("academic record schema", () => {
  const base = {
    entryType: "REGULAR" as const,
    tenthPercentage: 85,
    twelfthPercentage: 80,
    currentCGPA: 8,
    currentSemester: 7,
    activeBacklogs: 0,
  };

  it("does not ask a semester-1 student for a CGPA", () => {
    expect(academicInfoSchema.safeParse({ ...base, currentSemester: 1, currentCGPA: null }).success).toBe(true);
    expect(
      academicInfoSchema.safeParse({ ...base, entryType: "DIPLOMA", twelfthPercentage: null, diplomaPercentage: 75, currentSemester: 3, currentCGPA: null }).success
    ).toBe(true);
  });

  it("asks for it once a semester has finished", () => {
    const result = academicInfoSchema.safeParse({ ...base, currentSemester: 3, currentCGPA: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["currentCGPA"]);
  });

  it("accepts a board CGPA instead of a percentage, and needs one or the other", () => {
    expect(academicInfoSchema.safeParse({ ...base, tenthPercentage: null, tenthCgpa: 9.2 }).success).toBe(true);
    expect(academicInfoSchema.safeParse({ ...base, twelfthPercentage: null, twelfthCgpa: 8.8 }).success).toBe(true);
    expect(academicInfoSchema.safeParse({ ...base, tenthPercentage: null }).success).toBe(false);
    expect(academicInfoSchema.safeParse({ ...base, tenthPercentage: null, tenthCgpa: 11 }).success).toBe(false);
  });

  it("refuses a future passing year, and a 12th or diploma passed before the 10th", () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(academicInfoSchema.safeParse({ ...base, tenthYear: nextYear }).success).toBe(false);
    expect(academicInfoSchema.safeParse({ ...base, tenthYear: 2019, twelfthYear: 2019 }).success).toBe(false);
    expect(academicInfoSchema.safeParse({ ...base, tenthYear: 2019, twelfthYear: 2021 }).success).toBe(true);
    expect(
      academicInfoSchema.safeParse({ ...base, entryType: "DIPLOMA", twelfthPercentage: null, diplomaPercentage: 75, tenthYear: 2020, diplomaYear: 2018 }).success
    ).toBe(false);
  });

  it("caps the semester at 8", () => {
    expect(academicInfoSchema.safeParse({ ...base, currentSemester: 9 }).success).toBe(false);
  });
});

describe("profile dates make sense", () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  it("an experience cannot start in the future or end before it starts", () => {
    const experience = { companyName: "Acme", role: "Intern", description: "Work" };
    expect(experienceSchema.safeParse({ ...experience, startDate: "2025-06-01", endDate: "2025-08-01" }).success).toBe(true);
    // An internship running until next month is fine.
    expect(experienceSchema.safeParse({ ...experience, startDate: "2025-06-01", endDate: future }).success).toBe(true);
    expect(experienceSchema.safeParse({ ...experience, startDate: future }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...experience, startDate: "2025-06-01", endDate: "2025-05-01" }).success).toBe(false);
  });

  it("a certificate cannot be issued in the future or expire before issue", () => {
    const cert = { certificationName: "AWS", issuingOrganization: "Amazon" };
    expect(certificationSchema.safeParse({ ...cert, issueDate: "2025-01-10" }).success).toBe(true);
    expect(certificationSchema.safeParse({ ...cert, issueDate: future }).success).toBe(false);
    expect(certificationSchema.safeParse({ ...cert, issueDate: "2025-01-10", expiryDate: "2024-12-01" }).success).toBe(false);
  });

  it("a project cannot end before it starts", () => {
    const project = { title: "Portal", description: "d", technologiesUsed: "TS" };
    expect(projectSchema.safeParse({ ...project, startDate: "2025-01-01", endDate: "2024-12-01" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...project, startDate: "2025-01-01", endDate: "2025-03-01" }).success).toBe(true);
  });

  it("a date of birth is in the past and gives a student's age", () => {
    const person = { name: "Asha" };
    expect(personalInfoSchema.safeParse({ ...person, dateOfBirth: "2004-05-01" }).success).toBe(true);
    expect(personalInfoSchema.safeParse({ ...person, dateOfBirth: future }).success).toBe(false);
    expect(personalInfoSchema.safeParse({ ...person, dateOfBirth: "2021-05-01" }).success).toBe(false);
  });

  it("a failed check reaches the student as a sentence, not a JSON dump", () => {
    const result = experienceSchema.safeParse({ companyName: "A", role: "B", description: "C", startDate: "2025-06-01", endDate: "2025-05-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(actionErrorMessage(result.error, "fallback")).toBe("An experience's end date cannot be before its start date");
    }
    expect(actionErrorMessage(new ZodError([]), "fallback")).toBe("fallback");
  });
});

describe("eligibility with no CGPA yet", () => {
  it("fails a CGPA rule with a reason, instead of comparing against nothing", () => {
    const subject: EligibilitySubject = {
      approved: true,
      placed: false,
      optedIn: true,
      entryType: "REGULAR",
      expectedPassoutYear: null,
      academic: {
        currentCGPA: null,
        activeBacklogs: 0,
        pastBacklogCount: 0,
        tenthPercentage: 85,
        twelfthPercentage: 80,
        diplomaPercentage: null,
        currentSemester: 1,
      },
      semestersWithMarks: [],
      skills: [],
    };
    const rule = { id: "r", ruleType: "CGPA", operator: "GTE", numberValue: 7, listValue: [] } as never;
    const result = evaluateEligibility(subject, [rule]);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/add your current CGPA/);
  });
});

// ---------------------------------------------------------------------------
// The save actions, against a mocked database
// ---------------------------------------------------------------------------

describe("saving semester results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStudent).mockResolvedValue({ student: { id: "s1" } } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  const stored = (academic: { currentSemester: number; currentCGPA: number | null } | null, entryType = "REGULAR") =>
    vi.mocked(prisma.student.findUniqueOrThrow).mockResolvedValue({ entryType, academic } as never);

  it("refuses the current semester's result, even from a direct call", async () => {
    stored({ currentSemester: 7, currentCGPA: 8 });
    const result = await updateSemesterMarks({
      entryType: "REGULAR",
      marks: [{ semester: 7, sgpa: 8, gradeCardUrl: null }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/current semester/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("saves finished semesters", async () => {
    stored({ currentSemester: 3, currentCGPA: 8 });
    const result = await updateSemesterMarks({
      entryType: "REGULAR",
      marks: [
        { semester: 1, sgpa: 7.8, gradeCardUrl: null },
        { semester: 2, sgpa: 8.2, gradeCardUrl: null },
      ],
    });
    expect(result).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuses results that contradict the saved CGPA", async () => {
    stored({ currentSemester: 3, currentCGPA: 9.6 });
    const result = await updateSemesterMarks({
      entryType: "REGULAR",
      marks: [
        { semester: 1, sgpa: 7.8, gradeCardUrl: null },
        { semester: 2, sgpa: 8.2, gradeCardUrl: null },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/between your lowest and highest SGPA/);
  });

  it("needs the current semester saved first", async () => {
    stored(null);
    const result = await updateSemesterMarks({
      entryType: "REGULAR",
      marks: [{ semester: 1, sgpa: 8, gradeCardUrl: null }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Save your current semester/);
  });
});

describe("saving the academic record", () => {
  let upserted: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(SEP_2026);
    upserted = null;
    vi.mocked(requireStudent).mockResolvedValue({ student: { id: "s1" } } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        studentAcademic: {
          upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => {
            upserted = update;
          }),
        },
        semesterMark: { deleteMany: prisma.semesterMark.deleteMany },
      })
    );
  });

  afterEach(() => vi.useRealTimers());

  const owner = (entryType: "REGULAR" | "DIPLOMA", expectedPassoutYear: number | null) =>
    vi.mocked(prisma.student.findUniqueOrThrow).mockResolvedValue({ entryType, expectedPassoutYear } as never);

  const input = {
    entryType: "REGULAR" as const,
    tenthPercentage: 85,
    twelfthPercentage: 80,
    currentCGPA: 8,
    currentSemester: 7,
    activeBacklogs: 0,
    pastBacklogCount: 0,
  };

  it("uses the stored entry type — a tampered 'DIPLOMA' cannot erase a regular student's 12th", async () => {
    owner("REGULAR", 2027);
    const result = await updateAcademicInfo({ ...input, entryType: "DIPLOMA", diplomaPercentage: 70 });
    expect(result).toEqual({ success: true });
    expect(upserted).toMatchObject({ twelfthPercentage: 80, diplomaPercentage: null });
    expect(prisma.semesterMark.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a semester outside the batch's year", async () => {
    owner("REGULAR", 2027);
    const result = await updateAcademicInfo({ ...input, currentSemester: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/semester 7 or 8/);
  });

  it("stores a board CGPA as its percentage and keeps the CGPA", async () => {
    owner("REGULAR", 2027);
    await updateAcademicInfo({ ...input, tenthPercentage: null, tenthCgpa: 9.2 });
    expect(upserted).toMatchObject({ tenthPercentage: 87.4, tenthCgpa: 9.2, twelfthCgpa: null });
  });

  it("stores no CGPA for a student with no finished semester, whatever was sent", async () => {
    owner("REGULAR", 2030);
    const result = await updateAcademicInfo({ ...input, currentSemester: 1, currentCGPA: 9 });
    expect(result).toEqual({ success: true });
    expect(upserted).toMatchObject({ currentSemester: 1, currentCGPA: null });
  });
});
