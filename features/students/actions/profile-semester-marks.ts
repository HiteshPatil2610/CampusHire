"use server";

import { afterStudentProfileSave } from "../domain/after-profile-save";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  semesterMarksSchema,
  type SemesterMarksInput,
} from "../schemas/profile";
import {
  cgpaConsistencyProblem,
  semesterResultProblem,
} from "../domain/academic-standing";
import { actionErrorMessage } from "../utils/action-error";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert semester SGPA marks for the authenticated student.
 *
 * Only finished semesters can have a result: from the first semester the
 * student studied here (3 for lateral entry) up to one below their current
 * semester — a semester-7 student records 1–6, never 7. Entry type and the
 * current semester are re-read from the stored record here; the client's
 * copy is never the authority. The profile form saves the academic record
 * (with the current semester) first, then calls this.
 *
 * Once every finished semester has an SGPA, the stored CGPA must lie between
 * the lowest and highest of them (a weighted average always does).
 */
export async function updateSemesterMarks(
  input: SemesterMarksInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const validated = semesterMarksSchema.parse(input);

    // Entry type lives on Student, set at registration.
    const owner = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: {
        entryType: true,
        academic: { select: { currentSemester: true, currentCGPA: true } },
      },
    });

    if (!owner.academic) {
      if (validated.marks.length === 0) return { success: true };
      return {
        success: false,
        error: "Save your current semester before adding semester results.",
      };
    }

    const { currentSemester, currentCGPA } = owner.academic;
    for (const mark of validated.marks) {
      const problem = semesterResultProblem(owner.entryType, currentSemester, mark.semester);
      if (problem) return { success: false, error: problem };
    }

    const inconsistency = cgpaConsistencyProblem(
      owner.entryType,
      currentSemester,
      currentCGPA,
      validated.marks
    );
    if (inconsistency) return { success: false, error: inconsistency };

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

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

    return { success: true };
  } catch (error) {
    console.error("Update semester marks error:", error);
    return {
      success: false,
      error: actionErrorMessage(error, "Failed to save semester results. Please try again."),
    };
  }
}
