import { z } from "zod";

/**
 * Shared with `features/students/schemas/profile.ts`'s `skillSchema`: the
 * name shape both the student form and the master list's own CHECK
 * (`Skill_name_shape`) agree on, so a name the form accepts is never refused
 * by the database.
 */
export const SKILL_NAME_MAX = 60;

export const searchSkillsSchema = z.object({
  query: z.string().trim().max(SKILL_NAME_MAX).optional().default(""),
  skillType: z.enum(["TECHNICAL", "SOFT"]),
});

export type SearchSkillsInput = z.infer<typeof searchSkillsSchema>;

export const skillIdSchema = z.object({
  skillId: z.string().min(1, "Invalid skill"),
});

export const rejectSkillSchema = skillIdSchema.extend({
  reason: z.string().trim().max(500).optional(),
});
