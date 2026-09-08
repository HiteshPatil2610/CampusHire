/**
 * Update Academic Information Server Action
 * 
 * Handles updating student academic information including:
 * - 10th standard marks, board, year
 * - 12th standard marks, board, year
 * - Current CGPA and semester
 * - Active backlogs
 * - Semester-wise marks (optional)
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStudentId } from "@/lib/auth-helpers";
import { academicInfoSchema, type AcademicInfoInput } from "../schemas/profile-schemas";

export type UpdateAcademicInfoResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Update student academic information
 * 
 * Creates or updates StudentAcademic record for the authenticated student
 * 
 * @param input - Academic information data
 * @returns Success or error result
 * 
 * @example
 * ```tsx
 * const result = await updateAcademicInfo({
 *   tenthPercentage: 92.5,
 *   tenthBoard: "CBSE",
 *   tenthYear: 2019,
 *   twelfthPercentage: 89.0,
 *   twelfthBoard: "CBSE",
 *   twelfthYear: 2021,
 *   currentCGPA: 8.4,
 *   currentSemester: 7,
 *   activeBacklogs: 0,
 * });
 * ```
 */
export async function updateAcademicInfo(
  input: AcademicInfoInput
): Promise<UpdateAcademicInfoResult> {
  try {
    // 1. Get authenticated student ID
    const studentId = await getCurrentStudentId();

    // 2. Validate input with Zod
    const validationResult = academicInfoSchema.safeParse(input);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Validation failed",
      };
    }

    const validatedData = validationResult.data;

    // 3. Prepare academic data
    const academicData: {
      tenthPercentage: number;
      twelfthPercentage: number;
      currentCGPA: number;
      currentSemester: number;
      activeBacklogs: number;
      tenthBoard?: string | null;
      tenthYear?: number | null;
      twelfthBoard?: string | null;
      twelfthYear?: number | null;
      semesterMarks?: string | null;
    } = {
      tenthPercentage: validatedData.tenthPercentage,
      twelfthPercentage: validatedData.twelfthPercentage,
      currentCGPA: validatedData.currentCGPA,
      currentSemester: validatedData.currentSemester,
      activeBacklogs: validatedData.activeBacklogs,
    };

    // Add optional fields
    if (validatedData.tenthBoard !== undefined) {
      academicData.tenthBoard = validatedData.tenthBoard || null;
    }

    if (validatedData.tenthYear !== undefined) {
      academicData.tenthYear = validatedData.tenthYear || null;
    }

    if (validatedData.twelfthBoard !== undefined) {
      academicData.twelfthBoard = validatedData.twelfthBoard || null;
    }

    if (validatedData.twelfthYear !== undefined) {
      academicData.twelfthYear = validatedData.twelfthYear || null;
    }

    if (validatedData.semesterMarks !== undefined) {
      academicData.semesterMarks = validatedData.semesterMarks || null;
    }

    // 4. Update or create academic record (upsert)
    await prisma.studentAcademic.upsert({
      where: { studentId },
      update: academicData,
      create: {
        ...academicData,
        studentId,
      },
    });

    // 5. Update student's semester field if provided
    if (validatedData.currentSemester) {
      const semesterLabels = [
        '1st semester', '2nd semester', '3rd semester', '4th semester',
        '5th semester', '6th semester', '7th semester', '8th semester',
        '9th semester', '10th semester', '11th semester', '12th semester',
      ];
      
      const semesterLabel = semesterLabels[validatedData.currentSemester - 1] || 
                           `${validatedData.currentSemester}th semester`;
      
      await prisma.student.update({
        where: { id: studentId },
        data: { semester: semesterLabel },
      });
    }

    // 6. Revalidate the profile page to show updated data
    revalidatePath("/profile");

    return {
      success: true,
      message: "Academic information updated successfully",
    };
  } catch (error) {
    console.error("Error updating academic info:", error);

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message === "Unauthorized: No authenticated user") {
        return {
          success: false,
          error: "You must be logged in to update your profile",
        };
      }

      if (error.message === "Student profile not found for authenticated user") {
        return {
          success: false,
          error: "Student profile not found",
        };
      }
    }

    return {
      success: false,
      error: "Failed to update academic information. Please try again.",
    };
  }
}
