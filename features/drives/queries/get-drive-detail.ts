"use server";

import { getOrCreateUser, requireStudent, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStudentEligibleForDrive } from "./drive-eligibility";
import type { Drive, Department } from "@prisma/client";

export type DriveWithDepartment = Drive & {
  department: Pick<Department, "id" | "name" | "code">;
};

/**
 * Get drive detail by ID
 * Access control:
 * - Department admin: can view drives from own department
 * - Student: can only view eligible drives
 */
export async function getDriveDetail(driveId: string): Promise<DriveWithDepartment> {
  // Get authenticated user
  const user = await getOrCreateUser();

  if (!user) {
    throw new AuthorizationError("Authentication required");
  }

  // Get drive with department info
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!drive) {
    throw new Error("Drive not found");
  }

  // Authorization based on role
  if (user.role === "DEPT_ADMIN") {
    // Department admin can view drives from own department
    const admin = await prisma.departmentAdmin.findUnique({
      where: { userId: user.id },
    });

    if (!admin || admin.departmentId !== drive.departmentId) {
      throw new AuthorizationError("You do not have permission to view this drive");
    }

    return drive;
  } else if (user.role === "STUDENT") {
    // Student can only view eligible drives
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        academic: true,
      },
    });

    if (!student) {
      throw new AuthorizationError("Student profile not found");
    }

    if (!isStudentEligibleForDrive(student, drive)) {
      throw new AuthorizationError("You are not eligible for this drive");
    }

    return drive;
  } else {
    // Super admin or other roles
    throw new AuthorizationError("Access denied");
  }
}
