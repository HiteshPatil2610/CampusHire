'use client';

import { useState } from 'react';
import type { Drive } from '@prisma/client';
import ApplicationReviewModal from '@/components/drives/application-review-modal';
import type { ApplicationReviewData } from '@/features/applications/utils/application-review-fields';
import type { WithSerializedPackage } from '@/features/drives/utils/serialize-drive';

interface ApplySectionProps {
  /** This department's resolved drive, package serialised for the client. */
  drive: WithSerializedPackage<Drive>;
  /** From getDriveStatus: not open yet, taking applications, or ended. */
  driveStatus: 'upcoming' | 'open' | 'closed';
  hasApplied: boolean;
  /**
   * This department's application form with the student's profile values —
   * the same form `applyToDrive` rebuilds and validates against.
   */
  reviewFields: ApplicationReviewData;
  eligible: boolean;
  ineligibilityReasons: string[];
}

/**
 * Apply Section - the apply button, and the application card it opens.
 *
 * The card is the same `ApplicationReviewModal` the dashboard uses, so a
 * student sees this department's configured form wherever they apply from:
 * its fields, which are required, and which they may edit. None of that is
 * trusted here — the server re-derives and enforces it on submit.
 */
export function ApplySection({
  drive,
  driveStatus,
  hasApplied,
  reviewFields,
  eligible,
  ineligibilityReasons,
}: ApplySectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { applyMethod, externalApplyUrl } = drive;

  function handleApplyClick() {
    if (applyMethod === 'EXTERNAL' && externalApplyUrl) {
      // Open external URL
      window.open(externalApplyUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsDialogOpen(true);
  }


  // Already applied
  if (hasApplied) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--success-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
          }}
        >
          ✓
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--success)',
              marginBottom: 2,
            }}
          >
            Application Submitted
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            You have successfully applied to this drive
          </div>
        </div>
      </div>
    );
  }

  // Applications not open yet
  if (driveStatus === 'upcoming') {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Applications Not Open Yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Applications open on{' '}
          {new Date(drive.applicationStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    );
  }

  // Drive closed
  if (driveStatus === 'closed') {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 4,
          }}
        >
          Applications Closed
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          The application deadline for this drive has passed
        </div>
      </div>
    );
  }

  // External apply method
  if (applyMethod === 'EXTERNAL' && externalApplyUrl) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 12,
          }}
        >
          This drive requires you to apply through the company&apos;s external portal
        </div>
        <button
          type="button"
          onClick={handleApplyClick}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          Apply on Company Website ↗
        </button>
      </div>
    );
  }

  // In-app apply - show apply button
  return (
    <>
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      >
        <button
          type="button"
          onClick={handleApplyClick}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Apply Now
        </button>
      </div>

      <ApplicationReviewModal
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        drive={drive}
        fields={reviewFields}
        eligible={eligible}
        ineligibilityReasons={ineligibilityReasons}
      />
    </>
  );
}
