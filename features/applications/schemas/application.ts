import { z } from "zod";

/**
 * Schema for applying to a drive
 */
export const applyToDriveSchema = z.object({
  driveId: z.string().cuid("Invalid drive ID format"),
  /**
   * Values the student reviewed and possibly corrected in the submission
   * card, keyed by application-field key. Only editable keys are accepted;
   * institutional records are re-read server-side and never trusted here.
   */
  submittedDetails: z
    .record(z.string(), z.string().max(2000))
    .optional()
    .default({}),
  /**
   * The accuracy declaration must be ticked before an application is taken.
   * It is also the point at which the student accepts that the submission is
   * final — there is no edit and no withdrawal afterwards.
   */
  consent: z.boolean().optional().default(false),
});

export type ApplyToDriveInput = z.infer<typeof applyToDriveSchema>;

/**
 * Schema for a department admin advancing an application.
 *
 * Both `stage` and `status` are admin-owned — no student-facing path writes
 * either one.
 *
 * `WITHDRAWN` is deliberately absent. It still exists on the Prisma enum so
 * that any historical row carrying it keeps reading correctly, but it is no
 * longer a value anything can *write*: an application is final once submitted,
 * so there is no actor — student or admin — who may move one into it.
 */
export const updateApplicationStageSchema = z.object({
  applicationId: z.string().cuid("Invalid application ID"),
  stage: z.enum(["APPLIED", "APTITUDE", "INTERVIEW", "OFFER"]),
  status: z.enum(["IN_PROGRESS", "SELECTED", "REJECTED"]),
});

export type UpdateApplicationStageInput = z.infer<
  typeof updateApplicationStageSchema
>;

/**
 * Schema for pagination in application queries
 */
export const getApplicationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export type GetApplicationsInput = z.infer<typeof getApplicationsSchema>;
