"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { preferencesSchema, type PreferencesInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update or create student placement preferences
 * Uses upsert pattern (create if missing, update if exists)
 */
export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = preferencesSchema.parse(input);

    // Convert arrays to JSON strings for database storage
    const preferredRoles = JSON.stringify(validated.preferredRoles);
    const preferredLocations = JSON.stringify(validated.preferredLocations);
    const preferredCompanyTypes = JSON.stringify(validated.preferredCompanyTypes);

    // Upsert preferences record
    await prisma.studentPreferences.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        preferredRoles,
        preferredLocations,
        preferredCompanyTypes,
        expectedPackageMin: validated.expectedPackageMin ?? null,
        expectedPackageMax: validated.expectedPackageMax ?? null,
        willingToRelocate: validated.willingToRelocate,
      },
      update: {
        preferredRoles,
        preferredLocations,
        preferredCompanyTypes,
        expectedPackageMin: validated.expectedPackageMin ?? null,
        expectedPackageMax: validated.expectedPackageMax ?? null,
        willingToRelocate: validated.willingToRelocate,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update preferences error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update preferences. Please try again.",
    };
  }
}
