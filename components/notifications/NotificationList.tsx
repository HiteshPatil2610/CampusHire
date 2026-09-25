'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { markNotificationRead } from '@/features/notifications/actions/mark-notification-read';
import Pagination from '@/components/ui/pagination';
import {
  getNotificationHref,
  getNotificationTypeLabel,
  PRIORITY_PRESENTATION,
} from '@/features/notifications/utils/notification-priority';
import { groupNotifications } from '@/features/notifications/utils/notification-grouping';
import type { Notification } from '@prisma/client';

interface NotificationListProps {
  initialNotifications: {
    data: Notification[];
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

/**
 * The notification rows.
 *
 * Grouped into sections rather than one flat feed, badged by the stored
 * priority the event registry set, and opened through the action URL its
 * producer built for this recipient's role. Each row can be marked read or
 * unread again without opening it.
 */
export function NotificationList({ initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications.data);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sections = useMemo(() => groupNotifications(notifications), [notifications]);

  function setRead(id: string, isRead: boolean) {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, isRead } : n))
    );
  }

  async function toggleRead(notification: Notification) {
    const next = !notification.isRead;
    setRead(notification.id, next);
    const result = await markNotificationRead(notification.id, next);
    if (!result.success) {
      setRead(notification.id, notification.isRead);
      return;
    }
    router.refresh();
  }

  async function handleOpen(notification: Notification) {
    const href = getNotificationHref(notification);

    if (!notification.isRead) {
      // Optimistic: marking read is low risk and the row should respond at
      // once, especially when we are about to navigate away.
      setRead(notification.id, true);
      const result = await markNotificationRead(notification.id, true);
      if (!result.success) {
        setRead(notification.id, false);
        return;
      }
    }

    if (href) {
      router.push(href);
      return;
    }
    router.refresh();
  }

  function formatTimestamp(date: Date) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) params.delete('page');
    else params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (notifications.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔔</div>
        <p>No notifications in this category.</p>
      </div>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <section key={section.key} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: section.key === 'attention' ? 'var(--red)' : 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {section.label}
            </h2>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {section.items.length}
            </span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {section.items.map((n) => {
              const presentation = PRIORITY_PRESENTATION[n.priority];
              const href = getNotificationHref(n);
              const isActionable = Boolean(href) || !n.isRead;

              return (
                <div
                  key={n.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    background: n.isRead ? 'transparent' : 'var(--accent-light)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    // An urgent item keeps a coloured spine so it stays
                    // findable once it drops into a time bucket.
                    borderLeft:
                      n.priority === 'URGENT' || n.priority === 'ACTION_REQUIRED'
                        ? '3px solid var(--red)'
                        : '3px solid transparent',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: n.isRead ? 'transparent' : 'var(--accent-dark)',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />

                  <div
                    role={isActionable ? 'button' : undefined}
                    tabIndex={isActionable ? 0 : undefined}
                    onClick={isActionable ? () => void handleOpen(n) : undefined}
                    onKeyDown={
                      isActionable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void handleOpen(n);
                            }
                          }
                        : undefined
                    }
                    style={{ flex: 1, minWidth: 0, cursor: isActionable ? 'pointer' : 'default' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${presentation.badgeClass}`}>
                        {getNotificationTypeLabel(n)}
                      </span>
                      {href && (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Open →
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.isRead ? 400 : 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        marginTop: 4,
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginTop: 2,
                        lineHeight: 1.5,
                      }}
                    >
                      {n.message}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {formatTimestamp(n.createdAt)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                    onClick={() => void toggleRead(n)}
                  >
                    {n.isRead ? 'Mark unread' : 'Mark read'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {initialNotifications.totalCount > initialNotifications.pageSize && (
        <div
          style={{
            marginTop: 24,
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <Pagination
            page={initialNotifications.page}
            pageSize={initialNotifications.pageSize}
            totalCount={initialNotifications.totalCount}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </>
  );
}
