"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export interface SystemStats {
  totalStudents:     number;
  registeredStudents: number; // isPending = false
  pendingStudents:   number;  // isPending = true (bulk-imported, not yet registered)
  totalDepartments:  number;
  activeDepartments: number;
  totalAdmins:       number;
  totalDrives:       number;
  openDrives:        number;  // applicationDeadline > now
  placedStudents:    number;  // holds at least one SELECTED application
  optedOutStudents:  number;  // registered but not participating in placement
  overallPlacementRate: number; // percentage 0–100
}

/**
 * Every figure on this card is a COUNT over one of three tables, so they all
 * resolve in a single statement rather than nine round trips. Postgres reads
 * each table once and applies the filters as aggregate FILTER clauses; issuing
 * them separately cost nine network hops and, with `connection_limit=5`, ran
 * as two serial batches rather than truly in parallel.
 *
 * `placedStudents` mirrors PLACED_STUDENT_FILTER: at least one SELECTED
 * application. Keep the two definitions in step — placement is derived, never
 * stored, and this is the one place it is expressed as raw SQL.
 */
export async function getSystemStats(): Promise<SystemStats> {
  await requireSuperAdmin();

  const [row] = await prisma.$queryRaw<
    Array<Record<keyof Omit<SystemStats, "pendingStudents" | "overallPlacementRate">, bigint>>
  >`
    SELECT
      (SELECT COUNT(*) FROM "Student")                                    AS "totalStudents",
      (SELECT COUNT(*) FROM "Student" WHERE "isPending" = false)          AS "registeredStudents",
      (SELECT COUNT(*) FROM "Department")                                 AS "totalDepartments",
      (SELECT COUNT(*) FROM "Department" WHERE "isActive" = true)         AS "activeDepartments",
      (SELECT COUNT(*) FROM "DepartmentAdmin")                            AS "totalAdmins",
      (SELECT COUNT(*) FROM "Drive")                                      AS "totalDrives",
      (SELECT COUNT(*) FROM "Drive" WHERE "applicationDeadline" > NOW())  AS "openDrives",
      (SELECT COUNT(*) FROM "Student" s WHERE EXISTS (
         SELECT 1 FROM "DriveApplication" da
         WHERE da."studentId" = s."id" AND da."status" = 'SELECTED'))     AS "placedStudents",
      (SELECT COUNT(*) FROM "Student"
        WHERE "isPending" = false AND "optedIn" = false)                  AS "optedOutStudents"
  `;

  // COUNT() comes back as bigint over the wire; these are screen-sized numbers.
  const n = (value: bigint) => Number(value);

  const totalStudents = n(row.totalStudents);
  const registeredStudents = n(row.registeredStudents);
  const placedStudents = n(row.placedStudents);

  const overallPlacementRate =
    registeredStudents > 0
      ? Math.round((placedStudents / registeredStudents) * 100)
      : 0;

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
