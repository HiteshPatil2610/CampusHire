'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import UrlField from '@/components/ui/url-field';
import { useToast } from '@/hooks/use-toast';
import {
  addCertification,
  updateCertification,
  removeCertification,
} from '@/features/students/actions/profile-certifications';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { StudentCertification } from '@prisma/client';

export interface TabCertificationsProps {
  profile: CompleteProfile;
}

interface CertificationForm {
  certificationName: string;
  issuingOrganization: string;
  issueDate: Date | null;
  expiryDate: Date | null;
  credentialUrl: string;
}

const EMPTY_FORM: CertificationForm = {
  certificationName: '',
  issuingOrganization: '',
  issueDate: null,
  expiryDate: null,
  credentialUrl: '',
};

export default function TabCertifications({ profile }: TabCertificationsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CertificationForm>(EMPTY_FORM);

  function startEdit(certification: StudentCertification) {
    setEditingId(certification.id);
    setForm({
      certificationName: certification.certificationName,
      issuingOrganization: certification.issuingOrganization,
      issueDate: new Date(certification.issueDate),
      expiryDate: certification.expiryDate
        ? new Date(certification.expiryDate)
        : null,
      credentialUrl: certification.credentialUrl ?? '',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (
      !form.certificationName ||
      !form.issuingOrganization ||
      !form.issueDate
    ) {
      toast({
        title: 'Validation error',
        description: 'Name, organization, and issue date are required.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const payload = {
        certificationName: form.certificationName,
        issuingOrganization: form.issuingOrganization,
        issueDate: form.issueDate!.toISOString().split('T')[0],
        expiryDate: form.expiryDate
          ? form.expiryDate.toISOString().split('T')[0]
          : undefined,
        credentialUrl: form.credentialUrl || undefined,
      };

      const result = editingId
        ? await updateCertification(editingId, payload)
        : await addCertification(payload);

      if (result.success) {
        toast({
          title: 'Saved',
          description: editingId
            ? 'Certification updated.'
            : 'Certification added.',
        });
        resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save certification.',
          variant: 'destructive',
        });
      }
    });
  }

  function handleDelete(certificationId: string) {
    startTransition(async () => {
      const result = await removeCertification(certificationId);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Certification removed.' });
        if (editingId === certificationId) resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to delete certification.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Certifications
      </h3>

      {profile.certifications.map((certification) => (
        <div key={certification.id} className="card" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <strong>{certification.certificationName}</strong>
              <div className="text-secondary" style={{ fontSize: 13 }}>
                {certification.issuingOrganization}
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                Issued {new Date(certification.issueDate).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => startEdit(certification)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(certification.id)}
                disabled={isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="card" style={{ background: 'var(--surface-1)' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>
          {editingId ? 'Edit Certification' : 'Add Certification'}
        </h4>
        <div className="field">
          <label>Certification Name *</label>
          <input
            value={form.certificationName}
            onChange={(e) =>
              setForm({ ...form, certificationName: e.target.value })
            }
          />
        </div>
        <div className="field">
          <label>Issuing Organization *</label>
          <input
            value={form.issuingOrganization}
            onChange={(e) =>
              setForm({ ...form, issuingOrganization: e.target.value })
            }
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Issue Date *</label>
            <DatePicker
              value={form.issueDate}
              onChange={(issueDate) => setForm({ ...form, issueDate })}
            />
          </div>
          <div className="field">
            <label>Expiry Date</label>
            <DatePicker
              value={form.expiryDate}
              onChange={(expiryDate) => setForm({ ...form, expiryDate })}
            />
          </div>
        </div>
        <div className="field">
          <label>Credential URL</label>
          <UrlField
            platform="url"
            value={form.credentialUrl}
            onChange={(credentialUrl) =>
              setForm({ ...form, credentialUrl })
            }
            placeholder="credential-link.com"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingId && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending
              ? 'Saving…'
              : editingId
                ? 'Update certification'
                : 'Add certification'}
          </button>
        </div>
      </div>
    </div>
  );
}
