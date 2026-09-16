import { z } from "zod";

/** A student switching their own placement participation on or off. */
export const setMyOptInSchema = z.object({
  optedIn: z.boolean(),
});

export type SetMyOptInInput = z.infer<typeof setMyOptInSchema>;

/**
 * A department admin setting a student's participation, and optionally
 * locking it so the student can no longer change it themselves.
 */
export const setStudentOptInSchema = z.object({
  studentId: z.string().cuid("Invalid student ID"),
  optedIn: z.boolean(),
  locked: z.boolean(),
});

export type SetStudentOptInInput = z.infer<typeof setStudentOptInSchema>;
