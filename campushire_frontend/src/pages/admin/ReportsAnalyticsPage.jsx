import { useMemo } from 'react';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import { Badge } from '../../components/ui/Badge';
import DepartmentScopeBanner from '../../components/admin/DepartmentScopeBanner';
import { DEPT_ADMIN, CENTRAL_DRIVES } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import { isDeptMatch, isDriveEligibleForDept, normalizeDept } from '../../utils/departmentUtils';

export default function ReportsAnalyticsPage() {
  const { user: authUser } = useAuth();
  const { studentsList, drives: customDrives } = useAppState();

  const user = authUser || { name: DEPT_ADMIN.name, initials: 'DA' };
  const currentDept = normalizeDept(user.department || DEPT_ADMIN.department);

  const deptStudents = useMemo(() => {
    return (studentsList || []).filter((s) => isDeptMatch(s.dept, currentDept));
  }, [studentsList, currentDept]);

  const placed = deptStudents.filter((s) => s.status === 'placed').length;
  const inProcess = deptStudents.filter((s) => s.status === 'attention_needed').length;
  const eligible = deptStudents.filter((s) => s.status === 'eligible').length;

  const allDrives = useMemo(() => {
    return [...CENTRAL_DRIVES, ...(customDrives || [])];
  }, [customDrives]);

  const deptDrives = useMemo(() => {
    return allDrives.filter((d) => isDriveEligibleForDept(d, currentDept));
  }, [allDrives, currentDept]);

  const placementRate = deptStudents.length > 0
    ? Math.round((placed / deptStudents.length) * 100)
    : 0;

  const statusRows = [
    { label: 'Placed in Campus Drives', value: placed, variant: 'teal' },
    { label: 'Eligible & Active in Drives', value: eligible, variant: 'purple' },
    { label: 'Requires Attention / Remedial', value: inProcess, variant: 'amber' },
  ];
  const max = Math.max(...statusRows.map((r) => r.value), 1);

  return (
    <AppShell role="admin" user={user}>
      <DepartmentScopeBanner
        currentDept={currentDept}
        studentCount={deptStudents.length}
        driveCount={deptDrives.length}
      />

      <h1 className="page-title" style={{ marginBottom: 20 }}>
        {currentDept} Placement Reports & Analytics
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard value={deptStudents.length} label={`${currentDept} Students`} />
        <KpiCard value={`${placementRate}%`} label="Placement Rate" />
        <KpiCard value={placed} label="Offers Secured" />
        <KpiCard value={deptDrives.length} label="Allocated Drives" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          {currentDept} Placement Status Distribution
        </h3>
        {statusRows.map((r) => (
          <div key={r.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${r.variant}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll No</th>
              <th>Department</th>
              <th>CGPA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {deptStudents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No students recorded in {currentDept}.
                </td>
              </tr>
            ) : (
              deptStudents.map((s) => (
                <tr key={s.id || s.roll}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.roll}</td>
                  <td><span style={{ fontWeight: 600, color: 'var(--accent)' }}>{s.dept || currentDept}</span></td>
                  <td>{s.cgpa}</td>
                  <td>
                    <Badge variant={s.status === 'placed' ? 'green' : s.status === 'attention_needed' ? 'red' : 'purple'}>
                      {s.status === 'attention_needed' ? 'Attention' : s.status === 'placed' ? 'Placed' : 'Eligible'}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
