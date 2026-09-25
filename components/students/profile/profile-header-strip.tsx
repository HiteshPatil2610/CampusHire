'use client';

import { Save } from 'lucide-react';
import ProgressBar from '@/components/ui/progress-bar';
import { YEAR_LEVEL_LABELS, yearLevelFor } from '@/features/students/domain/academic-year';
import { useProfileSave } from './profile-save-context';
import type {
  CompleteProfile,
  ProfileCompletion,
} from '@/features/students/queries/profile-completion';

export interface ProfileHeaderStripProps {
  profile: CompleteProfile;
  completion: ProfileCompletion;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


export default function ProfileHeaderStrip({
  profile,
  completion,
}: ProfileHeaderStripProps) {
  const { student } = profile;
  const { save, isSaving, canSave } = useProfileSave();
  const pct = completion.percentage;

  // Derived from the batch and the academic cycle, never from the semester.
  const level = yearLevelFor(student.expectedPassoutYear);
  const year = level ? YEAR_LEVEL_LABELS[level] : null;
  const subtitle = [student.department.name, year, student.email]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="profile-header-strip">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {student.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.profilePhotoUrl}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid var(--border)',
            }}
          />
        ) : (
          <div
            className="sid-avatar"
            style={{ width: 48, height: 48, fontSize: 16 }}
          >
            {getInitials(student.name)}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
              {student.name}
            </h2>
            <span className="badge badge-gray" style={{ fontSize: 11 }}>
              {student.rollNumber}
            </span>
          </div>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>

      <div className="profile-header-actions">
        <div style={{ minWidth: 180 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Profile Completion
            </span>
            <strong
              style={{ color: pct >= 80 ? 'var(--teal)' : 'var(--accent)' }}
            >
              {pct}%
            </strong>
          </div>
          <ProgressBar
            value={pct}
            variant={pct >= 80 ? 'teal' : 'accent'}
            showLabel={false}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={!canSave || isSaving}
          title="Save the section you are editing"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Save size={13} aria-hidden />
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
