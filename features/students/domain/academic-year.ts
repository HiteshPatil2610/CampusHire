import type { StudentYearLevel } from "@prisma/client";
import { batchLabel, isValidPassoutYear } from "../utils/batch";

/**
 * A student's academic year level — 3rd year, 4th year, graduated — is
 * DERIVED, never stored.
 *
 * It is a function of two facts: the student's expected passout year (the
 * one stored field, `Student.expectedPassoutYear`) and today's academic
 * cycle. Nothing in the database says "4th year", so nothing can say it
 * wrongly, and there is no second year-level field to disagree with the
 * batch. Consequences that fall out of that, rather than being written:
 *
 *  - Annual promotion. The cycle turns at the end of June 30 (India time).
 *    From July 1 the batch passing out this calendar year reads as GRADUATED
 *    and next year's as FOURTH_YEAR — for every student at once, with no job
 *    that could run halfway, and no way to promote anyone twice.
 *  - Dropping. A drop adds one to the passout year; the level moves back one
 *    step because it is derived from that year (GRADUATED → FOURTH_YEAR,
 *    FOURTH_YEAR → THIRD_YEAR).
 *
 * Every later reader — batch filters, drive eligibility, semester filters,
 * the Super Admin directory — reads `expectedPassoutYear`, and calls
 * `yearLevelFor` when it needs the level. None of them re-implements this.
 *
 * Pure: every function takes `now`, so the cutover is testable on any date.
 */

/** India Standard Time, where the academic cycle turns. UTC+5:30, no DST. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The cycle turns at the start of July 1 — "after June 30". */
const CUTOVER_MONTH = 7; // July, 1-based

/** The last year level before graduating, counted back from passout. */
const LEVEL_BY_YEARS_TO_PASSOUT: StudentYearLevel[] = [
  "FOURTH_YEAR", // passes out at the end of this cycle
  "THIRD_YEAR",
  "SECOND_YEAR",
  "FIRST_YEAR",
];

export const YEAR_LEVEL_LABELS: Record<StudentYearLevel, string> = {
  FIRST_YEAR: "1st Year",
  SECOND_YEAR: "2nd Year",
  THIRD_YEAR: "3rd Year",
  FOURTH_YEAR: "4th Year",
  GRADUATED: "Graduated",
};

export interface AcademicCycle {
  /** e.g. "2026-27" — July 2026 to June 2027. */
  label: string;
  /** The passout year of this cycle's final-year batch, e.g. 2027. */
  finalYearPassout: number;
  /** The instant the cycle began: July 1, 00:00 India time. */
  startsAt: Date;
}

/** The academic cycle `now` falls in. */
export function academicCycle(now: Date = new Date()): AcademicCycle {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1;
  const startYear = month >= CUTOVER_MONTH ? year : year - 1;

  return {
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    finalYearPassout: startYear + 1,
    startsAt: new Date(Date.UTC(startYear, CUTOVER_MONTH - 1, 1) - IST_OFFSET_MS),
  };
}

/**
 * The year level of a student expected to pass out in `expectedPassoutYear`,
 * in the cycle `now` falls in. Null when the batch is not on record — an
 * unknown level is never guessed.
 */
export function yearLevelFor(
  expectedPassoutYear: number | null,
  now: Date = new Date()
): StudentYearLevel | null {
  if (expectedPassoutYear === null) return null;

  const yearsToPassout = expectedPassoutYear - academicCycle(now).finalYearPassout;
  if (yearsToPassout < 0) return "GRADUATED";

  // A batch more than four years out has not started yet; it reads as first
  // year rather than as nothing, since its students are already on the roll.
  return LEVEL_BY_YEARS_TO_PASSOUT[Math.min(yearsToPassout, LEVEL_BY_YEARS_TO_PASSOUT.length - 1)];
}

/** A student's academic standing, for display: "4th Year · 2023-27". */
export function describeStanding(
  expectedPassoutYear: number | null,
  now: Date = new Date()
): string {
  const level = yearLevelFor(expectedPassoutYear, now);
  if (level === null || expectedPassoutYear === null) return "Batch not on record";
  return `${YEAR_LEVEL_LABELS[level]} · ${batchLabel(expectedPassoutYear)}`;
}

// ---------------------------------------------------------------------------
// Dropping
// ---------------------------------------------------------------------------

/** How long a drop can be undone: 48 hours after it was recorded. */
export const DROP_UNDO_WINDOW_MS = 48 * 60 * 60 * 1000;

/** A reason is required, and must say something. Mirrored by a CHECK. */
export const MIN_DROP_REASON_LENGTH = 5;

export interface DropPlan {
  academicYear: string;
  previousPassoutYear: number;
  newPassoutYear: number;
  previousLevel: StudentYearLevel;
  newLevel: StudentYearLevel;
  undoDeadline: Date;
}

export type DropDecision =
  | { ok: true; plan: DropPlan }
  | { ok: false; error: string };

/**
 * What dropping a student now would record. The passout year moves one
 * later; the level is read before and after, in the same cycle.
 */
export function planDrop(expectedPassoutYear: number | null, now: Date = new Date()): DropDecision {
  if (expectedPassoutYear === null) {
    return {
      ok: false,
      error: "This student has no batch on record, so a drop cannot be recorded. Set their batch first.",
    };
  }

  const newPassoutYear = expectedPassoutYear + 1;
  if (!isValidPassoutYear(newPassoutYear)) {
    return { ok: false, error: "The student's batch cannot move any later." };
  }

  return {
    ok: true,
    plan: {
      academicYear: academicCycle(now).label,
      previousPassoutYear: expectedPassoutYear,
      newPassoutYear,
      previousLevel: yearLevelFor(expectedPassoutYear, now)!,
      newLevel: yearLevelFor(newPassoutYear, now)!,
      undoDeadline: new Date(now.getTime() + DROP_UNDO_WINDOW_MS),
    },
  };
}

/** The drop record fields the undo rule reads. */
export interface DropRecordForUndo {
  newPassoutYear: number;
  undoDeadline: Date;
  undoneAt: Date | null;
}

export type UndoDecision = { ok: true } | { ok: false; error: string };

/**
 * Whether a drop may be undone now.
 *
 * Only inside its window, only once, and only while it is still the change in
 * force — the student's passout year must still be the one this drop set. If
 * a later drop has moved it on, undoing this one would silently cancel the
 * later drop as well, so the later one must be undone first. History outside
 * the window is permanent: there is no arbitrary rewind.
 */
export function decideUndo(
  drop: DropRecordForUndo,
  currentPassoutYear: number | null,
  now: Date = new Date()
): UndoDecision {
  if (drop.undoneAt !== null) {
    return { ok: false, error: "This drop has already been undone." };
  }
  if (now.getTime() > drop.undoDeadline.getTime()) {
    return {
      ok: false,
      error: "The 48-hour undo window for this drop has closed. It is now part of the student's record.",
    };
  }
  if (currentPassoutYear !== drop.newPassoutYear) {
    return {
      ok: false,
      error: "A later change to this student's batch is in force. Undo the most recent drop first.",
    };
  }
  return { ok: true };
}

/** Whether a drop's undo control should still be offered. */
export function isUndoable(drop: { undoDeadline: Date; undoneAt: Date | null }, now: Date = new Date()): boolean {
  return drop.undoneAt === null && now.getTime() <= drop.undoDeadline.getTime();
}

// ---------------------------------------------------------------------------
// The annual cutover record
// ---------------------------------------------------------------------------

/**
 * Whether the cycle `now` falls in has begun and not yet been recorded.
 *
 * Recording the cutover changes no student — levels are derived, so every
 * student already reads at their new level the moment the cycle turns. The
 * record is the institution's ledger of the transition (when it was observed,
 * by whom, and how many students crossed into each level), and its unique key
 * is what makes recording idempotent: a second run finds the row and writes
 * nothing.
 */
export function cutoverDue(
  recordedCycles: ReadonlySet<string>,
  now: Date = new Date()
): AcademicCycle | null {
  const cycle = academicCycle(now);
  return recordedCycles.has(cycle.label) ? null : cycle;
}
