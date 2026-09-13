import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { STUDENT } from '../../../data/mockData';

export default function StudentApplicationPreviewModal({ open, onClose, drive, config, fields = [] }) {
  if (!open || !drive) return null;

  const currentConfig = config || drive.adminConfig || {};
  const currentFields = fields.length > 0 ? fields : drive.applicationFields || [];

  const lockedKeys = new Set(['rollNo', 'cgpa', 'department', 'backlogs', 'tenthPct', 'twelfthPct']);
  const editableKeys = new Set(['name', 'resume', 'phone', 'email', 'personalEmail', 'linkedin', 'github', 'portfolio', 'skills', 'address']);

  return (
    <Modal open={open} onClose={onClose} size="wide">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 11, background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            ADMIN PREVIEW MODE
          </span>
          <h3 className="section-title" style={{ marginTop: 4 }}>
            Student Application Card Preview — {drive.company}
          </h3>
          <p className="text-secondary" style={{ fontSize: 12, margin: '2px 0 0' }}>
            Simulating what students see when clicking &quot;Apply&quot;: locked institutional metrics vs auto-filled editable options.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <div className="drive-info-strip" style={{ marginBottom: 14 }}>
        <div className="company-avatar" style={{ width: 36, height: 36, fontSize: 11 }}>
          {drive.logoText || (drive.company || 'CO').slice(0, 4).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <strong>{drive.role}</strong> · {drive.company} ({drive.ctc || 'CTC TBD'})
          <div className="text-muted" style={{ fontSize: 11 }}>
            Drive Date: {drive.date || drive.driveDate || 'Upcoming'} · Deadline: {drive.deadline || 'Closing soon'}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 12,
            background: 'var(--teal-light)',
            color: 'var(--teal)',
          }}
        >
          ✓ Eligible to Apply
        </span>
      </div>

      {/* Admin Logistics Banner */}
      {(currentConfig.venue || currentConfig.reportingTime || currentConfig.contactPerson || currentConfig.additionalNotes) && (
        <div
          style={{
            background: 'var(--teal-light)',
            border: '1px solid var(--teal)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--teal)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏢</span> Department Logistics Configured by Admin:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12 }}>
            {currentConfig.venue && <div>📍 <strong>Venue:</strong> {currentConfig.venue}</div>}
            {currentConfig.reportingTime && <div>⏰ <strong>Reporting:</strong> {currentConfig.reportingTime}</div>}
            {currentConfig.contactPerson && <div>👤 <strong>Coordinator:</strong> {currentConfig.contactPerson}</div>}
            {currentConfig.contactPhone && <div>📞 <strong>Phone:</strong> {currentConfig.contactPhone}</div>}
          </div>
          {currentConfig.additionalNotes && (
            <div style={{ marginTop: 8, fontSize: 12, borderTop: '0.5px solid rgba(15,110,86,0.2)', paddingTop: 6, color: 'var(--teal)' }}>
              <strong>Instructions:</strong> {currentConfig.additionalNotes}
            </div>
          )}
        </div>
      )}

      {/* Two sections: Locked vs Editable */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
        {/* Section 1: Locked Institutional Fields */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Locked Institutional Records (Students cannot modify)
              </strong>
            </div>
            <span style={{ fontSize: 10, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 10, border: '0.5px solid var(--border)' }}>
              Verified by Registrar
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Roll Number / PRN</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.rollNo} 🔒</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current CGPA</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.cgpa} / 10.0 🔒</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Department</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.department} 🔒</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Active Backlogs</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.activeBacklogs} Active 🔒</div>
            </div>
          </div>
        </div>

        {/* Section 2: Editable Profile Fields */}
        <div style={{ background: 'var(--surface-0)', border: '1.5px solid var(--accent)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>✏️</span>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--accent-dark)' }}>
                Auto-Filled Profile Options (Students have rights to update/change)
              </strong>
            </div>
            <span style={{ fontSize: 10, color: 'var(--teal)', background: 'var(--teal-light)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              ✓ Editable by Student
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Full Name */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Applicant Full Name *</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.name}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>✏️ Student Can Edit Name</span>
            </div>

            {/* Resume */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submitted Resume *</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Placement_Resume_{STUDENT.name.replace(/\s+/g, '_')}.pdf
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--teal)' }}>ATS Score: {STUDENT.resumeScore}/100</div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>🔄 Student Can Change/Upload</span>
            </div>

            {/* Phone & Email */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Contact Information *</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>📞 {STUDENT.phone} &nbsp;·&nbsp; ✉️ {STUDENT.email}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>✏️ Student Can Edit</span>
            </div>

            {/* Portfolio / GitHub */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Online Profiles & Portfolio</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>🐙 {STUDENT.github} &nbsp;·&nbsp; 🔗 {STUDENT.linkedin}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>✏️ Student Can Edit</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Button onClick={onClose}>Close Preview</Button>
      </div>
    </Modal>
  );
}
