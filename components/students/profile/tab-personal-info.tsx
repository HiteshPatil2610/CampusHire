'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import GenderToggle from '@/components/ui/gender-toggle';
import { useToast } from '@/hooks/use-toast';
import { updatePersonalInfo } from '@/features/students/actions/profile-personal';
import { updateProfilePhoto } from '@/features/students/actions/profile-photo';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabPersonalInfoProps {
  profile: CompleteProfile;
}

function calculateAge(dob: Date | null): number | null {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export default function TabPersonalInfo({ profile }: TabPersonalInfoProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: profile.student.name,
    phoneNumber: profile.student.phoneNumber ?? '',
    personalEmail: profile.student.personalEmail ?? '',
    address: profile.student.address ?? '',
    gender: profile.student.gender ?? 'Female',
    dateOfBirth: profile.student.dateOfBirth
      ? new Date(profile.student.dateOfBirth)
      : null,
  });

  const age = calculateAge(form.dateOfBirth);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select a valid image file (PNG, JPG, WebP).',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);

      const uploadRes = await fetch('/api/students/profile-photo', {
        method: 'POST',
        body,
      });
      const uploadData = (await uploadRes.json()) as {
        success: boolean;
        url?: string;
        error?: string;
      };

      if (!uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error ?? 'Upload failed');
      }

      const saveRes = await updateProfilePhoto({ photoUrl: uploadData.url });
      if (!saveRes.success) {
        throw new Error(saveRes.error ?? 'Failed to save photo');
      }

      toast({ title: 'Photo updated', description: 'Profile photo saved.' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Could not upload photo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePersonalInfo({
        name: form.name,
        phoneNumber: form.phoneNumber || undefined,
        personalEmail: form.personalEmail || undefined,
        address: form.address || undefined,
        gender: form.gender as 'Male' | 'Female' | 'Other' | 'Prefer not to say',
        dateOfBirth: form.dateOfBirth
          ? form.dateOfBirth.toISOString().split('T')[0]
          : undefined,
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Personal info updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save.',
          variant: 'destructive',
        });
      }
    });
  }

  const initials = profile.student.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Personal Information
      </h3>

      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <span style={{ fontSize: 18 }}>✉</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{profile.student.email}</span>
            <span className="badge badge-green">🔒 Verified</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            College login email — cannot be changed here
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 16px',
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 20,
        }}
      >
        {profile.student.profilePhotoUrl ? (
          <img
            src={profile.student.profilePhotoUrl}
            alt={profile.student.name}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--border)',
            }}
          />
        ) : (
          <div
            className="sid-avatar"
            style={{ width: 56, height: 56, fontSize: 20 }}
          >
            {initials}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
            Profile Photo
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              margin: '0 0 8px',
            }}
          >
            Upload a clear, professional photo for campus recruitment.
          </p>
          <input
            type="file"
            ref={photoInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={isUploading}
            onClick={() => photoInputRef.current?.click()}
          >
            {isUploading ? 'Uploading…' : 'Change photo'}
          </button>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Full Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Date of Birth</label>
          <DatePicker
            value={form.dateOfBirth}
            onChange={(date) => setForm({ ...form, dateOfBirth: date })}
            placeholder="Select date of birth"
          />
          {age !== null && (
            <div className="field-hint">Age: {age} years</div>
          )}
        </div>
      </div>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Phone Number</label>
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(e) =>
              setForm({ ...form, phoneNumber: e.target.value })
            }
          />
        </div>
        <div className="field">
          <label>Personal Email</label>
          <input
            type="email"
            value={form.personalEmail}
            onChange={(e) =>
              setForm({ ...form, personalEmail: e.target.value })
            }
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Current Address</label>
        <textarea
          rows={3}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Gender</label>
        <GenderToggle
          value={form.gender}
          onChange={(gender) => setForm({ ...form, gender })}
        />
      </div>

      <div
        className="card"
        style={{
          marginTop: 16,
          marginBottom: 24,
          background: 'var(--surface-1)',
        }}
      >
        <div className="field-row">
          <div className="field">
            <label>Roll Number</label>
            <input type="text" value={profile.student.rollNumber} readOnly />
          </div>
          <div className="field">
            <label>Department</label>
            <input
              type="text"
              value={profile.student.department.name}
              readOnly
            />
          </div>
        </div>
        {profile.student.batchYear && (
          <div className="field">
            <label>Batch Year</label>
            <input
              type="text"
              value={String(profile.student.batchYear)}
              readOnly
            />
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 16,
          borderTop: '0.5px solid var(--border)',
        }}
      >
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
