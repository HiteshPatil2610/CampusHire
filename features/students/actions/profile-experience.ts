"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { experienceSchema, type ExperienceInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
  experienceId?: string;
}

/**
 * Add a new experience to student profile
 */
export async function addExperience(input: ExperienceInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = experienceSchema.parse(input);

    // Create experience
    const experience = await prisma.studentExperience.create({
      data: {
        studentId: student.id,
        companyName: validated.companyName,
        role: validated.role,
        description: validated.description,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
      },
    });

    return { success: true, experienceId: experience.id };
  } catch (error) {
    console.error("Add experience error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to add experience. Please try again.",
    };
  }
}

/**
 * Update an existing experience
 * Verifies ownership before update
 */
export async function updateExperience(
  experienceId: string,
  input: ExperienceInput
): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify experience belongs to this student
    const experience = await prisma.studentExperience.findUnique({
      where: { id: experienceId },
    });

    if (!experience || experience.studentId !== student.id) {
      return {
        success: false,
        error: "Experience not found or you don't have permission to edit it",
      };
    }

    // Validate input
    const validated = experienceSchema.parse(input);

    // Update experience
    await prisma.studentExperience.update({
      where: { id: experienceId },
      data: {
        companyName: validated.companyName,
        role: validated.role,
        description: validated.description,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
      },
    });

    return { success: true, experienceId };
  } catch (error) {
    console.error("Update experience error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update experience. Please try again.",
    };
  }
}

/**
 * Remove an experience from student profile
 * Verifies ownership before deletion
 */
export async function removeExperience(experienceId: string): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify experience belongs to this student
    const experience = await prisma.studentExperience.findUnique({
      where: { id: experienceId },
    });

    if (!experience || experience.studentId !== student.id) {
      return {
        success: false,
        error: "Experience not found or you don't have permission to delete it",
      };
    }

    // Delete experience
    await prisma.studentExperience.delete({
      where: { id: experienceId },
    });

    return { success: true };
  } catch (error) {
    console.error("Remove experience error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to remove experience. Please try again.",
    };
  }
}
