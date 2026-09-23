"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { placedStudentSql } from "@/features/students/utils/placement-status";
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
  placementRate:   number;  // percentage 0–100
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
      COALESCE(a."adminCount", 0)         AS "adminCount",
      COALESCE(v."openDrives", 0)         AS "openDrives"
    FROM "Department" d
    LEFT JOIN (
      SELECT
        st."departmentId" AS did,
        COUNT(*)                                            AS "totalStudents",
        COUNT(*) FILTER (WHERE st."isPending" = false)      AS "registeredStudents",
        COUNT(*) FILTER (WHERE ${Prisma.raw(placedStudentSql('st'))}) AS "placedStudents"
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
    const registeredStudents = Number(row.registeredStudents);
    const placedStudents = Number(row.placedStudents);

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      isActive: row.isActive,
      totalStudents: Number(row.totalStudents),
      registeredStudents,
      placedStudents,
      placementRate:
        registeredStudents > 0
          ? Math.round((placedStudents / registeredStudents) * 100)
          : 0,
      adminCount: Number(row.adminCount),
      openDrives: Number(row.openDrives),
    };
  });
}
