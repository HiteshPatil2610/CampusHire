import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { SUPER_ADMIN, DEPT_MATRIX } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';

// Port of department-management.html — TPO manages departments.
// TODO(real-data): superAdminService.createDepartment/updateDepartment/archiveDepartment.
export default function DepartmentManagementPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const { showToast } = useToast();
  const [newDept, setNewDept] = useState('');

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Department Management</h1>

      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <input
          placeholder="New department name…"
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 13 }}
        />
        <Button
          onClick={() => {
            if (!newDept.trim()) return;
            showToast(`${newDept} department added.`, 'success');
            setNewDept('');
          }}
        >
          + Add department
        </Button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Department</th><th>Students</th><th>Avg Completion</th><th>Avg Readiness</th><th>Placed</th><th>Rate</th><th></th></tr>
          </thead>
          <tbody>
            {DEPT_MATRIX.map((d) => (
              <tr key={d.dept}>
                <td>{d.dept}</td>
                <td>{d.students}</td>
                <td>{d.avgCompletion}%</td>
                <td>{d.avgReadiness}</td>
                <td>{d.placed}</td>
                <td>{d.rate}%</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => showToast(`Editing ${d.dept}…`)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
