/**
 * Profile Queries
 * 
 * Data fetching layer for student profile information
 * Used by Server Components to fetch profile data
 */

import { prisma } from "@/lib/prisma";
import type { Student, Department, StudentAcademic, StudentPreferences } from "@prisma/client";

/**
 * Complete student profile with all related data
 */
export type CompleteProfile = Student & {
  department: Department;
  academic: StudentAcademic | null;
  preferences: StudentPreferences | null;
};

/**
 * Get complete student profile by student ID
 * Includes department, academic info, and preferences
 * 
 * @param studentId - The student ID to fetch
 * @returns Complete profile or null if not found
 */
export async function getCompleteProfile(studentId: string): Promise<CompleteProfile | null> {
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
 * Get complete student profile by user ID (Clerk ID)
 * 
 * @param userId - The Clerk user ID
 * @returns Complete profile or null if not found
 */
export async function getCompleteProfileByUserId(userId: string): Promise<CompleteProfile | null> {
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

/**
 * Calculate profile completion percentage
 * Based on the presence of key profile fields
 * 
 * @param profile - Complete student profile
 * @returns Completion percentage (0-100)
 */
export function calculateProfileCompletion(profile: CompleteProfile): number {
  let requiredFieldsFilled = 0;
  const totalRequiredFields = 10;

  // 1. Personal Info - Basic (3 fields)
  if (profile.name) requiredFieldsFilled++;
  if (profile.phoneNumber) requiredFieldsFilled++;
  if (profile.dateOfBirth) requiredFieldsFilled++;

  // 2. Academic Info - Current (2 fields)
  if (profile.academic?.currentCGPA) requiredFieldsFilled++;
  if (profile.academic?.tenthPercentage) requiredFieldsFilled++;

  // 3. Academic Info - 12th (1 field)
  if (profile.academic?.twelfthPercentage) requiredFieldsFilled++;

  // 4. Contact - LinkedIn or GitHub (1 field)
  if (profile.linkedinUrl || profile.githubUrl) requiredFieldsFilled++;

  // 5. Preferences - Roles (1 field)
  if (profile.preferences?.preferredRoles) {
    try {
      const roles = JSON.parse(profile.preferences.preferredRoles);
      if (Array.isArray(roles) && roles.length > 0) {
        requiredFieldsFilled++;
      }
    } catch {
      // Invalid JSON, don't count
    }
  }

  // 6. Preferences - Locations (1 field)
  if (profile.preferences?.preferredLocations) {
    try {
      const locations = JSON.parse(profile.preferences.preferredLocations);
      if (Array.isArray(locations) && locations.length > 0) {
        requiredFieldsFilled++;
      }
    } catch {
      // Invalid JSON, don't count
    }
  }

  // 7. Gender (1 field)
  if (profile.gender) requiredFieldsFilled++;

  return Math.round((requiredFieldsFilled / totalRequiredFields) * 100);
}
