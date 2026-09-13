'use client';

import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { ProfileCompletion } from '@/features/students/queries/profile-completion';

export interface StudentIdentityCardProps {
  profile: CompleteProfile;
  completion: ProfileCompletion;
  variant?: 'dashboard' | 'drives';
  readinessScore?: number | null;
  resumeScore?: number | null;
  placementBadge?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function semesterToYearLabel(semester: number): string {
  const year = Math.ceil(semester / 2);
  const suffix =
    year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} year`;
}

export default function StudentIdentityCard({
  profile,
  completion,
  variant = 'dashboard',
  readinessScore,
  resumeScore,
  placementBadge,
}: StudentIdentityCardProps) {
  const { toast } = useToast();
  const { student, academic } = profile;
  const isDrivesLayout = variant === 'drives';

  function showComingSoon(feature: string) {
    toast({
      title: 'Coming soon',
      description: `${feature} will be available in a future update.`,
    });
  }

  const departmentLabel = student.department.code || student.department.name;
  const yearLabel = academic?.currentSemester
    ? semesterToYearLabel(academic.currentSemester)
    : null;
  const cgpaLabel =
    academic?.currentCGPA != null
      ? `CGPA ${academic.currentCGPA.toFixed(1)}`
      : null;
  const email = student.personalEmail || student.email;

  const metaItems = [
    departmentLabel,
    yearLabel,
    `Roll ${student.rollNumber}`,
    cgpaLabel,
    email,
  ].filter(Boolean);

  return (
    <div className="student-id-card" style={{ marginBottom: 28 }}>
      <Link href="/student-dashboard/profile" className="sid-avatar">
        {student.profilePhotoUrl ? (
          <img src={student.profilePhotoUrl} alt={student.name} />
        ) : (
          getInitials(student.name)
        )}
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sid-name">{student.name}</div>
        <div className="sid-meta">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="sid-scores">
          {!isDrivesLayout && (
            <>
              <span className="sid-score-pill readiness">
                Readiness {readinessScore ?? '—'}
              </span>
              <span className="sid-score-pill resume">
                Resume {resumeScore ?? '—'}
              </span>
            </>
          )}
          <span className="sid-score-pill profile">
            Profile {completion.percentage}%
          </span>
          {!isDrivesLayout && placementBadge && (
            <span className="sid-score-pill badge">{placementBadge}</span>
          )}
        </div>
      </div>

      <div className="sid-actions">
        <Link href="/student-dashboard/profile" className="btn btn-primary btn-sm">
          Edit profile
        </Link>
        {isDrivesLayout ? (
          <Link
            href="/student-dashboard/applications"
            className="btn btn-outline btn-sm"
          >
            My applications
          </Link>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => showComingSoon('Readiness dashboard')}
            >
              View readiness
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => showComingSoon('Resume builder')}
            >
              Build resume
            </button>
          </>
        )}
      </div>
    </div>
  );
}
