import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, FileText, PencilLine, Sparkles } from 'lucide-react';
import { getOrCreateUser } from '@/lib/auth';
import { getStudentProfileByUserId } from '@/features/students/queries/get-profile';
import { calculateProfileCompletion } from '@/features/students/queries/profile-completion';
import { getStudentDashboardData } from '@/features/students/queries/get-dashboard-data';
import { getStudentActionItems } from '@/features/dashboard/queries/get-action-items';
import { ActionRequiredPanel } from '@/features/dashboard/components/action-required-panel';
import { getNotifications } from '@/features/notifications/queries/get-notifications';
import {
  sortByPriority,
  getNotificationHref,
  getNotificationPriority,
  getNotificationTypeLabel,
  PRIORITY_PRESENTATION,
} from '@/features/notifications/utils/notification-priority';
import { getEligibleDrives } from '@/features/drives/queries/get-eligible-drives';
import {
  isStudentEligibleForDrive,
  getIneligibilityReasons,
} from '@/features/drives/queries/drive-eligibility';
import { buildApplicationReviewData } from '@/features/applications/utils/application-review-fields';
import { prisma } from '@/lib/prisma';
import { ACTIVE_PLACEMENT_WHERE } from '@/features/students/utils/placement-status';
import { RegistrationForm } from '@/components/students/RegistrationForm';
import AwaitingApproval from '@/components/students/AwaitingApproval';
import { getMyAccessRequest } from '@/features/students/queries/get-my-access-request';
import DashboardDriveCard from '@/components/students/dashboard/dashboard-drive-card';
import StatusBadge from '@/components/ui/status-badge';
import { getDriveDisplayStatus, isDriveOpen } from '@/features/drives/utils/drive-status';
import { formatDeadline, formatNextStageDate } from '@/lib/drive-date-helpers';
import { formatRelativeTime } from '@/lib/format-relative-time';

import { formatPackage } from '@/features/drives/utils/format-package';
export const dynamic = 'force-dynamic';

/** Rows the dashboard notification widget shows before "View all". */
const DASHBOARD_NOTIFICATION_LIMIT = 4;

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
    // No Student record. Either they have not submitted their details yet, or
    // they have and are waiting on a department admin to approve them.
    const request = await getMyAccessRequest(user.id);

    // A pending request made before MIS verification cannot be approved as
    // it stands; the student verifies again, with their MIS number.
    const needsReverification =
      request?.status === 'PENDING' && request.misNumber === null;

    if (request && request.status !== 'APPROVED' && !needsReverification) {
      return (
        <AwaitingApproval
          email={request.email}
          departmentName={request.department.name}
          submittedAt={request.createdAt}
          rejectedReason={
            request.status === 'REJECTED'
              ? request.reviewNote ??
                'Your department admin declined this request. Contact them for details.'
              : null
          }
        />
      );
    }

    return <RegistrationForm />;
  }

  const completion = calculateProfileCompletion(profile);

  // Every drive the student is academically eligible for, open or not - the
  // table below shows the full picture, the cards show what needs action.
  // Notifications do not depend on the drive list, so both go out at once.
  // Pull a wider slice than we render so the widget can rank by urgency
  // rather than showing whichever three arrived most recently — an offer must
  // not be pushed off the dashboard by three announcements.
  const [eligible, notificationPool, placements] = await Promise.all([
    getEligibleDrives({ status: 'all', pageSize: 100 }),
    getNotifications(user.id, { page: 1, pageSize: 15 }),
    // Active placements — what the evaluator checks first.
    // Shown to the student read-only; nothing here lets them change it.
    prisma.studentPlacement.findMany({
      where: { studentId: profile.student.id, ...ACTIVE_PLACEMENT_WHERE },
      orderBy: { placedAt: 'desc' },
      select: {
        id: true,
        revokedAt: true,
        companyName: true,
        roleName: true,
        packageDisplay: true,
        placedAt: true,
      },
    }),
  ]);
  const dashboard = await getStudentDashboardData(
    profile.student.id,
    eligible.data,
    2
  );
  const notifications = sortByPriority(notificationPool.data).slice(
    0,
    DASHBOARD_NOTIFICATION_LIMIT
  );

  const now = new Date();
  const upcomingDeadlines = dashboard.all
    // Drives taking applications now, nearest end date first.
    .filter((item) => isDriveOpen(item.drive, now))
    .sort(
      (a, b) =>
        a.drive.applicationDeadline.getTime() -
        b.drive.applicationDeadline.getTime()
    )
    .slice(0, 5);

  // The submission card re-states eligibility, and the apply action re-checks
  // it server-side before writing.
  const eligibilityStudent = {
    ...profile.student,
    academic: profile.academic,
    skills: profile.skills,
    placements,
    // Which semesters have marks: the final-year marks gate reads them.
    semesterMarks: profile.semesterMarks,
  };
  // The same evaluator `applyToDrive` uses — standing (approved, placed,
  // opted in) first — so the card never offers an Apply the server refuses.
  const eligibilityFor = (drive: (typeof eligible.data)[number]) =>
    isStudentEligibleForDrive(eligibilityStudent, drive);

  // What needs the student now. Eligibility is the evaluator's answer
  // (`eligibilityFor`), never recomputed here.
  const actionItems = await getStudentActionItems({
    user,
    studentId: profile.student.id,
    profileCompletion: completion.percentage,
    hasAcademicRecord: profile.academic !== null,
    eligibleDrives: dashboard.all
      .filter((item) => item.application !== null || eligibilityFor(item.drive))
      .map((item) => ({
        driveId: item.drive.id,
        companyName: item.drive.companyName,
        roleName: item.drive.roleName,
        applicationStartDate: item.drive.applicationStartDate,
        deadline: item.drive.applicationDeadline,
        applied: item.application !== null,
      })),
  });

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

      <ActionRequiredPanel
        items={actionItems}
        emptyMessage="You are all caught up. New drives and updates will show up here."
      />

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

      {/* Placement — read-only for the student */}
      {placements.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--green, var(--accent))' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            🎉 You are placed
          </div>
          {placements.map((placement) => (
            <div key={placement.id} style={{ fontSize: 13, marginTop: 4 }}>
              <strong>{placement.companyName}</strong> — {placement.roleName}
              {placement.packageDisplay ? ` · ${placement.packageDisplay}` : ''}
              <span className="text-muted" style={{ fontSize: 11 }}>
                {' '}· {formatNextStageDate(placement.placedAt)}
              </span>
            </div>
          ))}
          <p className="text-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Placed students are no longer eligible for new placement drives. Your
            existing applications stay as they are. Contact your department
            admin if this is wrong.
          </p>
        </div>
      )}

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
                    // This department's resolved form — the same one
                    // `applyToDrive` rebuilds and validates against.
                    item.drive.applicationForm
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

          {notifications.length === 0 ? (
            <p className="dash-empty">No notifications yet.</p>
          ) : (
            notifications.map((notification) => {
              const priority = getNotificationPriority(notification);
              const href = getNotificationHref(notification);

              const row = (
                <>
                  <span
                    className={`dash-list-dot ${
                      notification.isRead ? 'read' : ''
                    }`.trim()}
                    aria-hidden
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        className={`badge ${PRIORITY_PRESENTATION[priority].badgeClass}`}
                        style={{ fontSize: 10 }}
                      >
                        {getNotificationTypeLabel(notification)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        fontWeight: notification.isRead ? 400 : 600,
                        marginTop: 3,
                      }}
                    >
                      {notification.title}
                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: 11.5, marginTop: 3 }}
                    >
                      {formatRelativeTime(new Date(notification.createdAt))}
                    </div>
                  </div>
                </>
              );

              // Link only when there is somewhere to go, so a row never
              // looks clickable and then does nothing.
              return href ? (
                <Link
                  key={notification.id}
                  href={href}
                  className="dash-list-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {row}
                </Link>
              ) : (
                <div key={notification.id} className="dash-list-item">
                  {row}
                </div>
              );
            })
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
                  <th>Next stage date</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.all.map(({ drive }) => {
                  const status = getDriveDisplayStatus(drive);

                  return (
                    <tr key={drive.id}>
                      <td>{drive.companyName}</td>
                      <td>{drive.roleName}</td>
                      <td>
                        {formatPackage(drive)}
                      </td>
                      <td>{drive.minCGPA}</td>
                      <td>{formatNextStageDate(drive.nextStageDate)}</td>
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
