import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SUPER_ADMIN, DEPT_ADMIN } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';

// Port of admin-accounts.html — TPO manages dept-admin staff accounts.
// TODO(real-data): ACCOUNTS below is demo-only. Replace with
// superAdminService.listAdminAccounts() / createAdminAccount().
const SEED_ACCOUNTS = [
  { id: 1, name: DEPT_ADMIN.name, email: DEPT_ADMIN.email, department: 'CSE', status: 'active' },
  { id: 2, name: 'Dr. M. Patil', email: 'ece.admin@college.edu', department: 'ECE', status: 'active' },
  { id: 3, name: 'Prof. A. Joshi', email: 'mech.admin@college.edu', department: 'Mech', status: 'invited' },
];

export default function AdminAccountsPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState(SEED_ACCOUNTS);
  const [form, setForm] = useState({ name: '', email: '', department: '' });

  function handleInvite(e) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setAccounts([...accounts, { id: Date.now(), ...form, status: 'invited' }]);
    showToast(`Invitation sent to ${form.email}.`, 'success');
    setForm({ name: '', email: '', department: '' });
  }

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Admin Accounts</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        <form className="card" onSubmit={handleInvite}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>Invite dept admin</h3>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Department</label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select</option>
              <option>CSE</option><option>ECE</option><option>Mech</option><option>Civil</option>
            </select>
          </div>
          <Button type="submit">Send invite</Button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.department}</td>
                  <td><Badge variant={a.status === 'active' ? 'green' : 'amber'}>{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
