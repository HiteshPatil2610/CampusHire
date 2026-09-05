"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studentRegistrationSchema, type StudentRegistrationInput } from "../schemas/registration";

export interface RegistrationResult {
  success: boolean;
  studentId?: string;
  error?: string;
}

/**
 * Create a new Student record for an authenticated user with STUDENT role
 * Called after Clerk authentication and User record creation
 */
export async function createStudent(
  input: StudentRegistrationInput
): Promise<RegistrationResult> {
  try {
    // Verify user is authenticated and has STUDENT role
    const user = await requireRole("STUDENT");

    // Validate input
    const validated = studentRegistrationSchema.parse(input);

    // Check if student record already exists for this user
    const existingStudent = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (existingStudent) {
      return {
        success: false,
        error: "Student profile already exists",
      };
    }

    // Check if roll number is already taken
    const existingRollNumber = await prisma.student.findUnique({
      where: { rollNumber: validated.rollNumber },
    });

    if (existingRollNumber) {
      return {
        success: false,
        error: "Roll number is already registered",
      };
    }

    // Create student record
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name: validated.name,
        rollNumber: validated.rollNumber,
        departmentId: validated.departmentId,
        phoneNumber: validated.phoneNumber || null,
      },
    });

    return {
      success: true,
      studentId: student.id,
    };
  } catch (error) {
    console.error("Student registration error:", error);
    
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to create student profile. Please try again.",
    };
  }
}

/**
 * Get all active departments for registration dropdown
 */
export async function getActiveDepartments() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}
