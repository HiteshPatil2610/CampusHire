import { DEPARTMENTS, getDeptDisplayLabel, normalizeDept } from '../../utils/departmentUtils';
import { useAuth } from '../../context/AuthContext';

export default function DepartmentScopeBanner({ currentDept, studentCount, driveCount }) {
  const { setDepartment } = useAuth();
  const normDept = normalizeDept(currentDept);

  return (
    <div
      className="dept-scope-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '10px 16px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>🏛️</span>
        <div>
          <span>
            Managing Department:&nbsp;
            <strong style={{ color: 'var(--accent)' }}>
              {getDeptDisplayLabel(normDept)}
            </strong>
          </span>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            Restricted scope: Only {normDept} students & eligible campus drives are visible.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {typeof studentCount === 'number' && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              fontWeight: 600,
            }}
          >
            👥 {studentCount} {studentCount === 1 ? 'Student' : 'Students'}
          </span>
        )}

        {typeof driveCount === 'number' && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              fontWeight: 600,
            }}
          >
            💼 {driveCount} {driveCount === 1 ? 'Drive' : 'Drives'}
          </span>
        )}

        {/* Quick Department Switcher for Demo / Testing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor="dept-select" style={{ fontSize: 11, opacity: 0.85 }}>Switch:</label>
          <select
            id="dept-select"
            value={normDept}
            onChange={(e) => setDepartment?.(e.target.value)}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--border)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.short}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
