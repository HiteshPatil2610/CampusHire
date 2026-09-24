import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getSystemStats } from "@/features/departments/queries/get-system-stats";
import { getDepartmentMatrix } from "@/features/departments/queries/get-department-matrix";
import { getSuperAdminActionItems } from "@/features/dashboard/queries/get-action-items";
import { ActionRequiredPanel } from "@/features/dashboard/components/action-required-panel";
import KpiCard from "@/components/shared/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import { getRecentCentralDrives } from "@/features/drives/queries/get-central-drives";
import { ensureAcademicCutoverRecorded } from "@/features/students/actions/academic-cutover";
import { eligibleDepartmentIdsOf } from "@/features/drives/utils/eligible-departments";

export default async function SuperAdminDashboardPage() {
  await requireSuperAdmin();

  // The annual cutover is recorded on the first Super Admin visit after
  // July 1 (no scheduler). Idempotent, and a failure never blocks the page.
  const [stats, deptMatrix, centralDrives, actionItems] = await Promise.all([
    getSystemStats(),
    getDepartmentMatrix(),
    // The "Central drives" card: Super Admin drives only, by origin.
    getRecentCentralDrives(),
    getSuperAdminActionItems(),
    ensureAcademicCutoverRecorded(),
  ]);

  const deptCodeById = new Map(deptMatrix.map((d) => [d.id, d.code]));

  function eligibleDeptCodes(drive: (typeof centralDrives)[number]): string {
    return eligibleDepartmentIdsOf(drive)
      .map((id) => deptCodeById.get(id) || id)
      .join(', ');
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 20 }}>
        Institutional Overview
      </h1>

      <ActionRequiredPanel items={actionItems} emptyMessage="No requests, invitations or system issues are waiting." />

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Link href="/super-admin-dashboard/students" style={{ textDecoration: 'none' }}>
          <KpiCard value={stats.totalStudents} label="Total Students" />
        </Link>
        <Link href="/super-admin-dashboard/students?status=placed" style={{ textDecoration: 'none' }}>
          <KpiCard value={stats.placedStudents} label="Placed" />
        </Link>
        <Link href="/super-admin-dashboard/drives" style={{ textDecoration: 'none' }}>
          <KpiCard value={stats.totalDrives} label="Central drives" />
        </Link>
        <Link href="/super-admin-dashboard/departments" style={{ textDecoration: 'none' }}>
          <KpiCard value={stats.totalDepartments} label="Departments" />
        </Link>
      </div>

      {/* Department Comparison Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>
          Department Comparison
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Students</th>
                <th>Eligible</th>
                <th>Placed</th>
                <th>Placement %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deptMatrix.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <Link href={`/super-admin-dashboard/departments/${dept.id}`}>
                      <strong>{dept.name}</strong>
                    </Link>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {dept.code}
                    </div>
                  </td>
                  <td>{dept.totalStudents}</td>
                  <td>{dept.eligibleStudents}</td>
                  <td>{dept.placedInPool}</td>
                  <td>
                    <strong style={{ color: 'var(--teal)' }}>
                      {dept.placementRate}%
                    </strong>
                  </td>
                  <td>
                    {dept.isActive ? (
                      <StatusBadge variant="teal">Active</StatusBadge>
                    ) : (
                      <StatusBadge variant="red">Inactive</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central Drives */}
      {centralDrives.length > 0 && (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            Central drives
          </h3>
          {centralDrives.map((drive) => (
            <div className="activity-item" key={drive.id}>
              <div className="activity-dot" />
              <div>
                <strong>{drive.companyName}</strong> — {drive.roleName}
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {eligibleDeptCodes(drive)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
