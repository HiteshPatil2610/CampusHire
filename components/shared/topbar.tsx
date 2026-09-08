'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Bell } from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

export interface TopbarProps {
  role: 'student' | 'admin' | 'superadmin';
}

export default function Topbar({ role }: TopbarProps) {
  const { user } = useUser();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notification count
    getUnreadCountAction()
      .then((result) => {
        if (result.success) {
          setUnreadCount(result.count);
        }
      })
      .catch(() => {
        // Silently ignore if unauthenticated
      });
  }, []);

  function handleBellClick() {
    router.push('/notifications');
  }

  function handleAvatarClick() {
    if (role === 'superadmin') {
      router.push('/super-admin-dashboard');
    } else if (role === 'admin') {
      router.push('/admin-dashboard');
    } else {
      router.push('/student-dashboard/profile');
    }
  }

  const displayName = user?.fullName || user?.firstName || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="app-topbar">
      <div />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
        }}
      >
        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          onClick={handleBellClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
          )}
        </button>

        {/* User profile */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
          onClick={handleAvatarClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleAvatarClick();
            }
          }}
          title="Go to profile"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={displayName}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent-light)',
                color: 'var(--accent-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {initials}
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</span>
        </div>
      </div>
    </header>
  );
}
