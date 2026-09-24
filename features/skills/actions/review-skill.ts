"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { skillIdSchema, rejectSkillSchema } from "../schemas/skill";

/**
 * Approving or rejecting a skill a student typed (Item 3).
 *
 * APPROVE lists it for every student's autocomplete from this moment on;
 * nothing else changes — whoever already holds it keeps holding it, exactly
 * as before.
 *
 * REJECT deletes the `Skill` row outright. `StudentSkill.skillId` references
 * it `ON DELETE CASCADE`, so every profile that had picked it up loses that
 * entry in the same statement — "remove it from affected student profiles"
 * is the database doing the removal, not a second write this action could
 * forget. There is no REJECTED status to leave behind: the name is free to
 * be typed and reviewed again, from nothing.
 *
 * Authorization: any active department admin. The master list is one shared
 * catalogue, not owned by a single department, so review is not restricted
 * to the department the requesting student belongs to.
 */

export type ReviewSkillResult = { success: true; message: string } | { success: false; error: string };

function revalidateSkillViews() {
  revalidatePath("/admin-dashboard/skills");
}

export async function approveSkill(input: { skillId: string }): Promise<ReviewSkillResult> {
  try {
    const { user: reviewer } = await requireDepartmentAdmin();
    const validated = skillIdSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const skill = await prisma.skill.findUnique({ where: { id: validated.data.skillId } });
    if (!skill) return { success: false, error: "This skill request no longer exists." };
    if (skill.status !== "PENDING") {
      return { success: false, error: "This skill has already been reviewed." };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Compare-and-set: a concurrent approve/reject only lets one through.
      const claim = await tx.skill.updateMany({
        where: { id: skill.id, status: "PENDING" },
        data: { status: "APPROVED", approvedById: reviewer.id, approvedAt: now },
      });
      if (claim.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.APPROVE,
          entityType: AuditEntityType.SKILL,
          entityId: skill.id,
          metadata: { name: skill.name, skillType: skill.skillType },
        },
        reviewer.id
      );
    });

    revalidateSkillViews();
    return { success: true, message: `"${skill.name}" is now on the master list.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This skill was just reviewed by someone else." };
    }
    console.error("approveSkill error:", error);
    return { success: false, error: "Could not approve this skill. Please try again." };
  }
}

export async function rejectSkill(input: { skillId: string; reason?: string }): Promise<ReviewSkillResult> {
  try {
    const { user: reviewer } = await requireDepartmentAdmin();
    const validated = rejectSkillSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const skill = await prisma.skill.findUnique({
      where: { id: validated.data.skillId },
      include: { _count: { select: { studentSkills: true } } },
    });
    if (!skill) return { success: false, error: "This skill request no longer exists." };
    if (skill.status !== "PENDING") {
      return { success: false, error: "This skill has already been reviewed." };
    }

    const affected = skill._count.studentSkills;

    await prisma.$transaction(async (tx) => {
      // Audited before the delete, since nothing would be left to point the
      // audit row at afterwards; the skill's own id and name still identify it.
      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.REJECT,
          entityType: AuditEntityType.SKILL,
          entityId: skill.id,
          metadata: {
            name: skill.name,
            skillType: skill.skillType,
            reason: validated.data.reason || null,
            profilesAffected: affected,
          },
        },
        reviewer.id
      );

      // Refused only if it is still the same pending row — a concurrent
      // approve must not be quietly deleted out from under it.
      const claim = await tx.skill.deleteMany({ where: { id: skill.id, status: "PENDING" } });
      if (claim.count === 0) throw new Error("changed");
    });

    revalidateSkillViews();
    return {
      success: true,
      message:
        affected > 0
          ? `"${skill.name}" was rejected and removed from ${affected} student profile${affected === 1 ? "" : "s"}.`
          : `"${skill.name}" was rejected.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This skill was just reviewed by someone else." };
    }
    console.error("rejectSkill error:", error);
    return { success: false, error: "Could not reject this skill. Please try again." };
  }
}
