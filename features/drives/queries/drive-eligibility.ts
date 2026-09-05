import type { Drive, Student, StudentAcademic } from "@prisma/client";
import { getDriveStatus } from "../utils/drive-status";

/**
 * Student with required academic and department information for eligibility check
 */
export type StudentWithEligibilityInfo = Student & {
  academic: StudentAcademic | null;
};

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
export function isStudentEligibleForDrive(
  student: StudentWithEligibilityInfo,
  drive: Drive
): boolean {
  // Must have academic record
  if (!student.academic) {
    return false;
  }

  // Drive must be open
  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    return false;
  }

  // Check department eligibility
  try {
    const eligibleDeptIds: string[] = JSON.parse(drive.eligibleDepartments);
    if (!eligibleDeptIds.includes(student.departmentId)) {
      return false;
    }
  } catch {
    // Invalid JSON in eligibleDepartments
    return false;
  }

  // Check CGPA requirement
  if (student.academic.currentCGPA < drive.minCGPA) {
    return false;
  }

  // Check backlogs limit
  if (student.academic.activeBacklogs > drive.maxActiveBacklogs) {
    return false;
  }

  return true;
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
  drive: Drive
): string[] {
  const reasons: string[] = [];

  if (!student.academic) {
    reasons.push("Academic information not completed");
    return reasons; // Can't check other criteria without academic info
  }

  if (getDriveStatus(drive.applicationDeadline) !== "open") {
    reasons.push("Drive is closed");
  }

  try {
    const eligibleDeptIds: string[] = JSON.parse(drive.eligibleDepartments);
    if (!eligibleDeptIds.includes(student.departmentId)) {
      reasons.push("Your department is not eligible");
    }
  } catch {
    reasons.push("Invalid eligibility configuration");
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
