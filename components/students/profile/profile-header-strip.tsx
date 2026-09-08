import ProgressBar from '@/components/ui/progress-bar';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { ProfileCompletion } from '@/features/students/queries/profile-completion';

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
  const pct = completion.percentage;

  return (
    <div
      className="card"
      style={{
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {student.profilePhotoUrl ? (
          <img
            src={student.profilePhotoUrl}
            alt={student.name}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
              {student.name}
            </h2>
            <span
              className="badge badge-gray"
              style={{ fontSize: 11 }}
            >
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
            {student.department.name} · {student.email}
          </p>
        </div>
      </div>

      <div style={{ minWidth: 200 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            Profile Completion
          </span>
          <strong style={{ color: pct >= 80 ? 'var(--teal)' : 'var(--accent)' }}>
            {pct}%
          </strong>
        </div>
        <ProgressBar
          value={pct}
          variant={pct >= 80 ? 'teal' : 'accent'}
          showLabel={false}
        />
      </div>
    </div>
  );
}
