import { z } from "zod";
import { DRIVE_DATE_MESSAGES, validateDriveDates } from "../domain/drive-window";

/**
 * Field constraints the drive forms are built from.
 *
 * The drive form's schema (`drive-form.ts`) composes these; the department
 * drive configuration (`drive-department-config.ts`) reuses the URL and text
 * helpers. One definition each, so a rule cannot drift between forms.
 */

/**
 * The URL inputs let admins type a bare host ("careers.acme.com/apply").
 * Add the scheme before validation so that isn't rejected as malformed.
 *
 * Previously duplicated verbatim in `central-drive.ts` and
 * `drive-department-config.ts`.
 */
export const optionalUrl = (message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;

      const trimmed = value.trim();
      if (trimmed === "") return "";

      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    },
    z.string().url(message).optional().or(z.literal(""))
  );

export const optionalText = (max: number, message: string) =>
  z.string().max(max, message).trim().optional().or(z.literal(""));

/** Identity of the recruiting company and the role being offered. */
export const companyNameField = z
  .string()
  .min(1, "Company name is required")
  .max(200, "Company name too long")
  .trim();

export const roleNameField = z
  .string()
  .min(1, "Role name is required")
  .max(200, "Role name too long")
  .trim();

/**
 * Blob URL returned by /api/admin/drives/logo. Optional — drive cards fall
 * back to a text tile built from the company name.
 */
export const companyLogoUrlField = z.string().url("Invalid logo URL").nullish();

/** Academic gates. These are the only eligibility rules the model has today. */
export const minCGPAField = z
  .number()
  .min(0, "CGPA cannot be negative")
  .max(10, "CGPA cannot exceed 10");

export const maxActiveBacklogsField = () =>
  z
    .number()
    .int("Backlogs must be a whole number")
    .min(0, "Backlogs cannot be negative")
    .max(10, "Backlogs limit seems unrealistic");

/**
 * The three dates, as calendar days ("2026-10-01"). Their rules — end after
 * start, next stage after end, start not before today — live in
 * `domain/drive-window.ts`; see `driveDatesRefinement` below.
 */
export const applicationStartDateField = z.string().min(1, DRIVE_DATE_MESSAGES.startRequired);
export const applicationDeadlineField = z.string().min(1, DRIVE_DATE_MESSAGES.endRequired);
export const nextStageDateField = z.string().min(1, DRIVE_DATE_MESSAGES.nextStageRequired);

/** Logistics shown to students. Optional. */
export const venueField = z.string().max(500).optional();
export const reportingTimeField = z.string().max(100).optional();
export const contactPersonField = z.string().max(200).optional();
export const contactPhoneField = z.string().max(50).optional();

/**
 * The order of a drive's dates — end after start, next stage after end —
 * as a refinement, reporting each problem on its own field. "Start not before
 * today" depends on whether the start is being set now (a new drive, or an
 * edit that moves it), which a schema cannot know, so the actions and the form
 * apply `validateDriveDates` with that decision; the schema never lets a
 * mis-ordered window through regardless.
 */
export function driveDatesRefinement(
  data: { applicationStartDate: string; applicationDeadline: string; nextStageDate: string },
  ctx: z.RefinementCtx
): void {
  const decision = validateDriveDates(data, { startNotBeforeToday: false });
  if (decision.ok) return;
  for (const issue of decision.issues) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
  }
}
