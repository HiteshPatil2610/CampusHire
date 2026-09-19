import type { Prisma } from "@prisma/client";
import type { EligibilityRuleInput } from "./eligibility-rules";

/**
 * Writing eligibility rules. Every function takes the caller's transaction, so
 * a rule set is always written in the same transaction as the drive or
 * instance it belongs to — never half a set, never a set without its owner.
 */

const LEGACY_TYPES = ["CGPA", "ACTIVE_BACKLOGS"] as const;

function toRows(rules: EligibilityRuleInput[]) {
  return rules.map((rule) => ({
    ruleType: rule.ruleType,
    operator: rule.operator,
    numberValue: rule.numberValue,
    listValue: rule.listValue,
  }));
}

/**
 * Write a master drive's default rules.
 *
 * `legacy` is always the CGPA + ACTIVE_BACKLOGS pair from the drive form's two
 * dedicated fields, so those two rules and the legacy columns are written by
 * the same call and cannot drift. `extras` are any further master defaults:
 * when given they replace every other master rule; when omitted (a form that
 * does not manage them) the existing extras are left exactly as they are.
 */
export async function writeMasterRules(
  tx: Prisma.TransactionClient,
  driveId: string,
  legacy: EligibilityRuleInput[],
  extras?: EligibilityRuleInput[]
): Promise<void> {
  await tx.driveEligibilityRule.deleteMany({
    where: extras
      ? { driveId }
      : { driveId, ruleType: { in: [...LEGACY_TYPES] } },
  });

  const rules = [...legacy, ...(extras ?? [])];
  if (rules.length > 0) {
    await tx.driveEligibilityRule.createMany({
      data: toRows(rules).map((row) => ({ ...row, driveId })),
    });
  }
}

/** Replace one department instance's whole rule set. */
export async function writeDepartmentRules(
  tx: Prisma.TransactionClient,
  driveDepartmentConfigId: string,
  rules: EligibilityRuleInput[]
): Promise<void> {
  await tx.driveEligibilityRule.deleteMany({ where: { driveDepartmentConfigId } });

  if (rules.length > 0) {
    await tx.driveEligibilityRule.createMany({
      data: toRows(rules).map((row) => ({ ...row, driveDepartmentConfigId })),
    });
  }
}

/** The master's rules other than the two the form's dedicated fields own. */
export function masterExtraRules(rules: EligibilityRuleInput[]): EligibilityRuleInput[] {
  return rules.filter(
    (rule) => !(LEGACY_TYPES as readonly string[]).includes(rule.ruleType)
  );
}
