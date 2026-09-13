import { requireSuperAdmin } from "@/lib/auth";
import { getSystemStats } from "@/features/departments/queries/get-system-stats";
import { getDepartmentMatrix } from "@/features/departments/queries/get-department-matrix";
import { GlobalReportsClient } from "./global-reports-client";

export default async function GlobalReportsPage() {
  await requireSuperAdmin();

  const [systemStats, departmentMatrix] = await Promise.all([
    getSystemStats(),
    getDepartmentMatrix(),
  ]);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 20 }}>
        Global Placement Reports
      </h1>

      <GlobalReportsClient
        systemStats={systemStats}
        departmentMatrix={departmentMatrix}
      />
    </div>
  );
}
