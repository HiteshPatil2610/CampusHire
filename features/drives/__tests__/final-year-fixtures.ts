import { academicCycle } from "@/features/students/domain/academic-year";

/**
 * Test fixtures for the final-year requirements every drive has (Item 8): a
 * student in their final year this academic cycle, with the semester marks
 * the gate asks for. Computed from the real clock, so fixtures stay valid
 * whatever day the suite runs on.
 */

/** The batch in its final year (semester 7 or 8) right now. */
export const FINAL_YEAR_PASSOUT = academicCycle().finalYearPassout;

/** Marks for semesters 1–6: what a regular-entry final-year student needs. */
export const REQUIRED_MARKS = [1, 2, 3, 4, 5, 6].map((semester) => ({ semester }));

/** What a lateral-entry (diploma) final-year student needs: semesters 3–6. */
export const REQUIRED_MARKS_DIPLOMA = [3, 4, 5, 6].map((semester) => ({ semester }));
