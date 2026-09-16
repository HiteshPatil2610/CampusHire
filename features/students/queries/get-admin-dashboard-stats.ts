"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { UNPLACED_STUDENT_FILTER } from "../utils/placement-status";

export interface AdminDashboardStats {
  totalStudents: number;
  placedStudents: number; // holds at least one SELECTED application
  optedOutStudents: number; // registered but not participating in placement
  pendingStudents: number; // bulk-imported, not yet registered
  openDrivesCount: number; // drives with deadline in the future
  placementRate: number; // percentage (0–100)
  studentsNeedingAttention: Array<{
    id: string;
    name: string;
    rollNumber: string | null;
    cgpa: number | null;
    activeBacklogs: number;
  }>;
}

/**
 * Get admin dashboard KPI stats + attention list, scoped to admin's dept.
 * Authorization: requireDepartmentAdmin()
 */
/**
 * Get admin dashboard KPI stats + attention list, scoped to admin's dept.
 * Authorization: requireDepartmentAdmin()
 *
 * The five KPI counts are one statement rather than five round trips — same
 * table, same department, differing only by filter, which is what
 * `COUNT(*) FILTER` is for. The attention list is a separate query because it
 * returns rows rather than a number, and it runs alongside rather than after.
 *
 * `placedStudents` mirrors PLACED_STUDENT_FILTER: at least one SELECTED
 * application. Placement is derived, never stored — keep this in step with
 * that filter.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { department } = await requireDepartmentAdmin();
  const deptId = department.id;

  const [[counts], needingAttention] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        totalStudents: bigint;
        placedStudents: bigint;
        optedOutStudents: bigint;
        pendingStudents: bigint;
        openDrivesCount: bigint;
      }>
    >`
      SELECT
        COUNT(*)                                                       AS "totalStudents",
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "DriveApplication" da
          WHERE da."studentId" = s."id" AND da."status" = 'SELECTED'
        ))                                                             AS "placedStudents",
        COUNT(*) FILTER (WHERE s."isPending" = false
                           AND s."optedIn" = false)                    AS "optedOutStudents",
        COUNT(*) FILTER (WHERE s."isPending" = true)                   AS "pendingStudents",
        (SELECT COUNT(*) FROM "Drive" d
          WHERE d."departmentId" = ${deptId}
            AND d."applicationDeadline" > NOW())                       AS "openDrivesCount"
      FROM "Student" s
      WHERE s."departmentId" = ${deptId}
    `,
    // Students still seeking a placement and carrying active backlogs. A
    // student who opted out is not "needing attention".
    prisma.student.findMany({
      where: {
        departmentId: deptId,
        isPending: false,
        optedIn: true,
        ...UNPLACED_STUDENT_FILTER,
        academic: { activeBacklogs: { gt: 0 } },
      },
      take: 5,
      orderBy: { name: "asc" },
      include: {
        academic: { select: { currentCGPA: true, activeBacklogs: true } },
      },
    }),
  ]);

  const n = (value: bigint) => Number(value);
  const totalStudents = n(counts.totalStudents);
  const placedStudents = n(counts.placedStudents);

  const placementRate =
    totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;

  return {
    totalStudents,
    placedStudents,
    optedOutStudents: n(counts.optedOutStudents),
    pendingStudents: n(counts.pendingStudents),
    openDrivesCount: n(counts.openDrivesCount),
    placementRate,
    studentsNeedingAttention: needingAttention.map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      cgpa: s.academic?.currentCGPA ?? null,
      activeBacklogs: s.academic?.activeBacklogs ?? 0,
    })),
  };
}
