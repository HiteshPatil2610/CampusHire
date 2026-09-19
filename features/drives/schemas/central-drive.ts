import { z } from "zod";
import {
  driveCoreShape,
  deadlineBeforeDriveDate,
  maxActiveBacklogsField,
  optionalUrl,
} from "./drive-core";
import { eligibilityRuleSetSchema } from "../domain/eligibility-rule-schema";
import { DEPARTMENT_EDITABLE_FIELDS } from "../domain/drive-lifecycle";

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
    // Institution-level defaults each department may override.
    requirements: z
      .string()
      .max(5000, "Requirements too long")
      .optional()
      .or(z.literal("")),
    skills: z
      .array(z.string().trim().min(1).max(100))
      .max(40, "Too many skills")
      .optional(),
    /**
     * Master default eligibility rules beyond CGPA and backlogs — those two are
     * owned by the dedicated `minCGPA` / `maxActiveBacklogs` fields above, so
     * they are refused here rather than allowed to contradict them. Omit to
     * leave the drive's existing extra defaults untouched.
     */
    eligibilityRules: eligibilityRuleSetSchema
      .refine(
        (rules) =>
          !rules.some((rule) => rule.ruleType === "CGPA" || rule.ruleType === "ACTIVE_BACKLOGS"),
        "Set CGPA and backlog limits with their own fields, not as extra rules"
      )
      .optional(),
    /**
     * Which content fields each assigned department may override. Anything
     * not listed is locked to the master's value. Create only — changed later
     * through `setDepartmentEditPermissions`.
     */
    departmentEditableFields: z
      .array(z.enum(DEPARTMENT_EDITABLE_FIELDS))
      .max(DEPARTMENT_EDITABLE_FIELDS.length)
      .optional(),
    /**
     * The master recruitment pipeline, validated in full by
     * `validatePipelineStages` in the action. Create only — changed later
     * through `saveMasterPipeline`. Omit to build it from selection rounds.
     */
    recruitmentStages: z.array(z.unknown()).max(15).optional(),
  })
  .refine(deadlineBeforeDriveDate.check, deadlineBeforeDriveDate.message);

export type CreateCentralDriveInput = z.infer<typeof createCentralDriveSchema>;

export const updateCentralDriveSchema = createCentralDriveSchema;
export type UpdateCentralDriveInput = z.infer<typeof updateCentralDriveSchema>;
