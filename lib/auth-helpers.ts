/**
 * Authentication Helper Functions
 * 
 * These functions provide a unified way to get authenticated user data
 * and resolve their Student profile using Clerk + Prisma.
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import type { Student, Department, StudentAcademic, StudentPreferences } from "@prisma/client";

/**
 * Error thrown when authentication fails
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Student with all related profile data
 */
export type CompleteStudentProfile = Student & {
  department: Department;
  academic: StudentAcademic | null;
  preferences: StudentPreferences | null;
};

/**
 * Get the current authenticated student with full profile data
 * 
 * @throws {AuthError} If user is not authenticated or doesn't have a student profile
 * @returns Promise resolving to the complete student profile
 * 
 * @example
 * ```ts
 * const student = await getCurrentStudent();
 * console.log(student.name, student.department.name);
 * ```
 */
export async function getCurrentStudent(): Promise<CompleteStudentProfile> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new AuthError("Unauthorized: No authenticated user");
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      department: true,
      academic: true,
      preferences: true,
    },
  });

  if (!student) {
    throw new AuthError("Student profile not found for authenticated user");
  }

  return student;
}

/**
 * Get the current authenticated student ID only (lightweight)
 * 
 * @throws {AuthError} If user is not authenticated or doesn't have a student profile
 * @returns Promise resolving to the student ID
 * 
 * @example
 * ```ts
 * const studentId = await getCurrentStudentId();
 * ```
 */
export async function getCurrentStudentId(): Promise<string> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new AuthError("Unauthorized: No authenticated user");
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!student) {
    throw new AuthError("Student profile not found for authenticated user");
  }

  return student.id;
}

/**
 * Get the current authenticated student or null if not authenticated
 * 
 * @returns Promise resolving to the complete student profile or null
 * 
 * @example
 * ```ts
 * const student = await getCurrentStudentOrNull();
 * if (student) {
 *   // User is authenticated with a student profile
 * }
 * ```
 */
export async function getCurrentStudentOrNull(): Promise<CompleteStudentProfile | null> {
  try {
    return await getCurrentStudent();
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
}

/**
 * Require authentication and return student profile
 * Alias for getCurrentStudent() with a more explicit name
 * 
 * @throws {AuthError} If user is not authenticated or doesn't have a student profile
 * @returns Promise resolving to the complete student profile
 */
export async function requireAuth(): Promise<CompleteStudentProfile> {
  return getCurrentStudent();
}

/**
 * Check if the current user is authenticated and has a student profile
 * 
 * @returns Promise resolving to boolean indicating if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const student = await getCurrentStudentOrNull();
  return student !== null;
}

/**
 * Get student by ID (for admin/super-admin operations)
 * 
 * @param studentId - The student ID to fetch
 * @returns Promise resolving to the complete student profile or null
 */
export async function getStudentById(studentId: string): Promise<CompleteStudentProfile | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      department: true,
      academic: true,
      preferences: true,
    },
  });

  return student;
}

/**
 * Get student by user ID (Clerk user ID)
 * 
 * @param userId - The Clerk user ID
 * @returns Promise resolving to the complete student profile or null
 */
export async function getStudentByUserId(userId: string): Promise<CompleteStudentProfile | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      department: true,
      academic: true,
      preferences: true,
    },
  });

  return student;
}
