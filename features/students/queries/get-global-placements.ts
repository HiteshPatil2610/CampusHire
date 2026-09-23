"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export interface GlobalPlacementFilters {
  page?: number;
  pageSize?: number;
  departmentId?: string;
  company?: string;
  expectedPassoutYear?: number;
  driveId?: string;
  /** Matches the student's name, roll number or email. */
  search?: string;
  /** ISO dates (YYYY-MM-DD), inclusive. */
  from?: string;
  to?: string;
  /** "active" (default) or "revoked" or "all". */
  status?: "active" | "revoked" | "all";
}

export interface GlobalPlacementRow {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  expectedPassoutYear: number | null;
  departmentCode: string;
  departmentName: string;
  companyName: string;
  roleName: string;
  packageDisplay: string | null;
  source: "APPLICATION" | "MANUAL";
  driveId: string | null;
  placedAt: Date;
  revokedAt: Date | null;
}

export interface GlobalPlacementsResult {
  rows: GlobalPlacementRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  /** Placed students under the current filters (distinct, active placements). */
  placedStudents: number;
  byDepartment: { code: string; name: string; count: number }[];
  options: {
    departments: { id: string; code: string; name: string }[];
    companies: string[];
    batchYears: number[];
  };
}

const parseDay = (value?: string, endOfDay = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * The institution's placements, with the filters the Super Admin works by:
 * department, company, batch, placement date, drive and student. Placements
 * come from `StudentPlacement` — the one record of who is placed — so this
 * view and the exclusion rule can never disagree.
 *
 * Read-only. Filters arrive from a URL, so each is validated before it reaches
 * the query and none can widen what is shown.
 *
 * Authorization: SUPER_ADMIN only.
 */
export async function getGlobalPlacements(
  filters: GlobalPlacementFilters = {}
): Promise<GlobalPlacementsResult> {
  await requireSuperAdmin();

  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const status = filters.status ?? "active";

  const from = parseDay(filters.from);
  const to = parseDay(filters.to, true);
  const search = filters.search?.trim().slice(0, 100) || undefined;
  const expectedPassoutYear =
    Number.isInteger(filters.expectedPassoutYear) && filters.expectedPassoutYear! > 1900 && filters.expectedPassoutYear! < 3000
      ? filters.expectedPassoutYear
      : undefined;

  const where: Prisma.StudentPlacementWhereInput = {
    ...(status === "active" ? { revokedAt: null } : status === "revoked" ? { revokedAt: { not: null } } : {}),
    ...(filters.company ? { companyName: { equals: filters.company.slice(0, 200), mode: "insensitive" } } : {}),
    ...(filters.driveId ? { driveId: filters.driveId.slice(0, 64) } : {}),
    ...(from || to ? { placedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    student: {
      ...(filters.departmentId ? { departmentId: filters.departmentId.slice(0, 64) } : {}),
      ...(expectedPassoutYear ? { expectedPassoutYear } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { rollNumber: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };

  const [totalCount, rows, placedStudents, departments, byDepartmentRaw, companyRows, batchRows] =
    await Promise.all([
      prisma.studentPlacement.count({ where }),
      prisma.studentPlacement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { placedAt: "desc" },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              expectedPassoutYear: true,
              department: { select: { code: true, name: true } },
            },
          },
        },
      }),
      prisma.studentPlacement.groupBy({ by: ["studentId"], where }).then((groups) => groups.length),
      prisma.department.findMany({
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.student.groupBy({
        by: ["departmentId"],
        where: { placements: { some: where } },
        _count: { _all: true },
      }),
      prisma.studentPlacement.findMany({
        distinct: ["companyName"],
        select: { companyName: true },
        orderBy: { companyName: "asc" },
      }),
      prisma.student.findMany({
        where: { expectedPassoutYear: { not: null }, placements: { some: {} } },
        distinct: ["expectedPassoutYear"],
        select: { expectedPassoutYear: true },
        orderBy: { expectedPassoutYear: "desc" },
      }),
    ]);

  const deptById = new Map(departments.map((dept) => [dept.id, dept]));

  return {
    rows: rows.map((row) => ({
      id: row.id,
      studentId: row.student.id,
      studentName: row.student.name,
      rollNumber: row.student.rollNumber,
      expectedPassoutYear: row.student.expectedPassoutYear,
      departmentCode: row.student.department.code,
      departmentName: row.student.department.name,
      companyName: row.companyName,
      roleName: row.roleName,
      packageDisplay: row.packageDisplay,
      source: row.source,
      driveId: row.driveId,
      placedAt: row.placedAt,
      revokedAt: row.revokedAt,
    })),
    page,
    pageSize,
    totalCount,
    placedStudents,
    byDepartment: byDepartmentRaw
      .map((row) => {
        const dept = deptById.get(row.departmentId);
        return dept ? { code: dept.code, name: dept.name, count: row._count._all } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.code.localeCompare(b.code)),
    options: {
      departments,
      companies: companyRows.map((row) => row.companyName),
      batchYears: batchRows.map((row) => row.expectedPassoutYear!).filter((year) => year !== null),
    },
  };
}
