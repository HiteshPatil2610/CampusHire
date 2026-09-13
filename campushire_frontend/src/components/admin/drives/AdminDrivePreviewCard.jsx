import { useState } from 'react';
import { BADGE_CLASS_MAP, daysUntil, deadlinePassed } from '../../../utils/driveUtils';
import { STUDENT } from '../../../data/mockData';

/**
 * AdminDrivePreviewCard
 * Displays a live preview card of how the recruitment drive and its application card
 * appear to students on their portal.
 */
export default function AdminDrivePreviewCard({ drive, config, fields = [], onTestApply }) {
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'application'

  if (!drive) return null;

  const currentConfig = config || drive.adminConfig || {};
  const currentFields = fields.length > 0 ? fields : drive.applicationFields || [];

  const badgeVariant = (BADGE_CLASS_MAP[drive.statusBadge?.cls] || 'badge-accent').replace('badge-', '');
  const daysLeft = daysUntil(drive.deadline || drive.driveDeadlineRaw);
  const isDlPassed = deadlinePassed(drive.deadline || drive.driveDeadlineRaw);

  const lockedKeys = new Set(['rollNo', 'cgpa', 'backlogs', 'department', 'tenthPct', 'twelfthPct']);
  const editableKeys = new Set(['name', 'resume', 'phone', 'email', 'personalEmail', 'linkedin', 'github', 'portfolio', 'skills', 'address']);

  return (
    <div
      className="card"
      style={{
        border: '1.5px solid var(--border-strong)',
        background: 'var(--surface-0)',
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      {/* Top Banner: Admin Preview Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '2px 8px',
              borderRadius: 10,
              background: 'var(--purple-light)',
              color: 'var(--purple)',
            }}
          >
            Student Portal Preview
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Live Drive Preview for Students
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'card' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('card')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            📇 Student Drive Card
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'application' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('application')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            📋 Application Submission Card
          </button>
          {onTestApply && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onTestApply}
              style={{ fontSize: 11, padding: '4px 10px', marginLeft: 4 }}
            >
              🚀 Test Full Modal
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {viewMode === 'card' ? (
          /* PREVIEW 1: Student Drive Card in Grid */
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div
              className="drive-card"
              style={{
                background: 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              }}
            >
              <div className="drive-card-head">
                <div
                  className="company-avatar"
                  style={{
                    width: 42,
                    height: 42,
                    fontSize: 12,
                    background: 'var(--accent)',
                    color: '#fff',
                  }}
                >
                  {drive.logoText || (drive.company || 'CO').slice(0, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="drive-role" style={{ fontSize: 15 }}>{drive.role}</div>
                  <div className="drive-company">
                    {drive.company} &nbsp;·&nbsp; <strong>{drive.ctc || 'CTC TBD'}</strong>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: drive.status === 'Open' ? 'var(--teal-light)' : 'var(--amber-light)',
                    color: drive.status === 'Open' ? 'var(--teal)' : 'var(--amber)',
                  }}
                >
                  {drive.status || 'Open'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0' }}>
                <span>📅 {drive.date || drive.driveDate || 'Oct 15, 2026'}</span>
                <span>🎓 Min CGPA {drive.minCgpa ?? 6.5}</span>
                <span>🏢 {(drive.departments || ['CSE']).join(', ')}</span>
              </div>

              {/* Deadline & Admin Logistics Pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {isDlPassed ? (
                  <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>⚠️ Deadline passed</span>
                ) : daysLeft !== null && daysLeft <= 5 ? (
                  <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600, background: 'var(--amber-light)', padding: '2px 6px', borderRadius: 6 }}>
                    ⏰ {daysLeft}d left to apply
                  </span>
                ) : (
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    📅 Deadline: {drive.deadline || 'Oct 01, 2026'}
                  </span>
                )}

                {currentConfig.venue && (
                  <span
                    style={{
                      fontSize: 10,
                      background: 'var(--surface-1)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    📍 {currentConfig.venue.slice(0, 24)}...
                  </span>
                )}
              </div>

              {/* Stepper */}
              <div className="stage-stepper" style={{ marginTop: 14 }}>
                {[
                  { label: 'Apply', done: false, current: true },
                  { label: 'Assessment', done: false, current: false },
                  { label: 'Interview', done: false, current: false },
                  { label: 'Offer', done: false, current: false },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div className={`stage-circle ${s.done ? 'done' : s.current ? 'current' : ''}`}>
                        {s.done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>
                        {s.label}
                      </div>
                    </div>
                    {i < 3 && (
                      <div className="stage-connector" style={{ background: 'var(--border-strong)', marginBottom: 14 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Student Action Row with interactive Apply button */}
              <div className="dc-action-row" style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onTestApply}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  Apply Now →
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              This is how your department students see this drive card in their catalog.
            </div>
          </div>
        ) : (
          /* PREVIEW 2: Student Application Submission Details Card */
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Student Application Review Card
                  </h4>
                  <p className="text-secondary" style={{ fontSize: 11, margin: '2px 0 0' }}>
                    Showing submitted details with locked institutional data and editable profile options.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'var(--teal-light)',
                    color: 'var(--teal)',
                    fontWeight: 600,
                  }}
                >
                  ✓ Eligible to Apply
                </span>
              </div>

              {/* Department Logistics Banner */}
              {(currentConfig.venue || currentConfig.reportingTime) && (
                <div
                  style={{
                    background: 'var(--teal-light)',
                    border: '0.5px solid var(--teal)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--teal)', marginBottom: 2 }}>
                    🏢 Department Logistics & Instructions (Configured by Admin):
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-primary)' }}>
                    {currentConfig.venue && <span>📍 <strong>Venue:</strong> {currentConfig.venue}</span>}
                    {currentConfig.reportingTime && <span>⏰ <strong>Time:</strong> {currentConfig.reportingTime}</span>}
                    {currentConfig.contactPerson && <span>👤 <strong>Coordinator:</strong> {currentConfig.contactPerson}</span>}
                  </div>
                </div>
              )}

              {/* Section 1: Locked Institutional Fields */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    🔒 Locked Records (Verified Institutional Data — Cannot be modified)
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Verified by Registrar</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
                  <div style={{ background: 'var(--surface-1)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Roll Number / PRN</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{STUDENT.rollNo}</span>
                      <span style={{ fontSize: 10 }}>🔒</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current CGPA</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{STUDENT.cgpa} / 10.0</span>
                      <span style={{ fontSize: 10 }}>🔒</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Department</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{STUDENT.department}</span>
                      <span style={{ fontSize: 10 }}>🔒</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Active Backlogs</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{STUDENT.activeBacklogs} Backlogs</span>
                      <span style={{ fontSize: 10 }}>🔒</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Editable Profile Fields */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-dark)' }}>
                    ✏️ Auto-Filled Profile Fields (Student has rights to update/change)
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 600 }}>Rights to Update Enabled</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Name (Explicitly editable) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--surface-0)',
                      borderRadius: 6,
                      border: '0.5px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Full Name (Auto-filled, Editable)</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{STUDENT.name}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
                      ✏️ Edit Name
                    </span>
                  </div>

                  {/* Resume (Explicitly editable/updatable) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--surface-0)',
                      borderRadius: 6,
                      border: '0.5px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submitted Resume (ATS Verified)</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Placement_Resume_{STUDENT.name.replace(/\s+/g, '_')}.pdf
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--teal)' }}>ATS Score: {STUDENT.resumeScore}/100</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
                      🔄 Change / Upload Resume
                    </span>
                  </div>

                  {/* Phone & Email */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--surface-0)',
                      borderRadius: 6,
                      border: '0.5px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Contact Helpline</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                        📞 {STUDENT.phone} &nbsp;·&nbsp; ✉️ {STUDENT.email}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
                      ✏️ Edit
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom confirmation action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Student reviews & checks confirmation before final submission.
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onTestApply}
                  style={{ fontSize: 11 }}
                >
                  Test Student Modal →
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              This preview shows how locked fields (CGPA, Roll No, Dept) vs editable fields (Resume, Name, Contact) are presented to students.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
