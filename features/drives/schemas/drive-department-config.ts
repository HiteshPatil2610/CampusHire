import { z } from "zod";

/**
 * The URL input lets admins type a bare host ("meet.google.com/xyz-abc-def").
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

const optionalText = (max: number, message: string) =>
  z.string().max(max, message).trim().optional().or(z.literal(""));

/**
 * What a department admin may set on a central drive. Everything here is
 * department-scoped — it never touches the Drive row the Super Admin owns.
 */
export const driveDepartmentConfigSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  venue: z
    .string()
    .min(1, "Drive venue is required")
    .max(300, "Venue text too long")
    .trim(),
  reportingTime: z
    .string()
    .min(1, "Reporting time is required")
    .max(120, "Reporting time text too long")
    .trim(),
  coordinatorName: optionalText(150, "Coordinator name too long"),
  coordinatorPhone: optionalText(30, "Phone number too long"),
  coordinatorEmail: z
    .string()
    .trim()
    .email("Invalid coordinator email")
    .max(200, "Email too long")
    .optional()
    .or(z.literal("")),
  seatingAllocation: optionalText(1000, "Seating breakdown too long"),
  pptLink: optionalUrl("Invalid pre-placement talk link"),
  specialInstructions: optionalText(2000, "Instructions too long"),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        required: z.boolean(),
      })
    )
    .max(60, "Too many application fields"),
});

export type DriveDepartmentConfigInput = z.infer<
  typeof driveDepartmentConfigSchema
>;
