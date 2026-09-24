"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import type { Student, StudentAcademic, Department } from "@prisma/client";
import {
  ACTIVE_PLACEMENT_WHERE,
  PLACEMENT_STATE_FILTERS,
  resolvePlacementState,
  type PlacementState,
} from "../utils/placement-status";
import { academicCycle, passoutYearForLevel } from "../domain/academic-year";

/**
 * One category in the roster's batch filter. "graduated" is not one passout
 * year but everyone whose batch has already crossed the July 1 cutover — an
 * open-ended range, unlike "third"/"fourth" which each mean exactly one
 * batch this academic cycle.
 */
export type RosterYearCategory = "third" | "fourth" | "graduated";

export type StudentRosterItem = Student & {
  academic: StudentAcademic | null;
  department: Pick<Department, "id" | "name" | "code">;
  _count: { skills: number; projects: number; applications: number };
  /**
   * Derived server-side from the student's applications — never a stored
   * column. See `utils/placement-status.ts`.
   */
  placementState: PlacementState;
  /** Companies that have selected this student, for the roster tooltip. */
  placedCompanies: string[];
};

export interface GetDepartmentStudentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  // "all" | "placed" | "unplaced" | "pending" | "opted-out"
  // pending  = isPending true (bulk-imported, not yet self-registered)
  // placed   = holds at least one SELECTED application
  // unplaced = registered, opted in, no SELECTED application
  status?: "all" | "placed" | "unplaced" | "pending" | "opted-out";
  /**
   * Zero or more categories, OR'd together; empty or omitted = every batch.
   * The year level is derived (never stored), so each category resolves to
   * the one passout year — or, for "graduated", the range — it currently
   * means.
   */
  years?: RosterYearCategory[];
}

export interface DepartmentStudentsResult {
  data: StudentRosterItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Get paginated, searchable student roster for the authenticated dept admin.
 * ALWAYS scoped to admin's own department — never returns cross-dept students.
 * Authorization: requireDepartmentAdmin()
 */
export async function getDepartmentStudents(
  params: GetDepartmentStudentsParams = {}
): Promise<DepartmentStudentsResult> {
  // Authorization: dept admin only, resolves department server-side
  const { department } = await requireDepartmentAdmin();

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim();
  const status = params.status ?? "all";

  // Typed, so a filter key that does not exist on Student is a compile error
  // rather than a clause Postgres ignores. departmentId is ALWAYS fixed to the
  // admin's own department and is written first so nothing below can reach it.
  // One filter per badge state, so a status button returns exactly the
  // students showing that badge (see PLACEMENT_STATE_FILTERS).
  const statusFilter: Prisma.StudentWhereInput =
    status === "placed"
      ? PLACEMENT_STATE_FILTERS.PLACED
      : status === "unplaced"
        ? PLACEMENT_STATE_FILTERS.ELIGIBLE
        : status === "pending"
          ? PLACEMENT_STATE_FILTERS.PENDING
          : status === "opted-out"
            ? PLACEMENT_STATE_FILTERS.OPTED_OUT
            : {};

  // Each selected category becomes one OR branch; a category picked more
  // than once just repeats a branch, which is harmless.
  const years = params.years ?? [];
  const yearOrClauses: Prisma.StudentWhereInput[] = years.map((category) =>
    category === "graduated"
      ? { expectedPassoutYear: { lt: academicCycle().finalYearPassout } }
      : {
          expectedPassoutYear: passoutYearForLevel(
            category === "third" ? "THIRD_YEAR" : "FOURTH_YEAR"
          ),
        }
  );

  const where: Prisma.StudentWhereInput = {
    ...statusFilter,
    // A top-level `OR` for the year categories; the search clause below nests
    // its own OR inside `AND` instead, so the two never collide as the same
    // Prisma key.
    ...(yearOrClauses.length > 0 ? { OR: yearOrClauses } : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { rollNumber: { contains: search, mode: "insensitive" as const } },
                { misNumber: { contains: search, mode: "insensitive" as const } },
                { prnNumber: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : {}),
    departmentId: department.id, // CRITICAL: never trust client-provided dept
  };

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      // Four relations per row would otherwise be four extra queries.
      relationLoadStrategy: "join",
      where,
      skip,
      take: pageSize,
      orderBy: [{ name: "asc" }],
      include: {
        academic: true,
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { skills: true, projects: true, applications: true } },
        // Only active placements, so placement state and the company list
        // come from one query rather than a per-row follow-up.
        placements: {
          where: ACTIVE_PLACEMENT_WHERE,
          select: { companyName: true },
        },
      },
    }),
  ]);

  return {
    data: data.map(({ placements, ...student }) => ({
      ...student,
      placementState: resolvePlacementState({
        isPending: student.isPending,
        optedIn: student.optedIn,
        isPlaced: placements.length > 0,
      }),
      placedCompanies: placements.map((placement) => placement.companyName),
    })),
    page,
    pageSize,
    totalCount,
  };
}
