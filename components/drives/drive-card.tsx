'use client';

import { useState } from 'react';
import type { Drive } from '@prisma/client';
import { getDriveStatus, getDaysUntilDeadline } from '@/features/drives/utils/drive-status';
import { formatDeadline, formatDriveDate } from '@/lib/drive-date-helpers';
import StatusBadge from '@/components/ui/status-badge';

interface DriveCardProps {
  drive: Drive;
  isApplied: boolean;
  applicantCount?: number;
  departmentMap?: Record<string, string>; // dept ID -> dept code
  onApplyClick: (driveId: string) => void;
}

/**
 * DriveCard component - displays a single drive with V1 constraints
 * 
 * V1 Changes from temp frontend:
 * - NO stage stepper (V1 has no application stage tracking)
 * - NO withdraw button (applications are immutable)
 * - NO edit button (applications are immutable)
 * - Status is COMPUTED from deadline, never stored
 * - Only shows eligible drives (server filters)
 */
export function DriveCard({
  drive,
  isApplied,
  applicantCount = 0,
  departmentMap = {},
  onApplyClick,
}: DriveCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Compute drive status from deadline (NEVER stored)
  const status = getDriveStatus(drive.applicationDeadline);
  const daysLeft = getDaysUntilDeadline(drive.applicationDeadline);
  const isOpen = status === 'open';

  // Format dates
  const formattedDriveDate = formatDriveDate(drive.driveDate);
  const formattedDeadline = formatDeadline(drive.applicationDeadline);

  // Parse eligible departments
  let departmentCodes: string[] = [];
  try {
    const deptIds: string[] = JSON.parse(drive.eligibleDepartments);
    departmentCodes = deptIds
      .map((id) => departmentMap[id])
      .filter((code): code is string => Boolean(code));
  } catch {
    // Invalid JSON - show nothing
  }

  // Company logo text (first 4 chars)
  const logoText = drive.companyName.slice(0, 4).toUpperCase();

  // Package display
  const packageText = drive.packageDisplay || `${drive.packageOffered} LPA`;

  // Status badge
  let statusBadge = null;
  if (status === 'closed') {
    statusBadge = <StatusBadge variant="red">Closed</StatusBadge>;
  } else if (daysLeft <= 3) {
    statusBadge = (
      <StatusBadge variant="amber">
        ⏰ {Math.ceil(daysLeft)}d left
      </StatusBadge>
    );
  } else {
    statusBadge = <StatusBadge variant="green">Open</StatusBadge>;
  }

  // Logistics info
  const hasLogistics = Boolean(
    drive.venue || drive.reportingTime || drive.pptLink || drive.externalApplyUrl
  );
  const venueShort = drive.venue ? drive.venue.split(',')[0] : 'Logistics set';

  return (
    <div
      className="drive-card"
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          className="company-avatar"
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--accent-surface)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {logoText}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="drive-role"
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--text-primary)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {drive.roleName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            <strong>{drive.companyName}</strong> · {packageText}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {statusBadge}
          <StatusBadge variant="green">✓ Eligible</StatusBadge>
        </div>
      </div>

      {/* Drive details */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <span>📅 {formattedDriveDate}</span>
        <span>🎓 Min CGPA: {drive.minCGPA}</span>
        <span>🚫 Max backlogs: {drive.maxActiveBacklogs}</span>
        {departmentCodes.length > 0 && <span>🏢 {departmentCodes.join(', ')}</span>}
      </div>

      {/* Deadline and logistics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          📅 Deadline: {formattedDeadline}
        </div>
        {hasLogistics && (
          <span
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
            }}
          >
            📍 {venueShort}
          </span>
        )}
      </div>

      {/* Expandable details panel */}
      {expanded && (
        <div
          style={{
            marginTop: 4,
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--surface-1)',
            border: '0.5px solid var(--border)',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Job description */}
          {drive.jobDescriptionUrl && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Job Description
              </div>
              <a
                href={drive.jobDescriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                📄 View JD (PDF) ↗
              </a>
            </div>
          )}

          {/* Selection rounds */}
          {drive.selectionRounds && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Selection Process
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {drive.selectionRounds}
              </div>
            </div>
          )}

          {/* Venue & logistics */}
          {hasLogistics && (
            <div
              style={{
                borderTop: '0.5px solid var(--border)',
                paddingTop: 10,
                marginTop: 2,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Venue & Logistics
              </div>
              {drive.venue && (
                <div style={{ marginBottom: 4 }}>
                  📍 <strong>Venue:</strong> {drive.venue}
                </div>
              )}
              {drive.reportingTime && (
                <div style={{ marginBottom: 4 }}>
                  ⏰ <strong>Reporting Time:</strong> {drive.reportingTime}
                </div>
              )}
              {drive.contactPerson && (
                <div style={{ marginBottom: 4 }}>
                  👤 <strong>Contact:</strong> {drive.contactPerson}
                  {drive.contactPhone && ` (${drive.contactPhone})`}
                </div>
              )}
            </div>
          )}

          {/* External links */}
          {(drive.externalApplyUrl || drive.pptLink) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              {drive.externalApplyUrl && (
                <a
                  href={drive.externalApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  🔗 Company Portal ↗
                </a>
              )}
              {drive.pptLink && (
                <a
                  href={drive.pptLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--teal)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  🎥 PPT Link ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action strip - V1 simplified */}
      <div
        className="dc-action-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 4,
        }}
      >
        {isApplied ? (
          <>
            <span
              className="dc-applied-chip"
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--success-surface)',
                color: 'var(--success)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ✓ Applied
            </span>
            <button
              type="button"
              onClick={() => onApplyClick(drive.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface-0)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              View details →
            </button>
          </>
        ) : status === 'closed' ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {applicantCount} applicant{applicantCount !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => onApplyClick(drive.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface-0)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              View details →
            </button>
            <StatusBadge variant="red">Closed</StatusBadge>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {applicantCount} applicant{applicantCount !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => onApplyClick(drive.id)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background: 'var(--accent)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              View & Apply →
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {expanded ? '▲ Less' : '▼ Info'}
        </button>
      </div>
    </div>
  );
}
