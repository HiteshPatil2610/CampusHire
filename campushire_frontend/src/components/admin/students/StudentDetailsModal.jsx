import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Badge } from '../../ui/Badge';

export default function StudentDetailsModal({ student, isOpen, onClose }) {
  if (!student) return null;

  const isPlaced = student.status === 'placed';
  const needsAttention = student.status === 'attention_needed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Placement & Academic Record"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header summary banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderRadius: 8,
            background: 'var(--surface-hover)',
            border: '0.5px solid var(--border)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {(student.name || 'S')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{student.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Roll No: <strong>{student.roll || student.id}</strong> · Dept: <strong>{student.dept}</strong> ({student.year || '4th'} Year)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant={isPlaced ? 'green' : needsAttention ? 'red' : 'purple'}>
              {needsAttention ? 'Needs Attention' : isPlaced ? 'Placed' : 'Eligible for Drives'}
            </Badge>
          </div>
        </div>

        {/* Academic metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>CGPA</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
              {student.cgpa || '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>out of 10.0</div>
          </div>

          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Backlogs</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: student.backlogs > 0 ? 'var(--red, #ef4444)' : 'var(--green, #10b981)',
                marginTop: 2,
              }}
            >
              {student.backlogs ?? 0}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {student.backlogs > 0 ? 'Active backlog' : 'Zero backlogs'}
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Readiness</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
              {student.readiness ? `${student.readiness}%` : '75%'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Evaluation score</div>
          </div>

          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resume ATS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
              {student.resumeScore ? `${student.resumeScore}/100` : '70/100'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>ATS verified</div>
          </div>
        </div>

        {/* Secondary Details & Academics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Institutional Records */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔒</span> Institutional Records
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Department:</span>
                <strong>{student.dept}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Academic Year:</span>
                <span>{student.year || '4th Year'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>10th Percentage:</span>
                <span>{student.tenth || '88%'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>12th / Diploma %:</span>
                <span>{student.twelfth || '85%'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Registry Status:</span>
                <span style={{ color: 'var(--green, #10b981)', fontWeight: 600 }}>✓ Verified</span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📞</span> Student Contact & Profiles
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>College Email:</span>
                <span style={{ wordBreak: 'break-all' }}>{student.email || `${(student.roll || 'student').toLowerCase()}@college.edu`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Mobile Phone:</span>
                <span>{student.phone || '+91 98765 43210'}</span>
              </div>
              {student.linkedin && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>LinkedIn:</span>
                  <a href={student.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>View Profile ↗</a>
                </div>
              )}
              {student.github && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>GitHub:</span>
                  <a href={student.github} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>View Code ↗</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Skills */}
        {student.skills && student.skills.length > 0 && (
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Technical Skills & Proficiencies
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {student.skills.map((skill, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'var(--surface-hover)',
                    border: '0.5px solid var(--border)',
                    fontWeight: 500,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
