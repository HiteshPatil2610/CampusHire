import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getSystemStats } from "@/features/departments/queries/get-system-stats";
import { getDepartmentMatrix } from "@/features/departments/queries/get-department-matrix";
import KpiCard from "@/components/shared/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { eligibleDepartmentIdsOf, eligibleDepartmentLinksInclude } from "@/features/drives/utils/eligible-departments";

export default async function SuperAdminDashboardPage() {
  await requireSuperAdmin();

  const [stats, deptMatrix, centralDrives] = await Promise.all([
    getSystemStats(),
    getDepartmentMatrix(),
    prisma.drive.findMany({
      orderBy: { createdAt: 'desc' },
      include: { department: true, ...eligibleDepartmentLinksInclude },
    }),
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
                  <td>{dept.placedStudents}</td>
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
