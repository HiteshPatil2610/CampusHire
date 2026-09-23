import type { EligibilityRuleInput } from "./eligibility-rules";

/**
 * Batch targeting — which batches a department drive is open to.
 *
 * It is not a separate store: it is the `BATCH_YEAR IN (…)` eligibility rule
 * on `Student.expectedPassoutYear`, evaluated by the one evaluator like every other
 * rule. These helpers only read and write that rule, so the picker, the
 * publish check and the evaluator can never disagree about what "targeted"
 * means.
 *
 * Years are never hard-coded: the picker offers the batch years the
 * department's students actually have (`getDepartmentCentralDrives`).
 */

/** The batch years a rule set targets, or null when it targets none. */
export function targetedBatchYears(rules: EligibilityRuleInput[]): string[] | null {
  const rule = rules.find((candidate) => candidate.ruleType === "BATCH_YEAR");
  if (!rule || rule.listValue.length === 0) return null;
  return [...rule.listValue].sort();
}

/** The rule set with its batch targeting replaced (or removed, for none). */
export function withTargetedBatchYears(
  rules: EligibilityRuleInput[],
  years: string[]
): EligibilityRuleInput[] {
  const others = rules.filter((rule) => rule.ruleType !== "BATCH_YEAR");
  const unique = [...new Set(years.map((year) => year.trim()).filter(Boolean))].sort();
  if (unique.length === 0) return others;
  return [
    ...others,
    { ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: unique },
  ];
}

export const BATCH_TARGETING_REQUIRED =
  "Select the batches this drive is open to before publishing it.";

/**
 * Which selected batches are not offered: a batch can be targeted only if
 * students actually hold that passout year (`present`), or if the drive
 * already targeted it (`alreadyTargeted`) — so an existing drive stays
 * editable even after its last student of a batch has moved on. Years are
 * never typed in or hard-coded. Returns the refused years; empty means valid.
 */
export function unavailableBatchYears(
  selected: string[],
  present: number[],
  alreadyTargeted: string[] | null = null
): string[] {
  const allowed = new Set([...present.map(String), ...(alreadyTargeted ?? [])]);
  return [...new Set(selected)].filter((year) => !allowed.has(year)).sort();
}

export function unavailableBatchMessage(years: string[]): string {
  return `No student is in batch ${years.join(", ")} — choose from the batches your students are in.`;
}
