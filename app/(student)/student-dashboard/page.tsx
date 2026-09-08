import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  ClipboardList,
  FileCheck,
  User,
} from 'lucide-react';
import { getOrCreateUser } from '@/lib/auth';
import { getStudentProfileByUserId } from '@/features/students/queries/get-profile';
import { calculateProfileCompletion } from '@/features/students/queries/profile-completion';
import { getNotifications } from '@/features/notifications/queries/get-notifications';
import { RegistrationForm } from '@/components/students/RegistrationForm';
import KpiCard from '@/components/shared/kpi-card';
import { formatRelativeTime } from '@/lib/format-relative-time';

export const dynamic = 'force-dynamic';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function StudentDashboardPage() {
  const user = await getOrCreateUser();
  if (!user) redirect('/sign-in');

  const profile = await getStudentProfileByUserId(user.id);
  if (!profile) {
    return <RegistrationForm />;
  }

  const completion = calculateProfileCompletion(profile);
  const notifications = await getNotifications(user.id, {
    page: 1,
    pageSize: 5,
  });

  const firstName = profile.student.name.split(' ')[0];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Link href="/student-dashboard/profile">
          {profile.student.profilePhotoUrl ? (
            <img
              src={profile.student.profilePhotoUrl}
              alt={profile.student.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              className="sid-avatar"
              style={{ width: 44, height: 44, fontSize: 15 }}
            >
              {getInitials(profile.student.name)}
            </div>
          )}
        </Link>
        <h1 className="page-title">Welcome back, {firstName}</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Link href="/student-dashboard/profile" style={{ display: 'block' }}>
          <KpiCard
            value={`${completion.percentage}%`}
            label="Profile Completion"
          />
        </Link>
        <KpiCard
          value="0"
          label="Eligible Drives"
          trend="Available soon"
          trendPositive
        />
        <KpiCard value="0" label="Applications Submitted" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Link href="/student-dashboard/profile" className="card">
          <div className="icon-tile accent" style={{ marginBottom: 10 }}>
            <User size={16} />
          </div>
          <strong>Complete Profile</strong>
        </Link>
        <Link href="/student-dashboard/drives" className="card">
          <div className="icon-tile teal" style={{ marginBottom: 10 }}>
            <Briefcase size={16} />
          </div>
          <strong>Browse Drives</strong>
        </Link>
        <Link href="/student-dashboard/applications" className="card">
          <div className="icon-tile amber" style={{ marginBottom: 10 }}>
            <FileCheck size={16} />
          </div>
          <strong>My Applications</strong>
        </Link>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <h3 className="section-title">Recent Notifications</h3>
          <Link
            href="/notifications"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12 }}
          >
            View all →
          </Link>
        </div>

        {notifications.data.length === 0 ? (
          <p className="text-secondary" style={{ fontSize: 13 }}>
            No notifications yet. You&apos;ll see drive alerts and updates here.
          </p>
        ) : (
          notifications.data.map((notification) => (
            <div className="activity-item" key={notification.id}>
              <div className="activity-dot" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{notification.title}</div>
                <div
                  className="text-secondary"
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 520,
                  }}
                >
                  {notification.message}
                </div>
                <div className="activity-time">
                  {formatRelativeTime(new Date(notification.createdAt))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className="card"
        style={{
          marginTop: 16,
          background: 'var(--surface-1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardList size={16} color="var(--text-secondary)" />
          <span className="text-secondary" style={{ fontSize: 13 }}>
            Upcoming drive deadlines will appear here in FE-03.
          </span>
        </div>
      </div>
    </div>
  );
}
