"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  semesterMarksSchema,
  type SemesterMarksInput,
} from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert semester SGPA marks for the authenticated student
 */
export async function updateSemesterMarks(
  input: SemesterMarksInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const validated = semesterMarksSchema.parse(input);

    await prisma.$transaction(
      validated.marks.map((mark) =>
        prisma.semesterMark.upsert({
          where: {
            studentId_semester: {
              studentId: student.id,
              semester: mark.semester,
            },
          },
          create: {
            studentId: student.id,
            semester: mark.semester,
            sgpa: mark.sgpa,
          },
          update: {
            sgpa: mark.sgpa,
          },
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error("Update semester marks error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to save semester results. Please try again.",
    };
  }
}
