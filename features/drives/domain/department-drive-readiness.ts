import type { DepartmentDriveStatus, MasterDriveStatus } from "@prisma/client";
import { applicationFormSchema } from "./application-form-schema";
import { enabledFields, type ApplicationFieldConfig } from "./application-form";
import { eligibilityRuleSetSchema } from "./eligibility-rule-schema";
import type { EligibilityRuleInput } from "./eligibility-rules";
import { BATCH_TARGETING_REQUIRED, targetedBatchYears } from "./batch-targeting";
import { validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import { checkStoredWindow } from "./drive-window";

/**
 * How far a department admin's configuration of a department drive has got,
 * step by step — and whether it may be published.
 *
 * One function answers both questions on purpose. The wizard shows these
 * steps (and opens at the first incomplete one), and `publishDepartmentDrive`
 * refuses to publish unless `ready` — computed on the server from what is
 * stored, never from the client's checklist.
 *
 * Every input is the *resolved* configuration — the same values the student
 * pages resolve — so "complete" means "complete as a student would see it".
 *
 * Pure: no database, no session.
 */

export const DEPARTMENT_DRIVE_STEPS = [
  { id: "details", label: "Drive details" },
  { id: "fields", label: "Student auto-fill fields" },
  { id: "eligibility", label: "Eligibility criteria" },
  { id: "batches", label: "Eligible batches" },
  { id: "pipeline", label: "Recruitment stages" },
  { id: "preview", label: "Student preview" },
  { id: "publish", label: "Publish" },
] as const;

export type DepartmentDriveStepId = (typeof DEPARTMENT_DRIVE_STEPS)[number]["id"];

export interface ReadinessInput {
  now: Date;
  master: {
    lifecycleStatus: MasterDriveStatus;
    jobDescriptionUrl: string | null;
  };
  /** Whether the drive's eligibility edge to this department exists. */
  assigned: boolean;
  instance: {
    status: DepartmentDriveStatus;
    lockedAt: Date | null;
    venue: string | null;
    reportingTime: string | null;
  } | null;
  resolved: {
    roleName: string;
    jobDescriptionText: string | null;
    applicationStartDate: Date;
    nextStageDate: Date;
    applicationDeadline: Date;
    eligibilityRules: EligibilityRuleInput[];
  };
  form: ApplicationFieldConfig[];
  /** The stages applicants will go through: the active version, or the master's. */
  pipelineStages: unknown;
}

export interface ReadinessStep {
  id: DepartmentDriveStepId;
  label: string;
  complete: boolean;
  issues: string[];
}

export interface DepartmentDriveReadiness {
  steps: ReadinessStep[];
  /** Everything that stops publishing, across all steps. */
  issues: string[];
  ready: boolean;
  /** Where to continue: the first step that is not complete. */
  resumeAt: DepartmentDriveStepId;
  published: boolean;
}

const blank = (value: string | null | undefined) => !value || value.trim() === "";
const validDate = (value: Date) => value instanceof Date && !Number.isNaN(value.getTime());

export function departmentDriveReadiness(input: ReadinessInput): DepartmentDriveReadiness {
  const { resolved, instance, now } = input;
  const issues: Record<DepartmentDriveStepId, string[]> = {
    details: [],
    fields: [],
    eligibility: [],
    batches: [],
    pipeline: [],
    preview: [],
    publish: [],
  };

  // 1. Drive details — the content students read, and the logistics.
  if (blank(resolved.roleName)) issues.details.push("Set the role.");
  if (blank(resolved.jobDescriptionText) && blank(input.master.jobDescriptionUrl)) {
    issues.details.push("Add a job description.");
  }
  if (!validDate(resolved.nextStageDate)) issues.details.push("Set a valid next stage date.");
  if (!validDate(resolved.applicationDeadline)) {
    issues.details.push("Set a valid application end date.");
  } else {
    if (resolved.applicationDeadline <= now) {
      issues.details.push("The application end date has already passed. Set a later one.");
    }
    // End after start, next stage after end — the rule every form uses.
    if (validDate(resolved.nextStageDate) && validDate(resolved.applicationStartDate)) {
      for (const issue of checkStoredWindow(resolved)) issues.details.push(`${issue.message}.`);
    }
  }
  if (blank(instance?.venue)) issues.details.push("Set the venue.");
  if (blank(instance?.reportingTime)) issues.details.push("Set the reporting time.");

  // 2. Application form — at least one field, and a form the write boundary
  // would accept as it stands.
  if (enabledFields(input.form).length === 0) {
    issues.fields.push("Turn on at least one application field.");
  }
  const formCheck = applicationFormSchema.safeParse(
    input.form.map((field) => ({
      key: field.fieldKey,
      required: field.isRequired,
      enabled: field.isEnabled,
      permission: field.permission,
      label: field.label,
      description: field.description ?? undefined,
    }))
  );
  if (!formCheck.success) {
    issues.fields.push(formCheck.error.errors[0]?.message ?? "The application form is not valid.");
  }

  // 3. Eligibility — the effective rule set must be one the engine accepts.
  const rulesCheck = eligibilityRuleSetSchema.safeParse(resolved.eligibilityRules);
  if (!rulesCheck.success) {
    issues.eligibility.push(rulesCheck.error.errors[0]?.message ?? "The eligibility rules are not valid.");
  }

  // 4. Batches — a decision, never a default.
  const batches = targetedBatchYears(resolved.eligibilityRules);
  if (!batches) {
    issues.batches.push(BATCH_TARGETING_REQUIRED);
  } else if (batches.some((year) => !/^\d{4}$/.test(year))) {
    issues.batches.push("Every targeted batch must be a four-digit year.");
  }

  // 5. Recruitment stages.
  const pipeline = validatePipelineStages(input.pipelineStages);
  if (!pipeline.ok) {
    issues.pipeline.push(...pipeline.errors.map((error) => `Recruitment stages: ${error}.`));
  }

  // 7. Publish — the assignment and the lifecycle.
  const published = Boolean(instance?.lockedAt);
  if (!instance || !input.assigned) {
    issues.publish.push("This drive is not assigned to your department.");
  } else if (published) {
    issues.publish.push("This drive is already published.");
  } else if (instance.status !== "ASSIGNED" && instance.status !== "CONFIGURED") {
    issues.publish.push(`A ${instance.status.toLowerCase()} drive cannot be published.`);
  }
  if (input.master.lifecycleStatus === "ARCHIVED" || input.master.lifecycleStatus === "CANCELLED") {
    issues.publish.push(
      `This drive has been ${input.master.lifecycleStatus.toLowerCase()} by the Super Admin.`
    );
  }

  // 6. The preview has nothing of its own to fill in: it is complete once
  // everything it shows is.
  const contentIssues = [
    ...issues.details,
    ...issues.fields,
    ...issues.eligibility,
    ...issues.batches,
    ...issues.pipeline,
  ];
  if (contentIssues.length > 0) {
    issues.preview.push("Complete the steps above to see exactly what students will see.");
  }

  const steps = DEPARTMENT_DRIVE_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    // Published is the finished state of the last step, not an issue with it.
    complete:
      step.id === "publish" ? published : issues[step.id].length === 0,
    issues: issues[step.id],
  }));

  const blocking = [...contentIssues, ...issues.publish];

  return {
    steps,
    issues: blocking,
    ready: blocking.length === 0,
    resumeAt: steps.find((step) => !step.complete)?.id ?? "publish",
    published,
  };
}
