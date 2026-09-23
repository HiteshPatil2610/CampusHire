/**
 * A drive's dates: how a day typed into a form becomes a stored instant, and
 * the rules the three dates must satisfy.
 *
 * Pure and dependency-free, so the posting forms run exactly the checks the
 * server runs — the server's answer is the one that counts; the form only
 * shows it early.
 *
 * Days are India days. The forms submit a calendar day ("2026-10-01"); the
 * Application Start Date opens at the first instant of that day (00:00 IST),
 * the Application End Date closes at the last (23:59:59.999 IST), and the Next
 * Stage Date is the start of its day. Comparisons "today or later" and "after
 * the start date" are made on India calendar days, so a same-day start is
 * valid wherever the server happens to run.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The India calendar day an instant falls on, as "YYYY-MM-DD". */
export function indiaDay(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The calendar day a person picked in a date picker (local date parts, which
 * is the day they saw) as "YYYY-MM-DD". `toISOString()` must not be used for
 * this: in India it turns a picked day into the previous one.
 */
export function toDayInput(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The calendar day a submitted value names. A bare day is taken as written;
 * a full timestamp (older clients sent one) is read as the India day it falls
 * on. Null when the value is not a date at all.
 */
export function parseDay(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const match = value.trim().match(DAY_PATTERN);
    if (match) {
      const probe = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      return probe.toISOString().slice(0, 10) === value.trim() ? value.trim() : null;
    }
  }
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : indiaDay(instant);
}

function dayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/** 00:00:00.000 India time on that day — when applications open. */
export function startOfIndiaDay(day: string): Date {
  return dayStart(day);
}

/** 23:59:59.999 India time on that day — when applications close. */
export function endOfIndiaDay(day: string): Date {
  return new Date(dayStart(day).getTime() + DAY_MS - 1);
}

export interface DriveDatesInput {
  applicationStartDate: string | Date | null | undefined;
  applicationDeadline: string | Date | null | undefined;
  nextStageDate: string | Date | null | undefined;
}

export interface DriveDates {
  applicationStartDate: Date;
  applicationDeadline: Date;
  nextStageDate: Date;
}

export type DriveDateField = keyof DriveDatesInput;

export interface DriveDateIssue {
  field: DriveDateField;
  message: string;
}

export const DRIVE_DATE_MESSAGES = {
  startRequired: "Application start date is required",
  endRequired: "Application end date is required",
  nextStageRequired: "Next stage date is required",
  startInPast: "Application start date cannot be before today",
  endNotAfterStart: "Application end date must be after the start date",
  nextStageNotAfterEnd: "Next stage date must be after the application end date",
} as const;

export type DriveDatesDecision =
  | { ok: true; dates: DriveDates }
  | { ok: false; issues: DriveDateIssue[] };

/**
 * Judge a drive's three dates and turn them into stored instants.
 *
 *   start  >= today            (same day is valid)   — when `startNotBeforeToday`
 *   end    >  start            (a later day)
 *   next   >  end              (a later day)
 *
 * `startNotBeforeToday` is on for a new drive and whenever the start date is
 * being changed; it is off when an existing drive is edited and its start is
 * left alone — a drive that opened last week cannot be required to open
 * today. Every issue is reported, not just the first.
 */
export function validateDriveDates(
  input: DriveDatesInput,
  options: { now?: Date; startNotBeforeToday: boolean }
): DriveDatesDecision {
  const now = options.now ?? new Date();
  const issues: DriveDateIssue[] = [];

  const start = parseDay(input.applicationStartDate);
  const end = parseDay(input.applicationDeadline);
  const next = parseDay(input.nextStageDate);

  if (!start) issues.push({ field: "applicationStartDate", message: DRIVE_DATE_MESSAGES.startRequired });
  if (!end) issues.push({ field: "applicationDeadline", message: DRIVE_DATE_MESSAGES.endRequired });
  if (!next) issues.push({ field: "nextStageDate", message: DRIVE_DATE_MESSAGES.nextStageRequired });

  // "YYYY-MM-DD" strings compare in calendar order.
  if (start && options.startNotBeforeToday && start < indiaDay(now)) {
    issues.push({ field: "applicationStartDate", message: DRIVE_DATE_MESSAGES.startInPast });
  }
  if (start && end && end <= start) {
    issues.push({ field: "applicationDeadline", message: DRIVE_DATE_MESSAGES.endNotAfterStart });
  }
  if (end && next && next <= end) {
    issues.push({ field: "nextStageDate", message: DRIVE_DATE_MESSAGES.nextStageNotAfterEnd });
  }

  if (issues.length > 0 || !start || !end || !next) return { ok: false, issues };

  return {
    ok: true,
    dates: {
      applicationStartDate: startOfIndiaDay(start),
      applicationDeadline: endOfIndiaDay(end),
      nextStageDate: startOfIndiaDay(next),
    },
  };
}

/**
 * The same rules on dates that are already instants — a department's
 * resolved drive (the master's start with the department's own end or next
 * stage), before it is saved or published.
 */
export function checkStoredWindow(dates: DriveDates): DriveDateIssue[] {
  const issues: DriveDateIssue[] = [];
  const start = indiaDay(dates.applicationStartDate);
  const end = indiaDay(dates.applicationDeadline);
  const next = indiaDay(dates.nextStageDate);
  if (end <= start) issues.push({ field: "applicationDeadline", message: DRIVE_DATE_MESSAGES.endNotAfterStart });
  if (next <= end) issues.push({ field: "nextStageDate", message: DRIVE_DATE_MESSAGES.nextStageNotAfterEnd });
  return issues;
}

/** Whether a start instant differs from what is stored, by India day. */
export function startDayChanged(
  submitted: string | Date | null | undefined,
  stored: Date
): boolean {
  return parseDay(submitted) !== indiaDay(stored);
}
