"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { eligiblePoolSql, placedStudentSql, percentOfPool } from "../utils/placement-status";
import { openApplicationSql } from "@/features/drives/utils/drive-status";
import { getDepartmentBatchYears } from "./department-batch-years";

/**
 * Department Insights (Phase 9, Item 20).
 *
 * The funnel: **eligible** (`eligiblePoolSql` — registered, and opted in or
 * already placed; the same pool every Placement Rate in the app uses) →
 * **applied** (of those, who has applied to at least one drive) → **placed**
 * (of those, who holds an active placement). Placement
 * rate and participation rate are both fractions of the *eligible* pool, not
 * of every student on the roster — a pending or opted-out student was never
 * in the running, so they should not silently drag either rate down.
 *
 * Every count reads the same tables and the same definitions everything else
 * in the app uses — `placedStudentSql` (placement-status.ts) and
 * `openApplicationSql` (drive-status.ts) — nothing here re-derives "placed"
 * or "open" its own way. One statement, `COUNT(*) FILTER`, so filtering by
 * batch or semester changes every count together rather than requiring N
 * separate queries that could disagree.
 */

export interface DepartmentInsightsFilters {
  /** `Student.expectedPassoutYear`. */
  batchYear?: number | null;
  /** `StudentAcademic.currentSemester`. */
  semester?: number | null;
}

export interface DepartmentInsights {
  totalStudents: number;
  eligibleStudents: number;
  appliedStudents: number;
  placedStudents: number;
  /** Placed / Eligible, 0–100. */
  placementRate: number;
  /** Applied / Eligible, 0–100. */
  participationRate: number;
  /** Drives currently taking applications, for this department. Not
   *  affected by the batch/semester filter — a drive is not a student row. */
  activeDrivesCount: number;
  /** Distinct batches on the roster, for the filter dropdown. */
  availableBatches: number[];
  /** Distinct semesters on record, for the filter dropdown. */
  availableSemesters: number[];
}

export async function getDepartmentInsights(
  filters: DepartmentInsightsFilters = {}
): Promise<DepartmentInsights> {
  const { department } = await requireDepartmentAdmin();
  const deptId = department.id;
  const batchYear = filters.batchYear ?? null;
  const semester = filters.semester ?? null;

  const [[counts], batchRows, semesterRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        totalStudents: bigint;
        eligibleStudents: bigint;
        appliedStudents: bigint;
        placedStudents: bigint;
        activeDrivesCount: bigint;
      }>
    >`
      SELECT
        COUNT(*) AS "totalStudents",
        COUNT(*) FILTER (
          WHERE ${Prisma.raw(eligiblePoolSql("s"))}
        ) AS "eligibleStudents",
        COUNT(*) FILTER (
          WHERE ${Prisma.raw(eligiblePoolSql("s"))}
            AND EXISTS (SELECT 1 FROM "DriveApplication" da WHERE da."studentId" = s.id)
        ) AS "appliedStudents",
        COUNT(*) FILTER (
          WHERE ${Prisma.raw(eligiblePoolSql("s"))}
            AND ${Prisma.raw(placedStudentSql("s"))}
        ) AS "placedStudents",
        (SELECT COUNT(*) FROM "Drive" d
          WHERE d."departmentId" = ${deptId}
            AND ${Prisma.raw(openApplicationSql("d"))}) AS "activeDrivesCount"
      FROM "Student" s
      LEFT JOIN "StudentAcademic" sa ON sa."studentId" = s.id
      WHERE s."departmentId" = ${deptId}
        AND (${batchYear}::int IS NULL OR s."expectedPassoutYear" = ${batchYear}::int)
        AND (${semester}::int IS NULL OR sa."currentSemester" = ${semester}::int)
    `,
    getDepartmentBatchYears(deptId),
    prisma.studentAcademic.findMany({
      where: { student: { departmentId: deptId } },
      distinct: ["currentSemester"],
      select: { currentSemester: true },
      orderBy: { currentSemester: "asc" },
    }),
  ]);

  const n = (value: bigint) => Number(value);
  const totalStudents = n(counts.totalStudents);
  const eligibleStudents = n(counts.eligibleStudents);
  const appliedStudents = n(counts.appliedStudents);
  const placedStudents = n(counts.placedStudents);

  return {
    totalStudents,
    eligibleStudents,
    appliedStudents,
    placedStudents,
    placementRate: percentOfPool(placedStudents, eligibleStudents),
    participationRate: percentOfPool(appliedStudents, eligibleStudents),
    activeDrivesCount: n(counts.activeDrivesCount),
    availableBatches: batchRows.map((batch) => batch.year),
    availableSemesters: semesterRows.map((row) => row.currentSemester),
  };
}
