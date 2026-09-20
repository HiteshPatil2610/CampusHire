import { requireSuperAdmin } from "@/lib/auth";
import { getAdminAccounts } from "@/features/admin-accounts/queries/get-admin-accounts";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { AdminAccountsClient } from "./admin-accounts-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  departmentId?: string;
}

/**
 * Who can administer a department — the people who do, and the invitations
 * nobody has accepted yet.
 */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const { departmentId } = await searchParams;

  const [accounts, departmentsResult] = await Promise.all([
    getAdminAccounts({ departmentId }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Admin Accounts
        </h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Invite a department admin and they set their own password with the
          sign-in provider — CampusHire never creates or sends one. Disabling
          takes away access while keeping everything they did.
        </p>
      </div>

      <AdminAccountsClient
        rows={accounts.rows}
        counts={accounts.counts}
        departments={departmentsResult.data.map((department) => ({
          id: department.id,
          name: department.name,
          code: department.code,
        }))}
        selectedDepartmentId={departmentId}
      />
    </div>
  );
}
