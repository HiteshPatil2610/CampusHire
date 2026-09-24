"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  eligiblePoolSql,
  percentOfPool,
  placedStudentSql,
} from "@/features/students/utils/placement-status";
import { requireSuperAdmin } from "@/lib/auth";
import { openApplicationSql } from "@/features/drives/utils/drive-status";

export interface DepartmentMatrixRow {
  id:              string;
  name:            string;
  code:            string;
  isActive:        boolean;
  totalStudents:   number;
  registeredStudents: number;
  placedStudents:  number;
  /** The eligible pool (`eligiblePoolSql`): registered, and opted in or placed. */
  eligibleStudents: number;
  /** Of the eligible pool, applied to at least one drive. */
  appliedStudents: number;
  /** Of the eligible pool, holds an active placement. */
  placedInPool:    number;
  /** Placed ÷ eligible pool, 0–100 — the same Placement Rate every screen shows. */
  placementRate:   number;
  adminCount:      number;
  openDrives:      number;
}

/**
 * One row per department, resolved in a single statement.
 *
 * This previously issued four COUNT queries *per department* on top of the
 * department list — 4N + 1 round trips, so the page got linearly slower with
 * every department added. The counts are now lateral aggregates over the same
 * scan, which is one round trip no matter how many departments exist.
 *
 * `placedStudents` uses `placedStudentSql` — the same definition as
 * PLACED_STUDENT_FILTER (an active StudentPlacement), from the same module.
 */
export async function getDepartmentMatrix(): Promise<DepartmentMatrixRow[]> {
  await requireSuperAdmin();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      isActive: boolean;
      totalStudents: bigint;
      registeredStudents: bigint;
      placedStudents: bigint;
      eligibleStudents: bigint;
      appliedStudents: bigint;
      placedInPool: bigint;
      adminCount: bigint;
      openDrives: bigint;
    }>
  >`
    SELECT
      d."id",
      d."name",
      d."code",
      d."isActive",
      COALESCE(s."totalStudents", 0)      AS "totalStudents",
      COALESCE(s."registeredStudents", 0) AS "registeredStudents",
      COALESCE(s."placedStudents", 0)     AS "placedStudents",
      COALESCE(s."eligibleStudents", 0)   AS "eligibleStudents",
      COALESCE(s."appliedStudents", 0)    AS "appliedStudents",
      COALESCE(s."placedInPool", 0)       AS "placedInPool",
      COALESCE(a."adminCount", 0)         AS "adminCount",
      COALESCE(v."openDrives", 0)         AS "openDrives"
    FROM "Department" d
    LEFT JOIN (
      SELECT
        st."departmentId" AS did,
        COUNT(*)                                            AS "totalStudents",
        COUNT(*) FILTER (WHERE st."isPending" = false)      AS "registeredStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(placedStudentSql('st'))}) AS "placedStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(eligiblePoolSql('st'))}) AS "eligibleStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(eligiblePoolSql('st'))}
                           AND EXISTS (SELECT 1 FROM "DriveApplication" da
                                        WHERE da."studentId" = st."id")) AS "appliedStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(eligiblePoolSql('st'))}
                           AND ${Prisma.raw(placedStudentSql('st'))}) AS "placedInPool"
      FROM "Student" st
      GROUP BY st."departmentId"
    ) s ON s.did = d."id"
    LEFT JOIN (
      SELECT "departmentId" AS did, COUNT(*) AS "adminCount"
      FROM "DepartmentAdmin"
      GROUP BY "departmentId"
    ) a ON a.did = d."id"
    LEFT JOIN (
      SELECT "departmentId" AS did, COUNT(*) AS "openDrives"
      FROM "Drive"
      WHERE ${Prisma.raw(openApplicationSql())}
      GROUP BY "departmentId"
    ) v ON v.did = d."id"
    ORDER BY d."code" ASC
  `;

  return rows.map((row) => {
    const eligibleStudents = Number(row.eligibleStudents);
    const placedInPool = Number(row.placedInPool);

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      isActive: row.isActive,
      totalStudents: Number(row.totalStudents),
      registeredStudents: Number(row.registeredStudents),
      placedStudents: Number(row.placedStudents),
      eligibleStudents,
      appliedStudents: Number(row.appliedStudents),
      placedInPool,
      placementRate: percentOfPool(placedInPool, eligibleStudents),
      adminCount: Number(row.adminCount),
      openDrives: Number(row.openDrives),
    };
  });
}
