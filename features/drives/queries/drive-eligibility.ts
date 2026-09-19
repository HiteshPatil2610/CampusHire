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
 * notification fan-out and the department admin's eligible-student list. They
 * add the drive-level checks (academic record present, deadline open) and
 * delegate everything about the student — standing (approved, placed, opted
 * in), department, and every rule — to the single pure evaluator in
 * `domain/eligibility-evaluator.ts`. There is no other place eligibility is
 * computed.
 *
 * The student and the rules are both typed as *required* inputs: a caller that
 * forgot to load the student's skills or the drive's rule set does not compile,
 * rather than silently evaluating against nothing.
 */

/**
 * A student as the eligibility check needs them — server-loaded rows only.
 * `placements` are their active placements (`ACTIVE_PLACEMENTS_SELECT`).
 */
export type StudentWithEligibilityInfo = Student & {
  academic: StudentAcademic | null;
  skills: { skillName: string }[];
  placements: { revokedAt: Date | null }[];
};

/**
 * A drive as the eligibility check needs it: its deadline, the departments it
 * is assigned to, and the rule set already resolved for the student's
 * department (see `resolveDepartmentDriveWithRules`).
 */
export type DriveWithEligibility = {
  applicationDeadline: Date;
  eligibilityRules: EligibilityRuleInput[];
} & HasEligibleDepartmentLinks;

/** The rule-by-rule result, for checklists that show every criterion. */
export function evaluateStudentForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): EligibilityEvaluation {
  return evaluateEligibility(toEligibilitySubject(student), drive.eligibilityRules, {
    departmentEligible: eligibleDepartmentIdsOf(drive).includes(student.departmentId),
  });
}

/**
 * Eligible on everything except the deadline — for listings that also show
 * drives whose window has closed.
 */
export function isStudentAcademicallyEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): boolean {
  if (!student.academic) {
    return false;
  }

  // Standing (approved → placed → opted in → department), then every rule.
  return evaluateStudentForDrive(student, drive).eligible;
}

export function isStudentEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): boolean {
  if (!student.academic) {
    return false;
  }

  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    return false;
  }

  return isStudentAcademicallyEligibleForDrive(student, drive);
}

/**
 * Every reason a student cannot apply, in the order they should fix them.
 */
export function getIneligibilityReasons(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): string[] {
  const evaluation = evaluateStudentForDrive(student, drive);

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

  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    reasons.push("Drive is closed");
  }

  reasons.push(...evaluation.reasons);

  return reasons;
}
