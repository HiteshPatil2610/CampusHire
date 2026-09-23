'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Ban,
  Calendar,
  ChevronDown,
  ChevronUp,
  Building2,
  Eye,
  GraduationCap,
  Lock,
  MapPin,
} from 'lucide-react';
import type { ApplicationStage, ApplicationStatus, Drive } from '@prisma/client';
import { getDriveDisplayStatus } from '@/features/drives/utils/drive-status';
import ApplicationReviewModal from '@/components/drives/application-review-modal';
import type { ApplicationReviewData } from '@/features/applications/utils/application-review-fields';
import { formatDeadline, formatNextStageDate } from '@/lib/drive-date-helpers';
import { parseJsonArray } from '@/lib/parse-json-array';
import StatusBadge from '@/components/ui/status-badge';
import StageTrack from './stage-track';
import { formatPackage } from '@/features/drives/utils/format-package';
import type { WithSerializedPackage } from '@/features/drives/utils/serialize-drive';

export interface DashboardDriveCardProps {
  drive: WithSerializedPackage<Drive>;
  stage: ApplicationStage | null;
  /** Outcome set by the department admin; null when not applied. */
  applicationStatus?: ApplicationStatus | null;
  applicantCount: number;
  departmentCodes: string[];
  /** Fields the submission card shows, resolved from the drive's config. */
  reviewFields: ApplicationReviewData;
  eligible: boolean;
  ineligibilityReasons: string[];
}

/**
 * The rich drive card on the student dashboard: eligibility summary, a
 * four-step selection tracker, and the actions available for the student's
 * current relationship to the drive (apply / view / withdraw).
 */
export default function DashboardDriveCard({
  drive,
  stage,
  applicationStatus = null,
  applicantCount,
  departmentCodes,
  reviewFields,
  eligible,
  ineligibilityReasons,
}: DashboardDriveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const status = getDriveDisplayStatus(drive);
  const isApplied = stage !== null;
  const isOpen = status === 'open';

  const logoText = drive.companyName.slice(0, 4).toUpperCase();
  const packageText = formatPackage(drive);
  const selectionRounds = parseJsonArray(drive.selectionRounds);
  const hasLogistics = Boolean(
    drive.venue || drive.reportingTime || drive.pptLink || drive.contactPerson
  );
  const logisticsLabel = drive.venue
    ? drive.venue.split(',')[0]
    : 'Logistics set';

  return (
    <div className="drive-card">
      {/* Header */}
      <div className="drive-card-head" style={{ gap: 12 }}>
        {/* Real logo when the admin uploaded one, else the name tile. */}
        {drive.companyLogoUrl ? (
          <Image
            src={drive.companyLogoUrl}
            alt=""
            width={44}
            height={44}
            className="company-avatar"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div className="company-avatar" style={{ fontSize: 12 }}>
            {logoText}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div
              className="drive-role"
              title={drive.roleName}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {drive.roleName}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
                flexShrink: 0,
              }}
            >
              {isApplied ? (
                <StatusBadge variant="amber">In progress</StatusBadge>
              ) : status === 'open' ? (
                <StatusBadge variant="green">Open</StatusBadge>
              ) : status === 'upcoming' ? (
                <StatusBadge variant="purple">Upcoming</StatusBadge>
              ) : (
                <StatusBadge variant="red">Closed</StatusBadge>
              )}
              {/* Students only ever receive drives they qualify for */}
              <StatusBadge variant="teal">✓ Eligible</StatusBadge>
            </div>
          </div>

          <div
            className="drive-company"
            style={{ marginTop: 3, fontSize: 12.5 }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>
              {drive.companyName}
            </strong>
            {' · '}
            {packageText}
          </div>
        </div>
      </div>

      {/* Eligibility meta */}
      <div className="drive-meta-row">
        <span>
          <Calendar size={12} aria-hidden /> {formatNextStageDate(drive.nextStageDate)}
        </span>
        <span>
          <GraduationCap size={12} aria-hidden /> Min CGPA: {drive.minCGPA}
        </span>
        {departmentCodes.length > 0 && (
          <span>
            <Building2 size={12} aria-hidden /> {departmentCodes.join(', ')}
          </span>
        )}
      </div>

      <div className="drive-meta-row">
        <span>
          <Ban size={12} aria-hidden /> Backlogs &le; {drive.maxActiveBacklogs}
        </span>
      </div>

      {/* Deadline + logistics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {isOpen ? (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Calendar size={12} aria-hidden /> Deadline:{' '}
            {formatDeadline(drive.applicationDeadline)}
          </span>
        ) : (
          <span className="drive-chip danger">Deadline passed</span>
        )}

        {hasLogistics && (
          <span className="drive-chip">
            <MapPin size={11} aria-hidden /> {logisticsLabel}
          </span>
        )}
      </div>

      {/* Selection tracker */}
      <StageTrack
        stage={stage}
        status={applicationStatus}
        pendingLabels={['Apply', 'Online Test', 'Interview', 'Offer']}
      />

      {/* Expandable detail */}
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
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                Job description
              </div>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {drive.jobDescriptionText}
              </div>
            </div>
          )}

          {selectionRounds.length > 0 && (
            <div>
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                Selection process
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {selectionRounds.join(' → ')}
              </div>
            </div>
          )}

          {drive.venue && (
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Venue:</strong>{' '}
              {drive.venue}
            </div>
          )}
          {drive.reportingTime && (
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>
                Reporting time:
              </strong>{' '}
              {drive.reportingTime}
            </div>
          )}
          {drive.contactPerson && (
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Contact:</strong>{' '}
              {drive.contactPerson}
              {drive.contactPhone ? ` (${drive.contactPhone})` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {drive.jobDescriptionUrl && (
              <a
                href={drive.jobDescriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: 11.5 }}
              >
                View JD ↗
              </a>
            )}
            {drive.externalApplyUrl && (
              <a
                href={drive.externalApplyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: 11.5 }}
              >
                Company portal ↗
              </a>
            )}
            {drive.pptLink && (
              <a
                href={drive.pptLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--teal)', fontSize: 11.5 }}
              >
                Pre-placement talk ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Primary action row */}
      <div
        className="dc-action-row"
        style={{
          marginTop: 'auto',
          paddingTop: 10,
          borderTop: '0.5px solid var(--border)',
        }}
      >
        {isApplied ? (
          <>
            <span className="dc-applied-chip">✓ Applied</span>
            <Link
              href={`/student-dashboard/drives/${drive.id}`}
              className="dc-action-btn view"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                textDecoration: 'none',
              }}
            >
              <Eye size={12} aria-hidden /> View Application
            </Link>
            <button
              type="button"
              className="dc-action-btn"
              disabled
              title="Your submitted details are locked once you apply"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Lock size={12} aria-hidden /> Locked
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {applicantCount} applicant{applicantCount === 1 ? '' : 's'}
            </span>
            {isOpen ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setReviewOpen(true)}
              >
                Apply now
              </button>
            ) : (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {status === 'upcoming' ? 'Applications closed' : 'Closed'}
              </span>
            )}
            <button
              type="button"
              className="dc-link-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronUp size={12} aria-hidden />
              ) : (
                <ChevronDown size={12} aria-hidden />
              )}
              Info
            </button>
          </>
        )}
      </div>

      {/* Secondary action row (applied only) */}
      {isApplied && (
        <div
          className="dc-action-row"
          style={{ justifyContent: 'space-between' }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <Lock size={11} aria-hidden /> Submitted — final
          </span>

          <button
            type="button"
            className="dc-link-btn"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp size={12} aria-hidden />
            ) : (
              <ChevronDown size={12} aria-hidden />
            )}
            Drive info
          </button>
        </div>
      )}

      <ApplicationReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        drive={drive}
        fields={reviewFields}
        eligible={eligible}
        ineligibilityReasons={ineligibilityReasons}
      />

    </div>
  );
}
