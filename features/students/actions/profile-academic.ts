"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { academicInfoSchema, type AcademicInfoInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update or create student academic information.
 * Uses upsert pattern (create if missing, update if exists).
 *
 * The branch not matching the student's entry type is written as null, never
 * zero — a diploma student has no 12th record, and a 0% 12th score would
 * quietly fail every eligibility check.
 */
export async function updateAcademicInfo(input: AcademicInfoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = academicInfoSchema.parse(input);

    const isDiploma = validated.entryType === "DIPLOMA";

    const record = {
      entryType: validated.entryType,
      tenthPercentage: validated.tenthPercentage,
      tenthBoard: validated.tenthBoard || null,
      tenthYear: validated.tenthYear ?? null,
      tenthMarksheetUrl: validated.tenthMarksheetUrl ?? null,
      // Only the branch matching the entry type is stored; the other is
      // cleared so a student who switches entry type leaves no stale record.
      twelfthPercentage: isDiploma ? null : validated.twelfthPercentage ?? null,
      twelfthBoard: isDiploma ? null : validated.twelfthBoard || null,
      twelfthYear: isDiploma ? null : validated.twelfthYear ?? null,
      twelfthMarksheetUrl: isDiploma
        ? null
        : validated.twelfthMarksheetUrl ?? null,
      diplomaPercentage: isDiploma ? validated.diplomaPercentage ?? null : null,
      diplomaBoard: isDiploma ? validated.diplomaBoard || null : null,
      diplomaYear: isDiploma ? validated.diplomaYear ?? null : null,
      diplomaMarksheetUrl: isDiploma
        ? validated.diplomaMarksheetUrl ?? null
        : null,
      currentCGPA: validated.currentCGPA,
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

      // Switching to lateral entry retires semester 1-2 marks, which that
      // student never earned at this college.
      if (isDiploma) {
        await tx.semesterMark.deleteMany({
          where: { studentId: student.id, semester: { lt: 3 } },
        });
      }
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
