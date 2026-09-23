import type { ApplicationRecord } from "../utils/application-snapshot";

/**
 * Reading a submission snapshot back.
 *
 * The snapshot is written once and never changed, so this is the only way to
 * see what a student actually submitted and what they were judged against at
 * the time — not what the drive's form or rules say today. That distinction is
 * the point of the record: a drive republished with a different rule set must
 * not rewrite the history of who was eligible under the old one.
 *
 * Pure, and deliberately defensive. The payload is JSON that was written by an
 * older version of this code and may be missing anything, so every field is
 * read through a narrowing helper and a malformed document degrades to "not
 * recorded" rather than throwing in a table row.
 */

export interface SubmissionAnswer {
  fieldKey: string;
  label: string;
  value: string;
  /** READ_ONLY values came from the profile; EDITABLE ones the student typed. */
  editable: boolean;
  required: boolean;
}

export interface SubmissionCriterion {
  description: string;
  actual: string | null;
  passed: boolean;
}

export interface SubmissionView {
  /**
   * SUBMISSION — recorded as it happened.
   * BACKFILL — reconstructed later from what was still known.
   * LEGACY_COLUMNS — no snapshot; only the inline CGPA/backlogs/answers.
   */
  origin: ApplicationRecord["origin"];
  capturedAt: Date | null;
  answers: SubmissionAnswer[];
  criteria: SubmissionCriterion[];
  academic: {
    cgpa: number | null;
    backlogs: number | null;
    /** Recorded by schema-2 snapshots. */
    expectedPassoutYear: number | null;
    /**
     * Recorded by schema-1 snapshots, when the column's meaning was
     * undefined. Shown as recorded, never read as a passout year.
     */
    legacyBatchYear: number | null;
  };
  consentAcceptedAt: Date | null;
  declarationVersion: string | null;
  /** Identifies the exact form and rule set in force, for a dispute. */
  hashes: ApplicationRecord["hashes"];
}

const obj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const date = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** A stored value as a person reads it: never "null", never "[object Object]". */
const display = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(display).filter((v) => v !== "—").join(", ") || "—";
  return "—";
};

export function readSubmissionView(record: ApplicationRecord): SubmissionView {
  const payload = obj(record.payload);
  const form = obj(payload?.form);
  const application = obj(payload?.application);
  const eligibility = obj(payload?.eligibility);
  const academic = obj(payload?.academic);
  const student = obj(payload?.student);
  const consent = obj(application?.consent);

  const values = obj(application?.values) ?? {};

  // The form as it was, in the order the student saw it. Without it there is
  // still the raw answers map — shown as-is rather than not at all.
  const fields = arr(form?.fields)
    .map(obj)
    .filter((field): field is Record<string, unknown> => field !== null);

  const answers: SubmissionAnswer[] = fields.length
    ? fields.map((field) => {
        const fieldKey = str(field.fieldKey) ?? "";
        return {
          fieldKey,
          label: str(field.label) ?? fieldKey,
          value: display(values[fieldKey]),
          editable: field.permission === "EDITABLE",
          required: field.isRequired === true,
        };
      })
    : Object.entries(record.legacy.submittedDetails ?? {}).map(([fieldKey, value]) => ({
        fieldKey,
        label: fieldKey,
        value: display(value),
        editable: true,
        required: false,
      }));

  const criteria: SubmissionCriterion[] = arr(eligibility?.results)
    .map(obj)
    .filter((result): result is Record<string, unknown> => result !== null)
    .map((result) => ({
      description: str(result.description) ?? "Criterion",
      actual: str(result.actual),
      passed: result.passed === true,
    }));

  return {
    origin: record.origin,
    capturedAt: record.capturedAt ?? date(payload?.capturedAt),
    answers,
    criteria,
    academic: {
      // The snapshot first, the inline columns as the fallback that always
      // exists — they are the only thing a LEGACY_COLUMNS record has.
      cgpa: num(academic?.currentCGPA) ?? record.legacy.cgpa,
      backlogs: num(academic?.activeBacklogs) ?? record.legacy.backlogs,
      expectedPassoutYear: num(student?.expectedPassoutYear),
      legacyBatchYear: num(student?.batchYear),
    },
    consentAcceptedAt: date(consent?.acceptedAt) ?? record.legacy.consentAcceptedAt,
    declarationVersion: str(consent?.declarationVersion),
    hashes: record.hashes,
  };
}

/** What to call this record in the UI, so a reconstruction is never mistaken for a record. */
export const ORIGIN_LABELS: Record<ApplicationRecord["origin"], string> = {
  SUBMISSION: "Recorded at submission",
  BACKFILL: "Reconstructed later",
  LEGACY_COLUMNS: "Before snapshots — partial record",
};
