"use server";

import { afterStudentProfileSave } from "../domain/after-profile-save";
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
    const preferredCompanyTypes = JSON.stringify(validated.preferredCompanyTypes);
    const workModes = JSON.stringify(validated.workModes);
    // Item 5: Preferred Job Location is retired — no longer collected, shown
    // or read anywhere. The column stays (it is NOT NULL, and columns are
    // never dropped automatically), always written empty so nothing revives
    // a value nobody can see or edit any more.
    const preferredLocations = "[]";

    // Upsert preferences record
    await prisma.studentPreferences.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        preferredRoles,
        preferredLocations,
        preferredCompanyTypes,
        workModes,
        expectedPackageMin: validated.expectedPackageMin ?? null,
        expectedPackageMax: validated.expectedPackageMax ?? null,
        willingToRelocate: validated.willingToRelocate,
      },
      update: {
        preferredRoles,
        preferredCompanyTypes,
        workModes,
        expectedPackageMin: validated.expectedPackageMin ?? null,
        expectedPackageMax: validated.expectedPackageMax ?? null,
        willingToRelocate: validated.willingToRelocate,
        // preferredLocations intentionally left out of the update: an
        // existing value (from before Item 5) is left as it is rather than
        // being overwritten on every save, since nothing reads it either way.
      },
    });

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

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
