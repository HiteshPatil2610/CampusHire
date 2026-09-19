import type { EntryType } from "@prisma/client";
import { preCollegePercentage } from "@/features/students/utils/entry-type";
import {
  describeRule,
  RULE_SPECS,
  type EligibilityRuleInput,
} from "./eligibility-rules";

/**
 * The one eligibility evaluator.
 *
 * Every eligibility decision in the app — the student's drive list, the drive
 * detail page and its checklist, `applyToDrive`, and the new-drive
 * notification fan-out — reaches this function through the facade in
 * `queries/drive-eligibility.ts`. There is no second implementation, so a
 * student can never be shown a drive the apply action then refuses, or be
 * notified about one the list hides.
 *
 * Pure: no database, no session, no client input. The subject is built from
 * server-loaded rows only (`toEligibilitySubject`), and the rules come from the
 * resolved department rule set.
 *
 * **Standing first, and it stops.** Before any rule, in this order: is the
 * student's registration approved, are they already placed, are they opted in
 * to placement, and is their department assigned to the drive. The first that
 * fails ends the evaluation — a placed student is ineligible *because they are
 * placed*, and their CGPA, backlogs, batch, skills and every other rule are
 * never read. Placement is permanent exclusion from new drives.
 *
 * **A missing record fails a rule that needs it, with a reason that says so.**
 * A diploma student has no 12th percentage; that is NULL, never 0, so a
 * TWELFTH_PERCENTAGE rule fails with "no 12th record" rather than the false and
 * confusing "0% < 60%" (architecture.md invariant 11).
 */

/** Everything the evaluator may read about a student, and nothing else. */
export interface EligibilitySubject {
  /** Registration approved (a bulk-imported record linked to an account). */
  approved: boolean;
  /** Holds an active (unrevoked) placement. */
  placed: boolean;
  /** Participating in campus placement. */
  optedIn: boolean;
  entryType: EntryType;
  batchYear: number | null;
  academic: {
    currentCGPA: number;
    activeBacklogs: number;
    pastBacklogCount: number;
    tenthPercentage: number;
    twelfthPercentage: number | null;
    diplomaPercentage: number | null;
    currentSemester: number;
  } | null;
  /** Skill names as the student recorded them. */
  skills: string[];
}

/**
 * Build a subject from server-loaded rows. The only way to make one.
 *
 * `placements` is required: load it with `ACTIVE_PLACEMENTS_SELECT`
 * (features/students/utils/placement-status.ts). Only unrevoked placements
 * count, whichever rows are passed.
 */
export function toEligibilitySubject(student: {
  isPending: boolean;
  optedIn: boolean;
  placements: { revokedAt: Date | null }[];
  entryType: EntryType;
  batchYear: number | null;
  academic: EligibilitySubject["academic"];
  skills: { skillName: string }[];
}): EligibilitySubject {
  return {
    approved: !student.isPending,
    placed: student.placements.some((placement) => !placement.revokedAt),
    optedIn: student.optedIn,
    entryType: student.entryType,
    batchYear: student.batchYear,
    academic: student.academic
      ? {
          currentCGPA: student.academic.currentCGPA,
          activeBacklogs: student.academic.activeBacklogs,
          pastBacklogCount: student.academic.pastBacklogCount,
          tenthPercentage: student.academic.tenthPercentage,
          twelfthPercentage: student.academic.twelfthPercentage,
          diplomaPercentage: student.academic.diplomaPercentage,
          currentSemester: student.academic.currentSemester,
        }
      : null,
    skills: student.skills.map((skill) => skill.skillName),
  };
}

export interface RuleResult {
  rule: EligibilityRuleInput;
  passed: boolean;
  /** "CGPA ≥ 7.5" — what the rule asks for. */
  description: string;
  /** The student's own value as text, or null when they have none. */
  actual: string | null;
  /** Why it failed, for the student. Null when it passed. */
  reason: string | null;
}

/** Why evaluation stopped before the rules, if it did. */
export type StandingBlock = "NOT_APPROVED" | "PLACED" | "OPTED_OUT" | "DEPARTMENT";

export interface EligibilityEvaluation {
  eligible: boolean;
  /** Set when a standing check failed; no rule was evaluated. */
  blockedBy: StandingBlock | null;
  results: RuleResult[];
  /** Human-readable reasons, one per distinct failure. */
  reasons: string[];
}

const ACADEMIC_MISSING = "Academic information not completed";

export const STANDING_REASONS: Record<StandingBlock, string> = {
  NOT_APPROVED: "Your registration has not been approved yet.",
  PLACED: "You have already been placed, so you are no longer eligible for new placement drives.",
  OPTED_OUT:
    "You have opted out of campus placement. Ask your department admin to opt you back in.",
  DEPARTMENT: "Your department is not eligible for this drive.",
};

/**
 * The standing checks, in order; the first failure. Exported so a caller
 * that has no drive yet (the apply action, before it loads one) asks the same
 * question the same way.
 */
export function evaluateStanding(
  subject: Pick<EligibilitySubject, "approved" | "placed" | "optedIn">,
  departmentEligible = true
): StandingBlock | null {
  if (!subject.approved) return "NOT_APPROVED";
  if (subject.placed) return "PLACED";
  if (!subject.optedIn) return "OPTED_OUT";
  if (!departmentEligible) return "DEPARTMENT";
  return null;
}

export function evaluateEligibility(
  subject: EligibilitySubject,
  rules: EligibilityRuleInput[],
  /** Whether the student's department is assigned to the drive. */
  options: { departmentEligible?: boolean } = {}
): EligibilityEvaluation {
  // Short-circuit: a student who fails standing is not evaluated further.
  const blockedBy = evaluateStanding(subject, options.departmentEligible ?? true);
  if (blockedBy) {
    return { eligible: false, blockedBy, results: [], reasons: [STANDING_REASONS[blockedBy]] };
  }

  const results = rules.map((rule) => evaluateRule(subject, rule));

  // Several academic rules fail for the same missing record; say it once.
  const reasons = [
    ...new Set(
      results
        .filter((result) => !result.passed)
        .map((result) => result.reason!)
    ),
  ];

  return {
    eligible: results.every((result) => result.passed),
    blockedBy: null,
    results,
    reasons,
  };
}

function evaluateRule(subject: EligibilitySubject, rule: EligibilityRuleInput): RuleResult {
  const description = describeRule(rule);
  const pass = (actual: string | null): RuleResult => ({
    rule,
    passed: true,
    description,
    actual,
    reason: null,
  });
  const fail = (actual: string | null, reason: string): RuleResult => ({
    rule,
    passed: false,
    description,
    actual,
    reason,
  });

  if (RULE_SPECS[rule.ruleType].needsAcademic && !subject.academic) {
    return fail(null, ACADEMIC_MISSING);
  }

  const academic = subject.academic!;
  const n = rule.numberValue;

  switch (rule.ruleType) {
    case "CGPA": {
      const value = academic.currentCGPA;
      return value >= n!
        ? pass(String(value))
        : fail(String(value), `CGPA requirement: ${n} (You: ${value})`);
    }

    case "ACTIVE_BACKLOGS": {
      const value = academic.activeBacklogs;
      return value <= n!
        ? pass(String(value))
        : fail(String(value), `Maximum backlogs: ${n} (You: ${value})`);
    }

    case "PAST_BACKLOGS": {
      const value = academic.pastBacklogCount;
      return value <= n!
        ? pass(String(value))
        : fail(String(value), `Maximum past backlogs: ${n} (You: ${value})`);
    }

    case "TENTH_PERCENTAGE":
      return percentageResult(academic.tenthPercentage, n!, "10th", "a 10th record", pass, fail);

    case "TWELFTH_PERCENTAGE":
      return percentageResult(
        academic.twelfthPercentage,
        n!,
        "12th",
        subject.entryType === "DIPLOMA"
          ? "a 12th record, and lateral-entry students have none"
          : "a 12th record",
        pass,
        fail
      );

    case "DIPLOMA_PERCENTAGE":
      return percentageResult(
        academic.diplomaPercentage,
        n!,
        "Diploma",
        subject.entryType === "REGULAR"
          ? "a diploma record, and regular-entry students have none"
          : "a diploma record",
        pass,
        fail
      );

    case "PRE_COLLEGE_PERCENTAGE": {
      // Whichever branch this student's entry type filled — the same resolution
      // the profile and review card use.
      const value = preCollegePercentage(subject.entryType, academic);
      const label = subject.entryType === "DIPLOMA" ? "Diploma" : "12th";
      return percentageResult(value, n!, label, `a ${label} record`, pass, fail);
    }

    case "CURRENT_SEMESTER": {
      const value = academic.currentSemester;
      const ok =
        rule.operator === "GTE" ? value >= n! : rule.operator === "LTE" ? value <= n! : value === n;
      return ok
        ? pass(String(value))
        : fail(String(value), `${description} (You: semester ${value})`);
    }

    case "BATCH_YEAR": {
      if (subject.batchYear === null) {
        return fail(null, `Open to the ${description.replace(/^Batch of /, "")} batch only — your batch year is not on record`);
      }
      const value = String(subject.batchYear);
      return rule.listValue.includes(value)
        ? pass(value)
        : fail(
            value,
            `Your batch (${value}) is not targeted by this drive — open to the ${description.replace(/^Batch of /, "")} batch only`
          );
    }

    case "ENTRY_TYPE": {
      const value = subject.entryType;
      return rule.listValue.includes(value)
        ? pass(value)
        : fail(value, `Open to ${description.replace(/ only$/, "").toLowerCase()} students only`);
    }

    case "SKILL": {
      // Skills are self-typed, so matching ignores case and surrounding space:
      // "java" satisfies "Java".
      const have = new Set(subject.skills.map((skill) => skill.trim().toLowerCase()));
      const missing = rule.listValue.filter((skill) => !have.has(skill.trim().toLowerCase()));
      const matched = rule.listValue.length - missing.length;
      const actual = subject.skills.length ? subject.skills.join(", ") : null;

      if (rule.operator === "INCLUDES_ALL") {
        return missing.length === 0
          ? pass(actual)
          : fail(actual, `Missing required skill${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
      }

      return matched > 0
        ? pass(actual)
        : fail(actual, `Needs at least one of: ${rule.listValue.join(", ")}`);
    }
  }
}

function percentageResult(
  value: number | null,
  required: number,
  label: string,
  missingWhat: string,
  pass: (actual: string | null) => RuleResult,
  fail: (actual: string | null, reason: string) => RuleResult
): RuleResult {
  if (value === null) {
    return fail(null, `${label} percentage ≥ ${required}% requires ${missingWhat}`);
  }

  return value >= required
    ? pass(`${value}%`)
    : fail(`${value}%`, `${label} percentage requirement: ${required}% (You: ${value}%)`);
}
