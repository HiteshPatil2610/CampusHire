'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

interface NotificationBellProps {
  size?: number; // icon size, default 18
}

/**
 * Notification bell with unread indicator
 * Shows a dot when there are unread notifications
 * Navigates to /notifications on click
 */
export function NotificationBell({ size = 18 }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadCountAction()
      .then((result) => {
        if (result.success) setUnreadCount(result.count);
      })
      .catch(() => {
        // Silently ignore errors
      });
  }, []);

  return (
    <button
      type="button"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      onClick={() => router.push('/notifications')}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        borderRadius: 'var(--radius)',
        color: 'var(--text-secondary)',
      }}
    >
      <Bell size={size} strokeWidth={1.75} />
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
      )}
    </button>
  );
}
