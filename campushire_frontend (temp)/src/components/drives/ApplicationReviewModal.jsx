import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import UrlField from '../ui/UrlField';

/**
 * ApplicationReviewModal
 * Shows the full application submission card when students click "Apply" on any drive.
 * Displays all submitted details:
 * - Locked institutional options (CGPA, Roll No, Department, Backlogs, etc.) that cannot be modified.
 * - Auto-filled profile options (Resume, Full Name, Mobile, Email, Links, etc.) which students have rights to update/change.
 */
export default function ApplicationReviewModal({
  open,
  onClose,
  drive,
  student,
  editMode = false,
  onSubmit,
}) {
  const [consent, setConsent] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [showResumeSelector, setShowResumeSelector] = useState(false);

  // Initialize editable fields with values from student profile
  const [values, setValues] = useState(() => ({
    name: student?.name || 'Aarav Sharma',
    resumeName: `Placement_Resume_${(student?.name || 'Student').replace(/\s+/g, '_')}.pdf`,
    resumeScore: student?.resumeScore || 82,
    phone: student?.phone || '+91 98765 43210',
    email: student?.email || 'aarav.sharma@college.edu',
    personalEmail: student?.personalEmail || 'aarav.personal@gmail.com',
    linkedin: student?.linkedin || 'https://linkedin.com/in/aarav-sharma',
    github: student?.github || 'https://github.com/aarav-sharma',
    portfolio: student?.portfolio || 'https://aarav-dev.portfolio.io',
    skills: student?.technicalSkills?.join(', ') || 'React, Node.js, Python, PostgreSQL, Data Structures',
    address: student?.address || 'Hostel 4, Room B-204, Campus Main Road, City',
  }));

  // Available resumes the student can choose from or update
  const [availableResumes, setAvailableResumes] = useState([
    {
      id: 'res_default',
      name: `Placement_Resume_${(student?.name || 'Student').replace(/\s+/g, '_')}.pdf`,
      score: student?.resumeScore || 82,
      type: 'General Placement ATS Resume (Verified)',
    },
    {
      id: 'res_tech',
      name: `${(student?.name || 'Student').replace(/\s+/g, '_')}_Software_Engineer_v2.pdf`,
      score: 88,
      type: 'Technical & Full-Stack Specialized (ATS 88)',
    },
    {
      id: 'res_core',
      name: `${(student?.name || 'Student').replace(/\s+/g, '_')}_Core_Engineering.pdf`,
      score: 79,
      type: 'Core & Analytics Resume',
    },
  ]);

  const [customResumeInput, setCustomResumeInput] = useState('');

  if (!open || !drive) return null;

  const adminConfig = drive.adminConfig || {};
  const appFields = (drive.applicationFields || []).filter((f) => f.enabled !== false);

  const studentCgpa = parseFloat(student?.cgpa || 0);
  const minCgpa = parseFloat(drive.minCgpa || 0);
  const studentBacklogs = parseInt(student?.activeBacklogs || 0, 10);
  const maxBacklogs = parseInt(drive.maxBacklogs ?? 0, 10);
  const driveDepts = drive.departments || [];
  const deptEligible = !driveDepts.length || driveDepts.includes(student?.department);

  const cgpaPass = studentCgpa >= minCgpa;
  const backlogPass = studentBacklogs <= maxBacklogs;
  const eligible = cgpaPass && backlogPass && deptEligible;

  // Non-editable locked keys (Institutional Records)
  const lockedFieldKeys = new Set(['rollNo', 'cgpa', 'department', 'backlogs', 'tenthPct', 'twelfthPct']);

  // Reset editable values to student profile defaults
  function handleResetToProfile() {
    setValues({
      name: student?.name || 'Aarav Sharma',
      resumeName: `Placement_Resume_${(student?.name || 'Student').replace(/\s+/g, '_')}.pdf`,
      resumeScore: student?.resumeScore || 82,
      phone: student?.phone || '+91 98765 43210',
      email: student?.email || 'aarav.sharma@college.edu',
      personalEmail: student?.personalEmail || 'aarav.personal@gmail.com',
      linkedin: student?.linkedin || 'https://linkedin.com/in/aarav-sharma',
      github: student?.github || 'https://github.com/aarav-sharma',
      portfolio: student?.portfolio || 'https://aarav-dev.portfolio.io',
      skills: student?.technicalSkills?.join(', ') || 'React, Node.js, Python, PostgreSQL, Data Structures',
      address: student?.address || 'Hostel 4, Room B-204, Campus Main Road, City',
    });
    setEditingKey(null);
  }

  function handleSelectResume(res) {
    setValues((prev) => ({
      ...prev,
      resumeName: res.name,
      resumeScore: res.score,
    }));
    setShowResumeSelector(false);
  }

  function handleAddCustomResume(e) {
    e.preventDefault();
    if (!customResumeInput.trim()) return;
    const cleanName = customResumeInput.endsWith('.pdf') ? customResumeInput.trim() : `${customResumeInput.trim()}.pdf`;
    const newRes = {
      id: `res_${Date.now()}`,
      name: cleanName,
      score: 85,
      type: 'Uploaded Custom Resume (PDF)',
    };
    setAvailableResumes((prev) => [newRes, ...prev]);
    setValues((prev) => ({ ...prev, resumeName: cleanName, resumeScore: 85 }));
    setCustomResumeInput('');
    setShowResumeSelector(false);
  }

  // Institutional locked values
  const institutionalDetails = [
    { label: 'Roll Number / PRN', value: student?.rollNo || '21CS042', icon: '🪪' },
    { label: 'Cumulative CGPA', value: `${student?.cgpa || '8.45'} / 10.0`, icon: '🎓' },
    { label: 'Department', value: student?.department || 'Computer Science & Engineering', icon: '🏛️' },
    { label: 'Active Backlogs', value: `${student?.activeBacklogs ?? 0} Active`, icon: '⚠️' },
    { label: '10th Secondary %', value: student?.tenth || '92.4%', icon: '📊' },
    { label: '12th / Diploma %', value: student?.twelfth || '89.6%', icon: '📈' },
  ];

  return (
    <Modal open={open} onClose={onClose} size="wide">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              {editMode ? 'Edit Drive Application' : 'Application Submission Card'}
            </h3>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'var(--accent-light)',
                color: 'var(--accent-dark)',
                fontWeight: 600,
              }}
            >
              Step: Verify & Submit
            </span>
          </div>
          <p className="text-secondary" style={{ fontSize: 12, margin: '2px 0 0' }}>
            Review your application data below. Institutional records are verified and locked; auto-filled profile fields can be updated or changed.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      {/* Drive Summary Strip */}
      <div className="drive-info-strip" style={{ marginTop: 6, marginBottom: 10 }}>
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
            background: eligible ? 'var(--teal-light)' : 'var(--red-light)',
            color: eligible ? 'var(--teal)' : 'var(--red)',
          }}
        >
          {eligible ? '✓ Eligible to Apply' : '⚠️ Criteria Not Met'}
        </span>
      </div>

      {/* Department Logistics Banner (configured by admin) */}
      {(adminConfig.venue || adminConfig.reportingTime || adminConfig.contactPerson || adminConfig.additionalNotes) && (
        <div
          style={{
            background: 'var(--teal-light)',
            border: '1px solid var(--teal)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--teal)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏢</span> Department Logistics & Reporting Instructions:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
            {adminConfig.venue && (
              <div>📍 <strong>Venue:</strong> {adminConfig.venue}</div>
            )}
            {adminConfig.reportingTime && (
              <div>⏰ <strong>Reporting Time:</strong> {adminConfig.reportingTime}</div>
            )}
            {adminConfig.contactPerson && (
              <div>👤 <strong>Coordinator:</strong> {adminConfig.contactPerson} {adminConfig.contactPhone ? `(${adminConfig.contactPhone})` : ''}</div>
            )}
            {adminConfig.hallAllocation && (
              <div>🏛️ <strong>Allocated Labs:</strong> {adminConfig.hallAllocation}</div>
            )}
          </div>
          {adminConfig.additionalNotes && (
            <div style={{ marginTop: 6, fontSize: 11, borderTop: '0.5px solid rgba(15,110,86,0.2)', paddingTop: 4, color: 'var(--teal)' }}>
              <strong>Notice for Students:</strong> {adminConfig.additionalNotes}
            </div>
          )}
        </div>
      )}

      {/* Card Content Area: Two Columns / Clear Sections */}
      <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* =======================================================================
            SECTION 1: LOCKED INSTITUTIONAL RECORDS (CANNOT BE MODIFIED)
        ======================================================================== */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--text-secondary)' }}>
                Institutional Records (Locked · Verified by Registrar)
              </strong>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                padding: '2px 8px',
                borderRadius: 10,
                border: '0.5px solid var(--border)',
              }}
            >
              Cannot be modified by applicant
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {institutionalDetails.map((f) => (
              <div
                key={f.label}
                style={{
                  background: 'var(--surface-2)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '0.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {f.value}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.8 }} title="Verified Record — Locked">
                  🔒
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* =======================================================================
            SECTION 2: EDITABLE PROFILE OPTIONS (STUDENTS HAVE RIGHTS TO UPDATE)
        ======================================================================== */}
        <div
          style={{
            background: 'var(--surface-0)',
            border: '1.5px solid var(--accent)',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>✏️</span>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--accent-dark)' }}>
                Application Details & Submission Assets (Auto-filled · You can update/change)
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetToProfile}
                style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                title="Revert modified fields back to profile defaults"
              >
                ↺ Reset to Profile Defaults
              </button>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--teal)',
                  background: 'var(--teal-light)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                ✓ Rights to Update Enabled
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 1. Full Name (Explicitly requested by user: "like resume, name etc") */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: editingKey === 'name' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>👤</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Full Applicant Name <span style={{ color: 'var(--red)' }}>*</span>
                    </div>
                    {editingKey === 'name' ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <input
                          type="text"
                          value={values.name}
                          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: 13,
                            borderRadius: 6,
                            border: '1px solid var(--accent)',
                          }}
                          placeholder="Enter your full name"
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditingKey(null)}
                          style={{ fontSize: 11 }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {values.name || '—'}
                      </div>
                    )}
                  </div>
                </div>

                {editingKey !== 'name' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingKey('name')}
                    style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'underline' }}
                  >
                    ✏️ Edit Name
                  </button>
                )}
              </div>
            </div>

            {/* 2. Resume Submission (Explicitly requested: "like resume, name etc") */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: '0.5px solid var(--border)',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Submitted Placement Resume (PDF) <span style={{ color: 'var(--red)' }}>*</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {values.resumeName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600, marginTop: 2 }}>
                      ATS Score: {values.resumeScore}/100 · Pre-screened for campus drives
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowResumeSelector(!showResumeSelector)}
                    style={{ fontSize: 11 }}
                  >
                    {showResumeSelector ? '✕ Close Selector' : '🔄 Change / Update Resume'}
                  </button>
                </div>
              </div>

              {/* Resume Selector Tray */}
              {showResumeSelector && (
                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: 12,
                    marginTop: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    CHOOSE A SAVED RESUME FOR THIS APPLICATION:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {availableResumes.map((res) => {
                      const isSelected = values.resumeName === res.name;
                      return (
                        <div
                          key={res.id}
                          onClick={() => handleSelectResume(res)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isSelected ? 'var(--accent-light)' : 'var(--surface-2)',
                            border: isSelected ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {res.name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {res.type} · ATS Score: {res.score}/100
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 700 }}>
                              ✓ Active
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Option to upload / specify custom resume file */}
                  <form onSubmit={handleAddCustomResume} style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Or specify different resume file (e.g. Resume_Backend_Specialist.pdf)"
                      value={customResumeInput}
                      onChange={(e) => setCustomResumeInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '0.5px solid var(--border-strong)',
                      }}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                      Attach Resume
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* 3. Mobile Number & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
              {/* Phone */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: editingKey === 'phone' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Mobile Number *</div>
                    {editingKey === 'phone' ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <input
                          type="tel"
                          value={values.phone}
                          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: 12,
                            borderRadius: 4,
                            border: '1px solid var(--accent)',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditingKey(null)}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        📞 {values.phone}
                      </div>
                    )}
                  </div>
                  {editingKey !== 'phone' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingKey('phone')}
                      style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Email */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: editingKey === 'email' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Official / Communication Email *</div>
                    {editingKey === 'email' ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <input
                          type="email"
                          value={values.email}
                          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: 12,
                            borderRadius: 4,
                            border: '1px solid var(--accent)',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditingKey(null)}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        ✉️ {values.email}
                      </div>
                    )}
                  </div>
                  {editingKey !== 'email' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingKey('email')}
                      style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Portfolio & Online Profiles (LinkedIn, GitHub) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
              {/* LinkedIn */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: editingKey === 'linkedin' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>LinkedIn Profile URL</div>
                    {editingKey === 'linkedin' ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <UrlField
                            prefix="linkedin.com/"
                            size="sm"
                            placeholder="in/username"
                            value={(values.linkedin || '').replace(/^https?:\/\/(www\.)?linkedin\.com\//i, '')}
                            onChange={(val) =>
                              setValues((v) => ({
                                ...v,
                                linkedin: val ? `https://linkedin.com/${val}` : '',
                              }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditingKey(null)}
                          style={{ fontSize: 11, padding: '0 10px', height: 32 }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          🔗 {values.linkedin || 'Not linked'}
                        </span>
                        {values.linkedin && (
                          <a
                            href={values.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', marginLeft: 4 }}
                            title="Open LinkedIn profile"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {editingKey !== 'linkedin' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingKey('linkedin')}
                      style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>

              {/* GitHub */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: editingKey === 'github' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>GitHub Repository URL</div>
                    {editingKey === 'github' ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <UrlField
                            prefix="github.com/"
                            size="sm"
                            placeholder="username"
                            value={(values.github || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '')}
                            onChange={(val) =>
                              setValues((v) => ({
                                ...v,
                                github: val ? `https://github.com/${val}` : '',
                              }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditingKey(null)}
                          style={{ fontSize: 11, padding: '0 10px', height: 32 }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          🐙 {values.github || 'Not linked'}
                        </span>
                        {values.github && (
                          <a
                            href={values.github}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', marginLeft: 4 }}
                            title="Open GitHub profile"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {editingKey !== 'github' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingKey('github')}
                      style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Key Skills submitted for this drive */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: editingKey === 'skills' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Highlighted Technical Skills (Auto-filled from Profile)</div>
                  {editingKey === 'skills' ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        type="text"
                        value={values.skills}
                        onChange={(e) => setValues((v) => ({ ...v, skills: e.target.value }))}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid var(--accent)',
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setEditingKey(null)}
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                      ⚡ {values.skills}
                    </div>
                  )}
                </div>
                {editingKey !== 'skills' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingKey('skills')}
                    style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Consent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <input
          type="checkbox"
          id="applyConsent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <label htmlFor="applyConsent" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>
          I confirm that my verified academic data and auto-filled/updated profile details are accurate and ready for recruiter screening.
        </label>
      </div>

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          marginTop: 14,
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
        }}
      >
        {!eligible && !editMode && (
          <span style={{ fontSize: 12, color: 'var(--red)', marginRight: 'auto' }}>
            ⚠️ Criteria not satisfied: Min CGPA ≥ {drive.minCgpa}, Max Backlogs ≤ {drive.maxBacklogs ?? 0}.
          </span>
        )}
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!consent || (!eligible && !editMode)}
          onClick={() => onSubmit?.(values)}
        >
          {editMode ? 'Save Application Changes' : 'Submit Application'}
        </Button>
      </div>
    </Modal>
  );
}
