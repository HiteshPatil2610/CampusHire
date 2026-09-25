import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 5 — one eligibility engine (Items 7 and 8).
 *
 *   standing → department → window → batch → final year (sem 7/8)
 *            → required marks → the drive's other rules → eligible
 *
 * The first half drives the pure evaluator on fixed dates, so every case —
 * semester 5 to 8, the July 1 promotion, a drop — is exact. The second half
 * runs the profile-save path end to end against a mocked database: a save
 * that makes a student eligible tells them once, and never again.
 */

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/prisma", async () => {
  const { notificationModelMocks } = await import("@/features/notifications/__tests__/delivery-test-helpers");
  return {
    prisma: {
      student: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
      drive: { findMany: vi.fn() },
      semesterMark: { deleteMany: vi.fn(), upsert: vi.fn() },
      user: { findMany: vi.fn() },
      $transaction: vi.fn(),
      ...notificationModelMocks(),
    },
  };
});

vi.mock("@/lib/auth", () => ({ requireStudent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  evaluateEligibility,
  requiredMarkSemesters,
  type EligibilitySubject,
} from "../domain/eligibility-evaluator";
import type { EligibilityRuleInput } from "../domain/eligibility-rules";
import { evaluateStudentForDrive } from "../queries/drive-eligibility";
import {
  notifyNewlyEligibleDrives,
  notifyNewlyEligibleDrivesForBatch,
} from "@/features/notifications/domain/newly-eligible-drives";
import { updateSemesterMarks } from "@/features/students/actions/profile-semester-marks";
import { primeDeliveryMocks } from "@/features/notifications/__tests__/delivery-test-helpers";

/** India time, as a UTC instant. */
const ist = (local: string) => new Date(new Date(`${local}Z`).getTime() - 330 * 60 * 1000);

// The 2026-27 academic cycle: the 2027 batch is in its final year.
const SEM_ODD = ist("2026-09-23T12:00:00"); // semester 7 (4th year) / 5 (3rd year)
const SEM_EVEN = ist("2027-03-15T12:00:00"); // semester 8 (4th year) / 6 (3rd year)
const FINAL = 2027;

const rule = (
  ruleType: EligibilityRuleInput["ruleType"],
  operator: EligibilityRuleInput["operator"],
  value: number | string[]
): EligibilityRuleInput => ({
  ruleType,
  operator,
  numberValue: typeof value === "number" ? value : null,
  listValue: typeof value === "number" ? [] : value,
});

/** A drive's rules: its batch, and the usual academic bar. */
const RULES = [rule("BATCH_YEAR", "IN", [String(FINAL)]), rule("CGPA", "GTE", 7), rule("ACTIVE_BACKLOGS", "LTE", 0)];

function subject(over: Partial<EligibilitySubject> = {}): EligibilitySubject {
  return {
    approved: true,
    placed: false,
    optedIn: true,
    entryType: "REGULAR",
    expectedPassoutYear: FINAL,
    academic: {
      currentCGPA: 8.2,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 88,
      twelfthPercentage: 82,
      diplomaPercentage: null,
      currentSemester: 7,
    },
    semestersWithMarks: [1, 2, 3, 4, 5, 6],
    skills: [],
    ...over,
  };
}

const decide = (
  over: Partial<EligibilitySubject> = {},
  options: Parameters<typeof evaluateEligibility>[2] = {},
  rules = RULES
) => evaluateEligibility(subject(over), rules, { now: SEM_ODD, window: "open", ...options });

// ---------------------------------------------------------------------------
// The pipeline, case by case (test matrix 1–10, 13, 14)
// ---------------------------------------------------------------------------

describe("the eligibility pipeline", () => {
  it("1. an eligible student passes every stage, with no reasons", () => {
    const result = decide();
    expect(result).toMatchObject({ eligible: true, codes: [], reasons: [], blockedBy: null });
    expect(result.requirements.map((r) => [r.code, r.passed])).toEqual([
      ["WRONG_SEMESTER", true],
      ["MISSING_REQUIRED_MARKS", true],
    ]);
  });

  it("2. a student outside the drive's batches is WRONG_BATCH", () => {
    const result = decide({}, {}, [rule("BATCH_YEAR", "IN", [String(FINAL - 1)]), ...RULES.slice(1)]);
    expect(result.eligible).toBe(false);
    expect(result.codes).toContain("WRONG_BATCH");
  });

  it("3. a student of another department is WRONG_DEPARTMENT, and nothing else is read", () => {
    const result = decide({}, { departmentEligible: false });
    expect(result).toMatchObject({ eligible: false, codes: ["WRONG_DEPARTMENT"], results: [], requirements: [] });
  });

  it("4. a semester 5 student (3rd year, first half) is excluded", () => {
    const result = decide({ expectedPassoutYear: FINAL + 1 }, { now: SEM_ODD }, []);
    expect(result).toMatchObject({ eligible: false, codes: ["WRONG_SEMESTER"] });
    expect(result.reasons[0]).toMatch(/final-year \(semester 7 and 8\) students only — you are in 3rd Year/);
  });

  it("5. a semester 6 student (3rd year, second half) is excluded", () => {
    const result = decide({ expectedPassoutYear: FINAL + 1 }, { now: SEM_EVEN }, []);
    expect(result).toMatchObject({ eligible: false, codes: ["WRONG_SEMESTER"] });
  });

  it("6. a semester 7 student without semesters 1–6 marks is MISSING_REQUIRED_MARKS", () => {
    const result = decide({ semestersWithMarks: [1, 2, 3, 4, 5] });
    expect(result).toMatchObject({ eligible: false, codes: ["MISSING_REQUIRED_MARKS"] });
    expect(result.reasons).toEqual(["Upload your marks for semester 6 to see final-year drives"]);

    const none = decide({ semestersWithMarks: [] });
    expect(none.reasons[0]).toMatch(/semesters 1, 2, 3, 4, 5, 6/);
  });

  it("7. a semester 7 student with semesters 1–6 marks is eligible", () => {
    expect(decide({ semestersWithMarks: [6, 5, 4, 3, 2, 1] }).eligible).toBe(true);
  });

  it("8. a semester 8 student is eligible with semesters 1–6 (owner: no automatic semester-7 requirement)", () => {
    // Admins remind students when results are due; semester 7 marks are not
    // required automatically.
    expect(decide({}, { now: SEM_EVEN }).eligible).toBe(true);
    expect(decide({ semestersWithMarks: [1, 2, 3, 4, 5] }, { now: SEM_EVEN }).codes).toEqual([
      "MISSING_REQUIRED_MARKS",
    ]);
  });

  it("a lateral-entry student needs semesters 3–6, never 1 and 2", () => {
    expect(requiredMarkSemesters("DIPLOMA")).toEqual([3, 4, 5, 6]);
    const diploma = { entryType: "DIPLOMA" as const, semestersWithMarks: [3, 4, 5, 6] };
    expect(decide({ ...diploma, academic: { ...subject().academic!, twelfthPercentage: null, diplomaPercentage: 80 } }).eligible).toBe(true);
  });

  it("a graduated batch, or one not on record, is not final year", () => {
    expect(decide({ expectedPassoutYear: FINAL - 1 }, {}, []).codes).toEqual(["WRONG_SEMESTER"]);
    const unknown = decide({ expectedPassoutYear: null }, {}, []);
    expect(unknown.codes).toEqual(["WRONG_SEMESTER"]);
    expect(unknown.reasons[0]).toMatch(/not on record/);
  });

  it("the semester a student typed does not count — only the batch does", () => {
    const claimed = decide({ expectedPassoutYear: FINAL + 1, academic: { ...subject().academic!, currentSemester: 7 } }, {}, []);
    expect(claimed.codes).toEqual(["WRONG_SEMESTER"]);
  });

  it("9. a drive whose applications have not opened is APPLICATION_NOT_OPEN", () => {
    expect(decide({}, { window: "upcoming" })).toMatchObject({ eligible: false, codes: ["APPLICATION_NOT_OPEN"] });
  });

  it("10. a drive whose applications have closed is APPLICATION_CLOSED", () => {
    expect(decide({}, { window: "closed" })).toMatchObject({ eligible: false, codes: ["APPLICATION_CLOSED"] });
  });

  it("the window is judged from the drive's own dates through the facade", () => {
    const student = {
      ...subject(),
      id: "s",
      departmentId: "dept-comp",
      isPending: false,
      placements: [],
      skills: [],
      semesterMarks: [1, 2, 3, 4, 5, 6].map((semester) => ({ semester })),
    };
    const drive = (start: string, end: string) => ({
      applicationStartDate: ist(start),
      applicationDeadline: ist(end),
      eligibilityRules: RULES,
      eligibleDepartmentLinks: [{ departmentId: "dept-comp" }],
    });
    const at = (d: ReturnType<typeof drive>) =>
      evaluateStudentForDrive(student as never, d, { window: true, now: SEM_ODD }).codes;

    expect(at(drive("2026-09-01T00:00:00", "2026-09-30T23:59:59"))).toEqual([]);
    expect(at(drive("2026-09-24T00:00:00", "2026-09-30T23:59:59"))).toEqual(["APPLICATION_NOT_OPEN"]);
    expect(at(drive("2026-09-01T00:00:00", "2026-09-22T23:59:59"))).toEqual(["APPLICATION_CLOSED"]);
  });

  it("reports the CGPA and backlog bars under their own codes, after the gates", () => {
    const result = decide({
      expectedPassoutYear: FINAL,
      semestersWithMarks: [1, 2, 3, 4, 5],
      academic: { ...subject().academic!, currentCGPA: 6.1, activeBacklogs: 2 },
    });
    // Pipeline order: marks before the drive's other rules.
    expect(result.codes).toEqual(["MISSING_REQUIRED_MARKS", "BELOW_CGPA", "ACTIVE_BACKLOG_LIMIT"]);
  });

  it("puts the window and batch ahead of the semester, as the pipeline runs", () => {
    const result = decide(
      { expectedPassoutYear: FINAL + 1 },
      { window: "closed" },
      [rule("BATCH_YEAR", "IN", [String(FINAL)])]
    );
    expect(result.codes).toEqual(["APPLICATION_CLOSED", "WRONG_BATCH", "WRONG_SEMESTER"]);
  });

  it("13. the July 1 promotion makes a 3rd-year batch eligible, with no write", () => {
    const nextBatch = { expectedPassoutYear: FINAL + 1 };
    const rules = [rule("BATCH_YEAR", "IN", [String(FINAL + 1)])];

    expect(decide(nextBatch, { now: ist("2027-06-30T23:59:59") }, rules).codes).toEqual(["WRONG_SEMESTER"]);
    expect(decide(nextBatch, { now: ist("2027-07-01T00:00:00") }, rules).eligible).toBe(true);
  });

  it("14. a drop (batch +1) takes a final-year student out; undoing it brings them back", () => {
    const rules = [rule("BATCH_YEAR", "IN", [String(FINAL), String(FINAL + 1)])];
    expect(decide({ expectedPassoutYear: FINAL }, {}, rules).eligible).toBe(true);
    // Dropped: 2027 → 2028, now 3rd year.
    expect(decide({ expectedPassoutYear: FINAL + 1 }, {}, rules).codes).toEqual(["WRONG_SEMESTER"]);
    // Undone: back to 2027.
    expect(decide({ expectedPassoutYear: FINAL }, {}, rules).eligible).toBe(true);
  });

  it("standing still comes first: a placed student is told only that", () => {
    expect(decide({ placed: true, expectedPassoutYear: null, semestersWithMarks: [] })).toMatchObject({
      codes: ["PLACED"],
      requirements: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Item 7: a profile save re-checks and notifies once (test matrix 11, 12, 15)
// ---------------------------------------------------------------------------

const DEPT = "dept-comp";
const STUDENT_ID = "student-1";
const USER_ID = "user-1";

/** A drive published in the student's department, open now. */
function publishedDrive(id: string, over: { batch?: string; minCGPA?: number; companyName?: string } = {}) {
  return {
    id,
    departmentId: null,
    isCentralDrive: true,
    lifecycleStatus: "PUBLISHED",
    companyName: over.companyName ?? `Company ${id}`,
    roleName: "Software Engineer",
    packageOffered: "10.00",
    packageDisplay: "10 LPA",
    selectionRounds: "[]",
    applicationStartDate: new Date(Date.now() - 864e5),
    applicationDeadline: new Date(Date.now() + 7 * 864e5),
    nextStageDate: new Date(Date.now() + 14 * 864e5),
    minCGPA: over.minCGPA ?? 7,
    maxActiveBacklogs: 0,
    applicationFields: null,
    formFields: [],
    eligibleDepartmentLinks: [{ departmentId: DEPT }],
    eligibilityRules: [
      rule("BATCH_YEAR", "IN", [over.batch ?? String(finalNow())]),
      rule("CGPA", "GTE", over.minCGPA ?? 7),
    ],
    departmentConfigs: [
      {
        id: `config-${id}`,
        departmentId: DEPT,
        status: "PUBLISHED",
        roleName: null,
        applicationDeadline: null,
        nextStageDate: null,
        minCGPA: null,
        maxActiveBacklogs: null,
        eligibilityRules: [],
        formFields: [],
        applicationFields: null,
      },
    ],
  };
}

/** The final-year batch on the real clock (the drives above are dated from it). */
function finalNow(): number {
  const now = new Date(Date.now() + 330 * 60 * 1000);
  return now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

/** The student as the database holds them, with the semesters on record. */
function storedStudent(semesters: number[]) {
  return {
    id: STUDENT_ID,
    userId: USER_ID,
    departmentId: DEPT,
    rollNumber: "R1",
    isPending: false,
    optedIn: true,
    entryType: "REGULAR",
    expectedPassoutYear: finalNow(),
    academic: {
      currentCGPA: 8.2,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 88,
      twelfthPercentage: 82,
      diplomaPercentage: null,
      currentSemester: 7,
    },
    skills: [],
    placements: [],
    semesterMarks: semesters.map((semester) => ({ semester })),
  };
}

/** A notifications table that, like the real one, holds (userId, dedupeKey) unique. */
function notificationsTable() {
  const keys = new Set<string>();
  vi.mocked(prisma.notification.createMany).mockImplementation((async (args: {
    data: { userId: string; dedupeKey: string }[];
    skipDuplicates?: boolean;
  }) => {
    let count = 0;
    for (const row of args.data) {
      const key = `${row.userId}|${row.dedupeKey}`;
      if (keys.has(key)) continue;
      keys.add(key);
      count += 1;
    }
    return { count };
  }) as never);
  return keys;
}

describe("a profile save re-checks eligibility and notifies once", () => {
  let table: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    primeDeliveryMocks(prisma as never);
    table = notificationsTable();
    vi.mocked(requireStudent).mockResolvedValue({ user: { id: USER_ID }, student: { id: STUDENT_ID } } as never);
    // A semester-7 student (results for 1–6 allowed) whose CGPA matches the
    // SGPAs saved below.
    vi.mocked(prisma.student.findUniqueOrThrow).mockResolvedValue({
      entryType: "REGULAR",
      academic: { currentSemester: 7, currentCGPA: 8 },
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  afterEach(() => vi.useRealTimers());

  it("11. saving the missing semester's marks makes the drive appear and notifies the student", async () => {
    vi.mocked(prisma.drive.findMany).mockResolvedValue([publishedDrive("drive-a")] as never);

    // Before: semester 6 is missing — not eligible, nobody told.
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5]) as never);
    expect(await notifyNewlyEligibleDrives(STUDENT_ID)).toEqual({ eligibleDriveIds: [], notifiedDriveIds: [] });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();

    // The save: semester 6 added. The action commits, then re-checks.
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5, 6]) as never);
    const saved = await updateSemesterMarks({
      marks: [1, 2, 3, 4, 5, 6].map((semester) => ({ semester, sgpa: 8 })),
    } as never);

    expect(saved).toEqual({ success: true });
    const [call] = vi.mocked(prisma.notification.createMany).mock.calls;
    const rows = (call[0] as { data: Record<string, unknown>[] }).data;
    expect(rows).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        event: "DRIVE_PUBLISHED",
        title: "New Drive Available",
        dedupeKey: "drive-published:drive-a",
        resourceId: "drive-a",
        actionUrl: "/student-dashboard/drives/drive-a",
      }),
    ]);
    expect((call[0] as { skipDuplicates?: boolean }).skipDuplicates).toBe(true);
    // The Drives screen is refreshed; it evaluates on every read.
    expect(revalidatePath).toHaveBeenCalledWith("/student-dashboard/drives");
  });

  it("12. saving again — or at the same time — notifies nobody twice", async () => {
    vi.mocked(prisma.drive.findMany).mockResolvedValue([publishedDrive("drive-a")] as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5, 6]) as never);

    const first = await notifyNewlyEligibleDrives(STUDENT_ID);
    const [second, third] = await Promise.all([
      notifyNewlyEligibleDrives(STUDENT_ID),
      notifyNewlyEligibleDrives(STUDENT_ID),
    ]);

    expect(first.notifiedDriveIds).toEqual(["drive-a"]);
    expect(second.notifiedDriveIds).toEqual([]);
    expect(third.notifiedDriveIds).toEqual([]);
    // Still eligible — just not told again.
    expect(second.eligibleDriveIds).toEqual(["drive-a"]);
    expect(table.size).toBe(1);
  });

  it("uses the publish fan-out's key: a student told at publish is not told again on save", async () => {
    // The drive was announced to them when their department published it.
    table.add(`${USER_ID}|drive-published:drive-a`);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([publishedDrive("drive-a")] as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5, 6]) as never);

    expect((await notifyNewlyEligibleDrives(STUDENT_ID)).notifiedDriveIds).toEqual([]);
  });

  it("15. several drives becoming eligible at once: one notification each, none for the rest", async () => {
    vi.mocked(prisma.drive.findMany).mockResolvedValue([
      publishedDrive("drive-a"),
      publishedDrive("drive-b"),
      publishedDrive("drive-c"),
      // Out of reach: a higher bar, and another batch.
      publishedDrive("drive-high", { minCGPA: 9 }),
      publishedDrive("drive-other-batch", { batch: String(finalNow() + 1) }),
    ] as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5, 6]) as never);

    const result = await notifyNewlyEligibleDrives(STUDENT_ID);

    expect(result.eligibleDriveIds).toEqual(["drive-a", "drive-b", "drive-c"]);
    expect(result.notifiedDriveIds).toEqual(["drive-a", "drive-b", "drive-c"]);
    expect([...table].sort()).toEqual([
      `${USER_ID}|drive-published:drive-a`,
      `${USER_ID}|drive-published:drive-b`,
      `${USER_ID}|drive-published:drive-c`,
    ]);
  });

  it("asks SQL only for the student's department's published drives, then decides exactly", async () => {
    vi.mocked(prisma.drive.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(storedStudent([1, 2, 3, 4, 5, 6]) as never);

    await notifyNewlyEligibleDrives(STUDENT_ID);

    const [query] = vi.mocked(prisma.drive.findMany).mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(query.where).toEqual({
      eligibleDepartmentLinks: { some: { departmentId: DEPT } },
      departmentConfigs: { some: { departmentId: DEPT, status: "PUBLISHED" } },
      lifecycleStatus: { notIn: ["ARCHIVED", "CANCELLED"] },
    });
    // Everything the student is decided on comes from the database row.
    expect(vi.mocked(prisma.student.findUnique).mock.calls[0][0]).toMatchObject({
      where: { id: STUDENT_ID },
      include: { semesterMarks: { select: { semester: true } } },
    });
  });

  it("a student without an account yet is shown and told nothing", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue({ ...storedStudent([1, 2, 3, 4, 5, 6]), userId: null } as never);

    expect(await notifyNewlyEligibleDrives(STUDENT_ID)).toEqual({ eligibleDriveIds: [], notifiedDriveIds: [] });
    expect(prisma.drive.findMany).not.toHaveBeenCalled();
  });

  it("a failed re-check never fails the save that triggered it", async () => {
    vi.mocked(prisma.student.findUnique).mockRejectedValue(new Error("connection lost"));

    const saved = await updateSemesterMarks({
      marks: [1, 2, 3, 4, 5, 6].map((semester) => ({ semester, sgpa: 8 })),
    } as never);

    expect(saved).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// The July 1 changeover: the new final-year batch is told, once
// ---------------------------------------------------------------------------

describe("a new final-year batch is told about the drives it can now apply to", () => {
  let table: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    primeDeliveryMocks(prisma as never);
    table = notificationsTable();
  });

  const member = (id: string, departmentId: string, semesters = [1, 2, 3, 4, 5, 6]) => ({
    ...storedStudent(semesters),
    id,
    userId: `user-${id}`,
    departmentId,
  });

  it("delivers one notification per drive to every eligible student of the batch, and nobody else", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      member("a", DEPT),
      member("b", DEPT),
      // Semester 6 missing: stays out.
      member("c", DEPT, [1, 2, 3, 4, 5]),
      member("d", "dept-mech"),
    ] as never);
    // Each department's published drives, loaded once per department.
    vi.mocked(prisma.drive.findMany).mockImplementation((async (args: { where: { eligibleDepartmentLinks: { some: { departmentId: string } } } }) =>
      args.where.eligibleDepartmentLinks.some.departmentId === DEPT
        ? [publishedDrive("drive-a"), publishedDrive("drive-high", { minCGPA: 9 })]
        : []) as never);

    const result = await notifyNewlyEligibleDrivesForBatch(finalNow());

    expect(result).toEqual({ students: 4, notifications: 2 });
    expect(prisma.drive.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect([...table].sort()).toEqual(["user-a|drive-published:drive-a", "user-b|drive-published:drive-a"]);
  });

  it("asks SQL only for that batch's approved, opted-in, unplaced students with an account", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([] as never);

    await notifyNewlyEligibleDrivesForBatch(2028);

    expect(vi.mocked(prisma.student.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        expectedPassoutYear: 2028,
        isPending: false,
        optedIn: true,
        userId: { not: null },
        placements: { none: { revokedAt: null } },
      },
    });
  });

  it("running it again tells nobody twice, and skips anyone already told at publish", async () => {
    table.add(`user-b|drive-published:drive-a`);
    vi.mocked(prisma.student.findMany).mockResolvedValue([member("a", DEPT), member("b", DEPT)] as never);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([publishedDrive("drive-a")] as never);

    expect((await notifyNewlyEligibleDrivesForBatch(finalNow())).notifications).toBe(1);
    expect((await notifyNewlyEligibleDrivesForBatch(finalNow())).notifications).toBe(0);
    expect(table.size).toBe(2);
  });
});