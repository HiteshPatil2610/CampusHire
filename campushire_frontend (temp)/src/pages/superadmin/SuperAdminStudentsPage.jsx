import { useState, useMemo } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import FilterPill from '../../components/ui/FilterPill';
import { SUPER_ADMIN } from '../../data/mockData';
import { exportToCsv } from '../../utils/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

const DEPTS = ['All', 'CSE', 'ECE', 'Mech', 'Civil'];

export default function SuperAdminStudentsPage() {
  const { user: authUser } = useAuth();
  const { studentsList } = useAppState();
  const user = authUser || { name: SUPER_ADMIN.name, initials: 'VR' };
  const [dept, setDept] = useState('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const students = useMemo(() => {
    return studentsList
      .filter((s) => dept === 'All' || s.dept === dept)
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.roll.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [studentsList, dept, search, statusFilter]);

  function handleExportCsv() {
    const columns = [
      { key: 'roll', label: 'Roll Number' },
      { key: 'name', label: 'Full Name' },
      { key: 'dept', label: 'Department' },
      { key: 'year', label: 'Academic Year' },
      { key: 'cgpa', label: 'CGPA' },
      { key: 'readiness', label: 'Readiness Score' },
      { key: 'status', label: 'Status' },
    ];
    exportToCsv(`campushire_all_students_${dept.toLowerCase()}`, columns, students);
  }

  return (
    <AppShell role="superadmin" user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Institution Student Directory</h1>
        <Button variant="outline" onClick={handleExportCsv}>📥 Export CSV ({students.length})</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="drives-filters" style={{ margin: 0 }}>
          {DEPTS.map((d) => (
            <FilterPill key={d} active={dept === d} onClick={() => setDept(d)}>{d}</FilterPill>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status:</span>
          {['all', 'placed', 'eligible', 'attention_needed'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: 11, padding: '4px 8px', textTransform: 'capitalize' }}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'attention_needed' ? 'Needs Attention' : st}
            </button>
          ))}
        </div>
      </div>

      <input
        placeholder="Search by student name or roll number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360, marginBottom: 16, padding: '9px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 13 }}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Roll No</th><th>Dept</th><th>Year</th><th>CGPA</th><th>Readiness</th><th>Status</th></tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No students found for {dept} matching "{search}".
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.roll}</td>
                  <td>{s.dept}</td>
                  <td>{s.year}</td>
                  <td>{s.cgpa}</td>
                  <td>{s.readiness}/100</td>
                  <td>
                    <Badge variant={s.status === 'placed' ? 'green' : s.status === 'attention_needed' ? 'red' : 'purple'}>
                      {s.status === 'attention_needed' ? 'Needs attention' : s.status === 'placed' ? 'Placed' : 'Eligible'}
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
