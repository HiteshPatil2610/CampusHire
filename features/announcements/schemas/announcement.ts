import { z } from "zod";

/**
 * What an author may send. Everything about *scope* is re-decided
 * server-side from the session (see `manage-announcement.ts`): a department
 * admin's department and audience are never taken from here.
 */

const optionalDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date")
  .nullable()
  .optional();

export const saveAnnouncementSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(3, "Give the announcement a title").max(200),
  content: z.string().trim().min(3, "Write the announcement").max(10000),
  audience: z.enum(["STUDENTS", "ADMINS", "EVERYONE"]).default("STUDENTS"),
  /** Super Admin only; null is institution-wide. */
  departmentId: z.string().min(1).nullable().optional(),
  batchYears: z.array(z.number().int().min(1900).max(3000)).max(20).default([]),
  priority: z.enum(["INFO", "SUCCESS", "ACTION_REQUIRED", "WARNING", "URGENT"]).default("INFO"),
  publishAt: optionalDate,
  expiresAt: optionalDate,
  attachmentUrl: z.string().url().max(1000).nullable().optional(),
  attachmentName: z.string().trim().max(200).nullable().optional(),
});

export type SaveAnnouncementInput = z.input<typeof saveAnnouncementSchema>;

export const publishAnnouncementSchema = z.object({
  id: z.string().min(1),
  /** Future: schedule it. Omitted or past: publish now. */
  publishAt: optionalDate,
});

export const announcementIdSchema = z.object({ id: z.string().min(1) });

export type AnnouncementActionResult =
  | { success: true; id: string; message?: string }
  | { success: false; error: string };
