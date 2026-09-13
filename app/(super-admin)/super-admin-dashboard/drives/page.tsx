import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { SuperAdminDrivesClient } from "./super-admin-drives-client";

interface SearchParams {
  deptId?: string;
  status?: string;
  page?: string;
}

export default async function SuperAdminDrivesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const awaitedParams = await searchParams;
  const page = Number(awaitedParams.page) || 1;
  const pageSize = 20;
  const deptId = awaitedParams.deptId;
  const status = awaitedParams.status || 'all';

  // Build query filters
  const where: any = {};

  if (deptId) {
    where.departmentId = deptId;
  }

  if (status === 'open') {
    where.applicationDeadline = {
      gte: new Date(),
    };
  } else if (status === 'closed') {
    where.applicationDeadline = {
      lt: new Date(),
    };
  }

  const [drives, totalCount, departments] = await Promise.all([
    prisma.drive.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: [{ driveDate: 'desc' }],
      include: {
        department: true,
        _count: {
          select: {
            applications: true,
          },
        },
      },
    }),
    prisma.drive.count({ where }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Campus Drives (Read-Only)</h1>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
          View all placement drives across departments
        </p>
      </div>

      <SuperAdminDrivesClient
        drives={drives}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        departments={departments.data}
        filters={{
          deptId: deptId || '',
          status,
        }}
      />
    </div>
  );
}
