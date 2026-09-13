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
  /** The accuracy declaration must be ticked before an application is taken. */
  consent: z.boolean().optional().default(false),
});

export type ApplyToDriveInput = z.infer<typeof applyToDriveSchema>;

/**
 * Schema for withdrawing an application
 */
export const withdrawApplicationSchema = z.object({
  driveId: z.string().cuid("Invalid drive ID format"),
});

export type WithdrawApplicationInput = z.infer<
  typeof withdrawApplicationSchema
>;

/**
 * Schema for pagination in application queries
 */
export const getApplicationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export type GetApplicationsInput = z.infer<typeof getApplicationsSchema>;
