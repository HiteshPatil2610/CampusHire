"use client";

import DatePicker from "@/components/ui/date-picker";
import {
  toDayInput,
  validateDriveDates,
  type DriveDateField,
} from "../domain/drive-window";

/**
 * A drive's three dates — Application Start Date, Application End Date and
 * Next Stage Date — as one block every posting form uses.
 *
 * The inline messages come from `validateDriveDates`, the function the server
 * runs on submit, so the form never approves what the server refuses. The
 * values are calendar days ("YYYY-MM-DD"), taken from the picker's local date
 * parts: the day the admin picked is the day stored.
 */

export interface DriveDateValues {
  applicationStartDate: string;
  applicationDeadline: string;
  nextStageDate: string;
}

export const EMPTY_DRIVE_DATES: DriveDateValues = {
  applicationStartDate: "",
  applicationDeadline: "",
  nextStageDate: "",
};

/** A stored instant as the India day a form shows for it. */
export { indiaDay as dayOf } from "../domain/drive-window";

/** A "YYYY-MM-DD" day as a local Date for the picker, or null. */
function fromDay(day: string): Date | null {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/**
 * The problems with a set of dates, keyed by field — what the form shows and
 * whether it may submit. Empty fields are reported only when `requireAll`.
 */
export function driveDateIssues(
  values: DriveDateValues,
  options: { startNotBeforeToday: boolean; requireAll?: boolean }
): Partial<Record<DriveDateField, string>> {
  const decision = validateDriveDates(values, { startNotBeforeToday: options.startNotBeforeToday });
  const issues: Partial<Record<DriveDateField, string>> = {};
  if (decision.ok) return issues;
  for (const issue of decision.issues) {
    if (!options.requireAll && !values[issue.field]) continue;
    issues[issue.field] ??= issue.message;
  }
  return issues;
}

const LABELS: Record<DriveDateField, string> = {
  applicationStartDate: "Application Start Date",
  applicationDeadline: "Application End Date",
  nextStageDate: "Next Stage Date",
};

const HINTS: Record<DriveDateField, string> = {
  applicationStartDate: "Applications open at the start of this day. Today is allowed.",
  applicationDeadline: "Applications close at the end of this day.",
  nextStageDate: "The next round after applications, e.g. the aptitude test.",
};

export function DriveDateFields({
  values,
  onChange,
  startNotBeforeToday,
  disabled = false,
  showMissing = false,
}: {
  values: DriveDateValues;
  onChange: (values: DriveDateValues) => void;
  /** On for a new drive, and when an existing drive's start is being moved. */
  startNotBeforeToday: boolean;
  disabled?: boolean;
  /** After a submit attempt, also flag the fields left empty. */
  showMissing?: boolean;
}) {
  const issues = driveDateIssues(values, { startNotBeforeToday, requireAll: showMissing });
  const fields: DriveDateField[] = ["applicationStartDate", "applicationDeadline", "nextStageDate"];

  return (
    <div className="field-row" style={{ flexWrap: "wrap" }}>
      {fields.map((field) => (
        <div className="field" key={field} style={{ minWidth: 180 }}>
          <label>{LABELS[field]} *</label>
          <DatePicker
            value={fromDay(values[field])}
            onChange={(date) => onChange({ ...values, [field]: toDayInput(date) })}
            disabled={disabled}
          />
          {issues[field] ? (
            <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }} role="alert">
              {issues[field]}
            </p>
          ) : (
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              {HINTS[field]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
