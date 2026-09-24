"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyRole, getActiveDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { getStudentProfile } from "../queries/get-profile";

/**
 * Get full student profile details for an admin.
 *
 * A department admin can only view students from their own department; a
 * Super Admin can view any student (Phase 9, Item 21's "Student detail
 * link" on the institution-wide directory) — read-only oversight, since the
 * dialog's editing actions (recording a placement, dropping a student) stay
 * gated to the owning department admin at their own action, not here.
 *
 * @param studentId - ID of the student to fetch
 * @returns Full student profile with all related data
 * @throws AuthorizationError if a department admin requests another department's student
 * @throws Error if student not found
 */
export async function getStudentDetailForAdmin(studentId: string) {
  const user = await requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"]);

  if (user.role === "DEPT_ADMIN") {
    const admin = await getActiveDepartmentAdmin(user.id);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { departmentId: true },
    });

    // Not found and not in your department read the same, so an admin cannot
    // use this to discover which student ids exist in other departments.
    if (!student || !admin || student.departmentId !== admin.departmentId) {
      throw new AuthorizationError("Student not found in your department");
    }
  }

  return getStudentProfile(studentId);
}
