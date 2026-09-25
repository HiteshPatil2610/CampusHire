"use client";

import { useMemo } from "react";
import {
  describeRule,
  resolveEligibilityRules,
  RULE_SPECS,
  RULE_TYPE_ORDER,
  type EligibilityOperator,
  type EligibilityRuleInput,
  type EligibilityRuleType,
} from "../domain/eligibility-rules";
import { eligibilityRuleSetSchema } from "../domain/eligibility-rule-schema";

/**
 * A department admin's eligibility rules for their own instance of a drive.
 *
 * Shows two things side by side: the rules that will actually apply to this
 * department's students (master defaults it inherits, plus its own), and the
 * department's own rules as an editable list. A department rule of a type
 * replaces the master's rules of that type for this department only.
 *
 * Validation runs through the exact zod schema the server uses, so the admin
 * sees the server's objection before saving — but the server re-validates, and
 * after publication refuses any change whatever this component shows.
 */

/** A rule as the form holds it: the value is still text being typed. */
export interface RuleDraft {
  key: string;
  ruleType: EligibilityRuleType;
  operator: EligibilityOperator;
  value: string;
}

const OPERATOR_TEXT: Record<EligibilityOperator, string> = {
  GTE: "at least",
  LTE: "at most",
  EQ: "exactly",
  IN: "one of",
  INCLUDES_ALL: "all of",
  INCLUDES_ANY: "any of",
};

const VALUE_HINT: Record<EligibilityRuleType, string> = {
  CGPA: "e.g. 7.5",
  ACTIVE_BACKLOGS: "e.g. 0",
  PAST_BACKLOGS: "e.g. 2",
  TENTH_PERCENTAGE: "e.g. 60",
  TWELFTH_PERCENTAGE: "e.g. 60",
  DIPLOMA_PERCENTAGE: "e.g. 60",
  PRE_COLLEGE_PERCENTAGE: "e.g. 60",
  CURRENT_SEMESTER: "1–8",
  BATCH_YEAR: "e.g. 2026, 2027",
  ENTRY_TYPE: "REGULAR, DIPLOMA",
  SKILL: "e.g. Java, SQL",
};

let draftCounter = 0;
const nextKey = () => `rule-${++draftCounter}`;

/** Stored or resolved rules → form drafts. */
export function toDrafts(rules: EligibilityRuleInput[]): RuleDraft[] {
  return rules.map((rule) => ({
    key: nextKey(),
    ruleType: rule.ruleType,
    operator: rule.operator,
    value:
      RULE_SPECS[rule.ruleType].value.kind === "number"
        ? String(rule.numberValue ?? "")
        : rule.listValue.join(", "),
  }));
}

/** Form drafts → rules, as the server receives them. */
export function fromDrafts(drafts: RuleDraft[]): EligibilityRuleInput[] {
  return drafts.map((draft) => {
    const numeric = RULE_SPECS[draft.ruleType].value.kind === "number";
    return {
      ruleType: draft.ruleType,
      operator: draft.operator,
      numberValue: numeric && draft.value.trim() !== "" ? Number(draft.value) : null,
      listValue: numeric
        ? []
        : draft.value
            .split(",")
            .map((item) =>
              draft.ruleType === "ENTRY_TYPE" ? item.trim().toUpperCase() : item.trim()
            )
            .filter(Boolean),
    };
  });
}

export function EligibilityRulesEditor({
  masterRules,
  drafts,
  onChange,
  locked,
  departmentCode,
}: {
  /** The master's defaults, legacy columns already folded in. */
  masterRules: EligibilityRuleInput[];
  drafts: RuleDraft[];
  onChange: (drafts: RuleDraft[]) => void;
  locked: boolean;
  departmentCode: string;
}) {
  const parsed = useMemo(() => eligibilityRuleSetSchema.safeParse(fromDrafts(drafts)), [drafts]);
  const issues = parsed.success
    ? []
    : [...new Set(parsed.error.errors.map((error) => error.message))];

  // What students of this department are judged against, from the live form.
  const effective = useMemo(
    () =>
      resolveEligibilityRules({
        masterRules,
        masterLegacy: null,
        departmentRules: fromDrafts(drafts).filter(
          (rule) => rule.numberValue !== null || rule.listValue.length > 0
        ),
        departmentLegacy: null,
      }),
    [masterRules, drafts]
  );

  function update(key: string, patch: Partial<RuleDraft>) {
    onChange(
      drafts.map((draft) => {
        if (draft.key !== key) return draft;
        const next = { ...draft, ...patch };
        // Changing the type resets the operator to one that type allows.
        if (patch.ruleType && !RULE_SPECS[patch.ruleType].operators.includes(next.operator)) {
          next.operator = RULE_SPECS[patch.ruleType].operators[0];
        }
        if (patch.ruleType) next.value = "";
        return next;
      })
    );
  }

  function add() {
    const used = new Set(drafts.map((draft) => draft.ruleType));
    const ruleType = RULE_TYPE_ORDER.find((type) => !used.has(type)) ?? "CGPA";
    onChange([
      ...drafts,
      { key: nextKey(), ruleType, operator: RULE_SPECS[ruleType].operators[0], value: "" },
    ]);
  }

  const fieldStyle: React.CSSProperties = {
    padding: "7px 10px",
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-2)",
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* What applies */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          Rules applied to {departmentCode} students
        </div>
        {effective.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 12 }}>
            No eligibility rules — every assigned student qualifies.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {effective.map((rule) => (
              <span
                key={`${rule.ruleType}:${rule.operator}`}
                className={`badge ${rule.source === "DEPARTMENT" ? "badge-purple" : "badge-gray"}`}
                style={{ fontSize: 11 }}
                title={
                  rule.source === "DEPARTMENT"
                    ? `${departmentCode} rule`
                    : "Inherited from the Super Admin's master drive"
                }
              >
                {describeRule(rule)}
                {rule.source === "MASTER" ? " · inherited" : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* This department's own rules */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {departmentCode} rules{" "}
          <span className="text-muted" style={{ fontWeight: 400 }}>
            — a rule here replaces the master&apos;s rules of the same type
          </span>
        </div>

        {drafts.length === 0 && (
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            None — {departmentCode} inherits every master rule.
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {drafts.map((draft) => {
            const spec = RULE_SPECS[draft.ruleType];
            return (
              <div
                key={draft.key}
                style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
              >
                <select
                  style={fieldStyle}
                  value={draft.ruleType}
                  disabled={locked}
                  onChange={(e) =>
                    update(draft.key, { ruleType: e.target.value as EligibilityRuleType })
                  }
                  aria-label="Rule type"
                >
                  {RULE_TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>
                      {RULE_SPECS[type].label}
                    </option>
                  ))}
                </select>

                <select
                  style={fieldStyle}
                  value={draft.operator}
                  disabled={locked || spec.operators.length === 1}
                  onChange={(e) =>
                    update(draft.key, { operator: e.target.value as EligibilityOperator })
                  }
                  aria-label="Operator"
                >
                  {spec.operators.map((operator) => (
                    <option key={operator} value={operator}>
                      {OPERATOR_TEXT[operator]}
                    </option>
                  ))}
                </select>

                <input
                  style={{ ...fieldStyle, flex: 1, minWidth: 140 }}
                  value={draft.value}
                  placeholder={VALUE_HINT[draft.ruleType]}
                  inputMode={spec.value.kind === "number" ? "decimal" : "text"}
                  disabled={locked}
                  onChange={(e) => update(draft.key, { value: e.target.value })}
                  aria-label="Value"
                />

                {!locked && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => onChange(drafts.filter((item) => item.key !== draft.key))}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!locked && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12, marginTop: 10 }}
            onClick={add}
            disabled={drafts.length >= 20}
          >
            ＋ Add rule
          </button>
        )}

        {issues.length > 0 && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--red)" }}>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
