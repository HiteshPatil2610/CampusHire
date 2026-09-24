import type { Role, User } from '@prisma/client';
import { NotificationList } from '@/components/notifications/NotificationList';
import { NotificationsFilterBar } from '@/components/notifications/notifications-filter-bar';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button';
import {
  getCategoryCounts,
  getNotifications,
} from '@/features/notifications/queries/get-notifications';
import { parseNotificationFilter } from '@/features/notifications/schemas/notification';
import { materializeDueNotifications } from '@/features/notifications/domain/materialize';

/**
 * The notification centre, rendered under each role's own dashboard so the
 * surrounding navigation is theirs.
 *
 * One store, three experiences: the copy, the preference list and the links
 * in each row are the ones for that role — a row's action URL was built by
 * its producer for the recipient, so an admin's "new applications" opens the
 * drive workspace while a student's "selected" opens their applications.
 *
 * Every query is scoped to the signed-in user; no user id is ever taken from
 * a request.
 *
 * Item 6: preference editing itself is not shown here — it lives once, under
 * each role's own Settings page (`<NotificationPreferences>` there), so it is
 * never out of sync with the copy that page shows for it. This page is the
 * feed only.
 */

const COPY: Record<Role, { title: string; subtitle: string }> = {
  STUDENT: {
    title: 'Notifications',
    subtitle: 'Drives you can apply to, your applications, and announcements.',
  },
  DEPT_ADMIN: {
    title: 'Notifications',
    subtitle:
      'Drives assigned to your department, applications from your students, and what the placement office decides.',
  },
  SUPER_ADMIN: {
    title: 'Notifications',
    subtitle:
      'What departments are doing with their drives, requests waiting for you, and system alerts.',
  },
};

interface NotificationCenterProps {
  user: User;
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function NotificationCenter({ user, searchParams }: NotificationCenterProps) {
  // Time-based notifications (a deadline closing, a scheduled announcement)
  // are materialised on a visit, since nothing schedules them.
  await materializeDueNotifications(user);

  const filter = parseNotificationFilter(searchParams.filter);
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const [notifications, counts] = await Promise.all([
    getNotifications(user.id, {
      page,
      pageSize: 25,
      isRead: filter === 'unread' ? false : undefined,
      category: filter === 'all' || filter === 'unread' ? 'all' : filter,
    }),
    getCategoryCounts(user.id),
  ]);

  const copy = COPY[user.role];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {copy.title}
          </h1>
          <MarkAllReadButton hasUnread={notifications.unreadCount > 0} />
        </div>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          {copy.subtitle}
        </p>
      </div>

      <NotificationsFilterBar
        currentFilter={filter}
        counts={counts}
        unreadCount={notifications.unreadCount}
      />

      <div style={{ marginTop: 24 }}>
        <NotificationList initialNotifications={notifications} />
      </div>
    </div>
  );
}
