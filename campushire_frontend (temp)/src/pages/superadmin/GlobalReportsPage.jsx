import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import { SUPER_ADMIN, DEPT_MATRIX, STUDENTS_LIST } from '../../data/mockData';

// Port of global-reports.html — institution-wide placement analytics across all departments.
// TODO(real-data): superAdminService.getOverview() / a dedicated reports endpoint.
export default function GlobalReportsPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const totalPlaced = DEPT_MATRIX.reduce((s, d) => s + d.placed, 0);
  const totalStudents = DEPT_MATRIX.reduce((s, d) => s + d.students, 0);
  const max = Math.max(...DEPT_MATRIX.map((d) => d.rate));

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Global Reports</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard value={totalStudents} label="Total students" />
        <KpiCard value={totalPlaced} label="Total placed" />
        <KpiCard value={`${Math.round((totalPlaced / totalStudents) * 100)}%`} label="Overall placement rate" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Placement rate by department</h3>
        {DEPT_MATRIX.map((d) => (
          <div key={d.dept} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{d.dept}</span><span>{d.rate}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill teal" style={{ width: `${(d.rate / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Dept</th><th>CGPA</th><th>Readiness</th><th>Status</th></tr></thead>
          <tbody>
            {STUDENTS_LIST.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.dept}</td><td>{s.cgpa}</td><td>{s.readiness}</td><td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
