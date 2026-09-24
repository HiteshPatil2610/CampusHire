"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchSkillsSchema, type SearchSkillsInput } from "../schemas/skill";

export interface SkillOption {
  id: string;
  name: string;
}

/**
 * The master list's autocomplete (Item 3): approved skills of the asked-for
 * type whose name contains the query, case-insensitively. An empty query
 * lists the first page alphabetically, so opening the field with nothing
 * typed still shows something to browse.
 *
 * Read-only, and only ever returns APPROVED names — a PENDING one is not
 * offered to other students until a Super Admin approves it, which is the
 * point of the review step.
 */
export async function searchSkills(input: SearchSkillsInput): Promise<SkillOption[]> {
  await requireStudent();
  const validated = searchSkillsSchema.parse(input);

  return prisma.skill.findMany({
    where: {
      status: "APPROVED",
      skillType: validated.skillType,
      ...(validated.query ? { name: { contains: validated.query, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true },
  });
}
