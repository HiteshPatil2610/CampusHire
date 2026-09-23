"use server";

import { SEMESTER_MARKS_SELECT } from "@/features/drives/domain/eligibility-evaluator";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { resolveDepartmentDriveWithRules } from "../domain/resolve-department-drive";
import { evaluateStudentForDrive } from "./drive-eligibility";

export interface DriveEligibleStudents {
  totalStudents: number;
  eligible: { id: string; name: string; rollNumber: string | null; expectedPassoutYear: number | null }[];
  /** Why the rest are not eligible, most common first: reason → count. */
  ineligibleReasons: { reason: string; students: number }[];
  placedExcluded: number;
}

/**
 * Which of the calling department's students are eligible for this drive, as
 * its **saved** configuration stands — the list a department admin checks
 * before publishing, and the population the notification fan-out will reach.
 *
 * Decided per student by the same evaluator the student's list, the apply
 * action and the notifications use: standing first (a placed student stops
 * there), then department, then every rule including batch. SQL narrows only
 * to the department; nothing about eligibility is prefiltered.
 *
 * Authorization: DEPT_ADMIN; the department and its instance come from the
 * session, never the request.
 */
export async function getDepartmentDriveEligibleStudents(
  driveId: string
): Promise<DriveEligibleStudents> {
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: {
      ...eligibleDepartmentLinksInclude,
      eligibilityRules: true,
      departmentConfigs: {
        where: { departmentId: department.id },
        include: { eligibilityRules: true },
      },
    },
  });

  // A drive this department does not run reads the same as a missing one.
  const runs =
    drive &&
    (drive.departmentId === department.id ||
      drive.eligibleDepartmentLinks.some((link) => link.departmentId === department.id));
  if (!drive || !runs) {
    throw new AuthorizationError("Drive not found");
  }

  const { departmentConfigs, ...master } = drive;
  const resolved = resolveDepartmentDriveWithRules(master, departmentConfigs[0] ?? null);

  const students = await prisma.student.findMany({
    where: { departmentId: department.id },
    include: {
      academic: true,
      skills: { select: { skillName: true } },
      placements: ACTIVE_PLACEMENTS_SELECT,
      // Semesters with marks: the final-year marks gate reads them.
      semesterMarks: SEMESTER_MARKS_SELECT,
    },
    orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
  });

  const eligible: DriveEligibleStudents["eligible"] = [];
  const reasons = new Map<string, number>();
  let placedExcluded = 0;

  for (const student of students) {
    const evaluation = evaluateStudentForDrive(student, resolved);
    const hasAcademic = student.academic !== null;

    if (evaluation.eligible && hasAcademic) {
      eligible.push({
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        expectedPassoutYear: student.expectedPassoutYear,
      });
      continue;
    }

    if (evaluation.blockedBy === "PLACED") placedExcluded += 1;

    // One reason per student — the first — so the counts add up to the
    // number of ineligible students.
    const reason = !hasAcademic && !evaluation.blockedBy
      ? "Academic information not completed"
      : evaluation.reasons[0] ?? "Not eligible";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return {
    totalStudents: students.length,
    eligible,
    ineligibleReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, students: count }))
      .sort((a, b) => b.students - a.students),
    placedExcluded,
  };
}
