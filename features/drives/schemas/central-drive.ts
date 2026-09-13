import { z } from "zod";

/**
 * The URL inputs let admins type a bare host ("careers.acme.com/apply").
 * Add the scheme before validation so that isn't rejected as malformed.
 */
const optionalUrl = (message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;

      const trimmed = value.trim();
      if (trimmed === "") return "";

      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    },
    z.string().url(message).optional().or(z.literal(""))
  );

/**
 * Central Drive Schema
 *
 * A central drive is posted by the Super Admin and belongs to no single
 * department. It reuses the same field constraints as `driveSchema` but
 * omits departmentId (there is no owning department) and drops the fields a
 * department admin supplies during the full drive-creation flow
 * (selection rounds, apply method) — those are derived server-side.
 */
export const createCentralDriveSchema = z
  .object({
    companyName: z
      .string()
      .min(1, "Company name is required")
      .max(200, "Company name too long")
      .trim(),
    roleName: z
      .string()
      .min(1, "Role name is required")
      .max(200, "Role name too long")
      .trim(),
    packageDisplay: z
      .string()
      .min(1, "Package / CTC is required")
      .max(100, "Package text too long")
      .trim(),
    minCGPA: z
      .number()
      .min(0, "CGPA cannot be negative")
      .max(10, "CGPA cannot exceed 10"),
    maxActiveBacklogs: z
      .number()
      .int("Backlogs must be a whole number")
      .min(0, "Backlogs cannot be negative")
      .max(10, "Backlogs limit seems unrealistic")
      .default(0),
    driveDate: z.string().min(1, "Drive date is required"),
    applicationDeadline: z.string().min(1, "Application deadline is required"),
    externalApplyUrl: optionalUrl("Invalid company portal URL"),
    pptLink: optionalUrl("Invalid pre-placement talk URL"),
    jobDescriptionText: z
      .string()
      .max(5000, "Job description too long")
      .optional()
      .or(z.literal("")),
    eligibleDepartments: z
      .array(z.string().min(1))
      .min(1, "At least one eligible department is required")
      .max(50, "Too many departments"),
    venue: z.string().max(500).optional(),
    reportingTime: z.string().max(100).optional(),
    contactPerson: z.string().max(200).optional(),
    contactPhone: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      try {
        return new Date(data.applicationDeadline) < new Date(data.driveDate);
      } catch {
        return false;
      }
    },
    {
      message: "Application deadline must be before the drive date",
      path: ["applicationDeadline"],
    }
  );

export type CreateCentralDriveInput = z.infer<typeof createCentralDriveSchema>;

export const updateCentralDriveSchema = createCentralDriveSchema;
export type UpdateCentralDriveInput = z.infer<typeof updateCentralDriveSchema>;

/**
 * Payload for the post-creation "Application Fields Required" toggle panel.
 * Only enablement is editable here — whether a field is required is set
 * during drive configuration and preserved untouched.
 */
export const centralDriveApplicationFieldsSchema = z.object({
  driveId: z.string().min(1, "Drive ID is required"),
  fields: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        isEnabled: z.boolean(),
      })
    )
    .max(100, "Too many fields"),
});

export type CentralDriveApplicationFieldsInput = z.infer<
  typeof centralDriveApplicationFieldsSchema
>;
