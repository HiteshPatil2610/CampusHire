"use server";

import { afterStudentProfileSave } from "../domain/after-profile-save";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { academicInfoSchema, type AcademicInfoInput } from "../schemas/profile";
import {
  allowedCurrentSemesters,
  currentAcademicYearLabel,
  isCgpaExpected,
} from "../domain/academic-standing";
import { cgpaToPercentage } from "../utils/score-conversion";
import { actionErrorMessage } from "../utils/action-error";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/** The stored percentage for a record given as a percentage or a board CGPA. */
function percentageFrom(percentage: number | null | undefined, cgpa: number | null | undefined) {
  if (cgpa !== null && cgpa !== undefined) return { percentage: cgpaToPercentage(cgpa), cgpa };
  return { percentage: percentage ?? null, cgpa: null };
}

/**
 * Update or create student academic information.
 * Uses upsert pattern (create if missing, update if exists).
 *
 * The branch not matching the student's entry type is written as null, never
 * zero — a diploma student has no 12th record, and a 0% 12th score would
 * quietly fail every eligibility check.
 *
 * Entry type and batch are read from the student's own record, never from
 * the request: the form shows entry type read-only, and trusting the
 * client's copy would let a tampered request erase a regular student's 12th
 * record and semester 1-2 marks. The current semester must be one of the two
 * of the year their batch is in (domain/academic-standing.ts).
 */
export async function updateAcademicInfo(input: AcademicInfoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    const owner = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: { entryType: true, expectedPassoutYear: true },
    });

    // Validate input against the stored entry type.
    const validated = academicInfoSchema.parse({ ...input, entryType: owner.entryType });

    const allowed = allowedCurrentSemesters(owner.entryType, owner.expectedPassoutYear);
    if (!allowed.includes(validated.currentSemester)) {
      return {
        success: false,
        error: `For ${currentAcademicYearLabel()} your batch is in semester ${allowed.join(" or ")}. Please choose your current semester.`,
      };
    }

    const isDiploma = owner.entryType === "DIPLOMA";
    const tenth = percentageFrom(validated.tenthPercentage, validated.tenthCgpa);
    const twelfth = percentageFrom(validated.twelfthPercentage, validated.twelfthCgpa);
    const diploma = percentageFrom(validated.diplomaPercentage, validated.diplomaCgpa);

    const record = {
      // Required by the schema, so present one way or the other.
      tenthPercentage: tenth.percentage!,
      tenthCgpa: tenth.cgpa,
      tenthBoard: validated.tenthBoard || null,
      tenthYear: validated.tenthYear ?? null,
      tenthMarksheetUrl: validated.tenthMarksheetUrl ?? null,
      // Only the branch matching the entry type is stored; the other is
      // cleared so no stale record survives.
      twelfthPercentage: isDiploma ? null : twelfth.percentage,
      twelfthCgpa: isDiploma ? null : twelfth.cgpa,
      twelfthBoard: isDiploma ? null : validated.twelfthBoard || null,
      twelfthYear: isDiploma ? null : validated.twelfthYear ?? null,
      twelfthMarksheetUrl: isDiploma
        ? null
        : validated.twelfthMarksheetUrl ?? null,
      diplomaPercentage: isDiploma ? diploma.percentage : null,
      diplomaCgpa: isDiploma ? diploma.cgpa : null,
      diplomaBoard: isDiploma ? validated.diplomaBoard || null : null,
      diplomaYear: isDiploma ? validated.diplomaYear ?? null : null,
      diplomaMarksheetUrl: isDiploma
        ? validated.diplomaMarksheetUrl ?? null
        : null,
      // Before any semester has finished there is no CGPA, whatever was sent.
      currentCGPA: isCgpaExpected(owner.entryType, validated.currentSemester)
        ? validated.currentCGPA ?? null
        : null,
      currentSemester: validated.currentSemester,
      activeBacklogs: validated.activeBacklogs,
      pastBacklogCount: validated.pastBacklogCount,
    };

    await prisma.$transaction(async (tx) => {
      await tx.studentAcademic.upsert({
        where: { studentId: student.id },
        create: { studentId: student.id, ...record },
        update: record,
      });

      // A lateral-entry student never earned semester 1-2 marks here; any
      // left from before their entry type was corrected are retired.
      if (isDiploma) {
        await tx.semesterMark.deleteMany({
          where: { studentId: student.id, semester: { lt: 3 } },
        });
      }
    });

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

    return { success: true };
  } catch (error) {
    console.error("Update academic info error:", error);
    return {
      success: false,
      error: actionErrorMessage(
        error,
        "Failed to update academic information. Please try again."
      ),
    };
  }
}
