"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { academicInfoSchema, type AcademicInfoInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update or create student academic information
 * Uses upsert pattern (create if missing, update if exists)
 */
export async function updateAcademicInfo(input: AcademicInfoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = academicInfoSchema.parse(input);

    // Upsert academic record
    await prisma.studentAcademic.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        tenthPercentage: validated.tenthPercentage,
        twelfthPercentage: validated.twelfthPercentage,
        currentCGPA: validated.currentCGPA,
        currentSemester: validated.currentSemester,
        activeBacklogs: validated.activeBacklogs,
      },
      update: {
        tenthPercentage: validated.tenthPercentage,
        twelfthPercentage: validated.twelfthPercentage,
        currentCGPA: validated.currentCGPA,
        currentSemester: validated.currentSemester,
        activeBacklogs: validated.activeBacklogs,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update academic info error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update academic information. Please try again.",
    };
  }
}
