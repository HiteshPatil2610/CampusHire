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
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Audit Log
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Immutable record of all administrative actions across the system
        </p>
      </div>

      <AuditLogsTable initialData={initialData} />
    </div>
  );
}
