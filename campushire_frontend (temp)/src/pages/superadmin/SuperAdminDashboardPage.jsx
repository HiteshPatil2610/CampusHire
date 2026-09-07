import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import { SUPER_ADMIN, STUDENTS_LIST, DEPT_MATRIX, CENTRAL_DRIVES } from '../../data/mockData';
import { PATHS } from '../../routes/paths';

// Port of super-admin-dashboard.html — institution-wide TPO overview.
export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const user = { name: SUPER_ADMIN.name, initials: 'TP' };
  const placed = STUDENTS_LIST.filter((s) => s.status === 'Placed').length;

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Institutional Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard value={STUDENTS_LIST.length} label="Total students" onClick={() => navigate(PATHS.superAdminStudents)} />
        <KpiCard value={placed} label="Placed" />
        <KpiCard value={CENTRAL_DRIVES.length} label="Central drives" onClick={() => navigate(PATHS.superAdminDrives)} />
        <KpiCard value={DEPT_MATRIX.length} label="Departments" onClick={() => navigate(PATHS.departmentManagement)} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Department comparison</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Department</th><th>Students</th><th>Placed</th><th>Placement %</th></tr>
            </thead>
            <tbody>
              {DEPT_MATRIX.map((d) => (
                <tr key={d.dept}>
                  <td>{d.dept}</td>
                  <td>{d.students}</td>
                  <td>{d.placed}</td>
                  <td>{d.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 12 }}>Central drives</h3>
        {CENTRAL_DRIVES.map((d) => (
          <div className="activity-item" key={d.id}>
            <div className="activity-dot" />
            <div>
              <strong>{d.company}</strong> — {d.role}
              <div className="text-muted" style={{ fontSize: 11 }}>{d.departments?.join(', ')}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
