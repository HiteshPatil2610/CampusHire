"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { getStudentProfile } from "../queries/get-profile";

/**
 * Get full student profile details for department admin.
 * Enforces department scope - admin can only view students from their own department.
 * 
 * @param studentId - ID of the student to fetch
 * @returns Full student profile with all related data
 * @throws AuthorizationError if student is not in admin's department
 * @throws Error if student not found
 */
export async function getStudentDetailForAdmin(studentId: string) {
  // 1. Auth: dept admin only
  const { department } = await requireDepartmentAdmin();

  // 2. Verify the student belongs to this admin's department
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { departmentId: true },
  });

  // Not found and not in your department read the same, so an admin cannot
  // use this to discover which student ids exist in other departments.
  if (!student || student.departmentId !== department.id) {
    throw new AuthorizationError("Student not found in your department");
  }

  // 3. Return full profile (now safe — ownership verified)
  return getStudentProfile(studentId);
}
