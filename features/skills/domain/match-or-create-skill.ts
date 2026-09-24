import { Prisma, type Skill, type SkillType } from "@prisma/client";
import { normalizeSkillName } from "./normalize";

/**
 * The one place a student's typed skill becomes a master `Skill` row (Item 3).
 *
 *   exact match (case/edge-space-insensitive) on the list, any status → reuse it
 *   no match                                                          → create it PENDING
 *
 * A miss is attributed to the requesting student and is immediately usable —
 * their `StudentSkill` is created in the same transaction, so the skill shows
 * on their profile at once, tagged pending, exactly as Item 3 asks. There is
 * no separate "propose a new skill" step: typing one *is* proposing it.
 *
 * Two students requesting the same unmatched name at the same moment race on
 * `Skill_normalizedName_skillType_key`; the loser's insert fails with that
 * constraint, caught below and turned into an ordinary match — one Skill row
 * and one pending review either way, never two.
 */

type Db = Pick<Prisma.TransactionClient, "skill">;

export interface MatchOrCreateSkillResult {
  skill: Skill;
  /** True only for whichever call actually put the name on the list — the caller notifies on this, and only this. */
  createdNew: boolean;
}

export async function matchOrCreateSkill(
  tx: Db,
  input: { name: string; skillType: SkillType; requestedByStudentId: string }
): Promise<MatchOrCreateSkillResult> {
  const name = input.name.trim();
  const normalizedName = normalizeSkillName(name);

  const existing = await tx.skill.findUnique({
    where: { normalizedName_skillType: { normalizedName, skillType: input.skillType } },
  });
  if (existing) return { skill: existing, createdNew: false };

  try {
    const created = await tx.skill.create({
      data: {
        name,
        normalizedName,
        skillType: input.skillType,
        status: "PENDING",
        requestedByStudentId: input.requestedByStudentId,
      },
    });
    return { skill: created, createdNew: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Lost the race: someone else's identical request landed first.
      const winner = await tx.skill.findUniqueOrThrow({
        where: { normalizedName_skillType: { normalizedName, skillType: input.skillType } },
      });
      return { skill: winner, createdNew: false };
    }
    throw error;
  }
}
