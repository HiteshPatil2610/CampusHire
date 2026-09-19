import { z } from "zod";
import {
  ENTRY_TYPES,
  RULE_SPECS,
  type EligibilityRuleInput,
} from "./eligibility-rules";

/**
 * Validation for eligibility rules at the write boundary.
 *
 * Strict by design, because a malformed rule does not fail loudly later — it
 * silently admits or excludes students. Every check here is on the rule's
 * *shape*; nothing about a student is ever read from the request. Eligibility
 * values always come from the student's own server-side records.
 *
 * Per rule:
 *  - the operator must be one the catalogue allows for that type
 *  - exactly one value kind is set, and it is the kind the type takes
 *  - numbers are within the type's bounds, integral where required, and
 *    carry no more decimals than the column records
 *  - list items are valid for the type (real years, real entry types,
 *    non-empty skill names), de-duplicated, and within the size limit
 *
 * Per set:
 *  - one rule per (type, operator)
 *  - a semester range is coherent (GTE ≤ LTE; EQ never combined with a bound)
 */

const EPSILON = 1e-9;

function decimalsOk(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < EPSILON;
}

const ruleShape = z.object({
  ruleType: z.enum(Object.keys(RULE_SPECS) as [keyof typeof RULE_SPECS, ...(keyof typeof RULE_SPECS)[]]),
  operator: z.enum(["GTE", "LTE", "EQ", "IN", "INCLUDES_ALL", "INCLUDES_ANY"]),
  numberValue: z.number().finite().nullable().optional().default(null),
  listValue: z.array(z.string()).optional().default([]),
});

export const eligibilityRuleSchema = ruleShape
  .superRefine((rule, ctx) => {
    const spec = RULE_SPECS[rule.ruleType];
    const issue = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (!spec.operators.includes(rule.operator)) {
      issue(
        `${spec.label} rules allow ${spec.operators.join(" / ")}, not ${rule.operator}`,
        "operator"
      );
      return;
    }

    const value = spec.value;

    if (value.kind === "number") {
      if (rule.numberValue === null) {
        issue(`${spec.label} needs a number`, "numberValue");
        return;
      }
      if (rule.listValue.length > 0) {
        issue(`${spec.label} takes a number, not a list`, "listValue");
      }
      const n = rule.numberValue;
      if (n < value.min || n > value.max) {
        issue(`${spec.label} must be between ${value.min} and ${value.max}`, "numberValue");
      }
      if (value.integer && !Number.isInteger(n)) {
        issue(`${spec.label} must be a whole number`, "numberValue");
      }
      if (value.decimals !== undefined && !decimalsOk(n, value.decimals)) {
        issue(`${spec.label} can have at most ${value.decimals} decimal places`, "numberValue");
      }
      return;
    }

    // List-valued types.
    if (rule.numberValue !== null) {
      issue(`${spec.label} takes a list, not a number`, "numberValue");
    }

    const items = rule.listValue.map((item) => item.trim());

    if (items.length === 0 || items.some((item) => item === "")) {
      issue(`${spec.label} needs at least one non-empty value`, "listValue");
      return;
    }
    if (items.length > value.maxItems) {
      issue(`${spec.label} allows at most ${value.maxItems} values`, "listValue");
    }

    if (value.item === "year") {
      for (const item of items) {
        const year = Number(item);
        if (!/^\d{4}$/.test(item) || year < 2000 || year > 2100) {
          issue(`"${item}" is not a valid batch year`, "listValue");
        }
      }
    } else if (value.item === "entryType") {
      for (const item of items) {
        if (!ENTRY_TYPES.includes(item as never)) {
          issue(`"${item}" is not an entry type (REGULAR or DIPLOMA)`, "listValue");
        }
      }
    } else if (items.some((item) => item.length > 100)) {
      issue("A skill name can be at most 100 characters", "listValue");
    }

    const lowered = items.map((item) => item.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      issue(`${spec.label} lists the same value twice`, "listValue");
    }
  })
  .transform(
    (rule): EligibilityRuleInput => ({
      ruleType: rule.ruleType,
      operator: rule.operator,
      numberValue: RULE_SPECS[rule.ruleType].value.kind === "number" ? rule.numberValue : null,
      listValue:
        RULE_SPECS[rule.ruleType].value.kind === "list"
          ? rule.listValue.map((item) => item.trim())
          : [],
    })
  );

export const eligibilityRuleSetSchema = z
  .array(eligibilityRuleSchema)
  .max(20, "At most 20 eligibility rules")
  .superRefine((rules, ctx) => {
    const seen = new Set<string>();
    for (const rule of rules) {
      const key = `${rule.ruleType}:${rule.operator}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Only one ${RULE_SPECS[rule.ruleType].label} ${rule.operator} rule is allowed`,
        });
      }
      seen.add(key);
    }

    const semester = rules.filter((rule) => rule.ruleType === "CURRENT_SEMESTER");
    const eq = semester.find((rule) => rule.operator === "EQ");
    const gte = semester.find((rule) => rule.operator === "GTE");
    const lte = semester.find((rule) => rule.operator === "LTE");

    if (eq && (gte || lte)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An exact semester cannot be combined with a semester range",
      });
    }
    if (gte && lte && gte.numberValue! > lte.numberValue!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Semester range is empty: ${gte.numberValue} or later but ${lte.numberValue} or earlier`,
      });
    }
  });

export type EligibilityRuleSetInput = z.input<typeof eligibilityRuleSetSchema>;
