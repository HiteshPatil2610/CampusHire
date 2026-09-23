"use server";

import { afterStudentProfileSave } from "../domain/after-profile-save";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalInfoSchema, type PersonalInfoInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update student personal information
 */
export async function updatePersonalInfo(input: PersonalInfoInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = personalInfoSchema.parse(input);

    // A roll number can be supplied once, to fill a gap left at registration.
    // It is never overwritten from here: an existing roll number is owned by
    // the registrar, and it is the key admins and exports identify a student
    // by. Re-read from the database rather than trusting the submitted state.
    const current = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: { rollNumber: true },
    });

    const submittedRollNumber = validated.rollNumber?.trim();
    let rollNumberUpdate: { rollNumber?: string } = {};

    if (current.rollNumber === null && submittedRollNumber) {
      const taken = await prisma.student.findUnique({
        where: { rollNumber: submittedRollNumber },
        select: { id: true },
      });

      if (taken) {
        return {
          success: false,
          error: "That roll number is already registered to another student.",
        };
      }

      rollNumberUpdate = { rollNumber: submittedRollNumber };
    }

    // Update student record
    await prisma.student.update({
      where: { id: student.id },
      data: {
        ...rollNumberUpdate,
        name: validated.name,
        phoneNumber: validated.phoneNumber || null,
        gender: validated.gender || null,
        dateOfBirth: validated.dateOfBirth
          ? new Date(validated.dateOfBirth)
          : null,
        address: validated.address || null,
        personalEmail: validated.personalEmail || null,
        linkedinUrl: validated.linkedinUrl || null,
        githubUrl: validated.githubUrl || null,
        portfolioUrl: validated.portfolioUrl || null,
      },
    });

    // Item 7: re-check drive eligibility now; tell the student about new ones.

    await afterStudentProfileSave(student.id);

    return { success: true };
  } catch (error) {
    console.error("Update personal info error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update personal information. Please try again.",
    };
  }
}
