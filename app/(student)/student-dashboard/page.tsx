import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, FileText, PencilLine, Sparkles } from 'lucide-react';
import { getOrCreateUser } from '@/lib/auth';
import { getStudentProfileByUserId } from '@/features/students/queries/get-profile';
import { calculateProfileCompletion } from '@/features/students/queries/profile-completion';
import { getStudentDashboardData } from '@/features/students/queries/get-dashboard-data';
import { getNotifications } from '@/features/notifications/queries/get-notifications';
import { getEligibleDrives } from '@/features/drives/queries/get-eligible-drives';
import {
  isStudentEligibleForDrive,
  getIneligibilityReasons,
} from '@/features/drives/queries/drive-eligibility';
import { buildApplicationReviewData } from '@/features/applications/utils/application-review-fields';
import { RegistrationForm } from '@/components/students/RegistrationForm';
import DashboardDriveCard from '@/components/students/dashboard/dashboard-drive-card';
import StatusBadge from '@/components/ui/status-badge';
import { getDriveDisplayStatus } from '@/features/drives/utils/drive-status';
import { formatDeadline, formatDriveDate } from '@/lib/drive-date-helpers';
import { formatRelativeTime } from '@/lib/format-relative-time';

export const dynamic = 'force-dynamic';

const QUICK_ACTIONS = [
  {
    title: 'Build resume',
    href: '/student-dashboard/resume-builder',
    icon: FileText,
    tone: 'accent' as const,
  },
  {
    title: 'Take assessment',
    href: '/student-dashboard/self-assessment',
    icon: PencilLine,
    tone: 'teal' as const,
  },
  {
    title: 'View suggestions',
    href: '/student-dashboard/ai-analyzer',
    icon: Sparkles,
    tone: 'amber' as const,
  },
];

export default async function StudentDashboardPage() {
  const user = await getOrCreateUser();
  if (!user) redirect('/sign-in');

  const profile = await getStudentProfileByUserId(user.id);
  if (!profile) {
    return <RegistrationForm />;
  }

  const completion = calculateProfileCompletion(profile);

  // Every drive the student is academically eligible for, open or not - the
  // table below shows the full picture, the cards show what needs action.
  const eligible = await getEligibleDrives({ status: 'all', pageSize: 100 });
  const dashboard = await getStudentDashboardData(
    profile.student.id,
    eligible.data,
    2
  );
  const notifications = await getNotifications(user.id, {
    page: 1,
    pageSize: 3,
  });

  const now = new Date();
  const upcomingDeadlines = dashboard.all
    .filter((item) => item.drive.applicationDeadline > now)
    .sort(
      (a, b) =>
        a.drive.applicationDeadline.getTime() -
        b.drive.applicationDeadline.getTime()
    )
    .slice(0, 5);

  // The submission card re-states eligibility, and the apply action re-checks
  // it server-side before writing.
  const eligibilityStudent = { ...profile.student, academic: profile.academic };
  const eligibilityFor = (drive: (typeof eligible.data)[number]) =>
    isStudentEligibleForDrive(eligibilityStudent, drive);

  const firstName = profile.student.name.split(' ')[0];
  const initials = profile.student.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="dash-page">
      {/* Welcome */}
      <div className="dash-welcome">
        {profile.student.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="dash-avatar"
            src={profile.student.profilePhotoUrl}
            alt=""
          />
        ) : (
          <div className="dash-avatar" aria-hidden>
            {initials}
          </div>
        )}
        <h1 className="page-title" style={{ margin: 0 }}>
          Welcome back, {firstName}
        </h1>
      </div>

      {/* Scores */}
      <div className="dash-grid-3">
        <Link
          href="/student-dashboard/profile"
          className="dash-stat-card"
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <div className="dash-stat-value">{completion.percentage}%</div>
          <div className="dash-stat-label">Profile completion</div>
        </Link>

        <div className="dash-stat-card">
          <div className="dash-stat-value pending">&mdash;</div>
          <div className="dash-stat-label">
            Readiness score{' '}
            <span style={{ color: 'var(--text-muted)' }}>· Coming soon</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-value pending">&mdash;</div>
          <div className="dash-stat-label">
            Resume score{' '}
            <span style={{ color: 'var(--text-muted)' }}>· Coming soon</span>
          </div>
        </div>
      </div>

      {/* Your drives */}
      <section>
        <div className="dash-section-head">
          <h3 className="section-title" style={{ margin: 0 }}>
            Your drives
          </h3>
          <Link
            href="/student-dashboard/drives"
            style={{ fontSize: 13, color: 'var(--accent-dark)' }}
          >
            View all →
          </Link>
        </div>

        {dashboard.featured.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <Briefcase
              size={28}
              color="var(--text-muted)"
              style={{ margin: '0 auto 10px' }}
            />
            <p className="text-secondary" style={{ fontSize: 14 }}>
              No eligible drives available right now.
            </p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Check back later for new opportunities.
            </p>
          </div>
        ) : (
          <div className="dash-grid-2">
            {dashboard.featured.map((item) => {
              const eligible = eligibilityFor(item.drive);

              return (
                <DashboardDriveCard
                  key={item.drive.id}
                  drive={item.drive}
                  stage={item.application?.stage ?? null}
                  applicationStatus={item.application?.status ?? null}
                  applicantCount={item.applicantCount}
                  departmentCodes={item.departmentCodes}
                  reviewFields={buildApplicationReviewData(
                    profile,
                    item.drive.applicationFields
                  )}
                  eligible={eligible}
                  ineligibilityReasons={
                    eligible
                      ? []
                      : getIneligibilityReasons(eligibilityStudent, item.drive)
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <div className="dash-grid-3">
        {QUICK_ACTIONS.map(({ title, href, icon: Icon, tone }) => (
          <Link key={href} href={href} className="quick-action">
            <span className={`icon-tile ${tone}`}>
              <Icon size={17} aria-hidden />
            </span>
            <span>
              <span className="quick-action-title">{title}</span>
              <span className="quick-action-note" style={{ display: 'block' }}>
                Coming soon
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Notifications + deadlines */}
      <div className="dash-grid-2">
        <div className="card">
          <div className="dash-section-head">
            <h3 className="section-title" style={{ margin: 0 }}>
              Notifications
            </h3>
            <Link
              href="/notifications"
              style={{ fontSize: 12, color: 'var(--accent-dark)' }}
            >
              View all →
            </Link>
          </div>

          {notifications.data.length === 0 ? (
            <p className="dash-empty">No notifications yet.</p>
          ) : (
            notifications.data.map((notification) => (
              <div key={notification.id} className="dash-list-item">
                <span
                  className={`dash-list-dot ${
                    notification.isRead ? 'read' : ''
                  }`.trim()}
                  aria-hidden
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {notification.title}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: 11.5, marginTop: 3 }}
                  >
                    {formatRelativeTime(new Date(notification.createdAt))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="dash-section-head">
            <h3 className="section-title" style={{ margin: 0 }}>
              Deadlines
            </h3>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="dash-empty">No upcoming deadlines.</p>
          ) : (
            upcomingDeadlines.map((item) => {
              const daysLeft = Math.ceil(
                (item.drive.applicationDeadline.getTime() - now.getTime()) /
                  (1000 * 60 * 60 * 24)
              );

              return (
                <div key={item.drive.id} className="dash-list-item">
                  <span
                    className={`dash-list-dot ${
                      daysLeft > 3 ? 'read' : ''
                    }`.trim()}
                    aria-hidden
                  />
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {item.drive.companyName} application closes —{' '}
                    <strong>
                      {formatDeadline(item.drive.applicationDeadline)}
                    </strong>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active drives table */}
      <section>
        <div className="dash-section-head">
          <h3 className="section-title" style={{ margin: 0 }}>
            Active drives
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {dashboard.openDriveCount} open · {dashboard.totalApplications}{' '}
            applied
          </span>
        </div>

        {dashboard.all.length === 0 ? (
          <div className="card">
            <p className="dash-empty">No drives to show yet.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ padding: '4px 14px' }}>
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Package</th>
                  <th>Min CGPA</th>
                  <th>Drive date</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.all.map(({ drive }) => {
                  const status = getDriveDisplayStatus(
                    drive.applicationDeadline,
                    drive.driveDate
                  );

                  return (
                    <tr key={drive.id}>
                      <td>{drive.companyName}</td>
                      <td>{drive.roleName}</td>
                      <td>
                        {drive.packageDisplay || `${drive.packageOffered} LPA`}
                      </td>
                      <td>{drive.minCGPA}</td>
                      <td>{formatDriveDate(drive.driveDate)}</td>
                      <td>{formatDeadline(drive.applicationDeadline)}</td>
                      <td>
                        {status === 'open' && (
                          <StatusBadge variant="green">Open</StatusBadge>
                        )}
                        {status === 'upcoming' && (
                          <StatusBadge variant="purple">Upcoming</StatusBadge>
                        )}
                        {status === 'closed' && (
                          <StatusBadge variant="gray">Closed</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
