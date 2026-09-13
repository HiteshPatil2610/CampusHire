import { requireSuperAdmin } from "@/lib/auth";
import { getDepartmentAdmins } from "@/features/admin-accounts/queries/get-department-admins";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { AdminAccountsClient } from "./admin-accounts-client";

interface SearchParams {
  page?: string;
  departmentId?: string;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const awaitedParams = await searchParams;
  const page = Number(awaitedParams.page) || 1;
  const departmentId = awaitedParams.departmentId || undefined;

  const [adminsResult, departmentsResult] = await Promise.all([
    getDepartmentAdmins({
      page,
      pageSize: 25,
      departmentId,
    }),
    getDepartments({
      page: 1,
      pageSize: 100,
      includeInactive: false,
    }),
  ]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Admin Accounts</h1>
      </div>

      <AdminAccountsClient
        admins={adminsResult.data}
        page={adminsResult.page}
        pageSize={adminsResult.pageSize}
        totalCount={adminsResult.totalCount}
        departments={departmentsResult.data}
        selectedDepartmentId={departmentId}
      />
    </div>
  );
}
