import type {
  EligibilityOperator,
  EligibilityRuleType,
  EntryType,
} from "@prisma/client";

/**
 * The drive eligibility rule catalogue.
 *
 * Every rule type here is backed by a column the Student model actually has;
 * nothing is evaluated that the schema cannot answer. Each type has a fixed set
 * of operators and exactly one kind of value, so "CGPA ≤ 7" or "skills ≥ 3"
 * cannot even be expressed — the catalogue is the grammar.
 *
 *   type                     student column                       operators
 *   CGPA                     StudentAcademic.currentCGPA          ≥
 *   ACTIVE_BACKLOGS          StudentAcademic.activeBacklogs       ≤
 *   PAST_BACKLOGS            StudentAcademic.pastBacklogCount     ≤
 *   TENTH_PERCENTAGE         StudentAcademic.tenthPercentage      ≥
 *   TWELFTH_PERCENTAGE       StudentAcademic.twelfthPercentage    ≥   (NULL for diploma)
 *   DIPLOMA_PERCENTAGE       StudentAcademic.diplomaPercentage    ≥   (NULL for regular)
 *   PRE_COLLEGE_PERCENTAGE   12th or diploma, by entry type       ≥
 *   CURRENT_SEMESTER         StudentAcademic.currentSemester      ≥ ≤ =
 *   BATCH_YEAR               Student.batchYear                    in
 *   ENTRY_TYPE               Student.entryType                    in
 *   SKILL                    StudentSkill.skillName               all of / any of
 *
 * Deliberately absent: gender (the column exists, but gender-gated eligibility
 * is a policy decision, not a technical one) and per-semester SGPA (marks carry
 * a verification flag, and whether unverified marks count is unsettled).
 * Department is not a rule at all — it decides *whose* rule set applies.
 */

export type { EligibilityRuleType, EligibilityOperator };

/** A rule as stored and as submitted: the columns of `DriveEligibilityRule`. */
export interface EligibilityRuleInput {
  ruleType: EligibilityRuleType;
  operator: EligibilityOperator;
  numberValue: number | null;
  listValue: string[];
}

/** A rule after master/department resolution, knowing where it came from. */
export interface EffectiveEligibilityRule extends EligibilityRuleInput {
  source: "MASTER" | "DEPARTMENT";
}

type NumberValueSpec = {
  kind: "number";
  min: number;
  max: number;
  integer?: boolean;
  /** Maximum decimal places — CGPA and percentages are recorded to 2. */
  decimals?: number;
};

type ListValueSpec = {
  kind: "list";
  item: "year" | "entryType" | "skill";
  maxItems: number;
};

export interface RuleSpec {
  label: string;
  operators: readonly EligibilityOperator[];
  value: NumberValueSpec | ListValueSpec;
  /** Needs the student's academic record to be evaluated at all. */
  needsAcademic: boolean;
}

export const ENTRY_TYPES: readonly EntryType[] = ["REGULAR", "DIPLOMA"];

const percentage: NumberValueSpec = { kind: "number", min: 0, max: 100, decimals: 2 };
const backlogs: NumberValueSpec = { kind: "number", min: 0, max: 20, integer: true };

export const RULE_SPECS: Record<EligibilityRuleType, RuleSpec> = {
  CGPA: {
    label: "CGPA",
    operators: ["GTE"],
    value: { kind: "number", min: 0, max: 10, decimals: 2 },
    needsAcademic: true,
  },
  ACTIVE_BACKLOGS: {
    label: "Active backlogs",
    operators: ["LTE"],
    value: backlogs,
    needsAcademic: true,
  },
  PAST_BACKLOGS: {
    label: "Past backlogs",
    operators: ["LTE"],
    value: backlogs,
    needsAcademic: true,
  },
  TENTH_PERCENTAGE: {
    label: "10th percentage",
    operators: ["GTE"],
    value: percentage,
    needsAcademic: true,
  },
  TWELFTH_PERCENTAGE: {
    label: "12th percentage",
    operators: ["GTE"],
    value: percentage,
    needsAcademic: true,
  },
  DIPLOMA_PERCENTAGE: {
    label: "Diploma percentage",
    operators: ["GTE"],
    value: percentage,
    needsAcademic: true,
  },
  PRE_COLLEGE_PERCENTAGE: {
    label: "12th / Diploma percentage",
    operators: ["GTE"],
    value: percentage,
    needsAcademic: true,
  },
  CURRENT_SEMESTER: {
    label: "Current semester",
    operators: ["GTE", "LTE", "EQ"],
    value: { kind: "number", min: 1, max: 8, integer: true },
    needsAcademic: true,
  },
  BATCH_YEAR: {
    label: "Batch year",
    operators: ["IN"],
    value: { kind: "list", item: "year", maxItems: 10 },
    needsAcademic: false,
  },
  ENTRY_TYPE: {
    label: "Entry type",
    operators: ["IN"],
    value: { kind: "list", item: "entryType", maxItems: 2 },
    needsAcademic: false,
  },
  SKILL: {
    label: "Skills",
    operators: ["INCLUDES_ALL", "INCLUDES_ANY"],
    value: { kind: "list", item: "skill", maxItems: 20 },
    needsAcademic: false,
  },
};

/** Display order: the order rules appear in the catalogue above. */
export const RULE_TYPE_ORDER = Object.keys(RULE_SPECS) as EligibilityRuleType[];

// ---------------------------------------------------------------------------
// Master defaults, department overrides, and the legacy columns
// ---------------------------------------------------------------------------

/** The pre-rules eligibility columns, kept as mirrors during the migration. */
export interface LegacyEligibilityColumns {
  minCGPA: number | null;
  maxActiveBacklogs: number | null;
}

/**
 * Supply the CGPA / ACTIVE_BACKLOGS rules from the legacy columns when no
 * stored rule of that type exists.
 *
 * Compatibility during the migration, and nothing more: the backfill writes
 * these rules for every existing drive and the write paths dual-write them, so
 * after the migration this adds nothing. It exists so a drive that somehow has
 * no stored rule still gets exactly its pre-migration bar instead of none.
 * A stored rule always wins over its column. Remove with the legacy columns.
 */
export function withLegacyRules(
  stored: EligibilityRuleInput[],
  legacy: LegacyEligibilityColumns | null
): EligibilityRuleInput[] {
  if (!legacy) return stored;

  const types = new Set(stored.map((rule) => rule.ruleType));
  const rules = [...stored];

  if (!types.has("CGPA") && legacy.minCGPA !== null) {
    rules.push({ ruleType: "CGPA", operator: "GTE", numberValue: legacy.minCGPA, listValue: [] });
  }
  if (!types.has("ACTIVE_BACKLOGS") && legacy.maxActiveBacklogs !== null) {
    rules.push({
      ruleType: "ACTIVE_BACKLOGS",
      operator: "LTE",
      numberValue: legacy.maxActiveBacklogs,
      listValue: [],
    });
  }

  return rules;
}

/**
 * The rules that apply to one department's students.
 *
 * Override is **per rule type**, matching how every other department override
 * works: if the department sets any rule of a type, the master's rules of that
 * type do not apply to it; every other master rule is inherited. So a
 * department raising the CGPA bar keeps the master's 10th-percentage rule, and
 * a department's semester range (GTE + LTE) replaces the master's range as a
 * whole rather than being half-merged with it.
 *
 * The student's department is the input here — a rule set is always resolved
 * *for* a department, never globally.
 */
export function resolveEligibilityRules(params: {
  masterRules: EligibilityRuleInput[];
  masterLegacy: LegacyEligibilityColumns | null;
  departmentRules: EligibilityRuleInput[];
  departmentLegacy: LegacyEligibilityColumns | null;
}): EffectiveEligibilityRule[] {
  const master = withLegacyRules(params.masterRules, params.masterLegacy);
  const department = withLegacyRules(params.departmentRules, params.departmentLegacy);

  const overriddenTypes = new Set(department.map((rule) => rule.ruleType));

  const effective: EffectiveEligibilityRule[] = [
    ...master
      .filter((rule) => !overriddenTypes.has(rule.ruleType))
      .map((rule) => ({ ...pickRule(rule), source: "MASTER" as const })),
    ...department.map((rule) => ({ ...pickRule(rule), source: "DEPARTMENT" as const })),
  ];

  return effective.sort(
    (a, b) =>
      RULE_TYPE_ORDER.indexOf(a.ruleType) - RULE_TYPE_ORDER.indexOf(b.ruleType) ||
      a.operator.localeCompare(b.operator)
  );
}

/** Strip a stored row down to the rule itself (no ids, owners or timestamps). */
function pickRule(rule: EligibilityRuleInput): EligibilityRuleInput {
  return {
    ruleType: rule.ruleType,
    operator: rule.operator,
    numberValue: rule.numberValue,
    listValue: [...rule.listValue],
  };
}

/**
 * The legacy column values a rule set implies, for dual-writing the mirrors.
 * `null` means "no rule of that type", which for an instance means inherit.
 */
export function legacyColumnsFromRules(
  rules: EligibilityRuleInput[]
): LegacyEligibilityColumns {
  const cgpa = rules.find((rule) => rule.ruleType === "CGPA" && rule.operator === "GTE");
  const backlogs = rules.find(
    (rule) => rule.ruleType === "ACTIVE_BACKLOGS" && rule.operator === "LTE"
  );

  return {
    minCGPA: cgpa?.numberValue ?? null,
    maxActiveBacklogs: backlogs?.numberValue ?? null,
  };
}

/** Master CGPA and backlog rules from the form's two dedicated fields. */
export function legacyMasterRules(
  minCGPA: number,
  maxActiveBacklogs: number
): EligibilityRuleInput[] {
  return [
    { ruleType: "CGPA", operator: "GTE", numberValue: minCGPA, listValue: [] },
    {
      ruleType: "ACTIVE_BACKLOGS",
      operator: "LTE",
      numberValue: maxActiveBacklogs,
      listValue: [],
    },
  ];
}

/**
 * A rule set as one comparable string: order-independent, and with list
 * values sorted case-insensitively, since "Java, SQL" and "sql, java" are the
 * same requirement. Used to decide whether a locked set is being changed.
 */
export function ruleSetKey(rules: EligibilityRuleInput[]): string {
  return JSON.stringify(
    rules
      .map((rule) => ({
        t: rule.ruleType,
        o: rule.operator,
        n: rule.numberValue,
        l: [...rule.listValue]
          .map((item) => item.trim().toLowerCase())
          .sort(),
      }))
      .sort((a, b) => `${a.t}:${a.o}`.localeCompare(`${b.t}:${b.o}`))
  );
}

// ---------------------------------------------------------------------------
// Human-readable text
// ---------------------------------------------------------------------------

const ENTRY_TYPE_TEXT: Record<string, string> = {
  REGULAR: "Regular entry",
  DIPLOMA: "Lateral (diploma) entry",
};

/** A rule as a student or admin reads it: "CGPA ≥ 7.5". */
export function describeRule(rule: EligibilityRuleInput): string {
  const spec = RULE_SPECS[rule.ruleType];
  const n = rule.numberValue;
  const list = rule.listValue;

  switch (rule.ruleType) {
    case "CGPA":
      return `CGPA ≥ ${n}`;
    case "ACTIVE_BACKLOGS":
      return n === 0 ? "No active backlogs" : `At most ${n} active backlog${n === 1 ? "" : "s"}`;
    case "PAST_BACKLOGS":
      return n === 0 ? "No past backlogs" : `At most ${n} past backlog${n === 1 ? "" : "s"}`;
    case "TENTH_PERCENTAGE":
    case "TWELFTH_PERCENTAGE":
    case "DIPLOMA_PERCENTAGE":
    case "PRE_COLLEGE_PERCENTAGE":
      return `${spec.label} ≥ ${n}%`;
    case "CURRENT_SEMESTER":
      return rule.operator === "GTE"
        ? `Semester ${n} or later`
        : rule.operator === "LTE"
          ? `Semester ${n} or earlier`
          : `Semester ${n}`;
    case "BATCH_YEAR":
      return list.length === 1 ? `Batch of ${list[0]}` : `Batch of ${list.join(", ")}`;
    case "ENTRY_TYPE":
      return list.length === 1
        ? `${ENTRY_TYPE_TEXT[list[0]] ?? list[0]} only`
        : list.map((item) => ENTRY_TYPE_TEXT[item] ?? item).join(" or ");
    case "SKILL":
      return rule.operator === "INCLUDES_ALL"
        ? `Skills: all of ${list.join(", ")}`
        : `Skills: any of ${list.join(", ")}`;
  }
}
