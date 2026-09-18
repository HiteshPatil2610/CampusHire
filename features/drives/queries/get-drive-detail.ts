"use server";

import { getOrCreateUser, requireStudent, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStudentEligibleForDrive } from "./drive-eligibility";
import { checkApplicationExists } from "@/features/applications/queries/check-application-exists";
import { resolveDepartmentDrive } from "../domain/resolve-department-drive";
import type { DriveForStudent } from "../domain/resolve-department-drive";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import type { Drive, Department } from "@prisma/client";

type DriveWithEligibility = Drive & HasEligibleDepartmentLinks;

// department is null for central drives, which have no single owning department
export type DriveWithDepartment = (DriveWithEligibility | DriveForStudent<DriveWithEligibility>) & {
  department: Pick<Department, "id" | "name" | "code"> | null;
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
      ...eligibleDepartmentLinksInclude,
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

    const hasApplied = await checkApplicationExists(student.id, drive.id);

    // A central drive's venue, coordinator and required fields are configured
    // per department, so show this student their own department's instance.
    const instance = await prisma.driveDepartmentConfig.findUnique({
      where: {
        driveId_departmentId: {
          driveId: drive.id,
          departmentId: student.departmentId,
        },
      },
    });

    // The drive has to be published *for this student's department* before it
    // is theirs to read. A student who already applied keeps access to their
    // own application's drive even after it is administratively closed.
    if (!hasApplied && instance?.status !== "PUBLISHED") {
      throw new AuthorizationError("You are not eligible for this drive");
    }

    if (!hasApplied && !isStudentEligibleForDrive(student, drive)) {
      throw new AuthorizationError("You are not eligible for this drive");
    }

    return {
      ...resolveDepartmentDrive(drive, instance),
      department: drive.department,
    };
  } else {
    // Super admin or other roles
    throw new AuthorizationError("Access denied");
  }
}
