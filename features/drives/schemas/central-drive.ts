import { z } from "zod";
import {
  driveCoreShape,
  deadlineBeforeDriveDate,
  maxActiveBacklogsField,
  optionalUrl,
} from "./drive-core";

/**
 * Central (master) Drive Schema
 *
 * A central drive is posted by the Super Admin and belongs to no single
 * department. It shares `driveCoreShape` with the department drive schema and
 * declares only what differs: the package is free text (the numeric column is
 * parsed from it server-side), the apply method is derived from whether a
 * company portal URL was given, and selection rounds / application fields are
 * configured after creation rather than on the form.
 */
export const createCentralDriveSchema = z
  .object({
    ...driveCoreShape,
    maxActiveBacklogs: maxActiveBacklogsField(0),
    packageDisplay: z
      .string()
      .min(1, "Package / CTC is required")
      .max(100, "Package text too long")
      .trim(),
    externalApplyUrl: optionalUrl("Invalid company portal URL"),
    pptLink: optionalUrl("Invalid pre-placement talk URL"),
    jobDescriptionText: z
      .string()
      .max(5000, "Job description too long")
      .optional()
      .or(z.literal("")),
  })
  .refine(deadlineBeforeDriveDate.check, deadlineBeforeDriveDate.message);

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
