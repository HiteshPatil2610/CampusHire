import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  DROP_UNDO_WINDOW_MS,
  academicCycle,
  decideUndo,
  describeStanding,
  droppedThisCycle,
  isUndoable,
  passoutYearForLevel,
  planDrop,
  yearLevelFor,
} from "../domain/academic-year";
import { recordAcademicCutover } from "../domain/record-academic-cutover";
import { dropStudent, undoStudentDrop } from "../actions/manage-drop";
import { decideStudentRetirement } from "@/features/admin-accounts/utils/retire-student-record";
import { countActiveDrops } from "../utils/drop-count";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireAnyRole, getActiveDepartmentAdmin } from "@/lib/auth";
import { createAuditLogInTransaction } from "@/lib/audit";
import { notifyNewlyEligibleDrives } from "@/features/notifications/domain/newly-eligible-drives";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/notifications/domain/newly-eligible-drives", () => ({
  notifyNewlyEligibleDrives: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    studentDrop: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return { AuthorizationError, requireAnyRole: vi.fn(), getActiveDepartmentAdmin: vi.fn() };
});

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => {}),
  AuditAction: { DROP: "DROP", UNDO: "UNDO", CUTOVER: "CUTOVER" },
  AuditEntityType: { STUDENT_DROP: "StudentDrop", ACADEMIC_CUTOVER: "AcademicCycleCutover" },
}));

/** An instant in India time: 2026-06-30 23:59 IST is 18:29 UTC. */
const ist = (isoLocal: string) => new Date(new Date(`${isoLocal}Z`).getTime() - (5 * 60 + 30) * 60 * 1000);

const JUNE_30_LAST_MINUTE = ist("2026-06-30T23:59:59");
const JULY_1_MIDNIGHT = ist("2026-07-01T00:00:00");
const SEPTEMBER = ist("2026-09-23T12:00:00");

// ---------------------------------------------------------------------------
// Annual promotion — derived, so it happens by the calendar alone
// ---------------------------------------------------------------------------

describe("annual promotion", () => {
  it("the academic cycle turns at the start of July 1, India time", () => {
    expect(academicCycle(JUNE_30_LAST_MINUTE).label).toBe("2025-26");
    expect(academicCycle(JULY_1_MIDNIGHT)).toEqual({
      label: "2026-27",
      finalYearPassout: 2027,
      startsAt: JULY_1_MIDNIGHT,
    });
  });

  it("1. 3rd year → 4th year at the cutover (passing out next year)", () => {
    expect(yearLevelFor(2027, JUNE_30_LAST_MINUTE)).toBe("THIRD_YEAR");
    expect(yearLevelFor(2027, JULY_1_MIDNIGHT)).toBe("FOURTH_YEAR");
  });

  it("2. 4th year → Graduated at the cutover (passing out this year)", () => {
    expect(yearLevelFor(2026, JUNE_30_LAST_MINUTE)).toBe("FOURTH_YEAR");
    expect(yearLevelFor(2026, JULY_1_MIDNIGHT)).toBe("GRADUATED");
  });

  it("reads every level of the cycle from the passout year", () => {
    expect([2025, 2026, 2027, 2028, 2029, 2030, 2031].map((year) => yearLevelFor(year, SEPTEMBER))).toEqual([
      "GRADUATED",
      "GRADUATED",
      "FOURTH_YEAR",
      "THIRD_YEAR",
      "SECOND_YEAR",
      "FIRST_YEAR",
      "FIRST_YEAR",
    ]);
  });

  it("does not guess a level for a student with no batch", () => {
    expect(yearLevelFor(null, SEPTEMBER)).toBeNull();
    expect(describeStanding(null, SEPTEMBER)).toBe("Batch not on record");
    expect(describeStanding(2027, SEPTEMBER)).toBe("4th Year · 2023-27");
  });

  it("turns a year filter into the one batch it means", () => {
    // 2026-27: 4th year passes out in 2027, 3rd year in 2028.
    expect(passoutYearForLevel("FOURTH_YEAR", SEPTEMBER)).toBe(2027);
    expect(passoutYearForLevel("THIRD_YEAR", SEPTEMBER)).toBe(2028);
    expect(yearLevelFor(passoutYearForLevel("THIRD_YEAR", SEPTEMBER), SEPTEMBER)).toBe("THIRD_YEAR");
    // Before July 1 it is still last cycle's batches.
    expect(passoutYearForLevel("FOURTH_YEAR", JUNE_30_LAST_MINUTE)).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// Dropping — the plan
// ---------------------------------------------------------------------------

describe("planDrop", () => {
  it("3. Graduated → 4th Year: the batch moves one year later", () => {
    const decision = planDrop(2026, SEPTEMBER);
    expect(decision).toEqual({
      ok: true,
      plan: {
        academicYear: "2026-27",
        previousPassoutYear: 2026,
        newPassoutYear: 2027,
        previousLevel: "GRADUATED",
        newLevel: "FOURTH_YEAR",
        undoDeadline: new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS),
      },
    });
  });

  it("4. 4th Year → 3rd Year", () => {
    const decision = planDrop(2027, SEPTEMBER);
    expect(decision.ok && [decision.plan.previousLevel, decision.plan.newLevel]).toEqual(["FOURTH_YEAR", "THIRD_YEAR"]);
    expect(decision.ok && decision.plan.newPassoutYear).toBe(2028);
  });

  it("5. multiple drops each move one step further back", () => {
    let passout = 2026;
    const levels: string[] = [yearLevelFor(passout, SEPTEMBER)!];
    for (let i = 0; i < 3; i++) {
      const decision = planDrop(passout, SEPTEMBER);
      if (!decision.ok) throw new Error(decision.error);
      passout = decision.plan.newPassoutYear;
      levels.push(decision.plan.newLevel);
    }
    expect(passout).toBe(2029);
    expect(levels).toEqual(["GRADUATED", "FOURTH_YEAR", "THIRD_YEAR", "SECOND_YEAR"]);
  });

  it("14. refuses a student with no batch on record rather than inventing one", () => {
    expect(planDrop(null, SEPTEMBER)).toEqual({ ok: false, error: expect.stringContaining("no batch on record") });
  });

  it("refuses to move a batch past the plausible range", () => {
    expect(planDrop(2100, SEPTEMBER).ok).toBe(false);
  });

  it("allows one drop per academic year — the year turns on July 1", () => {
    const standing = { academicYear: "2026-27", undoneAt: null };
    expect(droppedThisCycle([standing], SEPTEMBER)).toBe(true);
    // An undone drop does not use up the year.
    expect(droppedThisCycle([{ ...standing, undoneAt: SEPTEMBER }], SEPTEMBER)).toBe(false);
    // Last year's drop does not count this year.
    expect(droppedThisCycle([{ academicYear: "2025-26", undoneAt: null }], SEPTEMBER)).toBe(false);
    // At the cutover: a drop on June 30 belongs to 2025-26, so July 1 is free again.
    expect(droppedThisCycle([{ academicYear: "2025-26", undoneAt: null }], JUNE_30_LAST_MINUTE)).toBe(true);
    expect(droppedThisCycle([{ academicYear: "2025-26", undoneAt: null }], JULY_1_MIDNIGHT)).toBe(false);
    expect(droppedThisCycle([], SEPTEMBER)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Undo — the rule
// ---------------------------------------------------------------------------

describe("decideUndo", () => {
  const droppedAt = SEPTEMBER;
  const drop = {
    newPassoutYear: 2027,
    undoDeadline: new Date(droppedAt.getTime() + DROP_UNDO_WINDOW_MS),
    undoneAt: null,
  };

  it("10. allows an undo inside the 48 hours, up to the last millisecond", () => {
    expect(decideUndo(drop, 2027, new Date(droppedAt.getTime() + 60_000))).toEqual({ ok: true });
    expect(decideUndo(drop, 2027, drop.undoDeadline)).toEqual({ ok: true });
    expect(isUndoable(drop, drop.undoDeadline)).toBe(true);
  });

  it("11. refuses an undo after the window — history is permanent", () => {
    const late = new Date(drop.undoDeadline.getTime() + 1);
    expect(decideUndo(drop, 2027, late)).toEqual({ ok: false, error: expect.stringContaining("48-hour undo window") });
    expect(isUndoable(drop, late)).toBe(false);
  });

  it("the window is exactly 48 hours from the drop", () => {
    const hour = 60 * 60 * 1000;
    const decision = planDrop(2027, droppedAt);
    if (!decision.ok) throw new Error(decision.error);
    expect(decision.plan.undoDeadline.getTime() - droppedAt.getTime()).toBe(48 * hour);
    expect(decideUndo({ ...drop, undoDeadline: decision.plan.undoDeadline }, 2027, new Date(droppedAt.getTime() + 49 * hour)).ok).toBe(false);
  });

  it("refuses a second undo", () => {
    expect(decideUndo({ ...drop, undoneAt: droppedAt }, 2027, droppedAt).ok).toBe(false);
  });

  it("refuses to undo an older drop while a later one is in force", () => {
    // Dropped 2026 → 2027, then again 2027 → 2028: undoing the first would
    // silently cancel the second too.
    expect(decideUndo(drop, 2028, droppedAt)).toEqual({
      ok: false,
      error: expect.stringContaining("Undo the most recent drop first"),
    });
  });
});

// ---------------------------------------------------------------------------
// The actions — transactional writes, audit, reason, authorization
// ---------------------------------------------------------------------------

describe("dropStudent / undoStudentDrop", () => {
  let tx: {
    student: { updateMany: ReturnType<typeof vi.fn> };
    studentDrop: { create: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  };
  /** What the transaction wrote, applied only if the callback completes. */
  let committed: { passout: number; drops: number };

  const STUDENT_ID = "ckstudent0000000000000001";
  const DROP_ID = "ckdrop000000000000000000001";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(SEPTEMBER);

    vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-user", role: "DEPT_ADMIN" } as never);
    vi.mocked(getActiveDepartmentAdmin).mockResolvedValue({ departmentId: "dept-comp" } as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue({
      id: STUDENT_ID,
      departmentId: "dept-comp",
      expectedPassoutYear: 2026,
    } as never);

    committed = { passout: 2026, drops: 0 };
    tx = {
      student: { updateMany: vi.fn(async () => ({ count: 1 })) },
      studentDrop: {
        create: vi.fn(async ({ data }: { data: object }) => ({ id: DROP_ID, ...data })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    // A transaction: the callback's writes count only if it returns.
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (t: typeof tx) => unknown) => {
      const staged = { ...committed };
      tx.student.updateMany.mockImplementation(async ({ data }: { data: { expectedPassoutYear: number } }) => {
        staged.passout = data.expectedPassoutYear;
        return { count: 1 };
      });
      tx.studentDrop.create.mockImplementation(async ({ data }: { data: object }) => {
        staged.drops += 1;
        return { id: DROP_ID, ...data };
      });
      const result = await callback(tx);
      committed = staged;
      return result;
    }) as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("6/7/8/9. one transaction: batch +1, drop recorded with reason, audited with before/after", async () => {
    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });

    expect(result).toEqual({ success: true, dropId: DROP_ID, newPassoutYear: 2027 });
    expect(committed).toEqual({ passout: 2027, drops: 1 });

    // Compare-and-set on the year that was read.
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: STUDENT_ID, expectedPassoutYear: 2026 },
      data: { expectedPassoutYear: 2027 },
    });

    expect(tx.studentDrop.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        droppedById: "admin-user",
        droppedAt: SEPTEMBER,
        academicYear: "2026-27",
        previousPassoutYear: 2026,
        newPassoutYear: 2027,
        previousLevel: "GRADUATED",
        newLevel: "FOURTH_YEAR",
        reason: "Year back after backlogs",
        undoDeadline: new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS),
      },
    });

    expect(createAuditLogInTransaction).toHaveBeenCalledWith(
      tx,
      {
        action: "DROP",
        entityType: "StudentDrop",
        entityId: DROP_ID,
        metadata: {
          studentId: STUDENT_ID,
          departmentId: "dept-comp",
          academicYear: "2026-27",
          previousPassoutYear: 2026,
          newPassoutYear: 2027,
          previousLevel: "GRADUATED",
          newLevel: "FOURTH_YEAR",
          reason: "Year back after backlogs",
          undoStatus: "UNDOABLE",
          undoDeadline: new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS).toISOString(),
        },
      },
      "admin-user"
    );
  });

  it("9. requires a reason", async () => {
    const result = await dropStudent({ studentId: STUDENT_ID, reason: " no " });
    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("6. drop count is the number of drops not undone", () => {
    expect(countActiveDrops([{ undoneAt: null }, { undoneAt: SEPTEMBER }, { undoneAt: null }])).toBe(2);
  });

  it("13. a failure inside the transaction leaves nothing behind", async () => {
    vi.mocked(createAuditLogInTransaction).mockRejectedValueOnce(new Error("audit write failed"));

    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });

    expect(result).toEqual({ success: false, error: "Failed to record the drop. Nothing was changed." });
    expect(committed).toEqual({ passout: 2026, drops: 0 });
  });

  it("13. a concurrent change to the batch rolls the drop back", async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce((async (callback: (t: typeof tx) => unknown) => {
      tx.student.updateMany.mockResolvedValueOnce({ count: 0 });
      return callback(tx);
    }) as never);

    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });

    expect(result.success).toBe(false);
    expect(tx.studentDrop.create).not.toHaveBeenCalled();
  });

  it("refuses a student of another department, as not found", async () => {
    vi.mocked(getActiveDepartmentAdmin).mockResolvedValue({ departmentId: "dept-mech" } as never);
    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });
    expect(result).toEqual({ success: false, error: "Student not found." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("14. refuses an existing student with no batch on record, writing nothing", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue({
      id: STUDENT_ID,
      departmentId: "dept-comp",
      expectedPassoutYear: null,
    } as never);
    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });
    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  const recordedDrop = (overrides: object = {}) => ({
    id: DROP_ID,
    previousPassoutYear: 2026,
    newPassoutYear: 2027,
    previousLevel: "GRADUATED",
    newLevel: "FOURTH_YEAR",
    undoDeadline: new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS),
    undoneAt: null,
    student: { id: STUDENT_ID, departmentId: "dept-comp", expectedPassoutYear: 2027 },
    ...overrides,
  });

  it("10. undo within the window restores the batch and is audited", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.setSystemTime(new Date(SEPTEMBER.getTime() + 24 * 60 * 60 * 1000));

    const result = await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" });

    expect(result).toEqual({ success: true, dropId: DROP_ID, newPassoutYear: 2026 });
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: STUDENT_ID, expectedPassoutYear: 2027 },
      data: { expectedPassoutYear: 2026 },
    });
    expect(tx.studentDrop.updateMany).toHaveBeenCalledWith({
      where: { id: DROP_ID, undoneAt: null },
      data: { undoneAt: expect.any(Date), undoneById: "admin-user", undoReason: "Marked in error" },
    });
    expect(createAuditLogInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "UNDO",
        metadata: expect.objectContaining({ restoredPassoutYear: 2026, undoStatus: "UNDONE", reason: "Marked in error" }),
      }),
      "admin-user"
    );
  });

  it("11. undo after the window is refused and writes nothing", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.setSystemTime(new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS + 1));

    const result = await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" });

    expect(result).toEqual({ success: false, error: expect.stringContaining("48-hour undo window") });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a successful undo tells the student about drives they can apply to again", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.setSystemTime(new Date(SEPTEMBER.getTime() + 60 * 60 * 1000));

    expect((await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" })).success).toBe(true);
    expect(notifyNewlyEligibleDrives).toHaveBeenCalledWith(STUDENT_ID);
  });

  it("a refused undo, or a drop, tells nobody anything", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.setSystemTime(new Date(SEPTEMBER.getTime() + DROP_UNDO_WINDOW_MS + 1));
    await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" });

    vi.setSystemTime(SEPTEMBER);
    await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });

    expect(notifyNewlyEligibleDrives).not.toHaveBeenCalled();
  });

  it("a failed notification never undoes the undo", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.setSystemTime(new Date(SEPTEMBER.getTime() + 60 * 60 * 1000));
    vi.mocked(notifyNewlyEligibleDrives).mockRejectedValueOnce(new Error("mail server down"));

    expect(await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" })).toEqual({
      success: true,
      dropId: DROP_ID,
      newPassoutYear: 2026,
    });
  });

  it("an undo raced by another undo rolls back", async () => {
    vi.mocked(prisma.studentDrop.findUnique).mockResolvedValue(recordedDrop() as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce((async (callback: (t: typeof tx) => unknown) => {
      tx.studentDrop.updateMany.mockResolvedValueOnce({ count: 0 });
      return callback(tx);
    }) as never);

    const result = await undoStudentDrop({ dropId: DROP_ID, reason: "Marked in error" });
    expect(result.success).toBe(false);
    expect(createAuditLogInTransaction).not.toHaveBeenCalled();
  });

  it("the Super Admin cannot drop or undo — dropping is the department's call", async () => {
    // Only the roles the action asks for get through, as the real check does.
    vi.mocked(requireAnyRole).mockImplementation((async (roles: string[]) => {
      if (!roles.includes("SUPER_ADMIN")) throw new AuthorizationError("This action requires DEPT_ADMIN role.");
      return { id: "super-user", role: "SUPER_ADMIN" };
    }) as never);

    expect((await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" })).success).toBe(false);
    expect((await undoStudentDrop({ dropId: DROP_ID, reason: "Recorded by mistake" })).success).toBe(false);
    expect(requireAnyRole).toHaveBeenCalledWith(["DEPT_ADMIN"]);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a second drop in the same academic year, writing nothing", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue({
      id: STUDENT_ID,
      departmentId: "dept-comp",
      expectedPassoutYear: 2027,
      drops: [{ academicYear: "2026-27", undoneAt: null }],
    } as never);

    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Second year back" });

    expect(result).toEqual({ success: false, error: expect.stringContaining("only once a year") });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // It asks only for this academic year's standing drops.
    expect(vi.mocked(prisma.student.findUnique).mock.calls[0][0]).toMatchObject({
      select: { drops: { where: { academicYear: "2026-27", undoneAt: null } } },
    });
  });

  it("allows a drop again once the earlier one this year was undone", async () => {
    // The query returns standing drops only; an undone one is not among them.
    vi.mocked(prisma.student.findUnique).mockResolvedValue({
      id: STUDENT_ID,
      departmentId: "dept-comp",
      expectedPassoutYear: 2026,
      drops: [],
    } as never);

    const result = await dropStudent({ studentId: STUDENT_ID, reason: "Year back after backlogs" });

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The annual cutover record — idempotent
// ---------------------------------------------------------------------------

describe("recordAcademicCutover", () => {
  function fakeDb() {
    const rows = new Map<string, { recordedAt: Date }>();
    const db = {
      academicCycleCutover: {
        findUnique: vi.fn(async ({ where }: { where: { academicYear: string } }) => rows.get(where.academicYear) ?? null),
        create: vi.fn(async ({ data }: { data: { academicYear: string; recordedAt: Date } }) => {
          if (rows.has(data.academicYear)) {
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
          }
          rows.set(data.academicYear, { recordedAt: data.recordedAt });
          return data;
        }),
      },
      student: {
        count: vi.fn(async ({ where }: { where: { expectedPassoutYear: number } }) =>
          ({ 2026: 40, 2027: 55, 2028: 60 } as Record<number, number>)[where.expectedPassoutYear] ?? 0),
      },
      $transaction: vi.fn(async (callback: (t: unknown) => unknown) => callback(db)),
    };
    return { db, rows };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("records the cycle once, with who stood where, and audits it", async () => {
    const { db } = fakeDb();
    const result = await recordAcademicCutover(db as never, "super-admin", JULY_1_MIDNIGHT);

    expect(result).toEqual({
      recorded: true,
      cycle: academicCycle(JULY_1_MIDNIGHT),
      counts: { graduatedCount: 40, fourthYearCount: 55, thirdYearCount: 60 },
    });
    expect(createAuditLogInTransaction).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ action: "CUTOVER", entityId: "2026-27" }),
      "super-admin"
    );
  });

  it("12. running it twice records nothing the second time", async () => {
    const { db } = fakeDb();
    await recordAcademicCutover(db as never, "super-admin", JULY_1_MIDNIGHT);
    const second = await recordAcademicCutover(db as never, "super-admin", SEPTEMBER);

    expect(second).toEqual({ recorded: false, cycle: academicCycle(SEPTEMBER), recordedAt: JULY_1_MIDNIGHT });
    expect(db.academicCycleCutover.create).toHaveBeenCalledTimes(1);
    expect(createAuditLogInTransaction).toHaveBeenCalledTimes(1);
  });

  it("12. two runs racing: the loser's unique violation is reported, not thrown", async () => {
    const { db, rows } = fakeDb();
    // The other run inserts between this run's read and its write.
    db.academicCycleCutover.findUnique.mockResolvedValueOnce(null);
    rows.set("2026-27", { recordedAt: JULY_1_MIDNIGHT });

    const result = await recordAcademicCutover(db as never, "super-admin", SEPTEMBER);

    expect(result).toEqual({ recorded: false, cycle: academicCycle(SEPTEMBER), recordedAt: JULY_1_MIDNIGHT });
  });

  it("promotes nobody twice because it promotes nobody at all", async () => {
    const { db } = fakeDb();
    await recordAcademicCutover(db as never, "super-admin", JULY_1_MIDNIGHT);
    await recordAcademicCutover(db as never, "super-admin", JULY_1_MIDNIGHT);
    // The only student access is counting; no student is ever written.
    expect(Object.keys(db.student)).toEqual(["count"]);
    expect(yearLevelFor(2027, SEPTEMBER)).toBe("FOURTH_YEAR");
  });

  it("a new cycle is recorded separately the next year", async () => {
    const { db } = fakeDb();
    await recordAcademicCutover(db as never, "super-admin", JULY_1_MIDNIGHT);
    const next = await recordAcademicCutover(db as never, "super-admin", ist("2027-07-01T09:00:00"));
    expect(next.recorded && next.cycle.label).toBe("2027-28");
  });
});

// ---------------------------------------------------------------------------
// Existing student compatibility
// ---------------------------------------------------------------------------

describe("existing student compatibility", () => {
  it("14. a student record with drop history is never retired (deleted)", () => {
    expect(
      decideStudentRetirement({ hasStudentRecord: true, applicationCount: 0, placementCount: 0, dropCount: 1 }).action
    ).toBe("refuse");
    expect(
      decideStudentRetirement({ hasStudentRecord: true, applicationCount: 0, placementCount: 0 }).action
    ).toBe("delete");
  });
});
