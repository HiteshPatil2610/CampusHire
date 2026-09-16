"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  semesterMarksSchema,
  type SemesterMarksInput,
} from "../schemas/profile";
import { firstSemesterFor } from "../utils/entry-type";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert semester SGPA marks for the authenticated student.
 *
 * The set of semesters a student may submit depends on how they entered the
 * degree: a lateral-entry (diploma) student joins in the second year and has
 * no semester 1 or 2 marks. The entry type is re-read from the stored
 * academic record here — the client's copy is never the authority.
 */
export async function updateSemesterMarks(
  input: SemesterMarksInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const validated = semesterMarksSchema.parse(input);

    const academic = await prisma.studentAcademic.findUnique({
      where: { studentId: student.id },
      select: { entryType: true },
    });

    const firstSemester = firstSemesterFor(academic?.entryType ?? "REGULAR");
    const outOfRange = validated.marks.find(
      (mark) => mark.semester < firstSemester
    );

    if (outOfRange) {
      return {
        success: false,
        error: `Semester ${outOfRange.semester} does not apply to a lateral-entry student. Start from semester ${firstSemester}.`,
      };
    }

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
