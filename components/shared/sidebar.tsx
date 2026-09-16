'use client';

import { useEffect, useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Bell,
  Settings,
  Megaphone,
  BarChart2,
  LogOut,
  FileCheck,
  Target,
  FileText,
  Sparkles,
  PencilLine,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon | string;
  badge?: boolean;
}

/** A labelled run of links. An untitled group renders with no heading. */
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const NAV_GROUPS: Record<string, NavGroup[]> = {
  student: [
    {
      items: [
        {
          label: 'Dashboard',
          href: '/student-dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'Drives',
      items: [
        {
          label: 'Drives',
          href: '/student-dashboard/drives',
          icon: Briefcase,
        },
        {
          label: 'Applications',
          href: '/student-dashboard/applications',
          icon: FileCheck,
        },
      ],
    },
    {
      title: 'Student',
      items: [
        { label: 'Profile', href: '/student-dashboard/profile', icon: Target },
        {
          label: 'Resume Builder',
          href: '/student-dashboard/resume-builder',
          icon: FileText,
        },
        {
          label: 'AI Analyzer',
          href: '/student-dashboard/ai-analyzer',
          icon: Sparkles,
        },
        {
          label: 'Self Assessment',
          href: '/student-dashboard/self-assessment',
          icon: PencilLine,
        },
        {
          label: 'Readiness',
          href: '/student-dashboard/readiness',
          icon: Gauge,
        },
      ],
    },
    {
      items: [
        {
          label: 'Notifications',
          href: '/notifications',
          icon: Bell,
          badge: true,
        },
        {
          label: 'Settings',
          href: '/student-dashboard/settings',
          icon: Settings,
        },
      ],
    },
  ],
  admin: [
    {
      items: [
        { label: 'Dashboard', href: '/admin-dashboard', icon: LayoutDashboard },
        { label: 'Students', href: '/admin-dashboard/students', icon: Users },
        { label: 'Drives', href: '/admin-dashboard/drives', icon: Briefcase },
        {
          label: 'Announcements',
          href: '/admin-dashboard/announcements',
          icon: Megaphone,
        },
        { label: 'Reports', href: '/admin-dashboard/reports', icon: BarChart2 },
      ],
    },
  ],
  superadmin: [
    {
      items: [
        { label: 'Institutional Overview', href: '/super-admin-dashboard', icon: '🌐' },
        { label: 'All Students', href: '/super-admin-dashboard/students', icon: '◉' },
        { label: 'Campus Drives', href: '/super-admin-dashboard/drives', icon: '🚀' },
        { label: 'Departments', href: '/super-admin-dashboard/departments', icon: '🏛' },
        { label: 'Admin Accounts', href: '/super-admin-dashboard/admins', icon: '👤' },
        { label: 'Global Reports', href: '/super-admin-dashboard/reports', icon: '📊' },
        { label: 'Audit Log', href: '/audit-logs', icon: '🔍' },
        { label: 'System Settings', href: '/super-admin-dashboard/settings', icon: '⚙' },
      ],
    },
  ],
};

const SETTINGS_HREF: Record<string, string> = {
  student: '/student-dashboard/settings',
  admin: '/admin-dashboard',
  superadmin: '/super-admin-dashboard/settings',
};

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Portal',
  admin: 'Dept Admin',
  superadmin: 'Super Admin / TPO',
};

/**
 * Instant click feedback for a nav link.
 *
 * Even with the route shell prefetched there is a gap between the click and
 * the skeleton painting, and during it the *old* page is still on screen — so
 * a click can read as "nothing happened". `useLinkStatus` reports the pending
 * transition from inside the Link with no network involved, so this paints on
 * the very first frame after the click. It must be rendered as a descendant of
 * the `<Link>` whose status it reports.
 */
function NavPendingSpinner() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <span className="nav-spinner" role="status" aria-label="Loading" />;
}

export interface SidebarProps {
  role: 'student' | 'admin' | 'superadmin';
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const groups = NAV_GROUPS[role] || NAV_GROUPS.student;
  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || '';

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
    // Exact match for the href
    if (pathname === href) {
      return true;
    }
    
    // For dashboard links, only match exact path (not subpaths)
    if (href.endsWith('dashboard')) {
      return pathname === href;
    }
    
    // For other links, check if current path starts with the href
    return pathname?.startsWith(href + '/') || false;
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
        {groups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`} className="nav-group">
            {group.title && (
              <div className="nav-group-title">{group.title}</div>
            )}

            {group.items.map((item) => {
              const active = isActive(item.href);
              const isEmojiIcon = typeof item.icon === 'string';
              const Icon = isEmojiIcon ? null : (item.icon as LucideIcon);

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
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {isEmojiIcon ? (
                      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
                        {item.icon as string}
                      </span>
                    ) : (
                      Icon && <Icon size={16} />
                    )}
                    <span>{item.label}</span>
                  </span>
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {item.badge && unreadCount > 0 && (
                      <span className="badge badge-accent">{unreadCount}</span>
                    )}
                    <NavPendingSpinner />
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <Link
          href={SETTINGS_HREF[role]}
          className={`sidebar-link ${
            isActive(SETTINGS_HREF[role]) ? 'active' : ''
          }`}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <Settings size={16} />
          <span>Settings</span>
          <NavPendingSpinner />
        </Link>
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
          <span>{firstName ? `Log out (${firstName})` : 'Log out'}</span>
        </button>
      </div>
    </aside>
  );
}
