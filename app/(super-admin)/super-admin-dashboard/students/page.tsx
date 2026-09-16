import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { SuperAdminStudentsClient } from "./super-admin-students-client";
import {
  PLACED_STUDENT_FILTER,
  UNPLACED_STUDENT_FILTER,
  resolvePlacementState,
} from "@/features/students/utils/placement-status";

interface SearchParams {
  deptId?: string;
  status?: string;
  search?: string;
  page?: string;
}

export default async function SuperAdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const awaitedParams = await searchParams;
  const page = Number(awaitedParams.page) || 1;
  const pageSize = 50;
  const deptId = awaitedParams.deptId;
  const status = awaitedParams.status || 'all';
  const search = awaitedParams.search || '';

  // Build query filters
  const where: any = {};

  if (deptId) {
    where.departmentId = deptId;
  }

  // Placement is derived from applications, not stored on Student.
  if (status === 'placed') {
    Object.assign(where, PLACED_STUDENT_FILTER);
  } else if (status === 'eligible') {
    Object.assign(where, UNPLACED_STUDENT_FILTER);
    where.isPending = false;
    where.optedIn = true;
  } else if (status === 'pending') {
    where.isPending = true;
  } else if (status === 'opted-out') {
    where.isPending = false;
    where.optedIn = false;
  } else if (status === 'attention') {
    Object.assign(where, UNPLACED_STUDENT_FILTER);
    where.optedIn = true;
    where.academic = { activeBacklogs: { gt: 0 } };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rollNumber: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [students, totalCount, departments] = await Promise.all([
    prisma.student.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: [{ department: { code: 'asc' } }, { rollNumber: 'asc' }],
      include: {
        department: true,
        academic: true,
        applications: {
          where: { status: 'SELECTED' },
          select: { drive: { select: { companyName: true } } },
        },
      },
    }),
    prisma.student.count({ where }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const studentRows = students.map(({ applications, ...student }) => ({
    ...student,
    placementState: resolvePlacementState({
      isPending: student.isPending,
      optedIn: student.optedIn,
      isPlaced: applications.length > 0,
    }),
    placedCompanies: applications.map((a) => a.drive.companyName),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Institution Student Directory</h1>
      </div>

      <SuperAdminStudentsClient
        students={studentRows}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        departments={departments.data}
        filters={{
          deptId: deptId || '',
          status,
          search,
        }}
      />
    </div>
  );
}
