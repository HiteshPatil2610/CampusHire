'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import FileAttachField from '@/components/ui/file-attach-field';
import { useToast } from '@/hooks/use-toast';
import { syncExperiences } from '@/features/students/actions/profile-sync-collections';
import { useRegisterProfileSave } from './profile-save-context';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabExperienceProps {
  profile: CompleteProfile;
}

interface ExperienceRow {
  /** Null for a row the student just added and has not saved yet. */
  id: string | null;
  companyName: string;
  role: string;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
  certificateUrl: string | null;
}

const EMPTY_ROW: ExperienceRow = {
  id: null,
  companyName: '',
  role: '',
  startDate: null,
  endDate: null,
  description: '',
  certificateUrl: null,
};

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function TabExperience({ profile }: TabExperienceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ExperienceRow[]>(() =>
    profile.experiences.map((experience) => ({
      id: experience.id,
      companyName: experience.companyName,
      role: experience.role,
      startDate: new Date(experience.startDate),
      endDate: experience.endDate ? new Date(experience.endDate) : null,
      description: experience.description,
      certificateUrl: experience.certificateUrl,
    }))
  );

  function updateRow(index: number, patch: Partial<ExperienceRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleSave() {
    const incomplete = rows.find(
      (row) =>
        !row.companyName.trim() ||
        !row.role.trim() ||
        !row.description.trim() ||
        !row.startDate
    );

    if (incomplete) {
      toast({
        title: 'Validation error',
        description:
          'Every experience needs a company, role, start date, and summary.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await syncExperiences({
        experiences: rows.map((row) => ({
          id: row.id,
          companyName: row.companyName.trim(),
          role: row.role.trim(),
          description: row.description.trim(),
          startDate: row.startDate ? toIsoDate(row.startDate) : '',
          endDate: row.endDate ? toIsoDate(row.endDate) : undefined,
          certificateUrl: row.certificateUrl,
        })),
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Experience updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save experience.',
          variant: 'destructive',
        });
      }
    });
  }

  useRegisterProfileSave(handleSave, isPending);

  return (
    <div>
      <div className="tab-head">
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>
            Internships &amp; Professional Experience
          </h3>
          <p className="tab-subtitle">
            Record prior full-time, part-time, or research internships relevant
            to campus placements.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add experience
        </button>
      </div>

      {rows.length === 0 && (
        <p className="tab-empty">
          No experience added yet. Use “Add experience” to create your first
          entry.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="entry-card">
          <div className="entry-head">
            <span className="entry-index">Experience #{index + 1}</span>
            <strong className="entry-title">
              {row.role.trim() && row.companyName.trim()
                ? `${row.role.trim()} at ${row.companyName.trim()}`
                : row.role.trim() || row.companyName.trim() || 'New experience'}
            </strong>
            <button
              type="button"
              className="entry-remove"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              aria-label={`Remove experience ${index + 1}`}
              title="Remove this experience"
            >
              ×
            </button>
          </div>

          <div className="entry-body">
            <div className="field-row">
              <div className="field">
                <label>Company / Organization *</label>
                <input
                  value={row.companyName}
                  onChange={(e) =>
                    updateRow(index, { companyName: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Role / Title *</label>
                <input
                  value={row.role}
                  onChange={(e) => updateRow(index, { role: e.target.value })}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Start Date</label>
                {/* Experience already begun: never a future start. */}
                <DatePicker
                  value={row.startDate}
                  onChange={(startDate) => updateRow(index, { startDate })}
                  maxDate={new Date()}
                />
              </div>
              <div className="field">
                <label>End Date</label>
                {/* May be ahead (running until next month), never before the start. */}
                <DatePicker
                  value={row.endDate}
                  onChange={(endDate) => updateRow(index, { endDate })}
                  minDate={row.startDate ?? undefined}
                />
              </div>
            </div>

            <div className="field">
              <label>Summary of Responsibilities &amp; Impact</label>
              <textarea
                rows={2}
                value={row.description}
                onChange={(e) =>
                  updateRow(index, { description: e.target.value })
                }
              />
            </div>

            <FileAttachField
              kind="experience-certificate"
              value={row.certificateUrl}
              onChange={(certificateUrl) =>
                updateRow(index, { certificateUrl })
              }
              placeholder="Attach offer letter or certificate"
            />
          </div>
        </div>
      ))}

      <div className="tab-footer tab-footer-split">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add another experience
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
