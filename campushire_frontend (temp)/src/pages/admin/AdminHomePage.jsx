import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import { Badge } from '../../components/ui/Badge';
import DepartmentScopeBanner from '../../components/admin/DepartmentScopeBanner';
import { DEPT_ADMIN, NOTIFICATIONS, CENTRAL_DRIVES } from '../../data/mockData';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import { isDeptMatch, isDriveEligibleForDept, normalizeDept } from '../../utils/departmentUtils';

export default function AdminHomePage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { studentsList, drives: customDrives } = useAppState();

  const user = authUser || { name: DEPT_ADMIN.name, initials: 'DA' };
  const currentDept = normalizeDept(user.department || DEPT_ADMIN.department);

  // Department-scoped students
  const deptStudents = useMemo(() => {
    return (studentsList || []).filter((s) => isDeptMatch(s.dept, currentDept));
  }, [studentsList, currentDept]);

  const placedStudents = useMemo(() => {
    return deptStudents.filter((s) => s.status === 'placed');
  }, [deptStudents]);

  const needsAttentionStudents = useMemo(() => {
    return deptStudents.filter((s) => s.status === 'attention_needed' || (s.backlogs && s.backlogs > 0));
  }, [deptStudents]);

  // Department-scoped drives (Central Super Admin drives + custom drives)
  const allDrives = useMemo(() => {
    return [...CENTRAL_DRIVES, ...(customDrives || [])];
  }, [customDrives]);

  const deptDrives = useMemo(() => {
    return allDrives.filter((d) => isDriveEligibleForDept(d, currentDept));
  }, [allDrives, currentDept]);

  const placementRate = deptStudents.length > 0
    ? Math.round((placedStudents.length / deptStudents.length) * 100)
    : 0;

  return (
    <AppShell role="admin" user={user}>
      <DepartmentScopeBanner
        currentDept={currentDept}
        studentCount={deptStudents.length}
        driveCount={deptDrives.length}
      />

      <h1 className="page-title" style={{ marginBottom: 20 }}>Department Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          value={deptStudents.length}
          label={`${currentDept} Students`}
          onClick={() => navigate(PATHS.adminDashboard)}
        />
        <KpiCard
          value={placedStudents.length}
          label="Placed Students"
          onClick={() => navigate(PATHS.adminDashboard)}
        />
        <KpiCard
          value={deptDrives.length}
          label={`${currentDept} Drives`}
          onClick={() => navigate(PATHS.postDrive)}
        />
        <KpiCard
          value={`${placementRate}%`}
          label="Placement Rate"
          onClick={() => navigate(PATHS.reportsAnalytics)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Needs attention for this department */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              {currentDept} Students Needing Attention
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {needsAttentionStudents.length} {needsAttentionStudents.length === 1 ? 'case' : 'cases'}
            </span>
          </div>

          {needsAttentionStudents.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              ✓ All {currentDept} students are in good standing with complete profiles!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {needsAttentionStudents.slice(0, 4).map((s) => (
                <div
                  key={s.id || s.roll}
                  className="attn-item"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => navigate(PATHS.adminDashboard)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="attn-icon urgent">!</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name} ({s.roll})</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        CGPA: {s.cgpa} · Backlogs: {s.backlogs || 0} · Readiness: {s.readiness || 50}%
                      </div>
                    </div>
                  </div>
                  <Badge variant="red">Attention</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drives posted for this department */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Drives Posted for {currentDept}
            </h3>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => navigate(PATHS.postDrive)}
            >
              Manage Logistics →
            </button>
          </div>

          {deptDrives.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              No campus drives currently allocated for {currentDept}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deptDrives.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--surface-hover)',
                    border: '0.5px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.company}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {d.role} · {d.ctc || d.package}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge variant={d.status === 'Open' ? 'green' : 'gray'}>{d.status}</Badge>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Date: {d.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
