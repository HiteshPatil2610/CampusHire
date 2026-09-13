import { NotificationList } from '@/components/notifications/NotificationList';
import { NotificationsFilterBar } from '@/components/notifications/notifications-filter-bar';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button';
import { getNotifications } from '@/features/notifications/queries/get-notifications';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface NotificationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  // Authorization: Any authenticated user
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    // Redirect to sign-in if not authenticated
    redirect('/sign-in');
  }

  // Await searchParams (Next.js 15 async pattern)
  const params = await searchParams;
  const filterParam = params.filter as string | undefined;
  const pageParam = params.page as string | undefined;

  // Parse filter and page
  const currentFilter = filterParam ?? 'all';
  const filter = currentFilter === 'unread' ? 'unread' : 'all';
  const typeFilter = 
    currentFilter === 'drives' ? 'drives' :
    currentFilter === 'system' ? 'system' : 
    'all';
  const page = pageParam ? parseInt(pageParam, 10) : 1;

  // Fetch notifications with server-side isRead filter only
  const notifications = await getNotifications(user.id, {
    page,
    pageSize: 25,
    isRead: filter === 'unread' ? false : undefined,
  });

  // Check if there are unread notifications
  const hasUnread = notifications.data.some((n) => !n.isRead);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Notifications
          </h1>
          <MarkAllReadButton hasUnread={hasUnread} />
        </div>
        <p
          className="text-muted"
          style={{ fontSize: 13, margin: 0 }}
        >
          Stay updated with important activities and system updates
        </p>
      </div>

      {/* Filter Bar */}
      <NotificationsFilterBar currentFilter={currentFilter} />

      {/* Notification List */}
      <div style={{ marginTop: 24 }}>
        <NotificationList
          initialNotifications={notifications}
          typeFilter={typeFilter as 'all' | 'drives' | 'system'}
        />
      </div>
    </div>
  );
}
