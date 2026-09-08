'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Briefcase,
  User,
  Users,
  FileCheck,
  Bell,
  Settings,
  Megaphone,
  BarChart2,
  Globe,
  Building2,
  UserCog,
  ClipboardList,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: boolean;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  student: [
    { label: 'Dashboard', href: '/student-dashboard', icon: LayoutDashboard },
    { label: 'Drives', href: '/student-dashboard/drives', icon: Briefcase },
    { label: 'Profile', href: '/student-dashboard/profile', icon: User },
    { label: 'Applications', href: '/student-dashboard/applications', icon: FileCheck },
    { label: 'Notifications', href: '/notifications', icon: Bell, badge: true },
    { label: 'Settings', href: '/student-dashboard/settings', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin-dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/admin-dashboard/students', icon: Users },
    { label: 'Drives', href: '/admin-dashboard/drives', icon: Briefcase },
    { label: 'Announcements', href: '/admin-dashboard/announcements', icon: Megaphone },
    { label: 'Reports', href: '/admin-dashboard/reports', icon: BarChart2 },
  ],
  superadmin: [
    { label: 'Overview', href: '/super-admin-dashboard', icon: Globe },
    { label: 'Students', href: '/super-admin-dashboard/students', icon: Users },
    { label: 'Drives', href: '/super-admin-dashboard/drives', icon: Briefcase },
    { label: 'Departments', href: '/super-admin-dashboard/departments', icon: Building2 },
    {
      label: 'Admin Accounts',
      href: '/super-admin-dashboard/admins',
      icon: UserCog,
    },
    { label: 'Reports', href: '/super-admin-dashboard/reports', icon: BarChart2 },
    { label: 'Audit Log', href: '/audit-logs', icon: ClipboardList },
    { label: 'Settings', href: '/super-admin-dashboard/settings', icon: Settings },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Portal',
  admin: 'Dept Admin',
  superadmin: 'Super Admin',
};

export interface SidebarProps {
  role: 'student' | 'admin' | 'superadmin';
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [unreadCount, setUnreadCount] = useState(0);

  const items = NAV_ITEMS[role] || NAV_ITEMS.student;

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

  function isActive(href: string): boolean {
    return pathname === href || pathname?.startsWith(href + '/');
  }

  function handleSignOut() {
    signOut({ redirectUrl: '/sign-in' });
  }

  return (
    <aside className="app-sidebar">
      <div style={{ marginBottom: 20 }}>
        <Link href="/" className="brand-mark" style={{ cursor: 'pointer' }}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </Link>
        <div style={{ marginTop: 6, display: 'inline-block' }}>
          <span
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
            }}
          >
            {ROLE_LABELS[role] || role}
          </span>
        </div>
      </div>

      <nav className="app-sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={16} />
                <span>{item.label}</span>
              </span>
              {item.badge && unreadCount > 0 && (
                <span className="badge badge-accent">{unreadCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <button
          className="sidebar-link"
          style={{
            border: 'none',
            background: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
