'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getUnreadSummaryAction } from '@/features/notifications/actions/get-unread-summary-action';

interface NotificationBellProps {
  size?: number; // icon size, default 18
}

/** Counts above this render as "9+" so the badge stays a fixed width. */
const MAX_DISPLAYED_COUNT = 9;

/**
 * Notification bell with an unread count.
 *
 * Shows the number rather than a bare dot, and turns red when one of the
 * unread items is critical (an application outcome, or a profile gap that
 * blocks applying) — twelve unread announcements should not look as urgent
 * as a single unread offer.
 */
export function NotificationBell({ size = 18 }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);

  useEffect(() => {
    getUnreadSummaryAction()
      .then((result) => {
        if (result.success) {
          setUnreadCount(result.count);
          setHasCritical(result.hasCritical);
        }
      })
      .catch(() => {
        // Chrome element — a failed count must not surface as an error.
      });
  }, []);

  const hasUnread = unreadCount > 0;
  const badgeColor = hasCritical ? 'var(--red)' : 'var(--accent)';
  const label = hasUnread
    ? `Notifications, ${unreadCount} unread${hasCritical ? ', including urgent' : ''}`
    : 'Notifications';

  return (
    <button
      type="button"
      aria-label={label}
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
        color: hasCritical ? 'var(--red)' : 'var(--text-secondary)',
      }}
    >
      <Bell size={size} strokeWidth={1.75} />

      {hasUnread && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 15,
            height: 15,
            padding: '0 4px',
            borderRadius: 999,
            background: badgeColor,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: '15px',
            textAlign: 'center',
          }}
        >
          {unreadCount > MAX_DISPLAYED_COUNT
            ? `${MAX_DISPLAYED_COUNT}+`
            : unreadCount}
        </span>
      )}
    </button>
  );
}
