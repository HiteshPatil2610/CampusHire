"use client";

import StatusBadge from "@/components/ui/status-badge";
import BarChart from "@/components/shared/bar-chart";
import type { SystemStats } from "@/features/departments/queries/get-system-stats";
import type { DepartmentMatrixRow } from "@/features/departments/queries/get-department-matrix";

interface Props {
  systemStats: SystemStats;
  departmentMatrix: DepartmentMatrixRow[];
}

/**
 * The Super Admin's Global Reports — where departments are compared (Item
 * 20: department admins see only their own department's Insights). Every
 * Placement Rate here is placed ÷ eligible pool, the same definition as the
 * department dashboards (`eligiblePoolSql` / `percentOfPool`).
 */
export function GlobalReportsClient({ systemStats, departmentMatrix }: Props) {
  const maxRate = Math.max(...departmentMatrix.map((d) => d.placementRate), 1);
  // One scale for every department's funnel, so the bars compare across them.
  const funnelMax = Math.max(...departmentMatrix.map((d) => d.eligibleStudents), 1);

  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Total Students
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>
            {systemStats.totalStudents.toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Students Placed
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--teal)' }}>
            {systemStats.placedStudents.toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Overall Placement Rate
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--purple)' }}>
            {systemStats.overallPlacementRate}%
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            Placed ÷ eligible (registered, and opted in or placed)
          </div>
        </div>
      </div>

      {departmentMatrix.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: 'center', padding: 20, marginBottom: 20 }}>
          No departments found
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
          {/* Department comparison: the eligible → applied → placed funnel */}
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 4 }}>
              Eligible vs. Applied vs. Placed by Department
            </h3>
            <p className="text-muted" style={{ fontSize: 11, margin: '0 0 16px' }}>
              All departments share one scale, so the bars compare across them.
            </p>
            <div style={{ display: 'grid', gap: 20 }}>
              {departmentMatrix.map((dept) => (
                <div key={dept.id}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {dept.code}{' '}
                    <span className="text-muted" style={{ fontWeight: 400 }}>{dept.name}</span>
                  </div>
                  <BarChart
                    max={funnelMax}
                    data={[
                      { label: 'Eligible', value: dept.eligibleStudents, color: 'var(--purple)' },
                      { label: 'Applied', value: dept.appliedStudents, color: 'var(--accent)' },
                      { label: 'Placed', value: dept.placedInPool, color: 'var(--teal)' },
                    ]}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {/* Placement Rate by Department */}
            <div className="card">
              <h3 className="section-title" style={{ marginBottom: 16 }}>
                Placement Rate by Department
              </h3>
              {departmentMatrix.map((dept) => (
                <div key={dept.id} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      <strong>{dept.name}</strong>{' '}
                      <span className="text-muted">({dept.code})</span>
                    </span>
                    <span style={{ fontWeight: 500 }}>
                      {dept.placedInPool} / {dept.eligibleStudents} ({dept.placementRate}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      backgroundColor: 'var(--surface-hover)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(dept.placementRate / maxRate) * 100}%`,
                        backgroundColor: 'var(--teal)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Active drives by department */}
            <div className="card">
              <h3 className="section-title" style={{ marginBottom: 4 }}>
                Active Drives by Department
              </h3>
              <p className="text-muted" style={{ fontSize: 11, margin: '0 0 16px' }}>
                Department-posted drives taking applications now.
              </p>
              <BarChart
                data={departmentMatrix.map((dept) => ({
                  label: dept.code,
                  value: dept.openDrives,
                  color: 'var(--accent)',
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Department Breakdown Table */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          Department-wise Breakdown
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Registered</th>
                <th>Eligible</th>
                <th>Applied</th>
                <th>Placed</th>
                <th>Placement Rate</th>
                <th>Admins</th>
                <th>Open Drives</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {departmentMatrix.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40 }}>
                    <div className="text-muted">No departments found</div>
                  </td>
                </tr>
              ) : (
                departmentMatrix.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <strong>{dept.name}</strong>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {dept.code}
                      </div>
                    </td>
                    <td>{dept.registeredStudents}</td>
                    <td>{dept.eligibleStudents}</td>
                    <td>{dept.appliedStudents}</td>
                    <td>
                      <span style={{ color: 'var(--teal)', fontWeight: 500 }}>
                        {dept.placedInPool}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {dept.placementRate}%
                      </span>
                    </td>
                    <td>{dept.adminCount}</td>
                    <td>{dept.openDrives}</td>
                    <td>
                      {dept.isActive ? (
                        <StatusBadge variant="teal">Active</StatusBadge>
                      ) : (
                        <StatusBadge variant="gray">Inactive</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
