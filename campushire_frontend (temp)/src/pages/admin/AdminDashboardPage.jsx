import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import DepartmentScopeBanner from '../../components/admin/DepartmentScopeBanner';
import StudentDetailsModal from '../../components/admin/students/StudentDetailsModal';
import { DEPT_ADMIN, CENTRAL_DRIVES } from '../../data/mockData';
import { PATHS } from '../../routes/paths';
import { exportToCsv } from '../../utils/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import { isDeptMatch, isDriveEligibleForDept, normalizeDept } from '../../utils/departmentUtils';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { studentsList, drives: customDrives } = useAppState();
  const user = authUser || { name: DEPT_ADMIN.name, initials: 'DA' };
  const currentDept = normalizeDept(user.department || DEPT_ADMIN.department);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Drives eligible for this department (for the banner metric)
  const deptDrivesCount = useMemo(() => {
    const allDrives = [...CENTRAL_DRIVES, ...(customDrives || [])];
    return allDrives.filter((d) => isDriveEligibleForDept(d, currentDept)).length;
  }, [customDrives, currentDept]);

  // Strictly filter students by department
  const students = useMemo(() => {
    return (studentsList || [])
      .filter((s) => isDeptMatch(s.dept, currentDept))
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.roll && s.roll.toLowerCase().includes(search.toLowerCase())) ||
          (s.id && s.id.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [studentsList, search, statusFilter, currentDept]);

  function handleExportCsv() {
    const columns = [
      { key: 'roll', label: 'Roll Number' },
      { key: 'name', label: 'Full Name' },
      { key: 'dept', label: 'Department' },
      { key: 'cgpa', label: 'CGPA' },
      { key: 'backlogs', label: 'Backlogs' },
      { key: 'readiness', label: 'Readiness Score' },
      { key: 'status', label: 'Placement Status' },
    ];
    exportToCsv(`${currentDept}_students_placement_roster`, columns, students);
  }

  return (
    <AppShell role="admin" user={user}>
      <DepartmentScopeBanner
        currentDept={currentDept}
        studentCount={students.length}
        driveCount={deptDrivesCount}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{currentDept} Department Students</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Showing verified student records enrolled in <strong>{currentDept}</strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={handleExportCsv}>📥 Export CSV</Button>
          <Button variant="outline" onClick={() => navigate(PATHS.excelUpload)}>Bulk import</Button>
          <Button onClick={() => navigate(PATHS.addStudent)}>+ Add student</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <input
          placeholder={`Search ${currentDept} students by name or roll number…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360, flex: 1, padding: '9px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 13 }}
        />

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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Department</th>
              <th>CGPA</th>
              <th>Backlogs</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                  No students found for {currentDept} matching current criteria.
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr
                  key={s.id || s.roll}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedStudent(s)}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {s.email || `${(s.roll || 'student').toLowerCase()}@college.edu`}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.roll || s.id}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                      {s.dept || currentDept}
                    </span>
                  </td>
                  <td>
                    <strong>{s.cgpa}</strong> <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ 10</span>
                  </td>
                  <td>
                    <span style={{ color: (s.backlogs && s.backlogs > 0) ? 'var(--red, #ef4444)' : 'inherit', fontWeight: (s.backlogs && s.backlogs > 0) ? 700 : 400 }}>
                      {s.backlogs ?? 0}
                    </span>
                  </td>
                  <td>
                    <Badge variant={s.status === 'placed' ? 'green' : s.status === 'attention_needed' ? 'red' : 'purple'}>
                      {s.status === 'attention_needed' ? 'Needs attention' : s.status === 'placed' ? 'Placed' : 'Eligible'}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(s);
                      }}
                    >
                      View Details ↗
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Student Details Modal */}
      <StudentDetailsModal
        student={selectedStudent}
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </AppShell>
  );
}
