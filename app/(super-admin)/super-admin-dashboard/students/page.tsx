import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { SuperAdminStudentsClient } from "./super-admin-students-client";
import {
  ACTIVE_PLACEMENT_WHERE,
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

  // Typed, so a filter key that does not exist on Student is a compile error
  // rather than a clause Postgres ignores. The Super Admin sees every
  // department, so `deptId` narrows this listing and can never widen it.
  // Placement is derived from applications, not stored on Student.
  const statusFilter: Prisma.StudentWhereInput =
    status === 'placed'
      ? PLACED_STUDENT_FILTER
      : status === 'eligible'
        ? { ...UNPLACED_STUDENT_FILTER, isPending: false, optedIn: true }
        : status === 'pending'
          ? { isPending: true }
          : status === 'opted-out'
            ? { isPending: false, optedIn: false }
            : status === 'attention'
              ? {
                  ...UNPLACED_STUDENT_FILTER,
                  optedIn: true,
                  academic: { activeBacklogs: { gt: 0 } },
                }
              : {};

  const where: Prisma.StudentWhereInput = {
    ...statusFilter,
    ...(deptId ? { departmentId: deptId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { rollNumber: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [students, totalCount, departments] = await Promise.all([
    prisma.student.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: [{ department: { code: 'asc' } }, { rollNumber: 'asc' }],
      include: {
        department: true,
        academic: true,
        // Active placements — company as recorded.
        placements: {
          where: ACTIVE_PLACEMENT_WHERE,
          select: { companyName: true },
        },
      },
    }),
    prisma.student.count({ where }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const studentRows = students.map(({ placements, ...student }) => ({
    ...student,
    placementState: resolvePlacementState({
      isPending: student.isPending,
      optedIn: student.optedIn,
      isPlaced: placements.length > 0,
    }),
    placedCompanies: placements.map((placement) => placement.companyName),
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
