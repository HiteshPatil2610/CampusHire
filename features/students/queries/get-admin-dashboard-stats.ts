"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import {
  UNPLACED_STUDENT_FILTER,
  eligiblePoolSql,
  percentOfPool,
  placedStudentSql,
} from "../utils/placement-status";
import { Prisma } from "@prisma/client";
import { openApplicationSql } from "@/features/drives/utils/drive-status";

export interface AdminDashboardStats {
  totalStudents: number;
  placedStudents: number; // holds an active placement
  optedOutStudents: number; // registered but not participating in placement
  pendingStudents: number; // bulk-imported, not yet registered
  openDrivesCount: number; // drives with deadline in the future
  /** Placed ÷ eligible pool (`eligiblePoolSql`), 0–100 — the same Placement
   *  Rate as Department Insights and the Super Admin's reports. */
  placementRate: number;
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
 * `placedStudents` uses `placedStudentSql` — the same definition as
 * PLACED_STUDENT_FILTER (an active StudentPlacement), from the same module.
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
        eligibleStudents: bigint;
        placedInPool: bigint;
      }>
    >`
      SELECT
        COUNT(*)                                                       AS "totalStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(placedStudentSql('s'))}) AS "placedStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(eligiblePoolSql('s'))}) AS "eligibleStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(eligiblePoolSql('s'))}
                           AND ${Prisma.raw(placedStudentSql('s'))}) AS "placedInPool",
        COUNT(*) FILTER (WHERE s."isPending" = false
                           AND s."optedIn" = false)                    AS "optedOutStudents",
        COUNT(*) FILTER (WHERE s."isPending" = true)                   AS "pendingStudents",
        (SELECT COUNT(*) FROM "Drive" d
          WHERE d."departmentId" = ${deptId}
            AND ${Prisma.raw(openApplicationSql("d"))})              AS "openDrivesCount"
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

  const placementRate = percentOfPool(n(counts.placedInPool), n(counts.eligibleStudents));

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
