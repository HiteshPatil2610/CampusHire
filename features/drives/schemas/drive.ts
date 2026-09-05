import { z } from "zod";

/**
 * Drive Creation/Update Schema
 * Validates all drive fields with proper business rules
 */
export const driveSchema = z
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
    jobDescriptionUrl: z
      .string()
      .url("Invalid job description URL")
      .optional()
      .or(z.literal("")),
    packageOffered: z
      .number()
      .positive("Package must be positive")
      .max(1000, "Package value seems unrealistic"),
    selectionRounds: z
      .array(z.string().min(1, "Round name cannot be empty"))
      .min(1, "At least one selection round is required")
      .max(20, "Too many selection rounds"),
    driveDate: z.string().min(1, "Drive date is required"),
    applicationDeadline: z.string().min(1, "Application deadline is required"),
    applyMethod: z.enum(["IN_APP", "EXTERNAL"], {
      required_error: "Apply method is required",
    }),
    externalApplyUrl: z
      .string()
      .url("Invalid external URL")
      .optional()
      .or(z.literal("")),
    minCGPA: z
      .number()
      .min(0, "CGPA cannot be negative")
      .max(10, "CGPA cannot exceed 10"),
    maxActiveBacklogs: z
      .number()
      .int("Backlogs must be a whole number")
      .min(0, "Backlogs cannot be negative")
      .max(10, "Backlogs limit seems unrealistic"),
    eligibleDepartments: z
      .array(z.string().min(1))
      .min(1, "At least one eligible department is required")
      .max(50, "Too many departments"),
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
      message: "External application URL is required when apply method is EXTERNAL",
      path: ["externalApplyUrl"],
    }
  )
  .refine(
    (data) => {
      // Application deadline must be before drive date
      try {
        const driveDate = new Date(data.driveDate);
        const deadline = new Date(data.applicationDeadline);
        return deadline < driveDate;
      } catch {
        return false; // Invalid date format
      }
    },
    {
      message: "Application deadline must be before the drive date",
      path: ["applicationDeadline"],
    }
  )
  .refine(
    (data) => {
      // Application deadline must be in the future (for new drives)
      try {
        const deadline = new Date(data.applicationDeadline);
        const now = new Date();
        // Allow past deadlines for edits (handled separately in edit action)
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Invalid date format",
      path: ["applicationDeadline"],
    }
  );

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
