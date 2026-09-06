import { AuditLogsTable } from "@/components/audit/AuditLogsTable";
import { getAuditLogs } from "@/features/audit/queries/get-audit-logs";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  // Authorization: Super Admin only
  await requireSuperAdmin();

  // Fetch initial data server-side
  const initialData = await getAuditLogs({
    page: 1,
    pageSize: 25,
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Audit Logs
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          View and track all administrative actions and system activity
        </p>
      </div>

      <AuditLogsTable initialData={initialData} />
    </div>
  );
}
