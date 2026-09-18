import { z } from "zod";

/**
 * Field constraints shared by every drive form.
 *
 * A department drive and a central drive are validated by two schemas because
 * they genuinely take different input — a department drive carries selection
 * rounds and a numeric package, a central drive derives its apply method from
 * a portal URL. What they share was previously copied between the two files,
 * so a rule changed in one silently diverged from the other. It lives here now
 * and both schemas compose it.
 *
 * Every message is the one both schemas already used, so no existing form's
 * validation output changes.
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

/**
 * @param defaultValue omit to make the field required (the department drive
 * form asks for it explicitly); pass 0 to default it (the central drive modal
 * does not show the input).
 */
export const maxActiveBacklogsField = (defaultValue?: number) => {
  const base = z
    .number()
    .int("Backlogs must be a whole number")
    .min(0, "Backlogs cannot be negative")
    .max(10, "Backlogs limit seems unrealistic");

  return defaultValue === undefined ? base : base.default(defaultValue);
};

export const driveDateField = z.string().min(1, "Drive date is required");
export const applicationDeadlineField = z
  .string()
  .min(1, "Application deadline is required");

/**
 * Which departments the master drive is open to. For a department drive the
 * server overrides whatever arrives here with the caller's own department —
 * see `resolveDeptAdminEligibleDepartments`.
 */
export const eligibleDepartmentsField = z
  .array(z.string().min(1))
  .min(1, "At least one eligible department is required")
  .max(50, "Too many departments");

/** Logistics shown to students. Optional on both forms. */
export const venueField = z.string().max(500).optional();
export const reportingTimeField = z.string().max(100).optional();
export const contactPersonField = z.string().max(200).optional();
export const contactPhoneField = z.string().max(50).optional();

/**
 * The fields both drive schemas define identically. Spread into each schema's
 * own `z.object({ ... })` alongside the fields that differ.
 */
export const driveCoreShape = {
  companyName: companyNameField,
  roleName: roleNameField,
  companyLogoUrl: companyLogoUrlField,
  minCGPA: minCGPAField,
  driveDate: driveDateField,
  applicationDeadline: applicationDeadlineField,
  eligibleDepartments: eligibleDepartmentsField,
  venue: venueField,
  reportingTime: reportingTimeField,
  contactPerson: contactPersonField,
  contactPhone: contactPhoneField,
} as const;

/**
 * A drive's application window must close before the drive is held. Applied as
 * a `.refine` by both schemas, with the message they already shared.
 */
export const deadlineBeforeDriveDate = {
  check: (data: { driveDate: string; applicationDeadline: string }) => {
    const driveDate = new Date(data.driveDate);
    const deadline = new Date(data.applicationDeadline);

    // An unparseable date yields NaN, and every comparison against NaN is
    // false — so a malformed value fails this check rather than passing it.
    if (Number.isNaN(driveDate.getTime()) || Number.isNaN(deadline.getTime())) {
      return false;
    }

    return deadline < driveDate;
  },
  message: {
    message: "Application deadline must be before the drive date",
    path: ["applicationDeadline"],
  },
};
