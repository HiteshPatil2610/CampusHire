import type { EntryType } from "@prisma/client";

/**
 * A student enters the degree one of two ways, and the two produce different
 * academic records:
 *
 * - REGULAR — completes 12th, starts at semester 1, has all 8 semesters.
 * - DIPLOMA — completes a diploma instead of 12th and is admitted laterally
 *   into the second year, so there is no 12th record and no semester 1 or 2.
 *
 * Before this existed, a diploma student had no way to submit a profile: the
 * 12th percentage column was NOT NULL and the semester form asked for marks
 * they never earned. Zero-filling those fields would have poisoned every
 * eligibility comparison, so the unused branch is left null instead.
 */

/** First semester a student of this entry type actually studied. */
export function firstSemesterFor(entryType: EntryType): number {
  return entryType === "DIPLOMA" ? 3 : 1;
}

/** Highest semester in the programme. */
export const FINAL_SEMESTER = 8;

/**
 * Semesters a student of this entry type can hold marks for, capped at the
 * semester they have actually reached.
 */
export function semestersFor(
  entryType: EntryType,
  currentSemester: number
): number[] {
  const first = firstSemesterFor(entryType);
  const last = Math.min(Math.max(currentSemester, first - 1), FINAL_SEMESTER);

  const semesters: number[] = [];
  for (let semester = first; semester <= last; semester++) {
    semesters.push(semester);
  }
  return semesters;
}

/** True when this semester number is meaningful for this entry type. */
export function isSemesterApplicable(
  entryType: EntryType,
  semester: number
): boolean {
  return semester >= firstSemesterFor(entryType) && semester <= FINAL_SEMESTER;
}

/** Label for the pre-college qualification this entry type submits. */
export function preCollegeQualificationLabel(entryType: EntryType): string {
  return entryType === "DIPLOMA" ? "Diploma" : "12th / HSC";
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  REGULAR: "Regular (after 12th)",
  DIPLOMA: "Lateral entry (after Diploma)",
};

/**
 * The pre-college percentage used for eligibility and display, whichever
 * branch this student filled. Callers should not read `twelfthPercentage`
 * directly, because it is null for every diploma student.
 */
export function preCollegePercentage(academic: {
  entryType: EntryType;
  twelfthPercentage: number | null;
  diplomaPercentage: number | null;
}): number | null {
  return academic.entryType === "DIPLOMA"
    ? academic.diplomaPercentage
    : academic.twelfthPercentage;
}
