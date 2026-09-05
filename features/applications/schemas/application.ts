import { z } from "zod";

/**
 * Schema for applying to a drive
 */
export const applyToDriveSchema = z.object({
  driveId: z.string().cuid("Invalid drive ID format"),
});

export type ApplyToDriveInput = z.infer<typeof applyToDriveSchema>;

/**
 * Schema for pagination in application queries
 */
export const getApplicationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export type GetApplicationsInput = z.infer<typeof getApplicationsSchema>;
