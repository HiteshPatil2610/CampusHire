"use client";

import { useState } from "react";
import { markNotificationRead } from "@/features/notifications/actions/mark-notification-read";
import { markAllNotificationsRead } from "@/features/notifications/actions/mark-all-notifications-read";
import type { Notification } from "@prisma/client";

interface NotificationListProps {
  initialNotifications: {
    data: Notification[];
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

export function NotificationList({ initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications.data);
  const [loading, setLoading] = useState(false);

  const handleMarkAsRead = async (notificationId: string) => {
    setLoading(true);
    const result = await markNotificationRead(notificationId);
    
    if (result.success) {
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
    }
    
    setLoading(false);
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    const result = await markAllNotificationsRead();
    
    if (result.success) {
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    }
    
    setLoading(false);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "APPLICATION":
        return "bg-[var(--teal-light)] text-[var(--teal)]";
      case "DRIVE":
        return "bg-[var(--purple-light)] text-[var(--purple)]";
      case "PROFILE":
        return "bg-[var(--amber-light)] text-[var(--amber)]";
      case "ADMIN":
        return "bg-[var(--accent-light)] text-[var(--accent)]";
      case "SYSTEM":
        return "bg-[var(--surface-1)] text-[var(--text-secondary)]";
      default:
        return "bg-[var(--surface-1)] text-[var(--text-secondary)]";
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);
  const totalPages = Math.ceil(initialNotifications.totalCount / initialNotifications.pageSize);

  return (
    <div className="space-y-6">
      {/* Header with Mark All as Read button */}
      {hasUnread && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllAsRead}
            disabled={loading}
            className="px-4 py-2 text-sm text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors disabled:opacity-50"
          >
            Mark All as Read
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl">
            <p className="text-[var(--text-secondary)]">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 transition-colors hover:bg-[var(--surface-1)] ${
                !notification.isRead ? "border-l-4 border-l-[var(--accent)]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Type Badge */}
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getTypeColor(notification.type)}`}>
                    {notification.type}
                  </span>

                  {/* Title */}
                  <h3 className={`mt-2 text-base ${!notification.isRead ? "font-semibold" : ""} text-[var(--text-primary)]`}>
                    {notification.title}
                  </h3>

                  {/* Message */}
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {notification.message}
                  </p>

                  {/* Timestamp */}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {formatTimestamp(notification.createdAt)}
                  </p>
                </div>

                {/* Mark as Read button (only for unread) */}
                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    disabled={loading}
                    className="text-sm text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Info */}
      {notifications.length > 0 && (
        <div className="text-center text-sm text-[var(--text-secondary)]">
          Page {initialNotifications.page} of {totalPages} ({initialNotifications.totalCount} total notifications)
        </div>
      )}
    </div>
  );
}
