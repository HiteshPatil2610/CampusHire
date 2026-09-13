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

    const submittedSemesters = validated.marks.map((mark) => mark.semester);

    await prisma.$transaction([
      // Rows the student removed from the form are dropped, so the saved set
      // always matches what they see.
      prisma.semesterMark.deleteMany({
        where: {
          studentId: student.id,
          semester: { notIn: submittedSemesters },
        },
      }),
      ...validated.marks.map((mark) =>
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
            gradeCardUrl: mark.gradeCardUrl ?? null,
          },
          // isVerified is deliberately not written here - only a department
          // admin may set it.
          update: {
            sgpa: mark.sgpa,
            gradeCardUrl: mark.gradeCardUrl ?? null,
          },
        })
      ),
    ]);

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
