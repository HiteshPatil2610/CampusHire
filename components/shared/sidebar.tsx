'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Globe,
  GraduationCap,
  Compass,
  Radio,
  Building2,
  UserCog,
  ScrollText,
  Tag,
  Search,
  PanelLeftClose,
  type LucideIcon,
} from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
        { label: 'Dashboard', href: '/student-dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Drives',
      items: [
        { label: 'Drives', href: '/student-dashboard/drives', icon: Briefcase },
        { label: 'Applications', href: '/student-dashboard/applications', icon: FileCheck },
      ],
    },
    {
      title: 'Student',
      items: [
        { label: 'Profile', href: '/student-dashboard/profile', icon: Target },
        { label: 'Resume Builder', href: '/student-dashboard/resume-builder', icon: FileText },
        { label: 'AI Analyzer', href: '/student-dashboard/ai-analyzer', icon: Sparkles },
        { label: 'Self Assessment', href: '/student-dashboard/self-assessment', icon: PencilLine },
        { label: 'Readiness', href: '/student-dashboard/readiness', icon: Gauge },
      ],
    },
    {
      items: [
        { label: 'Announcements', href: '/student-dashboard/announcements', icon: Megaphone },
        { label: 'Notifications', href: '/student-dashboard/notifications', icon: Bell, badge: true },
      ],
    },
  ],
  admin: [
    {
      items: [
        { label: 'Dashboard', href: '/admin-dashboard', icon: LayoutDashboard },
        { label: 'Students', href: '/admin-dashboard/students', icon: Users },
        { label: 'Drives', href: '/admin-dashboard/drives', icon: Briefcase },
        { label: 'Announcements', href: '/admin-dashboard/announcements', icon: Megaphone },
        { label: 'Reports', href: '/admin-dashboard/reports', icon: BarChart2 },
        { label: 'Notifications', href: '/admin-dashboard/notifications', icon: Bell, badge: true },
      ],
    },
  ],
  superadmin: [
    {
      items: [
        { label: 'Institutional Overview', href: '/super-admin-dashboard', icon: Globe },
        { label: 'All Students', href: '/super-admin-dashboard/students', icon: Users },
        { label: 'Campus Drives', href: '/super-admin-dashboard/drives', icon: Briefcase },
        { label: 'Placements', href: '/super-admin-dashboard/placements', icon: GraduationCap },
        { label: 'Pipeline Requests', href: '/super-admin-dashboard/pipeline-requests', icon: Compass },
        { label: 'Announcements', href: '/super-admin-dashboard/announcements', icon: Megaphone },
        { label: 'Notifications', href: '/super-admin-dashboard/notifications', icon: Bell, badge: true },
        { label: 'Notification Deliveries', href: '/super-admin-dashboard/notification-deliveries', icon: Radio },
        { label: 'Departments', href: '/super-admin-dashboard/departments', icon: Building2 },
        { label: 'Admin Accounts', href: '/super-admin-dashboard/admins', icon: UserCog },
        { label: 'Skill Review', href: '/super-admin-dashboard/skills', icon: Tag },
        { label: 'Global Reports', href: '/super-admin-dashboard/reports', icon: BarChart2 },
        { label: 'Audit Log', href: '/audit-logs', icon: ScrollText },
      ],
    },
  ],
};

const SETTINGS_HREF: Record<string, string> = {
  student: '/student-dashboard/settings',
  admin: '/admin-dashboard/settings',
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

/**
 * A dock icon with a right-anchored hover label. The label is `fixed` so the
 * dock's scroll container (needed when a role has many sections) can't clip it.
 */
function DockLink({
  item,
  active,
  unread,
}: {
  item: NavItem;
  active: boolean;
  unread: boolean;
}) {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const Icon = item.icon;

  function show(e: React.SyntheticEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  }

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setTip(null)}
      onFocus={show}
      onBlur={() => setTip(null)}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 ${
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
      }`}
    >
      <Icon size={20} />
      {unread && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
      )}
      {tip && (
        <span
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

export interface SidebarProps {
  role: 'student' | 'admin' | 'superadmin';
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const groups = NAV_GROUPS[role] || NAV_GROUPS.student;
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const settingsHref = SETTINGS_HREF[role];

  const displayName = user?.fullName || user?.firstName || 'User';
  const initials =
    displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  useEffect(() => {
    getUnreadCountAction()
      .then((result) => {
        if (result.success) setUnreadCount(result.count);
      })
      .catch(() => {
        // Silently ignore if unauthenticated
      });
  }, []);

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    // Dashboard roots match exactly, never their subpages.
    if (href.endsWith('dashboard')) return false;
    return pathname?.startsWith(href + '/') || false;
  }

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function closeSearch() {
    setSearching(false);
    setQuery('');
  }

  function handleSignOut() {
    signOut({ redirectUrl: '/sign-in' });
  }

  const trimmed = query.trim().toLowerCase();
  const visibleGroups = trimmed
    ? [
        {
          items: allItems.filter((item) => item.label.toLowerCase().includes(trimmed)),
        } as NavGroup,
      ]
    : groups;
  const accountMenu = menuOpen && (
    <div
      role="menu"
      className={`absolute z-50 w-52 rounded-xl border border-neutral-800 bg-neutral-950 p-1 shadow-xl ${
        collapsed ? 'bottom-0 left-full ml-2.5' : 'bottom-full left-2 right-2 mb-2 w-auto'
      }`}
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-white">{displayName}</p>
        <p className="truncate text-xs text-neutral-400">{ROLE_LABELS[role]}</p>
      </div>
      <Link
        role="menuitem"
        href={settingsHref}
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 hover:text-white"
      >
        <Settings size={16} />
        Settings
      </Link>
      <button
        role="menuitem"
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-900 hover:text-white"
      >
        <LogOut size={16} />
        Log out
      </button>
    </div>
  );

  const avatar = user?.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6c858b] text-xs font-semibold text-white">
      {initials}
    </span>
  );

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col bg-black text-white transition-all duration-300 ${
        collapsed ? 'w-14' : 'w-[260px]'
      }`}
    >
      {collapsed ? (
        <div className="flex h-full w-full flex-col items-center justify-between py-3.5">
          <div className="flex min-h-0 w-full flex-1 flex-col items-center">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Open sidebar"
              title="Open sidebar"
              className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-neutral-900"
            >
              <span className="h-[18px] w-[18px] rounded-[5px] bg-[var(--accent)]" />
            </button>

            <nav
              aria-label="Primary"
              className="flex min-h-0 w-full flex-1 flex-col items-center space-y-0.5 overflow-y-auto"
            >
              {groups.map((group, groupIndex) => (
                <div
                  key={group.title ?? `group-${groupIndex}`}
                  className={`flex w-full flex-col items-center space-y-0.5 ${
                    groupIndex > 0 ? 'border-t border-neutral-900 pt-1.5 mt-1.5' : ''
                  }`}
                >
                  {group.items.map((item) => (
                    <DockLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      unread={Boolean(item.badge) && unreadCount > 0}
                    />
                  ))}
                </div>
              ))}
            </nav>

          </div>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500"
            >
              {avatar}
            </button>
            {accountMenu}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col justify-between overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <Link href="/" className="flex items-center gap-2 text-base font-bold">
                <span className="h-[18px] w-[18px] rounded-[5px] bg-[var(--accent)]" />
                CampusHire
              </Link>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => (searching ? closeSearch() : setSearching(true))}
                  aria-label="Search navigation"
                  aria-pressed={searching}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white"
                >
                  <Search size={16} />
                </button>
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Collapse sidebar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>

            {searching && (
              <div className="px-3 pb-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeSearch();
                    if (e.key === 'Enter' && visibleGroups[0]?.items[0]) {
                      router.push(visibleGroups[0].items[0].href);
                      closeSearch();
                    }
                  }}
                  placeholder="Search pages…"
                  aria-label="Search pages"
                  className="w-full select-text rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                />
              </div>
            )}

            <nav
              aria-label="Primary"
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2"
            >
              {visibleGroups.map((group, groupIndex) => (
                <div key={group.title ?? `group-${groupIndex}`} className="space-y-0.5">
                  {group.title && !trimmed && (
                    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {group.title}
                    </div>
                  )}
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                          active
                            ? 'bg-neutral-900 font-medium text-white'
                            : 'text-neutral-200 hover:bg-neutral-900 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </span>
                        <span className="flex items-center gap-2">
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
              {trimmed && visibleGroups[0].items.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-500">No matching pages.</p>
              )}

            </nav>
          </div>

          <div ref={menuRef} className="relative border-t border-neutral-900 p-3">
            {accountMenu}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left hover:bg-neutral-900"
              >
                {avatar}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{displayName}</span>
                  <span className="block truncate text-xs text-neutral-400">{ROLE_LABELS[role]}</span>
                </span>
              </button>
              <Link
                href={settingsHref}
                aria-label="Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white"
              >
                <Settings size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
