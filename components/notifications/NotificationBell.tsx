"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUnreadCountAction } from "@/features/notifications/actions/get-unread-count-action";

interface NotificationBellProps {
  notificationsPath: string; // Path to notifications page based on role
}

export function NotificationBell({ notificationsPath }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const result = await getUnreadCountAction();
      if (result.success) {
        setUnreadCount(result.count);
      }
      setLoading(false);
    };

    fetchUnreadCount();
  }, []);

  return (
    <Link
      href={notificationsPath}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[var(--surface-1)] transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      {/* Bell Icon (using simple SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 text-[var(--text-primary)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Unread Badge */}
      {!loading && unreadCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[var(--accent)] rounded-full">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
