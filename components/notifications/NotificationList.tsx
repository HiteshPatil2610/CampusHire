'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { markNotificationRead } from '@/features/notifications/actions/mark-notification-read';
import Pagination from '@/components/ui/pagination';
import type { Notification } from '@prisma/client';

interface NotificationListProps {
  initialNotifications: {
    data: Notification[];
    page: number;
    pageSize: number;
    totalCount: number;
  };
  typeFilter?: 'all' | 'drives' | 'system';
}

/**
 * Notification list with CSS-class-based design
 * Supports type filtering for Drives and System categories
 */
export function NotificationList({ 
  initialNotifications,
  typeFilter = 'all' 
}: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications.data);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Apply client-side type filtering
  const visibleNotifications = useMemo(() => {
    if (typeFilter === 'drives') {
      return notifications.filter(n =>
        n.type === 'DRIVE' || n.type === 'APPLICATION'
      );
    }
    if (typeFilter === 'system') {
      return notifications.filter(n =>
        n.type === 'SYSTEM' || n.type === 'PROFILE' || n.type === 'ADMIN'
      );
    }
    return notifications; // 'all'
  }, [notifications, typeFilter]);

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationRead(notificationId);
    
    if (result.success) {
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      // Refresh server component to update bell count
      router.refresh();
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  };

  function getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'APPLICATION': return 'badge-green';
      case 'DRIVE':       return 'badge-purple';
      case 'PROFILE':     return 'badge-amber';
      case 'ADMIN':       return 'badge-accent';
      case 'SYSTEM':
      default:            return 'badge-gray';
    }
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Empty state
  if (visibleNotifications.length === 0) {
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
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {visibleNotifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.isRead && handleMarkAsRead(n.id)}
            style={{
              padding: '16px 20px',
              borderBottom: '0.5px solid var(--border)',
              background: n.isRead ? 'transparent' : 'var(--accent-light)',
              cursor: n.isRead ? 'default' : 'pointer',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Unread dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: n.isRead ? 'transparent' : 'var(--accent-dark)',
                marginTop: 6,
                flexShrink: 0,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1 }}>
              {/* Type badge */}
              <span className={`badge ${getTypeBadgeClass(n.type)}`}>
                {n.type}
              </span>
              {/* Title */}
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
              {/* Message */}
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
              {/* Timestamp */}
              <div
                className="text-muted"
                style={{ fontSize: 11, marginTop: 4 }}
              >
                {formatTimestamp(n.createdAt)}
              </div>
              
              {/* TODO FE-DEEP-LINK: When resourceType and resourceId are present,
                  navigate to the relevant resource page instead of just marking as read.
                  e.g. DRIVE → /student-dashboard/drives/{resourceId}
                       APPLICATION → /student-dashboard/applications */}
            </div>

            {/* New badge */}
            {!n.isRead && (
              <span
                className="badge badge-purple"
                style={{ fontSize: 10, flexShrink: 0 }}
              >
                New
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
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
