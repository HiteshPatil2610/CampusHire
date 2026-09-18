import { z } from "zod";
import {
  driveCoreShape,
  deadlineBeforeDriveDate,
  maxActiveBacklogsField,
} from "./drive-core";

/**
 * Department Drive Schema
 *
 * What a department admin submits when posting or editing their own
 * department's drive. Shares `driveCoreShape` with the central drive schema;
 * everything declared locally below is a field only this form has.
 *
 * Note `eligibleDepartments` is validated here but NOT trusted — the server
 * replaces it with the caller's own department in `createDrive`/`updateDrive`
 * via `resolveDeptAdminEligibleDepartments`.
 */
export const driveSchema = z
  .object({
    ...driveCoreShape,
    maxActiveBacklogs: maxActiveBacklogsField(),
    jobDescriptionUrl: z
      .string()
      .url("Invalid job description URL")
      .optional()
      .or(z.literal("")),
    packageOffered: z
      .number()
      .positive("Package must be positive")
      .max(1000, "Package value seems unrealistic")
      // The column is NUMERIC(10,2) and would silently round a third decimal
      // place away. Rejecting it here means what the admin typed is what gets
      // stored, or they are told why not. The epsilon is because the value
      // arrives from parseFloat, so 12.34 * 100 is 1233.9999999999998.
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
        "Package can have at most 2 decimal places"
      ),
    packageDisplay: z.string().max(100).optional(),
    selectionRounds: z
      .array(z.string().min(1, "Round name cannot be empty"))
      .min(1, "At least one selection round is required")
      .max(20, "Too many selection rounds"),
    applyMethod: z.enum(["IN_APP", "EXTERNAL"], {
      required_error: "Apply method is required",
    }),
    externalApplyUrl: z
      .string()
      .url("Invalid external URL")
      .optional()
      .or(z.literal("")),
    pptLink: z.string().url().optional().or(z.literal("")),
    // Application fields configuration (JSON string)
    applicationFields: z.string().optional(),
  })
  .refine(
    (data) => {
      // External URL required when apply method is EXTERNAL
      if (data.applyMethod === "EXTERNAL") {
        return !!data.externalApplyUrl && data.externalApplyUrl.length > 0;
      }
      return true;
    },
    {
      message:
        "External application URL is required when apply method is EXTERNAL",
      path: ["externalApplyUrl"],
    }
  )
  .refine(deadlineBeforeDriveDate.check, deadlineBeforeDriveDate.message);

export type DriveInput = z.infer<typeof driveSchema>;

/**
 * Drive Query/Filter Schema
 * Used for filtering drive lists
 */
export const driveFilterSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  status: z.enum(["open", "closed", "all"]).default("open"),
  search: z.string().optional(),
});

export type DriveFilter = z.infer<typeof driveFilterSchema>;
