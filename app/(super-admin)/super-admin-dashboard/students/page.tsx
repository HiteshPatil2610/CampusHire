import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { SuperAdminStudentsClient } from "./super-admin-students-client";

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

  if (status === 'placed') {
    where.placementStatus = 'PLACED';
  } else if (status === 'eligible') {
    where.placementStatus = 'UNPLACED';
    where.isPending = false;
  } else if (status === 'pending') {
    where.isPending = true;
  } else if (status === 'attention') {
    where.placementStatus = 'UNPLACED';
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
      },
    }),
    prisma.student.count({ where }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Institution Student Directory</h1>
      </div>

      <SuperAdminStudentsClient
        students={students}
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
