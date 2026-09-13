"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import type { Student, StudentAcademic, Department } from "@prisma/client";

export type StudentRosterItem = Student & {
  academic: StudentAcademic | null;
  department: Pick<Department, "id" | "name" | "code">;
  _count: { skills: number; projects: number; applications: number };
};

export interface GetDepartmentStudentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  // "all" | "placed" | "unplaced" | "pending"
  // pending = isPending true (bulk-imported, not yet self-registered)
  status?: "all" | "placed" | "unplaced" | "pending";
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
    where.placementStatus = "placed";
  } else if (status === "unplaced") {
    where.placementStatus = "unplaced";
    where.isPending = false;
  } else if (status === "pending") {
    where.isPending = true;
  }

  const totalCount = await prisma.student.count({ where });

  const data = await prisma.student.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [{ name: "asc" }],
    include: {
      academic: true,
      department: { select: { id: true, name: true, code: true } },
      _count: { select: { skills: true, projects: true, applications: true } },
    },
  });

  return { data, page, pageSize, totalCount };
}
