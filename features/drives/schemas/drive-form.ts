import { z } from "zod";
import {
  applicationDeadlineField,
  applicationStartDateField,
  companyLogoUrlField,
  companyNameField,
  contactPersonField,
  contactPhoneField,
  driveDatesRefinement,
  maxActiveBacklogsField,
  minCGPAField,
  nextStageDateField,
  optionalText,
  optionalUrl,
  reportingTimeField,
  roleNameField,
  venueField,
} from "./drive-core";
import { DEPARTMENT_EDITABLE_FIELDS } from "../domain/drive-lifecycle";

/**
 * The drive form's schema — the one validation every drive-posting surface
 * goes through: the Super Admin's form, a department admin's form (post and
 * edit), and the server actions behind them (`postDrive` / `saveDrive`).
 *
 * It describes the *shape* of a submission. What a given role may send — a
 * department admin never picks departments, a central drive has recruitment
 * stages instead of selection rounds — is `checkDriveFormForRole`
 * (`domain/drive-form-rules.ts`), which the form and the server both run.
 *
 * `.strict()`: origin and ownership (`isCentralDrive`, `departmentId`,
 * `createdByUserId`, `lifecycleStatus`) are not fields of this form. They come
 * from the session, so a request carrying any of them is refused rather than
 * quietly stripped.
 */

export const DRIVE_FORM_MESSAGES = {
  packageRequired: "Package is required",
  packageInvalid: "Enter the package in LPA, e.g. 12.5",
  externalUrlRequired: "External application URL is required when students apply on the company's site",
  selectDepartment: "Select at least one department, or choose All departments",
} as const;

/**
 * Which departments a Super Admin's drive reaches. "ALL" is resolved on the
 * server to every active department when the drive is written; "SELECTED"
 * names them. A department admin's drive always reaches their own department
 * only — see `checkDriveFormForRole`.
 */
export const departmentScopeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("ALL") }).strict(),
  z
    .object({
      mode: z.literal("SELECTED"),
      departmentIds: z
        .array(z.string().min(1))
        .min(1, DRIVE_FORM_MESSAGES.selectDepartment)
        .max(50, "Too many departments"),
    })
    .strict(),
]);

export type DepartmentScope = z.infer<typeof departmentScopeSchema>;

const packageOfferedField = z
  .number({
    required_error: DRIVE_FORM_MESSAGES.packageRequired,
    invalid_type_error: DRIVE_FORM_MESSAGES.packageInvalid,
  })
  .positive("Package must be positive")
  .max(1000, "Package value seems unrealistic")
  // The column is NUMERIC(10,2) and would silently round a third decimal
  // place away. The epsilon is because the value arrives from parseFloat, so
  // 12.34 * 100 is 1233.9999999999998.
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
    "Package can have at most 2 decimal places"
  );

const numberField = (label: string) => ({
  required_error: `${label} is required`,
  invalid_type_error: `Enter a number for ${label.toLowerCase()}`,
});

export const driveFormObject = z
  .object({
    // Company & role
    companyName: companyNameField,
    roleName: roleNameField,
    companyLogoUrl: companyLogoUrlField,
    packageOffered: packageOfferedField,
    packageDisplay: optionalText(100, "Package text too long"),
    jobDescriptionUrl: optionalUrl("Invalid job description URL"),
    jobDescriptionText: optionalText(5000, "Job description too long"),
    requirements: optionalText(5000, "Requirements too long"),
    skills: z.array(z.string().trim().min(1).max(100)).max(40, "Too many skills").optional(),

    // Eligibility
    minCGPA: z.number(numberField("Minimum CGPA")).pipe(minCGPAField),
    maxActiveBacklogs: z.number(numberField("Max active backlogs")).pipe(maxActiveBacklogsField()),
    /** Passout years; each must be one students hold (checked by the action). */
    batchYears: z
      .array(z.string().regex(/^\d{4}$/, "Invalid batch year"))
      .max(10, "Too many batches")
      .default([]),

    // Dates, as calendar days — rules in `domain/drive-window.ts`.
    applicationStartDate: applicationStartDateField,
    applicationDeadline: applicationDeadlineField,
    nextStageDate: nextStageDateField,

    // How students apply
    applyMethod: z.enum(["IN_APP", "EXTERNAL"], { required_error: "Apply method is required" }),
    externalApplyUrl: optionalUrl("Invalid external application URL"),
    pptLink: optionalUrl("Invalid pre-placement talk URL"),

    // Logistics (department drives; each department sets its own for a central one)
    venue: venueField,
    reportingTime: reportingTimeField,
    contactPerson: contactPersonField,
    contactPhone: contactPhoneField,

    // ── Scope-specific; which role may send each is `checkDriveFormForRole` ──
    /** Super Admin only. Omitted means All departments. */
    departmentScope: departmentScopeSchema.optional(),
    /** Department drives: the selection rounds (its pipeline is built from them). */
    selectionRounds: z
      .array(z.string().trim().min(1, "Round name cannot be empty").max(100))
      .max(20, "Too many selection rounds")
      .optional(),
    /** Department drives: the application form, as the legacy JSON string. */
    applicationFields: z.string().max(100_000).optional(),
    /** Central drives: which content fields each department may override. */
    departmentEditableFields: z
      .array(z.enum(DEPARTMENT_EDITABLE_FIELDS))
      .max(DEPARTMENT_EDITABLE_FIELDS.length)
      .optional(),
    /** Central drives: the master pipeline, validated in full by the action. */
    recruitmentStages: z.array(z.unknown()).max(15).optional(),
  })
  .strict();

export const driveFormSchema = driveFormObject.superRefine((data, ctx) => {
  if (data.applyMethod === "EXTERNAL" && !data.externalApplyUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["externalApplyUrl"],
      message: DRIVE_FORM_MESSAGES.externalUrlRequired,
    });
  }
  driveDatesRefinement(data, ctx);
});

/** What a form sends. */
export type DriveFormInput = z.input<typeof driveFormSchema>;
/** What the server works with once it has parsed. */
export type DriveFormData = z.output<typeof driveFormSchema>;

/** Field → first message, for inline display. Keys are top-level field names. */
export type DriveFormFieldErrors = Partial<Record<string, string>>;

export function fieldErrorsOf(error: z.ZodError): DriveFormFieldErrors {
  const errors: DriveFormFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
