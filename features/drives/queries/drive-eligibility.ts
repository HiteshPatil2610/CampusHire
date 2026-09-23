import type { Student, StudentAcademic } from "@prisma/client";
import { getDriveStatus } from "../utils/drive-status";
import {
  eligibleDepartmentIdsOf,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import {
  evaluateEligibility,
  toEligibilitySubject,
  type EligibilityEvaluation,
} from "../domain/eligibility-evaluator";
import type { EligibilityRuleInput } from "../domain/eligibility-rules";

/**
 * The eligibility facade.
 *
 * These are the functions every read and write path calls — the student's
 * drive list, the detail page, the dashboard, `applyToDrive`, the
 * notification fan-outs (a drive published, a profile saved) and the
 * department admin's eligible-student list. They pass the drive's
 * application window and department to the single pure evaluator in
 * `domain/eligibility-evaluator.ts`, which decides everything — standing,
 * department, window, batch, final year, required marks and every rule.
 * There is no other place eligibility is computed.
 *
 * The student and the rules are both typed as *required* inputs: a caller that
 * forgot to load the student's skills or the drive's rule set does not compile,
 * rather than silently evaluating against nothing.
 */

/**
 * A student as the eligibility check needs them — server-loaded rows only.
 * `placements` are their active placements (`ACTIVE_PLACEMENTS_SELECT`);
 * `semesterMarks` the semesters they have marks for (`SEMESTER_MARKS_SELECT`).
 */
export type StudentWithEligibilityInfo = Student & {
  academic: StudentAcademic | null;
  skills: { skillName: string }[];
  placements: { revokedAt: Date | null }[];
  semesterMarks: { semester: number }[];
};

/**
 * A drive as the eligibility check needs it: its application window, the departments it
 * is assigned to, and the rule set already resolved for the student's
 * department (see `resolveDepartmentDriveWithRules`).
 */
export type DriveWithEligibility = {
  applicationStartDate: Date;
  applicationDeadline: Date;
  eligibilityRules: EligibilityRuleInput[];
} & HasEligibleDepartmentLinks;

/**
 * The full evaluation, for checklists that show every criterion. With
 * `window: true` the application window is judged too (not open yet, or
 * closed, is then a failure).
 */
export function evaluateStudentForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility,
  options: { window?: boolean; now?: Date } = {}
): EligibilityEvaluation {
  const now = options.now ?? new Date();
  return evaluateEligibility(toEligibilitySubject(student), drive.eligibilityRules, {
    departmentEligible: eligibleDepartmentIdsOf(drive).includes(student.departmentId),
    window: options.window ? getDriveStatus(drive, now) : undefined,
    now,
  });
}

/**
 * Eligible on everything except the application window — for listings that
 * also show drives whose window has closed, and for announcing a drive.
 */
export function isStudentAcademicallyEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility,
  now: Date = new Date()
): boolean {
  if (!student.academic) {
    return false;
  }

  return evaluateStudentForDrive(student, drive, { now }).eligible;
}

/** Eligible, and the drive is taking applications now. */
export function isStudentEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility,
  now: Date = new Date()
): boolean {
  if (!student.academic) {
    return false;
  }

  return evaluateStudentForDrive(student, drive, { window: true, now }).eligible;
}

/**
 * Every reason a student cannot apply, in the order they should fix them.
 */
export function getIneligibilityReasons(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): string[] {
  const evaluation = evaluateStudentForDrive(student, drive, { window: true });

  // A standing block is the whole answer. A placed student is ineligible
  // because they are placed — nothing else is evaluated or reported.
  if (evaluation.blockedBy) {
    return evaluation.reasons;
  }

  const reasons: string[] = [];

  // Surfaced before the academic check so a lateral-entry student who has
  // neither sees both gaps at once rather than fixing one and discovering
  // the next. The same rule is enforced server-side in `applyToDrive`.
  if (!student.rollNumber) {
    reasons.push("Add your roll number in your profile");
  }

  if (!student.academic) {
    reasons.push("Academic information not completed");
    return reasons; // Every academic rule would repeat this; say it once.
  }

  // Window, batch, final year, marks, then the drive's rules — in that order.
  reasons.push(...evaluation.reasons);

  return reasons;
}