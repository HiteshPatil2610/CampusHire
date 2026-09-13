import { prisma } from "@/lib/prisma";
import type { Drive, DriveApplication } from "@prisma/client";
import { getDriveDisplayStatus } from "@/features/drives/utils/drive-status";
import { parseJsonArray } from "@/lib/parse-json-array";

/**
 * A drive paired with everything the student dashboard needs to render its
 * card: the caller's own application (if any), how many students applied, and
 * the human-readable department codes the drive is open to.
 */
export interface DashboardDrive {
  drive: Drive;
  application: DriveApplication | null;
  applicantCount: number;
  departmentCodes: string[];
}

export interface StudentDashboardData {
  /** Drives surfaced as cards - applied drives first, then closest deadline. */
  featured: DashboardDrive[];
  /** Every drive the student can see, for the "Active drives" table. */
  all: DashboardDrive[];
  totalApplications: number;
  openDriveCount: number;
}

/**
 * Load the drives a student may see, together with their own application
 * state. Eligibility filtering happens against the drives already resolved by
 * the caller, so this never widens what a student can see.
 */
export async function getStudentDashboardData(
  studentId: string,
  eligibleDrives: Drive[],
  featuredLimit = 4
): Promise<StudentDashboardData> {
  const driveIds = eligibleDrives.map((drive) => drive.id);

  const [applications, totalApplications, counts, departments] =
    await Promise.all([
      prisma.driveApplication.findMany({
        where: { studentId, driveId: { in: driveIds } },
      }),
      prisma.driveApplication.count({ where: { studentId } }),
      driveIds.length
        ? prisma.driveApplication.groupBy({
            by: ["driveId"],
            where: { driveId: { in: driveIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { driveId: string; _count: { _all: number } }[]),
      prisma.department.findMany({ select: { id: true, code: true } }),
    ]);

  const applicationByDrive = new Map(
    applications.map((application) => [application.driveId, application])
  );
  const countByDrive = new Map(
    counts.map((row) => [row.driveId, row._count._all])
  );
  const codeByDepartment = new Map(
    departments.map((department) => [department.id, department.code])
  );

  const all: DashboardDrive[] = eligibleDrives.map((drive) => ({
    drive,
    application: applicationByDrive.get(drive.id) ?? null,
    applicantCount: countByDrive.get(drive.id) ?? 0,
    departmentCodes: parseJsonArray(drive.eligibleDepartments)
      .map((id) => codeByDepartment.get(id))
      .filter((code): code is string => Boolean(code)),
  }));

  const now = new Date();
  const openDriveCount = all.filter(
    (item) => item.drive.applicationDeadline > now
  ).length;

  // Applied drives lead the card row, then still-open drives by nearest
  // deadline, so the student sees what needs action first.
  const featured = [...all]
    .sort((a, b) => {
      const rankA = featureRank(a, now);
      const rankB = featureRank(b, now);
      if (rankA !== rankB) return rankA - rankB;
      return (
        a.drive.applicationDeadline.getTime() -
        b.drive.applicationDeadline.getTime()
      );
    })
    .slice(0, featuredLimit);

  return { featured, all, totalApplications, openDriveCount };
}

function featureRank(item: DashboardDrive, now: Date): number {
  if (item.application) return 0;
  const status = getDriveDisplayStatus(
    item.drive.applicationDeadline,
    item.drive.driveDate
  );
  if (status === "open") return 1;
  if (status === "upcoming") return 2;
  return 3;
}
