"use server";

import { afterStudentProfileSave } from "../domain/after-profile-save";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deliverNotificationSafely, departmentAdminRecipients } from "@/lib/notifications";
import { skillSchema, type SkillInput } from "../schemas/profile";
import { matchOrCreateSkill } from "@/features/skills/domain/match-or-create-skill";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Add a skill to a student's profile (Item 3).
 *
 * The name is matched against the master list — or, if nothing matches,
 * turned into a new PENDING entry — by `matchOrCreateSkill`, the one place
 * that decision is made; this action just does it inside the same
 * transaction as the student's own row, so "the skill is on their profile"
 * and "the skill exists" are never true one without the other. This
 * student's own department admins are told once per *new* pending entry,
 * however many students end up requesting the same unmatched name while it
 * waits — review happens in the admin panel, not the Super Admin's, even
 * though the list itself is shared institution-wide.
 */
export async function addSkill(input: SkillInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = skillSchema.parse(input);

    // Check for duplicate skill name (case-insensitive)
    const existingSkill = await prisma.studentSkill.findFirst({
      where: {
        studentId: student.id,
        skillName: {
          equals: validated.skillName,
          mode: "insensitive",
        },
      },
    });

    if (existingSkill) {
      return {
        success: false,
        error: "This skill is already in your profile",
      };
    }

    const { skill, createdNew } = await prisma.$transaction(async (tx) => {
      const matched = await matchOrCreateSkill(tx, {
        name: validated.skillName,
        skillType: validated.skillType,
        requestedByStudentId: student.id,
      });

      // The canonical spelling on the master entry, not necessarily what was
      // typed — so everyone who holds this skill shows the same text.
      await tx.studentSkill.create({
        data: {
          studentId: student.id,
          skillId: matched.skill.id,
          skillName: matched.skill.name,
          skillType: validated.skillType,
        },
      });

      return matched;
    });

    if (createdNew) {
      // Best-effort end to end, including resolving who to tell: a failure
      // here must never turn an already-written skill and profile entry into
      // a reported failure to save.
      await deliverNotificationSafely({
        event: "SKILL_PENDING_REVIEW",
        role: "DEPT_ADMIN",
        recipients: await departmentAdminRecipients(student.departmentId).catch(() => []),
        content: {
          title: "New skill awaiting review",
          message: `"${skill.name}" (${skill.skillType === "TECHNICAL" ? "Technical" : "Soft"}) was typed by a student and is not yet on the master list.`,
          actionUrl: "/admin-dashboard/skills",
        },
        // One notification per pending skill, ever — not per student who
        // types it while it waits.
        dedupeKey: `skill-pending:${skill.id}`,
        resourceType: "Skill",
        resourceId: skill.id,
      });
    }

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

    return { success: true };
  } catch (error) {
    console.error("Add skill error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to add skill. Please try again.",
    };
  }
}

/**
 * Remove a skill from student profile
 * Verifies ownership before deletion
 */
export async function removeSkill(skillId: string): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify skill belongs to this student
    const skill = await prisma.studentSkill.findUnique({
      where: { id: skillId },
    });

    if (!skill || skill.studentId !== student.id) {
      return {
        success: false,
        error: "Skill not found or you don't have permission to delete it",
      };
    }

    // Delete skill. Only the student's own entry — the master Skill row (and
    // anyone else who holds it) is untouched: removing your own use of a
    // skill is not a verdict on it.
    await prisma.studentSkill.delete({
      where: { id: skillId },
    });

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

    return { success: true };
  } catch (error) {
    console.error("Remove skill error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to remove skill. Please try again.",
    };
  }
}
