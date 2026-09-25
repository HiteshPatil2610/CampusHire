import Link from 'next/link';
import { requireDepartmentAdmin } from '@/lib/auth';
import { getAdminDashboardStats } from '@/features/students/queries/get-admin-dashboard-stats';
import { getAdminDrives } from '@/features/drives/actions/get-admin-drives';
import { getAdminActionItems } from '@/features/dashboard/queries/get-action-items';
import { ActionRequiredPanel } from '@/features/dashboard/components/action-required-panel';
import { getDriveStatus } from '@/features/drives/utils/drive-status';
import { DepartmentScopeBanner } from '@/components/shared/department-scope-banner';
import KpiCard from '@/components/shared/kpi-card';
import StatusBadge from '@/components/ui/status-badge';

import { formatPackage } from '@/features/drives/utils/format-package';
export const dynamic = 'force-dynamic';

/**
 * Admin Home Page (Department Overview)
 * 
 * Shows KPIs, students needing attention, and recent drives for the admin's department.
 * All data is department-scoped via requireDepartmentAdmin().
 */
export default async function AdminDashboardPage() {
  // Auth: department admin only
  const { department } = await requireDepartmentAdmin();

  // Fetch dashboard data
  const [stats, drivesResult, actionItems] = await Promise.all([
    getAdminDashboardStats(),
    getAdminDrives({ page: 1, pageSize: 4 }),
    getAdminActionItems(),
  ]);

  const deptCode = department.code;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <DepartmentScopeBanner
        departmentName={department.name}
        departmentCode={deptCode}
        studentCount={stats.totalStudents}
        driveCount={stats.openDrivesCount}
      />

      <h1
        className="page-title"
        style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 20 }}
      >
        Department Overview
      </h1>

      <ActionRequiredPanel items={actionItems} emptyMessage="Nothing is waiting on your department." />

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Link href="/admin-dashboard/students" style={{ textDecoration: 'none' }}>
          <KpiCard
            value={stats.totalStudents}
            label={`${deptCode} Students`}
          />
        </Link>
        <Link
          href="/admin-dashboard/students?status=placed"
          style={{ textDecoration: 'none' }}
        >
          <KpiCard value={stats.placedStudents} label="Placed Students" />
        </Link>
        <Link href="/admin-dashboard/drives" style={{ textDecoration: 'none' }}>
          <KpiCard value={stats.openDrivesCount} label="Open Drives" />
        </Link>
        <Link href="/admin-dashboard/reports" style={{ textDecoration: 'none' }}>
          <KpiCard value={`${stats.placementRate}%`} label="Placement Rate" />
        </Link>
      </div>

      {/* Two-column section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Students needing attention */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 className="section-title" style={{ margin: 0 }}>
              {deptCode} Students Needing Attention
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {stats.studentsNeedingAttention.length}{' '}
              {stats.studentsNeedingAttention.length === 1 ? 'case' : 'cases'}
            </span>
          </div>

          {stats.studentsNeedingAttention.length === 0 ? (
            <div
              style={{
                padding: '16px 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              ✓ All {deptCode} students are in good standing!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.studentsNeedingAttention.map((s) => (
                <Link
                  key={s.id}
                  href="/admin-dashboard/students"
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="attn-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="attn-icon urgent">!</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {s.name} ({s.rollNumber})
                        </div>
                        <div
                          style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                        >
                          CGPA: {s.cgpa ?? '—'} · Backlogs: {s.activeBacklogs}
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-red">Attention</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent drives */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 className="section-title" style={{ margin: 0 }}>
              Recent Drives for {deptCode}
            </h3>
            <Link href="/admin-dashboard/drives">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                Manage Drives →
              </button>
            </Link>
          </div>

          {drivesResult.data.length === 0 ? (
            <div
              style={{
                padding: '16px 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              No drives posted yet for {deptCode}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drivesResult.data.map((drive) => {
                const status = getDriveStatus(drive);
                const packageDisplay =
                  formatPackage(drive);

                return (
                  <div
                    key={drive.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {drive.companyName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {drive.roleName} · {packageDisplay}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusBadge
                        variant={status === 'open' ? 'green' : 'gray'}
                      >
                        {status === 'open' ? 'Open' : 'Closed'}
                      </StatusBadge>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-secondary)',
                          marginTop: 2,
                        }}
                      >
                        {new Date(drive.nextStageDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
