import UrlField from '../../ui/UrlField';

export default function AdminDriveLogisticsPanel({ config, onChange }) {
  const current = config || {};

  function handleChange(field, val) {
    onChange?.({
      ...current,
      [field]: val,
    });
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏢</span>
          <span>Department Logistics & Additional Drive Information</span>
        </h3>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: current.venue || current.reportingTime ? 'var(--teal-light)' : 'var(--amber-light)',
            color: current.venue || current.reportingTime ? 'var(--teal)' : 'var(--amber)',
            fontWeight: 600,
          }}
        >
          {current.venue || current.reportingTime ? '✓ Logistics Configured' : '⚠ Details Needed'}
        </span>
      </div>

      <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Provide offline venue, reporting schedule, faculty coordinator helpline, and department-specific student guidelines. Students will see this information prior to attending the drive.
      </p>

      <div className="field-row">
        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Drive Venue / Lab / Auditorium Location *
          </label>
          <input
            type="text"
            placeholder="e.g. Main Auditorium, Block A & CSE Advanced Lab 3"
            value={current.venue || ''}
            onChange={(e) => handleChange('venue', e.target.value)}
          />
          <span className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Specific building, hall, or lab where students should gather.
          </span>
        </div>

        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Reporting Time & Schedule *
          </label>
          <input
            type="text"
            placeholder="e.g. 08:30 AM Sharp (Attendance gate closes at 08:50 AM)"
            value={current.reportingTime || ''}
            onChange={(e) => handleChange('reportingTime', e.target.value)}
          />
          <span className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Required arrival time for biometric/physical verification.
          </span>
        </div>
      </div>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Department Placement Coordinator
          </label>
          <input
            type="text"
            placeholder="e.g. Prof. S. R. Deshmukh (CSE Placement Officer)"
            value={current.contactPerson || ''}
            onChange={(e) => handleChange('contactPerson', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Coordinator Contact Helpline (Phone)
          </label>
          <input
            type="tel"
            placeholder="e.g. +91 98000 12345"
            value={current.contactPhone || ''}
            onChange={(e) => handleChange('contactPhone', e.target.value)}
          />
        </div>
      </div>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Coordinator Official Email
          </label>
          <input
            type="email"
            placeholder="e.g. cse.placement@college.edu"
            value={current.contactEmail || ''}
            onChange={(e) => handleChange('contactEmail', e.target.value)}
          />
        </div>

        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Seating & Lab Allocation Breakdown
          </label>
          <input
            type="text"
            placeholder="e.g. Hall B-201 (Roll CS001–CS075), Lab 3 (CS076+)"
            value={current.hallAllocation || ''}
            onChange={(e) => handleChange('hallAllocation', e.target.value)}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Pre-Placement Talk (PPT) / Online Meeting Link (if applicable)
        </label>
        <UrlField
          prefix="https://"
          placeholder="meet.google.com/xyz-abc-def or teams.microsoft.com/..."
          value={(current.pptLink || '').replace(/^https?:\/\//i, '')}
          onChange={(val) =>
            handleChange('pptLink', val ? (val.startsWith('http') ? val : `https://${val}`) : '')
          }
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Special Instructions & Student Guidelines
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Mandatory College ID & formal uniform. Carry 2 printed copies of ATS Resume and 2 passport photos. Calculators not allowed during Aptitude."
          value={current.additionalNotes || ''}
          onChange={(e) => handleChange('additionalNotes', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '0.5px solid var(--border-strong)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}
