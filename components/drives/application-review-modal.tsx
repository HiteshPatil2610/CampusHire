'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Check,
  ExternalLink,
  Lock,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
import type { Drive } from '@prisma/client';
import { applyToDrive } from '@/features/applications/actions/apply-to-drive';
import type {
  ApplicationReviewData,
  ReviewField,
} from '@/features/applications/utils/application-review-fields';
import { formatDeadline, formatDriveDate } from '@/lib/drive-date-helpers';
import { useToast } from '@/hooks/use-toast';

import { formatPackage } from '@/features/drives/utils/format-package';
export interface ApplicationReviewModalProps {
  open: boolean;
  onClose: () => void;
  drive: Drive;
  fields: ApplicationReviewData;
  /** Server-computed eligibility; the action re-checks it before writing. */
  eligible: boolean;
  ineligibilityReasons?: string[];
}

const URL_KEYS = new Set(['linkedin', 'github', 'portfolio']);

/**
 * The application submission card shown when a student clicks Apply.
 *
 * Institutional records render locked; the fields the student may correct
 * render inline-editable. Which rows appear at all comes from the drive's
 * admin-configured application fields, resolved server-side.
 */
export default function ApplicationReviewModal({
  open,
  onClose,
  drive,
  fields,
  eligible,
  ineligibilityReasons = [],
}: ApplicationReviewModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const defaults = useMemo(
    () =>
      Object.fromEntries(
        fields.editable.map((field) => [field.key, field.value])
      ),
    [fields.editable]
  );

  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  // Reopening the card starts from the current profile values again.
  useEffect(() => {
    if (open) {
      setValues(defaults);
      setEditingKey(null);
      setConsent(false);
    }
  }, [open, defaults]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const packageText = formatPackage(drive);
  const logoText = drive.companyName.slice(0, 4).toUpperCase();
  const missingRequired = fields.editable.filter(
    (field) => field.required && !values[field.key]?.trim()
  );
  const canSubmit =
    consent && eligible && missingRequired.length === 0 && !isPending;

  function handleSubmit() {
    startTransition(async () => {
      const result = await applyToDrive(drive.id, {
        submittedDetails: values,
        consent,
      });

      if (result.success) {
        toast({
          title: 'Application submitted',
          description: `${drive.companyName} — ${drive.roleName}`,
        });
        onClose();
        router.refresh();
      } else {
        toast({
          title: 'Could not apply',
          description: result.reasons?.join(' ') || result.error,
          variant: 'destructive',
        });
      }
    });
  }

  function renderEditable(field: ReviewField) {
    const isEditing = editingKey === field.key;
    const value = values[field.key] ?? '';
    const isUrl = URL_KEYS.has(field.key);

    return (
      <div
        key={field.key}
        className={`asc-field ${isEditing ? 'is-editing' : ''}`.trim()}
      >
        <div className="asc-field-main">
          <div className="asc-field-label">
            <span aria-hidden>{field.icon}</span>
            {field.label}
            {field.required && <span className="asc-req">*</span>}
          </div>

          {isEditing ? (
            <div className="asc-edit-row">
              <input
                autoFocus
                value={value}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingKey(null);
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditingKey(null)}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="asc-field-value">
              {value ? (
                <>
                  <span title={value}>{value}</span>
                  {isUrl && (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${field.label}`}
                    >
                      <ExternalLink size={11} aria-hidden />
                    </a>
                  )}
                </>
              ) : (
                <span className="asc-empty">
                  {field.required ? 'Required — add a value' : 'Not provided'}
                </span>
              )}
            </div>
          )}
        </div>

        {!isEditing && (
          <button
            type="button"
            className="asc-edit-btn"
            onClick={() => setEditingKey(field.key)}
          >
            <Pencil size={11} aria-hidden /> Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card wide asc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asc-title"
      >
        {/* Header */}
        <div className="asc-header">
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <h3 id="asc-title" className="section-title" style={{ margin: 0 }}>
                Application Submission Card
              </h3>
              <span className="asc-step">Step: Verify &amp; Submit</span>
            </div>
            <p className="asc-subtitle">
              Review your application data below. Institutional records are
              verified and locked; auto-filled profile fields can be updated or
              changed.
            </p>
          </div>

          <button
            type="button"
            className="asc-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Drive summary */}
        <div className="asc-drive-strip">
          <div className="company-avatar" style={{ width: 36, height: 36, fontSize: 11 }}>
            {logoText}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13 }}>
              <strong>{drive.roleName}</strong> · {drive.companyName} (
              {packageText})
            </div>
            <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
              Drive Date: {formatDriveDate(drive.driveDate)} · Deadline:{' '}
              {formatDeadline(drive.applicationDeadline)}
            </div>
          </div>
          <span className={`asc-verdict ${eligible ? 'ok' : 'bad'}`}>
            {eligible ? (
              <>
                <Check size={12} aria-hidden /> Eligible to Apply
              </>
            ) : (
              <>
                <AlertTriangle size={12} aria-hidden /> Criteria Not Met
              </>
            )}
          </span>
        </div>

        {/* Logistics, when the admin set any */}
        {(drive.venue || drive.reportingTime || drive.contactPerson) && (
          <div className="asc-logistics">
            <div className="asc-logistics-title">
              <Building2 size={12} aria-hidden /> Department logistics &amp;
              reporting instructions
            </div>
            <div className="asc-logistics-grid">
              {drive.venue && (
                <div>
                  <strong>Venue:</strong> {drive.venue}
                </div>
              )}
              {drive.reportingTime && (
                <div>
                  <strong>Reporting time:</strong> {drive.reportingTime}
                </div>
              )}
              {drive.contactPerson && (
                <div>
                  <strong>Coordinator:</strong> {drive.contactPerson}
                  {drive.contactPhone ? ` (${drive.contactPhone})` : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="asc-body">
          {fields.locked.length > 0 && (
            <section className="asc-section asc-section-locked">
              <div className="asc-section-head">
                <span className="asc-section-title">
                  <Lock size={13} aria-hidden />
                  Institutional Records (Locked · Verified by Registrar)
                </span>
                <span className="asc-note">Cannot be modified by applicant</span>
              </div>

              <div className="asc-locked-grid">
                {fields.locked.map((field) => (
                  <div key={field.key} className="asc-locked-cell">
                    <span className="asc-locked-icon" aria-hidden>
                      {field.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="asc-locked-label">{field.label}</div>
                      <div className="asc-locked-value">
                        {field.value || '—'}
                      </div>
                    </div>
                    <Lock
                      size={11}
                      aria-hidden
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {(fields.editable.length > 0 || fields.readOnly.length > 0) && (
            <section className="asc-section asc-section-editable">
              <div className="asc-section-head">
                <span className="asc-section-title accent">
                  <Pencil size={13} aria-hidden />
                  Application Details &amp; Submission Assets (Auto-filled · You
                  can update/change)
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className="asc-reset"
                    onClick={() => {
                      setValues(defaults);
                      setEditingKey(null);
                    }}
                    title="Revert edited fields back to your profile values"
                  >
                    <RotateCcw size={11} aria-hidden /> Reset to Profile
                    Defaults
                  </button>
                  <span className="asc-rights">✓ Rights to Update Enabled</span>
                </div>
              </div>

              <div className="asc-field-list">
                {fields.editable.map(renderEditable)}

                {fields.readOnly.map((field) => (
                  <div key={field.key} className="asc-field asc-field-static">
                    <div className="asc-field-main">
                      <div className="asc-field-label">
                        <span aria-hidden>{field.icon}</span>
                        {field.label}
                        {field.required && <span className="asc-req">*</span>}
                      </div>
                      <div className="asc-field-value">
                        {field.value || (
                          <span className="asc-empty">Not provided</span>
                        )}
                      </div>
                    </div>
                    <span className="asc-note">From profile</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Consent */}
        <label className="asc-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I confirm that my verified academic data and auto-filled/updated
            profile details are accurate and ready for recruiter screening.
          </span>
        </label>

        {/* Footer */}
        <div className="asc-footer">
          {!eligible && (
            <span className="asc-warning">
              <AlertTriangle size={12} aria-hidden />
              Criteria not satisfied:{' '}
              {ineligibilityReasons.length > 0
                ? ineligibilityReasons.join(' ')
                : `Min CGPA ≥ ${drive.minCGPA}, Max Backlogs ≤ ${drive.maxActiveBacklogs}.`}
            </span>
          )}

          {eligible && missingRequired.length > 0 && (
            <span className="asc-warning">
              <AlertTriangle size={12} aria-hidden />
              Add the required field
              {missingRequired.length > 1 ? 's' : ''}:{' '}
              {missingRequired.map((field) => field.label).join(', ')}.
            </span>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
