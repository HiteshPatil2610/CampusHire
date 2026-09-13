"use client";

import StatusBadge from "@/components/ui/status-badge";

interface SystemStats {
  totalStudents: number;
  registeredStudents: number;
  pendingStudents: number;
  totalDepartments: number;
  activeDepartments: number;
  totalAdmins: number;
  totalDrives: number;
  openDrives: number;
  placedStudents: number;
  overallPlacementRate: number;
}

interface DepartmentStats {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  totalStudents: number;
  registeredStudents: number;
  placedStudents: number;
  placementRate: number;
  adminCount: number;
  openDrives: number;
}

interface Props {
  systemStats: SystemStats;
  departmentMatrix: DepartmentStats[];
}

export function GlobalReportsClient({ systemStats, departmentMatrix }: Props) {
  // Calculate max placement rate for progress bar scaling
  const maxRate = Math.max(...departmentMatrix.map((d) => d.placementRate), 1);

  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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
            {systemStats.overallPlacementRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Placement Rate by Department */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          Placement Rate by Department
        </h3>
        {departmentMatrix.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: 20 }}>
            No departments found
          </div>
        ) : (
          departmentMatrix.map((dept) => (
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
                  {dept.placedStudents} / {dept.registeredStudents} ({dept.placementRate.toFixed(1)}%)
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
          ))
        )}
      </div>

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
                <th>Students</th>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
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
                    <td>
                      <span style={{ color: 'var(--teal)', fontWeight: 500 }}>
                        {dept.placedStudents}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {dept.placementRate.toFixed(1)}%
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
