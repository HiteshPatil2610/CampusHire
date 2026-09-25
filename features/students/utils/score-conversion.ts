/**
 * Pre-college scores (10th, 12th, diploma) come either as a percentage or,
 * from boards that grade that way (CBSE 10th until 2017, some state boards),
 * as a CGPA out of 10.
 *
 * Eligibility compares percentages, so a CGPA is stored as the percentage it
 * converts to, and the CGPA the student entered is kept beside it
 * (`tenthCgpa`, `twelfthCgpa`, `diplomaCgpa`) so it can be shown as entered.
 * Before this, a CGPA of 9.2 was stored as "9.2%" and failed every
 * "10th ≥ 60%" rule.
 */

/** CBSE's published CGPA → percentage factor. */
export const CGPA_TO_PERCENTAGE_FACTOR = 9.5;

export const MAX_BOARD_CGPA = 10;

export type ScoreMode = "PERCENTAGE" | "CGPA";

/** The percentage a board CGPA converts to, to two decimals, never above 100. */
export function cgpaToPercentage(cgpa: number): number {
  return Math.min(100, Math.round(cgpa * CGPA_TO_PERCENTAGE_FACTOR * 100) / 100);
}

/** How a stored pre-college record was entered. */
export function scoreModeOf(cgpa: number | null | undefined): ScoreMode {
  return cgpa === null || cgpa === undefined ? "PERCENTAGE" : "CGPA";
}

/**
 * A pre-college score for display: "87.4%", or "9.2 CGPA (87.4%)" when the
 * board gave a CGPA. Null when there is no record.
 */
export function formatPreCollegeScore(
  percentage: number | null | undefined,
  cgpa: number | null | undefined
): string | null {
  if (percentage === null || percentage === undefined) return null;
  return cgpa === null || cgpa === undefined
    ? `${percentage}%`
    : `${cgpa} CGPA (${percentage}%)`;
}
