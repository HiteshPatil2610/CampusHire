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

  if (!student) {
    throw new Error("Student not found");
  }

  if (student.departmentId !== department.id) {
    throw new AuthorizationError(
      "You do not have permission to view this student's details"
    );
  }

  // 3. Return full profile (now safe — ownership verified)
  return getStudentProfile(studentId);
}
