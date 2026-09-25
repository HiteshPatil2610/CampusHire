interface DepartmentScopeBannerProps {
  departmentName: string; // e.g. "Computer Science & Engineering"
  departmentCode: string; // e.g. "CSE"
  studentCount: number;
  driveCount?: number; // optional — pass when known
}

/**
 * Department Scope Banner
 * 
 * Shows the current department scope for admin users.
 * Displays department name, code, student count, and optional drive count.
 * 
 * NOTE: No department switcher — admin's department is fixed by their
 * DepartmentAdmin record and cannot be changed from the UI.
 */
export function DepartmentScopeBanner({
  departmentName,
  departmentCode,
  studentCount,
  driveCount,
}: DepartmentScopeBannerProps) {
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
            <strong style={{ color: 'var(--accent)' }}>{departmentName}</strong>
          </span>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            Restricted scope: Only {departmentCode} students & eligible campus
            drives are visible.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid rgba(0, 33, 71, 0.12)',
            fontWeight: 500,
          }}
        >
          👥 {studentCount} {studentCount === 1 ? 'Student' : 'Students'}
        </span>

        {typeof driveCount === 'number' && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid rgba(0, 33, 71, 0.12)',
              fontWeight: 500,
            }}
          >
            💼 {driveCount} {driveCount === 1 ? 'Drive' : 'Drives'}
          </span>
        )}
      </div>
    </div>
  );
}
