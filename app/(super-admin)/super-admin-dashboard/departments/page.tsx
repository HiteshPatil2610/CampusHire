import { requireSuperAdmin } from "@/lib/auth";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { DepartmentManagementClient } from "./department-management-client";

interface SearchParams {
  page?: string;
  includeInactive?: string;
}

export default async function DepartmentManagementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const awaitedParams = await searchParams;
  const page = Number(awaitedParams.page) || 1;
  const includeInactive = awaitedParams.includeInactive === 'true';

  const result = await getDepartments({
    page,
    pageSize: 25,
    includeInactive,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Department Management</h1>
      </div>

      <DepartmentManagementClient
        departments={result.data}
        page={result.page}
        pageSize={result.pageSize}
        totalCount={result.totalCount}
        includeInactive={includeInactive}
      />
    </div>
  );
}
