"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalInfoSchema, type PersonalInfoInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update student personal information
 */
export async function updatePersonalInfo(input: PersonalInfoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = personalInfoSchema.parse(input);

    // Update student record
    await prisma.student.update({
      where: { id: student.id },
      data: {
        name: validated.name,
        phoneNumber: validated.phoneNumber || null,
        linkedinUrl: validated.linkedinUrl || null,
        githubUrl: validated.githubUrl || null,
        portfolioUrl: validated.portfolioUrl || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update personal info error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update personal information. Please try again.",
    };
  }
}
