"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import type { Student, StudentAcademic, Department } from "@prisma/client";
import {
  ACTIVE_PLACEMENT_WHERE,
  PLACED_STUDENT_FILTER,
  UNPLACED_STUDENT_FILTER,
  resolvePlacementState,
  type PlacementState,
} from "../utils/placement-status";

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

  // Build where clause — departmentId is ALWAYS fixed to admin's own dept
  const where: any = {
    departmentId: department.id, // CRITICAL: never trust client-provided dept
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { rollNumber: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "placed") {
    Object.assign(where, PLACED_STUDENT_FILTER);
  } else if (status === "unplaced") {
    Object.assign(where, UNPLACED_STUDENT_FILTER);
    where.isPending = false;
    where.optedIn = true;
  } else if (status === "pending") {
    where.isPending = true;
  } else if (status === "opted-out") {
    where.isPending = false;
    where.optedIn = false;
  }

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
