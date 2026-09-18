import type { Drive, Student, StudentAcademic } from "@prisma/client";
import { getDriveStatus } from "../utils/drive-status";
import {
  eligibleDepartmentIdsOf,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";

/**
 * Student with required academic and department information for eligibility check
 */
export type StudentWithEligibilityInfo = Student & {
  academic: StudentAcademic | null;
};

/**
 * A drive with its eligible-department rows loaded — required for every
 * check below. `packageOffered` is widened to `unknown`: none of these
 * checks touch it, and pinning it to `Decimal` would force every caller to
 * hand over a raw, unserialized drive even after the caller has already
 * converted it for a Client Component (see serialize-drive.ts).
 */
export type DriveWithEligibility = Omit<Drive, "packageOffered"> & {
  packageOffered: unknown;
} & HasEligibleDepartmentLinks;

/**
 * Check if a student is eligible for a specific drive
 * 
 * Eligibility criteria:
 * 1. Student must have academic record
 * 2. Drive must be open (deadline not passed)
 * 3. Student's department must be in eligible departments list
 * 4. Student's CGPA must meet minimum requirement
 * 5. Student's active backlogs must not exceed maximum
 * 
 * @param student - Student with academic information
 * @param drive - Drive to check eligibility for
 * @returns true if student is eligible, false otherwise
 */
export function isStudentAcademicallyEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): boolean {
  if (!student.academic) {
    return false;
  }

  if (!eligibleDepartmentIdsOf(drive).includes(student.departmentId)) {
    return false;
  }

  if (student.academic.currentCGPA < drive.minCGPA) {
    return false;
  }

  if (student.academic.activeBacklogs > drive.maxActiveBacklogs) {
    return false;
  }

  return true;
}

export function isStudentEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): boolean {
  // Must have academic record
  if (!student.academic) {
    return false;
  }

  // Drive must be open
  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    return false;
  }

  return isStudentAcademicallyEligibleForDrive(student, drive);
}

/**
 * Get reason why student is not eligible (for debugging/display)
 * 
 * @param student - Student with academic information
 * @param drive - Drive to check
 * @returns Array of reasons student is not eligible (empty if eligible)
 */
export function getIneligibilityReasons(
  student: StudentWithEligibilityInfo,
  drive: DriveWithEligibility
): string[] {
  const reasons: string[] = [];

  // Surfaced before the academic check so a lateral-entry student who has
  // neither sees both gaps at once rather than fixing one and discovering
  // the next. The same rule is enforced server-side in `applyToDrive`.
  if (!student.rollNumber) {
    reasons.push("Add your roll number in your profile");
  }

  if (!student.academic) {
    reasons.push("Academic information not completed");
    return reasons; // Can't check other criteria without academic info
  }

  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    reasons.push("Drive is closed");
  }

  if (!eligibleDepartmentIdsOf(drive).includes(student.departmentId)) {
    reasons.push("Your department is not eligible");
  }

  if (student.academic.currentCGPA < drive.minCGPA) {
    reasons.push(`CGPA requirement: ${drive.minCGPA} (You: ${student.academic.currentCGPA})`);
  }

  if (student.academic.activeBacklogs > drive.maxActiveBacklogs) {
    reasons.push(
      `Maximum backlogs: ${drive.maxActiveBacklogs} (You: ${student.academic.activeBacklogs})`
    );
  }

  return reasons;
}
