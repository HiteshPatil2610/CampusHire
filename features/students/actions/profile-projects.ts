"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema, type ProjectInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
  projectId?: string;
}

/**
 * Add a new project to student profile
 */
export async function addProject(input: ProjectInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = projectSchema.parse(input);

    // Create project
    const project = await prisma.studentProject.create({
      data: {
        studentId: student.id,
        title: validated.title,
        description: validated.description,
        technologiesUsed: validated.technologiesUsed,
        projectUrl: validated.projectUrl || null,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
      },
    });

    return { success: true, projectId: project.id };
  } catch (error) {
    console.error("Add project error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to add project. Please try again.",
    };
  }
}

/**
 * Update an existing project
 * Verifies ownership before update
 */
export async function updateProject(
  projectId: string,
  input: ProjectInput
): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify project belongs to this student
    const project = await prisma.studentProject.findUnique({
      where: { id: projectId },
    });

    if (!project || project.studentId !== student.id) {
      return {
        success: false,
        error: "Project not found or you don't have permission to edit it",
      };
    }

    // Validate input
    const validated = projectSchema.parse(input);

    // Update project
    await prisma.studentProject.update({
      where: { id: projectId },
      data: {
        title: validated.title,
        description: validated.description,
        technologiesUsed: validated.technologiesUsed,
        projectUrl: validated.projectUrl || null,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
      },
    });

    return { success: true, projectId };
  } catch (error) {
    console.error("Update project error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update project. Please try again.",
    };
  }
}

/**
 * Remove a project from student profile
 * Verifies ownership before deletion
 */
export async function removeProject(projectId: string): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify project belongs to this student
    const project = await prisma.studentProject.findUnique({
      where: { id: projectId },
    });

    if (!project || project.studentId !== student.id) {
      return {
        success: false,
        error: "Project not found or you don't have permission to delete it",
      };
    }

    // Delete project
    await prisma.studentProject.delete({
      where: { id: projectId },
    });

    return { success: true };
  } catch (error) {
    console.error("Remove project error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to remove project. Please try again.",
    };
  }
}
