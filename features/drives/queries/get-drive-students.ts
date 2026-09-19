"use server";

import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { resolveDepartmentDriveWithRules } from "../domain/resolve-department-drive";
import { evaluateStudentForDrive } from "./drive-eligibility";

/** Where a student stands for this drive, as decided by the eligibility engine. */
export type DriveStudentEligibility = "ELIGIBLE" | "PLACED" | "INELIGIBLE";

export interface DriveStudentRow {
  id: string;
  name: string;
  rollNumber: string | null;
  batchYear: number | null;
  /** Signed up (has an account), as opposed to imported and waiting. */
  registered: boolean;
  eligibility: DriveStudentEligibility;
  /** The first reason, when not eligible. */
  reason: string | null;
  placed: boolean;
  application: {
    status: ApplicationStatus;
    stageName: string | null;
  } | null;
}

export interface DriveStudents {
  students: DriveStudentRow[];
  /** Batch years present in the department, for the filter. */
  batchYears: number[];
  /** True when the list was cut at the cap. */
  truncated: boolean;
}

const MAX_STUDENTS = 3000;

/**
 * Every student of the calling department, judged for one drive by the same
 * evaluator the student's drive list, `applyToDrive` and the notifications
 * use — standing first (a placed student stops there), then department, then
 * every rule of this department's set including batch. Nothing here is
 * recalculated in the UI; the client only filters what this returns.
 *
 * Also carries each student's application (status and stage) if they applied,
 * so one list serves Eligible Students and Registered Students.
 *
 * Authorization: DEPT_ADMIN; the department comes from the session. A drive
 * the department does not run reads as not found.
 */
export async function getDriveStudents(driveId: string): Promise<DriveStudents> {
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: String(driveId) },
    include: {
      ...eligibleDepartmentLinksInclude,
      eligibilityRules: true,
      departmentConfigs: {
        where: { departmentId: department.id },
        include: { eligibilityRules: true },
      },
    },
  });

  const runs =
    drive &&
    (drive.departmentId === department.id ||
      drive.eligibleDepartmentLinks.some((link) => link.departmentId === department.id));
  if (!drive || !runs) throw new AuthorizationError("Drive not found");

  const { departmentConfigs, ...master } = drive;
  const resolved = resolveDepartmentDriveWithRules(master, departmentConfigs[0] ?? null);

  const students = await prisma.student.findMany({
    where: { departmentId: department.id },
    take: MAX_STUDENTS + 1,
    orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
    include: {
      academic: true,
      skills: { select: { skillName: true } },
      placements: ACTIVE_PLACEMENTS_SELECT,
      applications: {
        where: { driveId: drive.id },
        select: { status: true, currentStage: { select: { name: true } } },
        take: 1,
      },
    },
  });

  const truncated = students.length > MAX_STUDENTS;
  const rows: DriveStudentRow[] = students.slice(0, MAX_STUDENTS).map((student) => {
    const evaluation = evaluateStudentForDrive(student, resolved);
    const hasAcademic = student.academic !== null;
    const eligible = evaluation.eligible && hasAcademic;
    const application = student.applications[0] ?? null;

    return {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      batchYear: student.batchYear,
      registered: student.userId !== null,
      eligibility: eligible
        ? "ELIGIBLE"
        : evaluation.blockedBy === "PLACED"
          ? "PLACED"
          : "INELIGIBLE",
      reason: eligible
        ? null
        : !hasAcademic && !evaluation.blockedBy
          ? "Academic information not completed"
          : evaluation.reasons[0] ?? "Not eligible",
      placed: student.placements.length > 0,
      application: application
        ? { status: application.status, stageName: application.currentStage?.name ?? null }
        : null,
    };
  });

  const batchYears = [
    ...new Set(rows.map((row) => row.batchYear).filter((year): year is number => year !== null)),
  ].sort((a, b) => b - a);

  return { students: rows, batchYears, truncated };
}
