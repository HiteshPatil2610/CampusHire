import {
  enabledFields,
  isCustomKey,
  type ApplicationFieldConfig,
} from "@/features/drives/domain/application-form";

/**
 * Server-side validation of an application submission.
 *
 * The expected form is reconstructed from the database — the department's
 * resolved form and the student's own profile — and the submission is judged
 * against that. The browser's copy of the form is never consulted, so a
 * tampered client cannot skip a required field, write to a read-only one, or
 * add a field the department never asked for.
 *
 * Per enabled field:
 *  - EDITABLE: the submitted value if the student sent one, otherwise their
 *    profile value (what the review card pre-fills). A value the student
 *    actually typed must be well-formed for its type.
 *  - READ_ONLY: always the profile value. Anything submitted for it is
 *    ignored — the applicant cannot restate a registrar record.
 *  - Required: the effective value must be non-empty. For a read-only field
 *    that means the profile must already have it, so the student is told to
 *    fix their profile rather than being let through with a blank.
 *
 * Keys that are not an enabled editable field of this form are dropped.
 *
 * Pure: the caller loads the form and profile; this only decides.
 */

const URL_KEYS = new Set(["linkedin", "github", "portfolio"]);
const EMAIL_KEYS = new Set(["email", "personalEmail"]);
const PHONE_KEYS = new Set(["phone"]);

const MAX_PROFILE_FIELD_LENGTH = 2000;
const MAX_CUSTOM_ANSWER_LENGTH = 1000;

export type SubmissionValidation =
  | {
      ok: true;
      /**
       * The effective value of every enabled editable field — what the
       * student submitted for this form, frozen onto the application.
       */
      submittedDetails: Record<string, string>;
    }
  | { ok: false; errors: string[] };

function formatError(key: string, label: string, value: string): string | null {
  if (URL_KEYS.has(key)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      return `${label} must be a full http(s) link`;
    }
  }

  if (EMAIL_KEYS.has(key) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${label} must be a valid email address`;
  }

  if (PHONE_KEYS.has(key) && !/^\+?[\d\s\-()]{7,20}$/.test(value)) {
    return `${label} must be a valid phone number`;
  }

  const max = isCustomKey(key) ? MAX_CUSTOM_ANSWER_LENGTH : MAX_PROFILE_FIELD_LENGTH;
  if (value.length > max) {
    return `${label} can be at most ${max} characters`;
  }

  return null;
}

export function validateApplicationSubmission(params: {
  form: ApplicationFieldConfig[];
  profileValues: Record<string, string>;
  submitted: Record<string, unknown>;
}): SubmissionValidation {
  const { form, profileValues, submitted } = params;

  const errors: string[] = [];
  const submittedDetails: Record<string, string> = {};

  for (const field of enabledFields(form)) {
    const key = field.fieldKey;
    const profileValue = (profileValues[key] ?? "").trim();

    if (field.permission === "READ_ONLY") {
      if (field.isRequired && !profileValue) {
        errors.push(`${field.label} is required — add it to your profile first`);
      }
      continue;
    }

    const sent = Object.prototype.hasOwnProperty.call(submitted, key);
    const raw = sent ? submitted[key] : undefined;

    if (sent && typeof raw !== "string") {
      errors.push(`${field.label} must be text`);
      continue;
    }

    const value = sent ? (raw as string).trim() : profileValue;

    // Only a value the student actually typed is format-checked. A profile
    // value was validated when the profile was saved, and must not block an
    // application because its format predates a rule.
    if (sent && value && value !== profileValue) {
      const problem = formatError(key, field.label, value);
      if (problem) {
        errors.push(problem);
        continue;
      }
    }

    if (field.isRequired && !value) {
      errors.push(`${field.label} is required`);
      continue;
    }

    if (value) submittedDetails[key] = value;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, submittedDetails };
}
