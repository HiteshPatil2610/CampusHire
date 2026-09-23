import type { EntryType } from "@prisma/client";
import { firstSemesterFor, preCollegePercentage } from "@/features/students/utils/entry-type";
import {
  describeRule,
  RULE_SPECS,
  type EligibilityRuleInput,
} from "./eligibility-rules";
import { batchLabel } from "@/features/students/utils/batch";
import { YEAR_LEVEL_LABELS, yearLevelFor } from "@/features/students/domain/academic-year";
import type { DriveStatus } from "../utils/drive-status";

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
  /**
   * The authoritative batch (Phase 1). The year level — and so whether the
   * student is in semester 7/8 — is derived from it (Phase 2): a promotion or
   * a drop changes this one value and every later check follows.
   */
  expectedPassoutYear: number | null;
  academic: {
    currentCGPA: number;
    activeBacklogs: number;
    pastBacklogCount: number;
    tenthPercentage: number;
    twelfthPercentage: number | null;
    diplomaPercentage: number | null;
    currentSemester: number;
  } | null;
  /** Semesters the student has marks uploaded for. */
  semestersWithMarks: number[];
  /** Skill names as the student recorded them. */
  skills: string[];
}

/**
 * Build a subject from server-loaded rows. The only way to make one.
 *
 * `placements` is required: load it with `ACTIVE_PLACEMENTS_SELECT`
 * (features/students/utils/placement-status.ts). Only unrevoked placements
 * count, whichever rows are passed. `semesterMarks` is required too: load it
 * with `SEMESTER_MARKS_SELECT` (below) — the final-year marks gate reads it.
 */
export function toEligibilitySubject(student: {
  isPending: boolean;
  optedIn: boolean;
  placements: { revokedAt: Date | null }[];
  entryType: EntryType;
  expectedPassoutYear: number | null;
  academic: EligibilitySubject["academic"];
  semesterMarks: { semester: number }[];
  skills: { skillName: string }[];
}): EligibilitySubject {
  return {
    approved: !student.isPending,
    placed: student.placements.some((placement) => !placement.revokedAt),
    optedIn: student.optedIn,
    entryType: student.entryType,
    expectedPassoutYear: student.expectedPassoutYear,
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
    semestersWithMarks: [...new Set((student.semesterMarks ?? []).map((mark) => mark.semester))],
    skills: student.skills.map((skill) => skill.skillName),
  };
}

/** What every eligibility loader selects for the marks gate. */
export const SEMESTER_MARKS_SELECT = { select: { semester: true } } as const;

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

/**
 * Why a student is not eligible, as a stable code — for callers that branch
 * or count (admin lists, tests, notifications). The student is shown the
 * matching `reasons` text, which only ever describes their own record.
 */
export type EligibilityCode =
  | "NOT_APPROVED"
  | "PLACED"
  | "OPTED_OUT"
  | "APPLICATION_NOT_OPEN"
  | "APPLICATION_CLOSED"
  | "WRONG_DEPARTMENT"
  | "WRONG_BATCH"
  | "WRONG_SEMESTER"
  | "MISSING_ACADEMIC_RECORD"
  | "MISSING_REQUIRED_MARKS"
  | "BELOW_CGPA"
  | "ACTIVE_BACKLOG_LIMIT"
  | "CRITERIA_NOT_MET";

/** A requirement every drive has, beyond its own rule set (Item 8). */
export interface RequirementResult {
  code: "WRONG_SEMESTER" | "MISSING_REQUIRED_MARKS";
  passed: boolean;
  /** "Final year (semester 7 or 8)". */
  description: string;
  actual: string | null;
  reason: string | null;
}

export interface EligibilityEvaluation {
  eligible: boolean;
  /** Set when a standing check failed; nothing else was evaluated. */
  blockedBy: StandingBlock | null;
  /** Every failure, as codes, in pipeline order. Empty when eligible. */
  codes: EligibilityCode[];
  /** The final-year and marks requirements (Item 8). */
  requirements: RequirementResult[];
  /** The drive's own rules. */
  results: RuleResult[];
  /** Human-readable reasons, one per distinct failure, in pipeline order. */
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

const STANDING_CODES: Record<StandingBlock, EligibilityCode> = {
  NOT_APPROVED: "NOT_APPROVED",
  PLACED: "PLACED",
  OPTED_OUT: "OPTED_OUT",
  DEPARTMENT: "WRONG_DEPARTMENT",
};

export const WINDOW_REASONS = {
  upcoming: "Applications have not opened yet",
  closed: "Drive is closed",
} as const;

/**
 * The last semester whose marks a final-year student must have uploaded.
 *
 * Item 8 (confirmed): a semester 7 student needs marks for semesters 1–6.
 * Semester 8 (owner, 2026-09-24): no automatic semester-7 requirement — the
 * department admin reminds students when results are due — so every
 * final-year student is held to semesters 1–6. Uploaded marks count without
 * an admin's verification (also the owner's decision).
 */
export const FINAL_YEAR_REQUIRED_MARKS_THROUGH = 6;

/**
 * The semesters whose marks a final-year student must have: from their first
 * semester (3 for a lateral-entry student, who never took 1 and 2) through
 * `FINAL_YEAR_REQUIRED_MARKS_THROUGH`.
 */
export function requiredMarkSemesters(entryType: EntryType): number[] {
  const semesters: number[] = [];
  for (let semester = firstSemesterFor(entryType); semester <= FINAL_YEAR_REQUIRED_MARKS_THROUGH; semester++) {
    semesters.push(semester);
  }
  return semesters;
}

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

/**
 * Item 8: only final-year students — semester 7 or 8 — qualify, and only
 * with the required semester marks uploaded. The year level is derived from
 * the batch and today's academic cycle (`yearLevelFor`), never from the
 * semester a student typed, so it cannot be claimed, and a promotion or a
 * drop moves it. Semester 5–6 (third year) and graduated batches are out.
 */
export function evaluateFinalYearRequirements(
  subject: Pick<EligibilitySubject, "expectedPassoutYear" | "entryType" | "semestersWithMarks">,
  now: Date = new Date()
): RequirementResult[] {
  const level = yearLevelFor(subject.expectedPassoutYear, now);
  const finalYear: RequirementResult = {
    code: "WRONG_SEMESTER",
    description: "Final year (semester 7 or 8)",
    passed: level === "FOURTH_YEAR",
    actual: level ? YEAR_LEVEL_LABELS[level] : null,
    reason:
      level === "FOURTH_YEAR"
        ? null
        : level === null
          ? "Open to final-year (semester 7 and 8) students only — your batch is not on record"
          : `Open to final-year (semester 7 and 8) students only — you are in ${YEAR_LEVEL_LABELS[level]}`,
  };
  // Marks are asked of final-year students only; for anyone else the year
  // is already the whole answer.
  if (!finalYear.passed) return [finalYear];

  const required = requiredMarkSemesters(subject.entryType);
  const have = new Set(subject.semestersWithMarks);
  const missing = required.filter((semester) => !have.has(semester));
  const range = `${required[0]}–${required[required.length - 1]}`;

  return [
    finalYear,
    {
      code: "MISSING_REQUIRED_MARKS",
      description: `Marks uploaded for semesters ${range}`,
      passed: missing.length === 0,
      actual: missing.length === 0 ? "All uploaded" : `Missing ${missing.join(", ")}`,
      reason:
        missing.length === 0
          ? null
          : `Upload your marks for semester${missing.length === 1 ? "" : "s"} ${missing.join(", ")} to see final-year drives`,
    },
  ];
}

/** The code a failed rule is reported under. */
function ruleCode(result: RuleResult): EligibilityCode {
  if (result.reason === ACADEMIC_MISSING) return "MISSING_ACADEMIC_RECORD";
  switch (result.rule.ruleType) {
    case "BATCH_YEAR":
      return "WRONG_BATCH";
    case "CGPA":
      return "BELOW_CGPA";
    case "ACTIVE_BACKLOGS":
      return "ACTIVE_BACKLOG_LIMIT";
    default:
      return "CRITERIA_NOT_MET";
  }
}

/**
 * The eligibility pipeline — one function, the only one:
 *
 *   standing (approved, not placed, opted in)   stops here if it fails
 *   → department assigned                        stops here if it fails
 *   → application window open                   (when `window` is given)
 *   → batch (the drive's BATCH_YEAR rule)
 *   → final year: semester 7 or 8
 *   → required semester marks uploaded
 *   → every other rule of the drive (CGPA, backlogs, …)
 *
 * After department, every failure is reported, so a student sees everything
 * to fix at once; `eligible` is true only when nothing failed.
 */
export function evaluateEligibility(
  subject: EligibilitySubject,
  rules: EligibilityRuleInput[],
  options: {
    /** Whether the student's department is assigned to the drive. */
    departmentEligible?: boolean;
    /** The drive's application window now, when the caller decides on it. */
    window?: DriveStatus;
    now?: Date;
  } = {}
): EligibilityEvaluation {
  // Short-circuit: a student who fails standing is not evaluated further.
  const blockedBy = evaluateStanding(subject, options.departmentEligible ?? true);
  if (blockedBy) {
    return {
      eligible: false,
      blockedBy,
      codes: [STANDING_CODES[blockedBy]],
      requirements: [],
      results: [],
      reasons: [STANDING_REASONS[blockedBy]],
    };
  }

  const codes: EligibilityCode[] = [];
  const reasons: string[] = [];
  const fail = (code: EligibilityCode, reason: string) => {
    if (!codes.includes(code)) codes.push(code);
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (options.window === "upcoming") fail("APPLICATION_NOT_OPEN", WINDOW_REASONS.upcoming);
  if (options.window === "closed") fail("APPLICATION_CLOSED", WINDOW_REASONS.closed);

  // Batch first, then the final-year requirements, then everything else.
  const batchRules = rules.filter((rule) => rule.ruleType === "BATCH_YEAR");
  const otherRules = rules.filter((rule) => rule.ruleType !== "BATCH_YEAR");
  const batchResults = batchRules.map((rule) => evaluateRule(subject, rule));
  const requirements = evaluateFinalYearRequirements(subject, options.now);
  const otherResults = otherRules.map((rule) => evaluateRule(subject, rule));

  for (const result of batchResults) if (!result.passed) fail(ruleCode(result), result.reason!);
  for (const requirement of requirements) if (!requirement.passed) fail(requirement.code, requirement.reason!);
  // Several academic rules fail for the same missing record; said once.
  for (const result of otherResults) if (!result.passed) fail(ruleCode(result), result.reason!);

  return {
    eligible: codes.length === 0,
    blockedBy: null,
    codes,
    requirements,
    results: [...batchResults, ...otherResults],
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
      if (subject.expectedPassoutYear === null) {
        return fail(null, `Open to the ${description.replace(/^Batch /, "")} batch only — your batch is not on record`);
      }
      const value = String(subject.expectedPassoutYear);
      return rule.listValue.includes(value)
        ? pass(value)
        : fail(
            value,
            `Your batch (${batchLabel(subject.expectedPassoutYear)}) is not targeted by this drive — open to the ${description.replace(/^Batch /, "")} batch only`
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
