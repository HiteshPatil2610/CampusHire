# CampusHire — Integration Unit FE-M01: Mobile Shell & CSS Foundation

You are adding mobile responsiveness to the CampusHire Next.js project.
All 9 frontend integration units (FE-01 through FE-09) must be complete
before starting this unit.

## Current Status

Frontend integration complete:

- FE-01 through FE-09 ✅
- `npm run build` passes ✅
- All three role dashboards working on desktop

Mobile responsiveness in progress:

- **FE-M01 — Mobile Shell & CSS Foundation ← YOU ARE HERE**

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, read:

- `context/ui-context.md` — design tokens, layout shell specs (§1.4),
  motion specs (§6)
- `app/globals.css` — the full CSS file as it exists after FE-01 through
  FE-09. Understand every `@layer` block that was added.
- `components/shared/app-shell.tsx` — the current AppShell implementation
- `components/shared/sidebar.tsx` — the current Sidebar implementation
- `components/shared/topbar.tsx` — the current Topbar implementation
- `app/(student)/layout.tsx` — how AppShell is used for students
- `app/(admin)/layout.tsx` — how AppShell is used for admins
- `app/(super-admin)/layout.tsx` — how AppShell is used for super admins
- `app/layout.tsx` — root layout
- `middleware.ts` — route protection (no changes needed here)

Do not begin implementation until you have read all of the above and
understand the current desktop structure completely.

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **CSS breakpoints** — add mobile/tablet media query blocks to `globals.css`
2. **Layout fixes** — make `.app-shell`, `.app-content`, `.field-row`,
   `.kpi-card` grids, `.drives-grid`, `.profile-layout`, and `.table-wrap`
   all respond correctly on small screens
3. **Student bottom nav bar** — new `BottomNav` component for student role
4. **Admin/super-admin hamburger drawer** — new `MobileDrawer` + trigger
5. **AppShell update** — switch between bottom nav / drawer based on role
6. **Topbar update** — add hamburger button (admin/super-admin only on mobile)
7. **`app/globals.css` mobile utility classes** — `.table-scroll-mobile`,
   `.hide-mobile`, `.hide-desktop` helpers

This unit does **NOT** implement:

- Any page-level mobile layouts (FE-M02, FE-M03)
- Profile tab strip conversion (FE-M02)
- Table-to-card conversions for specific pages (FE-M02, FE-M03)
- Any new server actions, queries, or schema changes
- Any feature changes — purely structural/visual

---

# 3. BREAKPOINT SYSTEM

## 3.1 Breakpoints to use

Add these as CSS custom properties at the top of the media query section
(comments only — CSS doesn't support variable breakpoints, but document them):

```
Desktop:  ≥ 1024px  — existing layout, no changes
Tablet:   ≤ 768px   — sidebar hidden, hamburger/bottom nav shown
Phone:    ≤ 480px   — single-column everything, larger touch targets
```

In code, use these two breakpoints consistently across all media queries:

```css
@media (max-width: 768px) { ... }   /* tablet + phone */
@media (max-width: 480px) { ... }   /* phone only */
```

Never use other arbitrary breakpoints. Never use `min-width` mobile-first
queries — the existing codebase is desktop-first, stay consistent.

## 3.2 Where to add in `globals.css`

Append a new `@layer` block at the very end of `globals.css`:

```css
@layer components {
  /* ============================================================
     MOBILE RESPONSIVENESS — FE-M01
     Breakpoints: ≤768px (tablet+phone), ≤480px (phone only)
     ============================================================ */

  /* ... all media queries go here ... */
}
```

All mobile CSS in this unit goes inside this single block, in one place.
Do not scatter `@media` queries throughout the file.

---

# 4. LAYOUT CSS CHANGES

Add each of the following inside the mobile `@layer` block from §3.2.

## 4.1 App Shell — hide sidebar, single column

```css
@media (max-width: 768px) {
  /* Switch from 2-column grid to single column */
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  /* Hide the desktop sidebar entirely on mobile */
  .app-sidebar {
    display: none;
  }

  /* The main column takes the full width */
  .app-main {
    min-width: 0;
    width: 100%;
  }

  /* Reduce content padding */
  .app-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .app-content {
    padding: 12px;
  }
}
```

## 4.2 Student role — add bottom nav spacing

When the student bottom nav is visible, the content must not be hidden
behind it. Add a bottom padding class that AppShell applies for students:

```css
@media (max-width: 768px) {
  /* Applied to .app-main when role === 'student' */
  .app-main.student-mobile {
    padding-bottom: 64px; /* height of bottom nav */
  }
}
```

## 4.3 Topbar

```css
@media (max-width: 768px) {
  .app-topbar {
    padding: 10px 16px;
  }
}
```

## 4.4 Form field grids

```css
@media (max-width: 480px) {
  .field-row {
    grid-template-columns: 1fr !important;
    gap: 0;
  }
}
```

The `!important` is needed because many `.field-row` elements have
inline `style` overrides (e.g. `gridTemplateColumns: 'repeat(4, 1fr)'`).
This ensures mobile always wins.

## 4.5 KPI card grids

KPI cards use inline `display: grid; grid-template-columns: repeat(4, 1fr)`
or similar patterns. Since these are inline styles, target the `.kpi-card`
parent differently. Add a wrapper class:

```css
/* Applied to the div wrapping KPI cards */
@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px !important;
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }
}
```

Update every page that renders a KPI grid to use `className="kpi-grid"`
instead of inline `style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', ... }}`.

This is the only place in this unit where you touch page files — every
admin home page, super admin dashboard, and student dashboard that has
a KPI row must have `className="kpi-grid"` added. Do this now as part
of this unit so FE-M02 and FE-M03 don't need to touch it.

Pages to update (add `className="kpi-grid"` to the wrapping div):
- `app/(student)/student-dashboard/page.tsx`
- `app/(admin)/admin-dashboard/page.tsx`
- `app/(super-admin)/super-admin-dashboard/page.tsx`
- `app/(super-admin)/super-admin-dashboard/reports/page.tsx`

## 4.6 Drives grid

```css
@media (max-width: 480px) {
  .drives-grid {
    grid-template-columns: 1fr !important;
  }
}
```

## 4.7 Profile layout (tab sidebar + content)

```css
@media (max-width: 768px) {
  /* Collapse the 190px left tab sidebar + content grid to single column.
     FE-M02 will replace the vertical tab nav with a horizontal strip.
     For now, stack them so the page doesn't break. */
  .profile-layout {
    grid-template-columns: 1fr !important;
  }

  /* Hide the vertical tabs on mobile — FE-M02 adds the horizontal strip */
  .profile-tabs {
    display: none;
  }
}
```

## 4.8 Table scroll on mobile

The primary mobile table strategy is horizontal scroll. More specific
conversions (table → cards) happen in FE-M02 and FE-M03.

```css
@media (max-width: 768px) {
  /* All .table-wrap containers scroll horizontally on mobile */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Prevent table cells from wrapping and causing vertical bloat */
  .table-wrap table {
    min-width: 600px; /* Enough for most tables to be readable */
  }

  /* Smaller cell padding on mobile */
  .table-wrap th,
  .table-wrap td {
    padding: 8px 6px;
    font-size: 12px;
  }
}
```

## 4.9 Card padding

```css
@media (max-width: 480px) {
  .card {
    padding: 14px;
  }
}
```

## 4.10 Page title size

```css
@media (max-width: 480px) {
  .page-title {
    font-size: 17px;
  }
  .section-title {
    font-size: 14px;
  }
}
```

## 4.11 Utility classes

```css
/* Hide on mobile (≤768px), show on desktop */
@media (max-width: 768px) {
  .hide-mobile {
    display: none !important;
  }
}

/* Hide on desktop (≥769px), show on mobile */
@media (min-width: 769px) {
  .hide-desktop {
    display: none !important;
  }
}

/* Table horizontal scroll wrapper */
.table-scroll-mobile {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

---

# 5. STUDENT BOTTOM NAVIGATION BAR

## 5.1 Target file

`components/shared/bottom-nav.tsx` (NEW FILE)

## 5.2 Spec

- Fixed to bottom of viewport
- Height: 64px (taller than standard 56px for better touch targets)
- Background: `var(--surface-2)`
- Border top: `0.5px solid var(--border)`
- 5 items: Dashboard, Drives, Profile, Applications, Notifications
- Each item: icon (20px) + label (10px) stacked vertically
- Active item: icon + label in `var(--accent)` colour
- Inactive item: `var(--text-secondary)`
- Notifications item shows unread dot when count > 0
- Only visible at `≤768px` (`.hide-desktop` class)
- `z-index: 200` (above content, below modals)

## 5.3 Nav items

```typescript
const STUDENT_NAV_ITEMS = [
  { label: 'Dashboard',    href: '/student-dashboard',              icon: LayoutDashboard },
  { label: 'Drives',       href: '/student-dashboard/drives',       icon: Briefcase       },
  { label: 'Profile',      href: '/student-dashboard/profile',      icon: User            },
  { label: 'Applications', href: '/student-dashboard/applications', icon: FileCheck       },
  { label: 'Notifs',       href: '/notifications',                  icon: Bell, badge: true },
];
```

Labels are shortened to fit 5 items across a 375px screen.
"Applications" becomes "Applied", "Notifications" becomes "Notifs" if
needed — measure and decide during implementation.

## 5.4 Active detection

Use `usePathname()` from `'next/navigation'`. An item is active when:
`pathname === item.href || pathname.startsWith(item.href + '/')`

## 5.5 Notification badge

Same pattern as `Sidebar` — call `getUnreadCountAction()` on mount
via `useEffect`. Show a 6px red dot on the bell icon when `count > 0`.
No numeric count — just a dot (consistent with `NotificationBell`).

## 5.6 Implementation

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Briefcase, User, FileCheck, Bell
} from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

const NAV_ITEMS = [
  { label: 'Home',    href: '/student-dashboard',              Icon: LayoutDashboard               },
  { label: 'Drives',  href: '/student-dashboard/drives',       Icon: Briefcase                     },
  { label: 'Profile', href: '/student-dashboard/profile',      Icon: User                          },
  { label: 'Applied', href: '/student-dashboard/applications', Icon: FileCheck                     },
  { label: 'Alerts',  href: '/notifications',                  Icon: Bell,        badge: true      },
];

export function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadCountAction()
      .then((r) => { if (r.success) setUnreadCount(r.count); })
      .catch(() => {});
  }, []);

  return (
    <nav
      className="hide-desktop"
      style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        height:          64,
        background:      'var(--surface-2)',
        borderTop:       '0.5px solid var(--border)',
        display:         'flex',
        alignItems:      'stretch',
        zIndex:          200,
      }}
    >
      {NAV_ITEMS.map(({ label, href, Icon, badge }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + '/');
        const color = isActive ? 'var(--accent)' : 'var(--text-secondary)';

        return (
          <Link
            key={href}
            href={href}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            3,
              color,
              textDecoration: 'none',
              position:       'relative',
              minWidth:       0,
            }}
          >
            {/* Icon */}
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
              {badge && unreadCount > 0 && (
                <span
                  style={{
                    position:     'absolute',
                    top:          -2,
                    right:        -2,
                    width:        6,
                    height:       6,
                    borderRadius: '50%',
                    background:   'var(--accent)',
                  }}
                />
              )}
            </span>
            {/* Label */}
            <span
              style={{
                fontSize:   10,
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow:   'hidden',
                textOverflow: 'ellipsis',
                maxWidth:   '100%',
                padding:    '0 2px',
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

---

# 6. ADMIN / SUPER ADMIN MOBILE DRAWER

## 6.1 Target files

- `components/shared/mobile-drawer.tsx` (NEW FILE)
- Update `components/shared/topbar.tsx` — add hamburger button

## 6.2 How it works

On mobile (`≤768px`), the desktop sidebar is hidden (§4.1). The Topbar
shows a hamburger button (Lucide `Menu`) on the left side. Tapping it
opens a full-height drawer from the left with the navigation items.
A dim overlay covers the rest of the screen. Tapping the overlay or
the ✕ button inside the drawer closes it.

## 6.3 State — where it lives

The open/closed state lives in `AppShell` and is passed down:

```typescript
// In app-shell.tsx:
const [drawerOpen, setDrawerOpen] = useState(false);

// Close drawer on route change:
const pathname = usePathname();
useEffect(() => { setDrawerOpen(false); }, [pathname]);
```

Pass `drawerOpen` and `setDrawerOpen` as props to `Topbar` and
`MobileDrawer`.

## 6.4 `MobileDrawer` component

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

interface MobileDrawerProps {
  role:     'admin' | 'superadmin';
  isOpen:   boolean;
  onClose:  () => void;
}

export function MobileDrawer({ role, isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  // Nav items are the same arrays as in Sidebar — import them from a
  // shared constant rather than duplicating.
  // Create: lib/nav-items.ts  (see §6.6)
  const items = NAV_ITEMS[role];

  if (!isOpen) return null;

  return (
    <>
      {/* Dim overlay */}
      <div
        className="hide-desktop"
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(28, 28, 26, 0.5)',
          zIndex:     300,
        }}
      />

      {/* Drawer panel */}
      <div
        className="hide-desktop"
        style={{
          position:   'fixed',
          top:        0,
          left:       0,
          bottom:     0,
          width:      280,
          background: 'var(--surface-2)',
          borderRight:'0.5px solid var(--border)',
          zIndex:     301,
          display:    'flex',
          flexDirection: 'column',
          padding:    '20px 14px',
          overflowY:  'auto',
          /* Slide-in animation */
          animation:  'drawerSlideIn 0.2s var(--ease-admin)',
        }}
      >
        {/* Drawer header: brand mark + close button */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   20,
          }}
        >
          <div className="brand-mark">
            <span className="brand-dot" />
            <span>CampusHire</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      'var(--text-secondary)',
              padding:    4,
            }}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(({ label, href, Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer: sign out */}
        <div
          style={{
            paddingTop:  12,
            borderTop:   '0.5px solid var(--border)',
          }}
        >
          <button
            className="sidebar-link"
            style={{
              border:     'none',
              background: 'none',
              width:      '100%',
              textAlign:  'left',
              cursor:     'pointer',
            }}
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </>
  );
}
```

## 6.5 Drawer slide-in animation

Add to the mobile CSS block in `globals.css`:

```css
@keyframes drawerSlideIn {
  from {
    transform: translateX(-100%);
    opacity: 0.8;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## 6.6 Shared nav items constant

To avoid duplicating nav items between `Sidebar` and `MobileDrawer`,
extract them into a shared constant file:

`lib/nav-items.ts` (NEW FILE)

```typescript
import {
  LayoutDashboard, Users, Briefcase, Megaphone,
  BarChart2, Globe, UserCog, Building2,
  ClipboardList, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href:  string;
  Icon:  LucideIcon;
  badge?: boolean;
}

export const NAV_ITEMS: Record<'admin' | 'superadmin', NavItem[]> = {
  admin: [
    { label: 'Dashboard',     href: '/admin-dashboard',                    Icon: LayoutDashboard },
    { label: 'Students',      href: '/admin-dashboard/students',           Icon: Users           },
    { label: 'Drives',        href: '/admin-dashboard/drives',             Icon: Briefcase       },
    { label: 'Announcements', href: '/admin-dashboard/announcements',      Icon: Megaphone       },
    { label: 'Reports',       href: '/admin-dashboard/reports',            Icon: BarChart2       },
  ],
  superadmin: [
    { label: 'Overview',       href: '/super-admin-dashboard',                   Icon: Globe         },
    { label: 'Students',       href: '/super-admin-dashboard/students',          Icon: Users         },
    { label: 'Drives',         href: '/super-admin-dashboard/drives',            Icon: Briefcase     },
    { label: 'Departments',    href: '/super-admin-dashboard/departments',       Icon: Building2     },
    { label: 'Admin Accounts', href: '/super-admin-dashboard/admins',            Icon: UserCog       },
    { label: 'Reports',        href: '/super-admin-dashboard/reports',           Icon: BarChart2     },
    { label: 'Audit Log',      href: '/audit-logs',                              Icon: ClipboardList },
    { label: 'Settings',       href: '/super-admin-dashboard/settings',          Icon: Settings      },
  ],
};
```

Then update `components/shared/sidebar.tsx` to import `NAV_ITEMS` from
`lib/nav-items.ts` instead of defining the array inline. This removes
the duplication.

---

# 7. UPDATE `AppShell`

## 7.1 What changes

`components/shared/app-shell.tsx` needs to:

1. Import and render `BottomNav` for student role
2. Import and render `MobileDrawer` for admin/superadmin roles
3. Add `.student-mobile` class to `.app-main` for student role
4. Manage `drawerOpen` state
5. Pass `drawerOpen` + `setDrawerOpen` to `Topbar` and `MobileDrawer`
6. Close drawer on pathname change

## 7.2 Updated AppShell structure

```tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { BottomNav } from './bottom-nav';
import { MobileDrawer } from './mobile-drawer';

interface AppShellProps {
  role:     'student' | 'admin' | 'superadmin';
  children: React.ReactNode;
}

export function AppShell({ role, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on every navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      {/* Desktop sidebar — hidden on mobile via CSS (§4.1) */}
      <Sidebar role={role} />

      {/* Main area */}
      <div
        className={`app-main${role === 'student' ? ' student-mobile' : ''}`}
      >
        {/* Topbar — receives hamburger state for admin/superadmin */}
        <Topbar
          role={role}
          onMenuClick={() => setDrawerOpen(true)}
        />

        {/* Page content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Student bottom nav — only rendered for student role,
          hidden on desktop via .hide-desktop CSS class */}
      {role === 'student' && <BottomNav />}

      {/* Admin / super admin mobile drawer */}
      {(role === 'admin' || role === 'superadmin') && (
        <MobileDrawer
          role={role}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
```

---

# 8. UPDATE `Topbar`

## 8.1 What changes

Add a hamburger button that appears only on mobile for admin/super admin roles.

The hamburger is on the LEFT side of the Topbar, before the page title area.

```typescript
interface TopbarProps {
  role:        'student' | 'admin' | 'superadmin';
  onMenuClick: () => void;   // ADD THIS
}
```

## 8.2 Hamburger button markup

```tsx
{/* Hamburger — only for admin/superadmin, only on mobile */}
{(role === 'admin' || role === 'superadmin') && (
  <button
    className="hide-desktop"
    onClick={onMenuClick}
    aria-label="Open navigation menu"
    style={{
      background: 'none',
      border:     'none',
      cursor:     'pointer',
      color:      'var(--text-secondary)',
      padding:    '4px 8px 4px 0',
      display:    'flex',
      alignItems: 'center',
    }}
  >
    <Menu size={22} strokeWidth={1.75} />
  </button>
)}
```

Place this at the start of the topbar's left section, before the page
title slot.

## 8.3 Topbar layout on mobile

On mobile the topbar should show:
- Left: hamburger (admin/superadmin) OR nothing (student — they use bottom nav)
- Right: notification bell + user avatar (same as desktop, but hide name text)

Hide user name text on mobile:

```tsx
{/* User name — hide on mobile */}
<span className="hide-mobile" style={{ fontSize: 13, fontWeight: 500 }}>
  {displayName}
</span>
```

---

# 9. UPDATE ROLE LAYOUTS

The three role layout files pass `role` to `AppShell`. No structural
changes needed — but verify the `AppShell` import uses the named export.

If any layout currently uses the old placeholder div structure instead
of `AppShell`, fix it now:

```typescript
// app/(student)/layout.tsx
import { AppShell } from '@/components/shared/app-shell';

export default async function StudentLayout({ children }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <AppShell role="student">{children}</AppShell>;
}
```

Same pattern for `(admin)` and `(super-admin)` layouts.

---

# 10. AUTH AND PUBLIC PAGE RESPONSIVENESS

The landing page, sign-in, and sign-up pages also need basic mobile fixes.
These don't use AppShell so they're handled here.

## 10.1 Landing page (`app/page.tsx`)

The `.public-navbar` needs to stay readable on mobile:

```css
@media (max-width: 480px) {
  .public-navbar {
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
}
```

Feature cards grid (if using a CSS grid):

```css
@media (max-width: 768px) {
  /* Landing page feature cards grid: 3-col → 1-col */
  .landing-features-grid {
    grid-template-columns: 1fr !important;
  }
}
```

Add `className="landing-features-grid"` to the feature cards container
in `app/page.tsx`.

## 10.2 Auth card

The `.auth-container` already has `max-width: 420px; margin: 60px auto`
which works fine. Just reduce the top margin on very small screens:

```css
@media (max-width: 480px) {
  .auth-container {
    margin: 24px auto;
    padding: 0 12px;
  }

  .auth-card {
    padding: 24px 20px;
  }
}
```

---

# 11. NEW FILES TO CREATE

```
components/shared/
  ├── bottom-nav.tsx           ← student bottom navigation bar
  └── mobile-drawer.tsx        ← admin/superadmin slide-out drawer

lib/
  └── nav-items.ts             ← shared nav item constants
```

Files to **update**:

```
app/globals.css                ← add mobile @layer block (§3.2–§4.11)
components/shared/app-shell.tsx ← add drawer/bottom nav rendering (§7)
components/shared/topbar.tsx   ← add hamburger button (§8)
components/shared/sidebar.tsx  ← import NAV_ITEMS from lib/nav-items.ts

app/(student)/student-dashboard/page.tsx   ← add .kpi-grid class
app/(admin)/admin-dashboard/page.tsx       ← add .kpi-grid class
app/(super-admin)/super-admin-dashboard/page.tsx ← add .kpi-grid class
app/(super-admin)/super-admin-dashboard/reports/page.tsx ← add .kpi-grid class
app/page.tsx                   ← add .landing-features-grid class (§10.1)
```

---

# 12. WHAT NOT TO DO

- Do NOT change any server actions, queries, or Prisma models
- Do NOT implement profile tab strip conversion — that is FE-M02
- Do NOT implement table-to-card conversions for specific pages — FE-M02/M03
- Do NOT add `AdminDrivePreviewCard` mobile hiding — that is FE-M03
- Do NOT add any new features or change any existing business logic
- Do NOT use arbitrary breakpoints other than `768px` and `480px`
- Do NOT use `min-width` mobile-first queries — stay desktop-first
- Do NOT give student role a hamburger drawer — students use bottom nav only
- Do NOT give admin/super admin a bottom nav bar — they use the drawer only
- Do NOT change `z-index` values for modals or dialogs — they already
  sit above the shell. Ensure the drawer (`z-index: 301`) and its overlay
  (`z-index: 300`) are below `z-index: 1000` used by `.modal-overlay`

---

# 13. TYPESCRIPT RULES

- All new files: `.tsx`, strict mode, no `any`
- `NavItem` interface exported from `lib/nav-items.ts`, imported in both
  `Sidebar` and `MobileDrawer`
- `LucideIcon` type from `'lucide-react'` for the `Icon` field in `NavItem`
- `AppShellProps.role` type: `'student' | 'admin' | 'superadmin'`
- `TopbarProps` updated to include `onMenuClick: () => void`
- `MobileDrawerProps` uses `role: 'admin' | 'superadmin'` (not student)

---

# 14. VERIFICATION

Run in order:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass.

Then open the browser dev tools, switch to **375px iPhone SE** and verify:

### Layout
- [ ] All three role dashboards show at 375px with no horizontal overflow
      on the page itself (only tables scroll horizontally as expected)
- [ ] `.app-sidebar` is not visible at 375px for any role
- [ ] `.app-content` has correct padding (12px sides)
- [ ] Page title is readable at 17px

### Student bottom nav
- [ ] Bottom nav bar shows at 375px for student role
- [ ] Bottom nav is NOT visible at 1024px (desktop)
- [ ] All 5 items visible and tappable (no overflow)
- [ ] Active item shows in `var(--accent)` terracotta colour
- [ ] Navigating between pages highlights the correct item
- [ ] Content is not hidden behind the bottom nav (padding-bottom: 64px)
- [ ] Notification badge dot appears when there are unread notifications
- [ ] No bottom nav shown for admin or super admin

### Admin/super admin hamburger drawer
- [ ] Hamburger icon visible in topbar at 375px for admin role
- [ ] Hamburger icon visible in topbar at 375px for super admin role
- [ ] No hamburger icon for student role
- [ ] Hamburger icon NOT visible at 1024px
- [ ] Tapping hamburger opens the drawer from the left
- [ ] Drawer shows brand mark, nav items, log out button
- [ ] Active route item is highlighted in drawer
- [ ] Tapping overlay closes the drawer
- [ ] Tapping ✕ closes the drawer
- [ ] Navigating to a page closes the drawer automatically
- [ ] Drawer slide-in animation plays
- [ ] Drawer does not appear on desktop (≥769px)

### CSS fixes
- [ ] `.field-row` is single-column at 375px
- [ ] KPI card grids show 2×2 at 768px, 1-col at 375px
- [ ] `.drives-grid` is single-column at 375px
- [ ] `.profile-layout` is single-column at 768px
- [ ] `.table-wrap` tables scroll horizontally on mobile (no overflow on the body)
- [ ] `.card` padding is 14px at 375px

### Tablet (768px)
- [ ] Switch dev tools to 768px (iPad portrait)
- [ ] KPI cards show 2×2 grid
- [ ] Student bottom nav visible at 768px
- [ ] Admin hamburger visible at 768px
- [ ] Tables scroll horizontally

### Auth & landing (not behind AppShell)
- [ ] Landing page readable at 375px
- [ ] Auth card (sign-in / sign-up) fits within screen at 375px
- [ ] No horizontal scroll on auth pages

---

# 15. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-M01 complete
- Mobile breakpoint system added to `globals.css`
- Layout fixes: app-shell, field-row, kpi-grid, drives-grid, profile-layout,
  table-wrap, card, page-title
- `BottomNav` created for student role
- `MobileDrawer` created for admin/super admin
- `lib/nav-items.ts` created (shared constant)
- `AppShell` updated with drawer + bottom nav integration
- `Topbar` updated with hamburger button
- `Sidebar` updated to use shared nav items
- Auth + landing page mobile fixes
- Build passing

Set next unit: **FE-M02 — Student Mobile Experience**

---

# 16. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Profile tab strip (FE-M02)
- Any page-specific table/card conversions (FE-M02, FE-M03)

The next unit is **FE-M02**.

---

# FINAL REPORT

When finished, provide:

## CSS Changes
- How many media query rules added to `globals.css`
- Any conflicts or overrides noted

## New Components
- `BottomNav`: icon count, badge wiring
- `MobileDrawer`: animation, close triggers

## AppShell & Topbar
- What changed, how state flows

## Shared Nav Items
- Confirm `Sidebar` now imports from `lib/nav-items.ts`

## Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run build` result

## Scope Confirmation
Explicitly confirm:
**No server actions changed. No database changes. No page content changed
beyond adding `.kpi-grid` and `.landing-features-grid` class names.
Profile tab strip not implemented (FE-M02). Table-to-card conversions
not implemented (FE-M02, FE-M03).**
