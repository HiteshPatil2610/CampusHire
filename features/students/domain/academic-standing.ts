import type { EntryType, StudentYearLevel } from "@prisma/client";
import { yearLevelFor, academicCycle } from "./academic-year";
import { FINAL_SEMESTER, firstSemesterFor } from "../utils/entry-type";

/**
 * Which semester a student can say they are in, which semesters they can
 * have results for, and whether their CGPA can be true.
 *
 * The rules, in one place so the profile form, the save actions and profile
 * completion cannot drift apart:
 *
 *  - The current semester is one of the two semesters of the year the
 *    student's batch is in (from `expectedPassoutYear` and today's academic
 *    cycle — `yearLevelFor`). A student cannot claim another year, and a
 *    value saved last year stops matching on July 1 and must be updated.
 *  - Results exist only for semesters already finished: from the first
 *    semester the student studied here up to one below the current one. A
 *    semester-7 student has results for 1–6, never 7.
 *  - A student with no finished semester has no CGPA yet, so it is not asked
 *    for. Once results exist it is.
 *  - A CGPA is a weighted average of the SGPAs, so it always lies between the
 *    lowest and the highest of them. Checked only once every finished
 *    semester has its SGPA — with some missing, the CGPA may rightly fall
 *    outside the ones entered.
 */

const SEMESTERS_BY_LEVEL: Record<StudentYearLevel, number[]> = {
  FIRST_YEAR: [1, 2],
  SECOND_YEAR: [3, 4],
  THIRD_YEAR: [5, 6],
  FOURTH_YEAR: [7, 8],
  // The batch has passed out: its last semester was the final one.
  GRADUATED: [FINAL_SEMESTER],
};

/**
 * The semesters this student may give as their current one. With no batch on
 * record the year is unknown, so every semester they could be in is allowed.
 */
export function allowedCurrentSemesters(
  entryType: EntryType,
  expectedPassoutYear: number | null,
  now: Date = new Date()
): number[] {
  const first = firstSemesterFor(entryType);
  const level = yearLevelFor(expectedPassoutYear, now);
  const all = Array.from({ length: FINAL_SEMESTER - first + 1 }, (_, i) => first + i);
  if (!level) return all;

  const forYear = SEMESTERS_BY_LEVEL[level].filter((semester) => semester >= first);
  // A lateral-entry student is never in first year; if the batch says so the
  // record is inconsistent, and their first semester is the only sane choice.
  return forYear.length > 0 ? forYear : [first];
}

/**
 * True when a saved current semester no longer matches the batch's year —
 * typically last year's value after the July 1 cutover.
 */
export function isCurrentSemesterStale(
  entryType: EntryType,
  expectedPassoutYear: number | null,
  currentSemester: number | null | undefined,
  now: Date = new Date()
): boolean {
  if (currentSemester === null || currentSemester === undefined) return false;
  return !allowedCurrentSemesters(entryType, expectedPassoutYear, now).includes(currentSemester);
}

/** The label of the academic year the allowed semesters belong to, e.g. "2026-27". */
export function currentAcademicYearLabel(now: Date = new Date()): string {
  return academicCycle(now).label;
}

/** Semesters already finished: first studied here up to one below the current. */
export function completedSemesters(entryType: EntryType, currentSemester: number): number[] {
  const first = firstSemesterFor(entryType);
  const semesters: number[] = [];
  for (let semester = first; semester < Math.min(currentSemester, FINAL_SEMESTER + 1); semester++) {
    semesters.push(semester);
  }
  return semesters;
}

/** A CGPA exists only once at least one semester has finished. */
export function isCgpaExpected(entryType: EntryType, currentSemester: number): boolean {
  return completedSemesters(entryType, currentSemester).length > 0;
}

/**
 * Why a semester's result cannot be recorded yet, or null when it can.
 * Covers semesters the student never studied here (lateral entry) and ones
 * not finished yet.
 */
export function semesterResultProblem(
  entryType: EntryType,
  currentSemester: number,
  semester: number
): string | null {
  const first = firstSemesterFor(entryType);
  if (semester < first) {
    return `Semester ${semester} does not apply to a lateral-entry student. Start from semester ${first}.`;
  }
  if (semester >= currentSemester) {
    return semester === currentSemester
      ? `Semester ${semester} is your current semester — its result can be added once it is over.`
      : `Semester ${semester} has not happened yet — you are in semester ${currentSemester}.`;
  }
  return null;
}

/**
 * Why this CGPA cannot be right given these SGPAs, or null. Only judged when
 * every finished semester has an SGPA.
 */
export function cgpaConsistencyProblem(
  entryType: EntryType,
  currentSemester: number,
  cgpa: number | null | undefined,
  marks: { semester: number; sgpa: number }[]
): string | null {
  if (cgpa === null || cgpa === undefined) return null;

  const completed = completedSemesters(entryType, currentSemester);
  const bySemester = new Map(marks.map((mark) => [mark.semester, mark.sgpa]));
  if (completed.length === 0 || !completed.every((semester) => bySemester.has(semester))) {
    return null;
  }

  const sgpas = completed.map((semester) => bySemester.get(semester)!);
  const lowest = Math.min(...sgpas);
  const highest = Math.max(...sgpas);
  // Rounding: a CGPA and SGPAs are each shown to two decimals.
  const tolerance = 0.01;
  if (cgpa < lowest - tolerance || cgpa > highest + tolerance) {
    return `Your CGPA (${cgpa}) should be between your lowest and highest SGPA (${lowest}–${highest}). Please check both.`;
  }
  return null;
}
