import type { Drive } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_PLACEMENTS_SELECT,
  UNPLACED_STUDENT_FILTER,
} from "@/features/students/utils/placement-status";
import { isStudentAcademicallyEligibleForDrive } from "@/features/drives/queries/drive-eligibility";
import {
  eligibleDepartmentIdsOf,
  type HasEligibleDepartmentLinks,
} from "@/features/drives/utils/eligible-departments";
import { resolveDepartmentDriveWithRules } from "@/features/drives/domain/resolve-department-drive";

/**
 * Who a drive event reaches, resolved from the database — never passed in.
 *
 * Students are judged by `isStudentAcademicallyEligibleForDrive`, the same
 * function the student's drive list, the drive page and `applyToDrive` use,
 * against each department's own resolved drive (its rule set, its batches,
 * its role). So a student is notified about a drive exactly when the listing
 * would show it to them as open to apply:
 *
 * - department: only departments the drive is assigned to *and* that have
 *   published their instance; a caller can narrow the departments, never
 *   widen them;
 * - batch: the BATCH_YEAR rule is one of the rules evaluated;
 * - placement: a placed student is excluded (narrowed in SQL, then decided
 *   again, first, by the evaluator);
 * - standing: unapproved and opted-out students are excluded by the evaluator.
 */

export interface EligibleStudentRecipient {
  userId: string;
  departmentId: string;
  /** The role this student's department is hiring for (its override, if any). */
  roleName: string;
}

export interface DriveAudience {
  eligible: EligibleStudentRecipient[];
  /** Candidates with no academic record — eligible for nothing until they add it. */
  missingAcademic: { userId: string }[];
  /** Each published department drive as its students see it. */
  resolvedByDepartment: Map<string, { roleName: string; applicationDeadline: Date }>;
}

export async function resolveDriveAudience(
  drive: Drive & HasEligibleDepartmentLinks,
  departmentIds?: string[]
): Promise<DriveAudience> {
  const assigned = eligibleDepartmentIdsOf(drive);
  const requested = departmentIds ? assigned.filter((id) => departmentIds.includes(id)) : assigned;
  const empty: DriveAudience = { eligible: [], missingAcademic: [], resolvedByDepartment: new Map() };
  if (requested.length === 0) return empty;

  // Each published instance with its own rules, and the master's defaults —
  // loaded here, so a caller cannot make this evaluate against nothing.
  const [instances, masterRules] = await Promise.all([
    prisma.driveDepartmentConfig.findMany({
      where: { driveId: drive.id, departmentId: { in: requested }, status: "PUBLISHED" },
      include: { eligibilityRules: true },
    }),
    prisma.driveEligibilityRule.findMany({ where: { driveId: drive.id } }),
  ]);
  if (instances.length === 0) return empty;

  const resolvedByDepartment = new Map(
    instances.map((instance) => [
      instance.departmentId,
      resolveDepartmentDriveWithRules({ ...drive, eligibilityRules: masterRules }, instance),
    ])
  );

  const candidates = await prisma.student.findMany({
    where: {
      departmentId: { in: [...resolvedByDepartment.keys()] },
      isPending: false,
      optedIn: true,
      ...UNPLACED_STUDENT_FILTER,
      userId: { not: null },
    },
    include: {
      academic: true,
      skills: { select: { skillName: true } },
      placements: ACTIVE_PLACEMENTS_SELECT,
    },
  });

  const eligible: EligibleStudentRecipient[] = [];
  for (const student of candidates) {
    const resolved = resolvedByDepartment.get(student.departmentId);
    if (resolved && isStudentAcademicallyEligibleForDrive(student, resolved)) {
      eligible.push({
        userId: student.userId!,
        departmentId: student.departmentId,
        roleName: resolved.roleName,
      });
    }
  }

  return {
    eligible,
    missingAcademic: candidates
      .filter((student) => student.academic === null)
      .map((student) => ({ userId: student.userId! })),
    resolvedByDepartment,
  };
}

/** A drive with its department links, loaded for a fan-out or its retry. */
export async function loadDriveForAudience(driveId: string) {
  return prisma.drive.findUnique({
    where: { id: driveId },
    include: { eligibleDepartmentLinks: { select: { departmentId: true } } },
  });
}

/** Students of these departments who applied to the drive, with an account. */
export async function applicantRecipients(driveId: string, departmentIds: string[]) {
  const rows = await prisma.driveApplication.findMany({
    where: {
      driveId,
      student: { departmentId: { in: departmentIds }, userId: { not: null } },
    },
    select: { student: { select: { userId: true, departmentId: true } } },
  });
  return rows.map((row) => ({ userId: row.student.userId!, departmentId: row.student.departmentId }));
}
