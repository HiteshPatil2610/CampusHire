"use server";

import { getOrCreateUser, requireStudent, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import { isStudentEligibleForDrive } from "./drive-eligibility";
import { checkApplicationExists } from "@/features/applications/queries/check-application-exists";
import {
  buildStudentDriveView,
  STUDENT_VIEW_INSTANCE_INCLUDE,
} from "../domain/student-drive-view";
import type { ApplicationFieldConfig } from "../domain/application-form";
import type { DriveForStudent } from "../domain/resolve-department-drive";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import type { Drive, Department } from "@prisma/client";
import type { EligibilityRuleInput } from "../domain/eligibility-rules";

type DriveWithEligibility = Drive & HasEligibleDepartmentLinks;

// department is null for central drives, which have no single owning department.
// `eligibilityRules` is the rule set resolved for the student's department —
// what the detail page's checklist renders, so it cannot disagree with the
// decision this query just made.
export type DriveWithDepartment = (DriveWithEligibility | DriveForStudent<DriveWithEligibility>) & {
  department: Pick<Department, "id" | "name" | "code"> | null;
  eligibilityRules: EligibilityRuleInput[];
  /**
   * The student's department's resolved application form. Set on the student
   * path only — it is what the apply card renders and what `applyToDrive`
   * rebuilds and validates against.
   */
  applicationForm?: ApplicationFieldConfig[];
  /**
   * The student's department's active recruitment stages that students may
   * see, in order. Set on the student path only.
   */
  recruitmentStages?: { name: string; scheduledAt: Date | null; location: string | null; instructions: string | null }[];
  /**
   * Set when the drive was cancelled for the student's department (or
   * everywhere). Only a student who applied still reaches a cancelled drive.
   */
  cancellation?: { cancelledAt: Date | null; reason: string | null } | null;
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
  const row = await prisma.drive.findUnique({
    where: { id: driveId },
    include: {
      // The master's default application form.
      formFields: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      ...eligibleDepartmentLinksInclude,
      // The master's default rules; the department's own are loaded below.
      eligibilityRules: true,
    },
  });

  if (!row) {
    throw new Error("Drive not found");
  }

  // The raw form rows are only read to resolve the form below.
  const { formFields, ...drive } = row;

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
    // Everything the rules read, from the student's own records.
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        academic: true,
        skills: { select: { skillName: true } },
        placements: ACTIVE_PLACEMENTS_SELECT,
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
      // The same rows the department admin's preview is built from.
      include: STUDENT_VIEW_INSTANCE_INCLUDE,
    });

    // The drive has to be published *for this student's department* before it
    // is theirs to read. A student who already applied keeps access to their
    // own application's drive even after it is administratively closed.
    if (
      !hasApplied &&
      (instance?.status !== "PUBLISHED" ||
        drive.lifecycleStatus === "ARCHIVED" ||
        drive.lifecycleStatus === "CANCELLED")
    ) {
      throw new AuthorizationError("You are not eligible for this drive");
    }

    // Resolve before judging eligibility: this department's rule set and
    // deadline may differ from the master's, and those are what apply here.
    const { resolved, applicationForm, recruitmentStages } = buildStudentDriveView(
      drive,
      formFields,
      instance
    );

    if (!hasApplied && !isStudentEligibleForDrive(student, resolved)) {
      throw new AuthorizationError("You are not eligible for this drive");
    }

    const cancelled =
      drive.lifecycleStatus === "CANCELLED" || instance?.status === "CANCELLED";
    const cancellation = cancelled
      ? {
          cancelledAt: instance?.cancelledAt ?? drive.cancelledAt,
          reason: instance?.cancellationReason ?? drive.cancellationReason,
        }
      : null;

    return {
      ...resolved,
      department: drive.department,
      applicationForm,
      recruitmentStages,
      cancellation,
    };
  } else {
    // Super admin or other roles
    throw new AuthorizationError("Access denied");
  }
}
