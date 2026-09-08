/**
 * Update Personal Information Server Action
 * 
 * Handles updating student personal information including:
 * - Name
 * - Phone number
 * - Date of birth
 * - Gender
 * - Address
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStudentId } from "@/lib/auth-helpers";
import { personalInfoSchema, type PersonalInfoInput } from "../schemas/profile-schemas";

export type UpdatePersonalInfoResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Update student personal information
 * 
 * @param input - Personal information data
 * @returns Success or error result
 * 
 * @example
 * ```tsx
 * const result = await updatePersonalInfo({
 *   name: "John Doe",
 *   phoneNumber: "9876543210",
 *   dateOfBirth: "2004-03-12",
 *   gender: "Male",
 *   address: "123 Main St, City",
 * });
 * ```
 */
export async function updatePersonalInfo(
  input: PersonalInfoInput
): Promise<UpdatePersonalInfoResult> {
  try {
    // 1. Get authenticated student ID
    const studentId = await getCurrentStudentId();

    // 2. Validate input with Zod
    const validationResult = personalInfoSchema.safeParse(input);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Validation failed",
      };
    }

    const validatedData = validationResult.data;

    // 3. Prepare update data (convert empty strings to null)
    const updateData: {
      name: string;
      phoneNumber?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      address?: string | null;
    } = {
      name: validatedData.name,
    };

    // Only include fields that were provided
    if (validatedData.phoneNumber !== undefined) {
      updateData.phoneNumber = validatedData.phoneNumber || null;
    }

    if (validatedData.dateOfBirth !== undefined) {
      updateData.dateOfBirth = validatedData.dateOfBirth
        ? new Date(validatedData.dateOfBirth)
        : null;
    }

    if (validatedData.gender !== undefined) {
      updateData.gender = validatedData.gender || null;
    }

    if (validatedData.address !== undefined) {
      updateData.address = validatedData.address || null;
    }

    // 4. Update student in database
    await prisma.student.update({
      where: { id: studentId },
      data: updateData,
    });

    // 5. Revalidate the profile page to show updated data
    revalidatePath("/profile");

    return {
      success: true,
      message: "Personal information updated successfully",
    };
  } catch (error) {
    console.error("Error updating personal info:", error);

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
      error: "Failed to update personal information. Please try again.",
    };
  }
}
