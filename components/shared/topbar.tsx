'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export interface TopbarProps {
  role: 'student' | 'admin' | 'superadmin';
}

export default function Topbar({ role }: TopbarProps) {
  const { user } = useUser();
  const router = useRouter();

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
        {/* Notifications - using shared NotificationBell component */}
        <NotificationBell size={18} />

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
