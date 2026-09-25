'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import UrlField from '@/components/ui/url-field';
import { useToast } from '@/hooks/use-toast';
import { syncCertifications } from '@/features/students/actions/profile-sync-collections';
import { useRegisterProfileSave } from './profile-save-context';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabCertificationsProps {
  profile: CompleteProfile;
}

interface CertificationRow {
  /** Null for a row the student just added and has not saved yet. */
  id: string | null;
  certificationName: string;
  issuingOrganization: string;
  issueDate: Date | null;
  credentialUrl: string;
}

const EMPTY_ROW: CertificationRow = {
  id: null,
  certificationName: '',
  issuingOrganization: '',
  issueDate: null,
  credentialUrl: '',
};

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function TabCertifications({
  profile,
}: TabCertificationsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<CertificationRow[]>(() =>
    profile.certifications.map((certification) => ({
      id: certification.id,
      certificationName: certification.certificationName,
      issuingOrganization: certification.issuingOrganization,
      issueDate: new Date(certification.issueDate),
      credentialUrl: certification.credentialUrl ?? '',
    }))
  );

  function updateRow(index: number, patch: Partial<CertificationRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleSave() {
    const incomplete = rows.find(
      (row) =>
        !row.certificationName.trim() ||
        !row.issuingOrganization.trim() ||
        !row.issueDate
    );

    if (incomplete) {
      toast({
        title: 'Validation error',
        description:
          'Every certification needs a title, issuing organization, and issue date.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await syncCertifications({
        certifications: rows.map((row) => ({
          id: row.id,
          certificationName: row.certificationName.trim(),
          issuingOrganization: row.issuingOrganization.trim(),
          issueDate: row.issueDate ? toIsoDate(row.issueDate) : '',
          credentialUrl: row.credentialUrl.trim() || undefined,
        })),
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Certifications updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save certifications.',
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
            Licenses &amp; Professional Certifications
          </h3>
          <p className="tab-subtitle">
            Showcase industry certifications, cloud badges, and verified
            credentials.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add certification
        </button>
      </div>

      {rows.length === 0 && (
        <p className="tab-empty">
          No certifications added yet. Use “Add certification” to create your
          first entry.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="entry-card">
          <div className="entry-head">
            <span className="entry-index entry-index-teal">
              Badge #{index + 1}
            </span>
            <strong className="entry-title">
              {row.certificationName.trim() || 'New certification'}
            </strong>
            <button
              type="button"
              className="entry-remove"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              aria-label={`Remove certification ${index + 1}`}
              title="Remove this certification"
            >
              ×
            </button>
          </div>

          <div className="entry-body">
            <div className="field-row">
              <div className="field">
                <label>Certification Title *</label>
                <input
                  value={row.certificationName}
                  onChange={(e) =>
                    updateRow(index, { certificationName: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Issuing Organization *</label>
                <input
                  value={row.issuingOrganization}
                  onChange={(e) =>
                    updateRow(index, { issuingOrganization: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="field-row" style={{ marginBottom: 0 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Date Issued</label>
                <DatePicker
                  value={row.issueDate}
                  onChange={(issueDate) => updateRow(index, { issueDate })}
                  maxDate={new Date()}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Credential Verification URL</label>
                <UrlField
                  platform="url"
                  value={row.credentialUrl}
                  onChange={(credentialUrl) =>
                    updateRow(index, { credentialUrl })
                  }
                  placeholder="issuer.com/verify/ID"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="tab-footer tab-footer-split">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add another certification
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
