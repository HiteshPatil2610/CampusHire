import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { SUPER_ADMIN } from '../../data/mockData';

// Port of audit-log.html — institution-wide action trail.
// TODO(real-data): SEED_LOG is illustrative demo content. Replace with
// superAdminService.getAuditLog({ from, to, actor }). See DUMMY_DATA.md.
const SEED_LOG = [
  { id: 1, actor: 'Dr. V. K. Raman', action: 'Posted central drive: TCS', time: 'Aug 1, 2026 · 10:22 AM' },
  { id: 2, actor: 'Prof. S. R. Deshmukh', action: 'Imported 42 students via Excel', time: 'Jul 29, 2026 · 3:41 PM' },
  { id: 3, actor: 'Dr. M. Patil', action: 'Edited drive: Infosys eligibility criteria', time: 'Jul 28, 2026 · 11:05 AM' },
  { id: 4, actor: 'System', action: 'Auto-archived 3 drives past deadline', time: 'Jul 27, 2026 · 12:00 AM' },
];

export default function AuditLogPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const [search, setSearch] = useState('');

  const rows = SEED_LOG.filter(
    (l) => l.actor.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Audit Log</h1>

      <input
        placeholder="Search by actor or action…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 320, marginBottom: 16, padding: '9px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 13 }}
      />

      <div className="table-wrap">
        <table>
          <thead><tr><th>Actor</th><th>Action</th><th>Timestamp</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}><td>{l.actor}</td><td>{l.action}</td><td className="text-muted">{l.time}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
