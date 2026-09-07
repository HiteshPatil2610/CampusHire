import Button from '../../ui/Button';

export default function ProfileHeaderStrip({ student, completion, onSave, photoPreview }) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '16px 20px',
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--accent-light)',
            color: 'var(--accent-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 18,
            border: '1.5px solid var(--border)',
          }}
        >
          {photoPreview ? (
            <img
              src={photoPreview}
              alt={student.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            student.initials || (student.name ? student.name.slice(0, 2).toUpperCase() : 'ST')
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{student.name}</h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-1)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              {student.rollNo || student.id}
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {student.department} Engineering · {student.year || '4th'} Year · {student.email}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Profile Completion</span>
            <strong style={{ color: completion >= 80 ? 'var(--teal)' : 'var(--accent)' }}>
              {completion}%
            </strong>
          </div>
          <div className="progress-track" style={{ marginTop: 0, height: 6 }}>
            <div
              className={`progress-fill ${completion >= 80 ? 'teal' : ''}`}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <Button size="sm" onClick={onSave}>
          💾 Save changes
        </Button>
      </div>
    </div>
  );
}
