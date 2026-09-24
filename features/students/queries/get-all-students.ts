"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import type { Student, StudentAcademic, Department } from "@prisma/client";
import {
  ACTIVE_PLACEMENT_WHERE,
  PLACEMENT_STATE_FILTERS,
  NOT_PLACED_STUDENT_FILTER,
  NOT_YET_ELIGIBLE_STUDENT_FILTER,
  resolvePlacementState,
  type PlacementState,
} from "../utils/placement-status";
import { getInstitutionBatchYears } from "./department-batch-years";

/**
 * The institution-wide student directory (Phase 9, Item 21) — every
 * department, unlike `getDepartmentStudents` which is scoped to one.
 * Authorization: Super Admin only. A department admin has no equivalent
 * query; `getDepartmentStudents` is the one they use, and it can never widen
 * past their own department.
 */

export type AllStudentsPlacementFilter = "all" | "placed" | "not-placed" | "not-yet-eligible";

export interface GetAllStudentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  deptId?: string;
  /** `Student.expectedPassoutYear`. */
  batchYear?: number | null;
  status?: AllStudentsPlacementFilter;
  /** Only students carrying active backlogs. Independent of `status`, so
   *  "Not placed" + this is the old "Needs Attention" view. */
  hasBacklogs?: boolean;
}

export type AllStudentsRow = Student & {
  academic: StudentAcademic | null;
  department: Pick<Department, "id" | "name" | "code">;
  placementState: PlacementState;
  placedCompanies: string[];
};

export interface AllStudentsResult {
  data: AllStudentsRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function getAllStudents(
  params: GetAllStudentsParams = {}
): Promise<AllStudentsResult> {
  await requireSuperAdmin();

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 50, 100);
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim();
  const status = params.status ?? "all";
  const batchYear = params.batchYear ?? null;

  const statusFilter: Prisma.StudentWhereInput =
    status === "placed"
      ? PLACEMENT_STATE_FILTERS.PLACED
      : status === "not-placed"
        ? NOT_PLACED_STUDENT_FILTER
        : status === "not-yet-eligible"
          ? NOT_YET_ELIGIBLE_STUDENT_FILTER
          : {};

  // Department, batch and status are independent AND'd conditions; search
  // nests its own OR inside `AND` so it can never collide with
  // `not-yet-eligible`'s own top-level OR key.
  const where: Prisma.StudentWhereInput = {
    ...statusFilter,
    ...(params.deptId ? { departmentId: params.deptId } : {}),
    ...(batchYear !== null ? { expectedPassoutYear: batchYear } : {}),
    ...(params.hasBacklogs ? { academic: { activeBacklogs: { gt: 0 } } } : {}),
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
  };

  const [totalCount, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ department: { code: "asc" } }, { rollNumber: "asc" }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        academic: true,
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

/**
 * Every batch on record, institution-wide, for the batch filter dropdown —
 * the same list the Super Admin's drive form offers. Authorized here because
 * this file is a server action; `getInstitutionBatchYears` itself is not.
 */
export async function getAllStudentsBatches(): Promise<number[]> {
  await requireSuperAdmin();
  return (await getInstitutionBatchYears()).map((batch) => batch.year);
}
