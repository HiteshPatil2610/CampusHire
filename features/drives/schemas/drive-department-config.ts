import { z } from "zod";
import { optionalUrl, optionalText } from "./drive-core";
import { eligibilityRuleSetSchema } from "../domain/eligibility-rule-schema";
import { applicationFormSchema } from "../domain/application-form-schema";

/**
 * A department's overrides of the master drive's content.
 *
 * Three states per field, and the distinction matters:
 *
 *   absent (undefined) — leave whatever is stored untouched
 *   null               — clear the override; inherit the master's value
 *   a value            — this department's own value
 *
 * A blank text input arrives as `""` and is normalised to `null`: a department
 * that empties its role-title box means "use the master's title", not "this
 * role has no title". Numbers are validated with the same bounds as the
 * master's fields so an override can never hold a value the master could not.
 */
const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const overrideText = (max: number, message: string) =>
  z.preprocess(blankToNull, z.string().trim().max(max, message).nullable()).optional();

const overrideDate = (message: string) =>
  z
    .preprocess(
      blankToNull,
      z
        .string()
        .refine((value) => !Number.isNaN(new Date(value).getTime()), message)
        .nullable()
    )
    .optional();

/** A tag list. An empty list clears the override, like a blank text box. */
const overrideList = (maxItems: number, message: string) =>
  z
    .preprocess(
      (value) => (Array.isArray(value) && value.length === 0 ? null : value),
      z.array(z.string().trim().min(1).max(100)).max(maxItems, message).nullable()
    )
    .optional();

export const departmentOverridesSchema = z.object({
  roleName: overrideText(200, "Role name too long"),
  jobDescriptionText: overrideText(5000, "Job description too long"),
  requirements: overrideText(5000, "Requirements too long"),
  skills: overrideList(40, "Too many skills"),
  driveDate: overrideDate("Invalid drive date"),
  applicationDeadline: overrideDate("Invalid application deadline"),
  selectionRounds: overrideList(20, "Too many selection rounds"),
  // Eligibility is deliberately not here. It is a rule set (`eligibilityRules`
  // below), and there must be exactly one way to set it — a CGPA override here
  // and a CGPA rule there could disagree.
});

export type DepartmentOverridesInput = z.infer<typeof departmentOverridesSchema>;

/**
 * What a department admin may set on a central drive. Everything here is
 * department-scoped — it never touches the Drive row the Super Admin owns.
 */
export const driveDepartmentConfigSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  // Optional here so an incomplete configuration can be saved as a draft and
  // finished later. Publishing requires both (see department-drive-readiness).
  venue: optionalText(300, "Venue text too long"),
  reportingTime: optionalText(120, "Reporting time text too long"),
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
  /**
   * This department's application form, in order, replacing its previous one
   * wholesale. Keys, permissions and labels are validated strictly — see
   * `applicationFormSchema`. Omit to leave the stored form untouched (the
   * panel omits it once the drive is published and the form is frozen).
   */
  fields: applicationFormSchema.optional(),
  overrides: departmentOverridesSchema.optional(),
  /**
   * This department's eligibility rule set, replacing its previous one
   * wholesale. A rule of a given type overrides the master's rules of that
   * type for this department; omit a type to inherit the master's. Omit the
   * whole field to leave the stored set untouched.
   */
  eligibilityRules: eligibilityRuleSetSchema.optional(),
});

/**
 * What a caller sends. `z.input`, not `z.infer`: fields the schema defaults
 * (a rule's empty `listValue`, say) are optional to the caller and filled in
 * by the schema, so the action's signature must not demand them.
 */
export type DriveDepartmentConfigInput = z.input<
  typeof driveDepartmentConfigSchema
>;
