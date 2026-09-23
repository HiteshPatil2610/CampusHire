import { createHash } from "node:crypto";
import type { EntryType } from "@prisma/client";
import {
  applicationFormKey,
  enabledFields,
  type ApplicationFieldConfig,
  type ApplicationFormOrigin,
} from "@/features/drives/domain/application-form";
import { ruleSetKey, type EffectiveEligibilityRule } from "@/features/drives/domain/eligibility-rules";
import type { EligibilityEvaluation } from "@/features/drives/domain/eligibility-evaluator";

/**
 * The historical record of one application.
 *
 * Captured by `applyToDrive` in the same transaction as the application, from
 * the same values the server just used to decide: the student's record, the
 * rule set and its evaluation, the application form, the effective values
 * shown and submitted, the declaration accepted, and the drive content as
 * this department ran it. So an application can be explained later exactly
 * as it was judged — whatever changes afterwards to the drive, its rules, its
 * form, its batch targeting or the student's profile.
 *
 * Deliberately *not* captured: anything the form did not ask for (no date of
 * birth, gender or address unless the department put them on the form), and
 * no raw profile beyond the fields eligibility reads.
 *
 * Revisions: there is no drive revision table. The snapshot carries the
 * resolved content itself plus the instance's publish/lock timestamps and
 * `updatedAt`s, and three hashes (form, eligibility, drive content) so two
 * applications can be compared — "were these judged on the same rules?" —
 * without parsing payloads. That is the lightest thing that keeps history
 * reproducible; a revision framework would add nothing an application needs.
 *
 * Pure (hashing aside): the caller loads everything.
 */

/**
 * 1 — the original shape.
 * 2 — `student.batchYear` (whose meaning was never defined) replaced by
 *     `student.expectedPassoutYear`. Readers accept both; a version-1
 *     payload's `batchYear` is shown as recorded, never reinterpreted.
 */
export const SNAPSHOT_SCHEMA_VERSION = 2;

export interface SubmissionSnapshotInput {
  capturedAt: Date;
  student: {
    id: string;
    rollNumber: string | null;
    departmentId: string;
    departmentCode: string;
    expectedPassoutYear: number | null;
    entryType: EntryType;
  };
  /** The academic record eligibility was evaluated on. */
  academic: {
    currentCGPA: number;
    activeBacklogs: number;
    pastBacklogCount: number;
    tenthPercentage: number;
    twelfthPercentage: number | null;
    diplomaPercentage: number | null;
    currentSemester: number;
  };
  /** Skill names — what SKILL rules read. */
  skills: string[];
  placement: { activePlacementCount: number };
  eligibility: {
    rules: EffectiveEligibilityRule[];
    evaluation: EligibilityEvaluation;
  };
  form: { fields: ApplicationFieldConfig[]; origin: ApplicationFormOrigin };
  /** Every enabled field's value as the application recorded it. */
  displayedValues: Record<string, string>;
  /** The effective values of the enabled editable fields. */
  submittedDetails: Record<string, string>;
  consent: { acceptedAt: Date; declarationVersion: string };
  drive: {
    masterDriveId: string;
    masterUpdatedAt: Date;
    departmentDrive: {
      id: string;
      departmentId: string;
      status: string;
      publishedAt: Date | null;
      lockedAt: Date | null;
      updatedAt: Date;
    };
    /** The drive as this department's students saw it (resolved). */
    content: {
      companyName: string;
      roleName: string;
      packageDisplay: string | null;
      packageOffered: string;
      nextStageDate: Date;
      applicationDeadline: Date;
      applyMethod: string;
      jobDescriptionText: string | null;
      jobDescriptionUrl: string | null;
      requirements: string | null;
      skills: string | null;
      selectionRounds: string;
    };
  };
}

export interface BuiltSnapshot {
  schemaVersion: number;
  formHash: string;
  eligibilityHash: string;
  driveContentHash: string;
  payload: string;
}

/** JSON with object keys sorted, so equal content always hashes equally. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (inner && typeof inner === "object" && !Array.isArray(inner) && !(inner instanceof Date)) {
      return Object.fromEntries(
        Object.keys(inner as Record<string, unknown>)
          .sort()
          .map((key) => [key, (inner as Record<string, unknown>)[key]])
      );
    }
    return inner;
  });
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function buildSubmissionSnapshot(input: SubmissionSnapshotInput): BuiltSnapshot {
  const fields = enabledFields(input.form.fields);

  // The same canonical keys the lock comparisons use, so "same form" and
  // "same rules" mean one thing across publishing and history.
  const formHash = sha256(applicationFormKey(input.form.fields));
  const eligibilityHash = sha256(ruleSetKey(input.eligibility.rules));
  const driveContentHash = sha256(stableStringify(input.drive.content));

  const payload = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    origin: "SUBMISSION",
    capturedAt: input.capturedAt,
    student: input.student,
    academic: input.academic,
    skills: [...input.skills].sort(),
    placement: {
      // Always unplaced today — a placed student is refused — but recorded,
      // so the record states the fact rather than relying on the rule of the
      // day.
      activePlacementCount: input.placement.activePlacementCount,
      placed: input.placement.activePlacementCount > 0,
    },
    eligibility: {
      hash: eligibilityHash,
      eligible: input.eligibility.evaluation.eligible,
      // CGPA, backlogs and batch are in `academic` / `student`; the rules say
      // which of them mattered and what each demanded.
      rules: input.eligibility.rules.map((rule) => ({
        ruleType: rule.ruleType,
        operator: rule.operator,
        numberValue: rule.numberValue,
        listValue: rule.listValue,
        source: rule.source,
      })),
      // The drive's rules, then the final-year and marks requirements every
      // drive has (Item 8) — each as the student met it when they applied.
      results: [
        ...input.eligibility.evaluation.results,
        ...(input.eligibility.evaluation.requirements ?? []),
      ].map((result) => ({
        description: result.description,
        actual: result.actual,
        passed: result.passed,
      })),
    },
    form: {
      hash: formHash,
      origin: input.form.origin,
      fields: fields.map((field) => ({
        fieldKey: field.fieldKey,
        label: field.label,
        source: field.source,
        category: field.category,
        isRequired: field.isRequired,
        permission: field.permission,
        sortOrder: field.sortOrder,
      })),
    },
    application: {
      // Only the form's own fields — nothing else from the profile.
      values: Object.fromEntries(
        fields.map((field) => [field.fieldKey, input.displayedValues[field.fieldKey] ?? ""])
      ),
      submittedDetails: input.submittedDetails,
      consent: input.consent,
    },
    drive: {
      hash: driveContentHash,
      masterDriveId: input.drive.masterDriveId,
      masterUpdatedAt: input.drive.masterUpdatedAt,
      departmentDrive: input.drive.departmentDrive,
      content: input.drive.content,
    },
  };

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    formHash,
    eligibilityHash,
    driveContentHash,
    payload: stableStringify(payload),
  };
}

/**
 * A snapshot for an application submitted before snapshots existed, from only
 * what was recorded at submission. It states plainly what is unknown instead
 * of reconstructing it from today's drive — today's rules are not the rules
 * the student was judged on.
 */
export function buildBackfillSnapshot(application: {
  id: string;
  studentId: string;
  driveId: string;
  appliedAt: Date;
  snapshotCgpa: number | null;
  snapshotBacklogs: number | null;
  submittedDetails: string | null;
  consentAcceptedAt: Date | null;
}): Omit<BuiltSnapshot, "formHash" | "eligibilityHash" | "driveContentHash"> {
  let submittedDetails: unknown = null;
  if (application.submittedDetails) {
    try {
      submittedDetails = JSON.parse(application.submittedDetails);
    } catch {
      submittedDetails = null;
    }
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    payload: stableStringify({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      origin: "BACKFILL",
      recordedAt: application.appliedAt,
      student: { id: application.studentId },
      academic: {
        currentCGPA: application.snapshotCgpa,
        activeBacklogs: application.snapshotBacklogs,
      },
      application: {
        submittedDetails,
        consent: application.consentAcceptedAt
          ? { acceptedAt: application.consentAcceptedAt, declarationVersion: null }
          : null,
      },
      drive: { masterDriveId: application.driveId },
      notCaptured: [
        "eligibility rules and evaluation",
        "application form configuration",
        "drive content as published",
        "placement state",
        "batch",
      ],
    }),
  };
}

/**
 * What is known about how an application was submitted — from its snapshot
 * when it has one, otherwise from the inline columns every application has
 * carried since before snapshots existed. `origin` says which, so a reader
 * never mistakes a reconstruction for a record.
 */
export interface ApplicationRecord {
  origin: "SUBMISSION" | "BACKFILL" | "LEGACY_COLUMNS";
  schemaVersion: number | null;
  capturedAt: Date | null;
  hashes: { form: string | null; eligibility: string | null; driveContent: string | null };
  /** The parsed snapshot document; null for LEGACY_COLUMNS. */
  payload: Record<string, unknown> | null;
  /** Always available, from the inline columns. */
  legacy: {
    cgpa: number | null;
    backlogs: number | null;
    submittedDetails: Record<string, string> | null;
    consentAcceptedAt: Date | null;
  };
}

export function readApplicationRecord(application: {
  snapshotCgpa: number | null;
  snapshotBacklogs: number | null;
  submittedDetails: string | null;
  consentAcceptedAt: Date | null;
  snapshot: {
    origin: "SUBMISSION" | "BACKFILL";
    schemaVersion: number;
    capturedAt: Date;
    formHash: string | null;
    eligibilityHash: string | null;
    driveContentHash: string | null;
    payload: string;
  } | null;
}): ApplicationRecord {
  let submittedDetails: Record<string, string> | null = null;
  if (application.submittedDetails) {
    try {
      const parsed = JSON.parse(application.submittedDetails);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        submittedDetails = parsed as Record<string, string>;
      }
    } catch {
      submittedDetails = null;
    }
  }

  const legacy = {
    cgpa: application.snapshotCgpa,
    backlogs: application.snapshotBacklogs,
    submittedDetails,
    consentAcceptedAt: application.consentAcceptedAt,
  };

  const snapshot = application.snapshot;
  if (!snapshot) {
    return {
      origin: "LEGACY_COLUMNS",
      schemaVersion: null,
      capturedAt: null,
      hashes: { form: null, eligibility: null, driveContent: null },
      payload: null,
      legacy,
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(snapshot.payload) as Record<string, unknown>;
  } catch {
    // The CHECK constraint makes this unreachable for stored rows.
    payload = null;
  }

  return {
    origin: snapshot.origin,
    schemaVersion: snapshot.schemaVersion,
    capturedAt: snapshot.capturedAt,
    hashes: {
      form: snapshot.formHash,
      eligibility: snapshot.eligibilityHash,
      driveContent: snapshot.driveContentHash,
    },
    payload,
    legacy,
  };
}
