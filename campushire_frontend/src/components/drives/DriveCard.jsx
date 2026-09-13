import { useState } from 'react';
import { deadlinePassed, drivePassed, daysUntil, BADGE_CLASS_MAP } from '../../utils/driveUtils';
import { Badge } from '../ui/Badge';
import Button from '../ui/Button';

/* Stage stepper — ui-context.md §2.6 */
function StageStepper({ steps }) {
  if (!steps || !steps.length) return null;
  return (
    <div className="stage-stepper" style={{ marginTop: 14 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div className={`stage-circle ${s.done ? 'done' : s.current ? 'current' : ''}`}>
              {s.done ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>
              {s.label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="stage-connector" style={{ background: s.done ? 'var(--teal)' : 'var(--border-strong)', marginBottom: 14 }} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * DriveCard — Standardized reusable component for displaying campus placement drives.
 * Used project-wide across student home, student dashboard, readiness tracker, and department overviews.
 *
 * Props:
 *   drive: Drive object (id, company, role, ctc, driveDate, deadline, minCgpa, departments, etc.)
 *   student: Optional student profile object to evaluate real-time eligibility
 *   showStepper: boolean (default true)
 *   showApply: boolean (default true)
 *   applied: boolean (default false)
 *   showAllActions: boolean (default false — shows view, edit, withdraw if true)
 *   onApply(drive): callback
 *   onView(drive): callback
 *   onEdit(drive): callback
 *   onWithdraw(drive): callback
 */
export default function DriveCard({
  drive,
  student,
  showStepper = true,
  showApply = true,
  applied = false,
  showAllActions = false,
  onApply,
  onView,
  onEdit,
  onWithdraw,
}) {
  const [expanded, setExpanded] = useState(false);

  const badgeVariant = (BADGE_CLASS_MAP[drive.statusBadge?.cls] || 'badge-accent').replace('badge-', '');
  const dlPassed = deadlinePassed(drive.driveDeadlineRaw || drive.deadline);
  const dPassed = drivePassed(drive.driveDateRaw || drive.date);
  const daysLeft = daysUntil(drive.driveDeadlineRaw || drive.deadline);

  // Student eligibility evaluation
  let eligibilityBadge = null;
  if (student) {
    const studentCgpa = parseFloat(student.cgpa) || 0;
    const driveMinCgpa = parseFloat(drive.minCgpa) || 0;
    const studentDept = (student.dept || student.department || '').toUpperCase();
    const driveDepts = (drive.departments || []).map((d) => String(d).toUpperCase());

    if (driveMinCgpa > 0 && studentCgpa < driveMinCgpa) {
      eligibilityBadge = (
        <Badge variant="amber" title={`Drive requires minimum CGPA ${driveMinCgpa}. Your CGPA is ${studentCgpa}.`}>
          ⚠ CGPA {driveMinCgpa}+
        </Badge>
      );
    } else if (driveDepts.length > 0 && studentDept && !driveDepts.includes(studentDept)) {
      eligibilityBadge = (
        <Badge variant="gray" title={`Eligible departments: ${drive.departments.join(', ')}`}>
          Dept: {drive.departments.join('/')}
        </Badge>
      );
    } else {
      eligibilityBadge = (
        <Badge variant="green" title="You meet all academic and department eligibility criteria">
          ✓ Eligible
        </Badge>
      );
    }
  }

  let deadlineNode = null;
  if (drive.deadline) {
    if (dlPassed) {
      deadlineNode = <Badge variant="red">Deadline passed</Badge>;
    } else if (daysLeft !== null && daysLeft <= 3) {
      deadlineNode = <Badge variant="amber">⏰ {daysLeft}d left</Badge>;
    } else {
      deadlineNode = <span className="text-muted" style={{ fontSize: 10 }}>📅 Deadline: {drive.deadline}</span>;
    }
  }

  // Logistics info check
  const logistics = drive.adminConfig || drive.logistics || {};
  const hasLogistics = Boolean(logistics.venue || logistics.reportingTime || logistics.pptLink || drive.applyLink);

  return (
    <div className="drive-card">
      <div className="drive-card-head">
        <div className="company-avatar">{drive.logoText || drive.company?.slice(0, 4)?.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="drive-role" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {drive.role}
          </div>
          <div className="drive-company">
            <strong>{drive.company}</strong> &nbsp;·&nbsp; {drive.ctc || drive.package}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {drive.statusBadge && <Badge variant={badgeVariant}>{drive.statusBadge.text}</Badge>}
          {eligibilityBadge}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>📅 {drive.driveDate || drive.date}</span>
        <span>🎓 Min CGPA: {drive.minCgpa}</span>
        {drive.departments?.length > 0 && <span>🏢 {drive.departments.join(', ')}</span>}
        {drive.maxBacklogs !== undefined && <span>🚫 Backlogs ≤ {drive.maxBacklogs}</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>{deadlineNode}</div>
        {hasLogistics && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
            }}
          >
            📍 {logistics.venue ? logistics.venue.split(',')[0] : 'Logistics set'}
          </span>
        )}
      </div>

      {showStepper && drive.stepper && <StageStepper steps={drive.stepper} />}

      {/* Expandable Drive Details Panel */}
      {expanded && (
        <div
          style={{
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--surface-1)',
            border: '0.5px solid var(--border)',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {drive.jd && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>About the Role</div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{drive.jd}</p>
            </div>
          )}

          {drive.rounds && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Selection Process</div>
              <div style={{ color: 'var(--text-secondary)' }}>{drive.rounds}</div>
            </div>
          )}

          {hasLogistics && (
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Venue & Logistics</div>
              {logistics.venue && <div>📍 <strong>Venue:</strong> {logistics.venue}</div>}
              {logistics.reportingTime && <div>⏰ <strong>Reporting:</strong> {logistics.reportingTime}</div>}
              {logistics.contactPerson && (
                <div>👤 <strong>Contact:</strong> {logistics.contactPerson} ({logistics.contactPhone || 'TPO Office'})</div>
              )}
              {logistics.additionalNotes && (
                <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                  ℹ️ {logistics.additionalNotes}
                </div>
              )}
            </div>
          )}

          {(drive.applyLink || logistics.pptLink) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              {drive.applyLink && (
                <a
                  href={drive.applyLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  🔗 Company Career Portal ↗
                </a>
              )}
              {logistics.pptLink && (
                <a
                  href={logistics.pptLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--teal)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  🎥 Pre-Placement Talk Link ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {showApply && (
        <div className="dc-action-row" style={{ marginTop: 12 }}>
          {applied ? (
            showAllActions ? (
              <>
                <span className="dc-applied-chip">✓ Applied</span>
                <button
                  type="button"
                  className="dc-action-btn view"
                  onClick={() => (onView ? onView(drive) : setExpanded((e) => !e))}
                >
                  👁 View Application
                </button>
                {!dlPassed && !dPassed ? (
                  <button type="button" className="dc-action-btn edit" onClick={() => onEdit?.(drive)}>
                    ✏ Edit
                  </button>
                ) : (
                  <span className="dc-action-chip locked">🔒 Locked</span>
                )}
                {!dPassed && (
                  <button type="button" className="dc-action-btn withdraw" onClick={() => onWithdraw?.(drive)}>
                    ↩ Withdraw
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? '▲ Hide details' : '▼ Drive info'}
                </button>
              </>
            ) : (
              <>
                <span className="text-muted" style={{ fontSize: 11 }}>{drive.applicants || 0} applicants</span>
                <span className="dc-applied-chip">✓ Applied</span>
                <button
                  type="button"
                  className="dc-action-btn view"
                  onClick={() => (onView ? onView(drive) : setExpanded((e) => !e))}
                >
                  👁 View
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? '▲ Less' : '▼ Info'}
                </button>
              </>
            )
          ) : !drive.open || dPassed ? (
            <>
              <span className="text-muted" style={{ fontSize: 11 }}>{drive.applicants || 0} applicants</span>
              <span className="text-muted" style={{ fontSize: 12 }}>Closed</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? '▲ Less' : '▼ Info'}
              </button>
            </>
          ) : (
            <>
              <span className="text-muted" style={{ fontSize: 11 }}>{drive.applicants || 0} applicants</span>
              <Button size="sm" onClick={() => (onApply ? onApply(drive) : setExpanded(true))}>
                Apply now
              </Button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? '▲ Less' : '▼ Info'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

