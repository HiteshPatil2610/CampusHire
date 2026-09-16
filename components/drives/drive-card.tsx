'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Drive } from '@prisma/client';
import { getDriveDisplayStatus } from '@/features/drives/utils/drive-status';
import { formatDeadline, formatDriveDate } from '@/lib/drive-date-helpers';
import { parseJsonArray } from '@/lib/parse-json-array';
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
 * - NO readiness/resume scores (deferred out of V1)
 * - Status is COMPUTED from deadline + drive date, never stored
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

  const status = getDriveDisplayStatus(drive.applicationDeadline, drive.driveDate);
  const canApply = status === 'open';

  const departmentCodes = parseJsonArray(drive.eligibleDepartments)
    .map((id) => departmentMap[id])
    .filter((code): code is string => Boolean(code));

  const logoText = drive.companyName.slice(0, 4).toUpperCase();
  const packageText = drive.packageDisplay || `${drive.packageOffered} LPA`;

  const hasLogistics = Boolean(
    drive.venue || drive.reportingTime || drive.pptLink || drive.externalApplyUrl
  );
  const venueShort = drive.venue ? drive.venue.split(',')[0] : 'Logistics set';

  const selectionRounds = parseJsonArray(drive.selectionRounds);

  return (
    <div
      className="drive-card"
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Real logo when the admin uploaded one, else the name tile. */}
        {drive.companyLogoUrl ? (
          <Image
            src={drive.companyLogoUrl}
            alt=""
            width={44}
            height={44}
            style={{
              borderRadius: 10,
              objectFit: 'contain',
              background: 'var(--surface-1)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            className="company-avatar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {logoText}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            <div
              className="drive-role"
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--text-primary)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
              title={drive.roleName}
            >
              {drive.roleName}
            </div>
            {status === 'open' && <StatusBadge variant="green">Open</StatusBadge>}
            {status === 'upcoming' && (
              <StatusBadge variant="purple">Upcoming</StatusBadge>
            )}
            {status === 'closed' && <StatusBadge variant="red">Closed</StatusBadge>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{drive.companyName}</strong>
            {' · '}
            {packageText}
          </div>
        </div>
      </div>

      {/* Eligibility meta */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <span>📅 {formatDriveDate(drive.driveDate)}</span>
        <span>🎓 Min CGPA: {drive.minCGPA}</span>
        {departmentCodes.length > 0 && <span>🏢 {departmentCodes.join(', ')}</span>}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        🚫 Backlogs ≤ {drive.maxActiveBacklogs}
      </div>

      {/* Deadline + logistics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {canApply ? (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            📅 Deadline: {formatDeadline(drive.applicationDeadline)}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--red-light)',
              color: 'var(--red)',
            }}
          >
            Deadline passed
          </span>
        )}

        {hasLogistics && (
          <span
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-1)',
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
          {drive.jobDescriptionText && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Job Description
              </div>
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {drive.jobDescriptionText}
              </div>
            </div>
          )}

          {drive.jobDescriptionUrl && (
            <a
              href={drive.jobDescriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              📄 View JD (PDF) ↗
            </a>
          )}

          {selectionRounds.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Selection Process
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {selectionRounds.join(' → ')}
              </div>
            </div>
          )}

          {hasLogistics && (
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Venue &amp; Logistics
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

          {(drive.externalApplyUrl || drive.pptLink) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {drive.externalApplyUrl && (
                <a
                  href={drive.externalApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}
                >
                  🔗 Company Portal ↗
                </a>
              )}
              {drive.pptLink && (
                <a
                  href={drive.pptLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--teal)', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}
                >
                  🎥 PPT Link ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action strip */}
      <div
        className="dc-action-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 'auto',
          paddingTop: 10,
          borderTop: '0.5px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        {isApplied ? (
          <>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--teal-light)',
                color: 'var(--teal)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ✓ Applied
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => onApplyClick(drive.id)}
            >
              👁 View Application
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {applicantCount} applicant{applicantCount !== 1 ? 's' : ''}
            </span>
            {canApply ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => onApplyClick(drive.id)}
              >
                Apply now
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {status === 'upcoming' ? 'Applications closed' : 'Closed'}
              </span>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {expanded ? '▲ Less' : '▾ Info'}
        </button>
      </div>
    </div>
  );
}
