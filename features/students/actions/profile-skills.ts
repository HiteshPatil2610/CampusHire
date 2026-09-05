"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { skillSchema, type SkillInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Add a new skill to student profile
 * Prevents duplicate skills via unique constraint
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

    // Add skill
    await prisma.studentSkill.create({
      data: {
        studentId: student.id,
        skillName: validated.skillName,
        skillType: validated.skillType,
      },
    });

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

    // Delete skill
    await prisma.studentSkill.delete({
      where: { id: skillId },
    });

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
