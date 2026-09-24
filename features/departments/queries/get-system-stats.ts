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

export interface SystemStats {
  totalStudents:     number;
  registeredStudents: number; // isPending = false
  pendingStudents:   number;  // isPending = true (bulk-imported, not yet registered)
  totalDepartments:  number;
  activeDepartments: number;
  totalAdmins:       number;
  totalDrives:       number;
  openDrives:        number;  // taking applications now (openApplicationSql)
  placedStudents:    number;  // holds an active placement
  optedOutStudents:  number;  // registered but not participating in placement
  /** Placed ÷ eligible pool (`eligiblePoolSql`), 0–100 — the same Placement
   *  Rate the department dashboards show. */
  overallPlacementRate: number;
}

/**
 * Every figure on this card is a COUNT over one of three tables, so they all
 * resolve in a single statement rather than nine round trips. Postgres reads
 * each table once and applies the filters as aggregate FILTER clauses; issuing
 * them separately cost nine network hops and, with `connection_limit=5`, ran
 * as two serial batches rather than truly in parallel.
 *
 * `placedStudents` uses `placedStudentSql` — the same definition as
 * PLACED_STUDENT_FILTER (an active StudentPlacement), from the same module.
 */
export async function getSystemStats(): Promise<SystemStats> {
  await requireSuperAdmin();

  const [row] = await prisma.$queryRaw<
    Array<
      Record<keyof Omit<SystemStats, "pendingStudents" | "overallPlacementRate">, bigint> & {
        eligibleStudents: bigint;
        placedInPool: bigint;
      }
    >
  >`
    SELECT
      (SELECT COUNT(*) FROM "Student")                                    AS "totalStudents",
      (SELECT COUNT(*) FROM "Student" WHERE "isPending" = false)          AS "registeredStudents",
      (SELECT COUNT(*) FROM "Department")                                 AS "totalDepartments",
      (SELECT COUNT(*) FROM "Department" WHERE "isActive" = true)         AS "activeDepartments",
      (SELECT COUNT(*) FROM "DepartmentAdmin")                            AS "totalAdmins",
      (SELECT COUNT(*) FROM "Drive")                                      AS "totalDrives",
      (SELECT COUNT(*) FROM "Drive" WHERE ${Prisma.raw(openApplicationSql())}) AS "openDrives",
      (SELECT COUNT(*) FROM "Student" s WHERE ${Prisma.raw(placedStudentSql('s'))}) AS "placedStudents",
      (SELECT COUNT(*) FROM "Student"
        WHERE "isPending" = false AND "optedIn" = false)                  AS "optedOutStudents",
      (SELECT COUNT(*) FROM "Student" s
        WHERE ${Prisma.raw(eligiblePoolSql('s'))})                        AS "eligibleStudents",
      (SELECT COUNT(*) FROM "Student" s
        WHERE ${Prisma.raw(eligiblePoolSql('s'))}
          AND ${Prisma.raw(placedStudentSql('s'))})                       AS "placedInPool"
  `;

  // COUNT() comes back as bigint over the wire; these are screen-sized numbers.
  const n = (value: bigint) => Number(value);

  const totalStudents = n(row.totalStudents);
  const registeredStudents = n(row.registeredStudents);
  const placedStudents = n(row.placedStudents);

  const overallPlacementRate = percentOfPool(n(row.placedInPool), n(row.eligibleStudents));

  return {
    totalStudents,
    registeredStudents,
    pendingStudents: totalStudents - registeredStudents,
    totalDepartments: n(row.totalDepartments),
    activeDepartments: n(row.activeDepartments),
    totalAdmins: n(row.totalAdmins),
    totalDrives: n(row.totalDrives),
    openDrives: n(row.openDrives),
    placedStudents,
    optedOutStudents: n(row.optedOutStudents),
    overallPlacementRate,
  };
}
