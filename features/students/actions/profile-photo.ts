"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profilePhotoSchema, type ProfilePhotoInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update student profile photo URL
 * Called after the photo has been uploaded to Vercel Blob
 * This action only updates the database reference
 */
export async function updateProfilePhoto(input: ProfilePhotoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = profilePhotoSchema.parse(input);

    // Update student record with new photo URL
    await prisma.student.update({
      where: { id: student.id },
      data: {
        profilePhotoUrl: validated.photoUrl,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update profile photo error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update profile photo. Please try again.",
    };
  }
}
