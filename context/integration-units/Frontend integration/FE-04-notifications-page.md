# CampusHire — Integration Unit FE-04: Notifications Page

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
- **FE-03 — Student Drives & Applications ✅**
  - Drive catalogue, DriveCard, Drive detail, Apply flow, My Applications
  - Schema migration `frontend-drive-fields` applied
  - `npm run build` passes ✅

Now implement:

# FE-04 — Notifications Page

---

# 1. IMPORTANT CONTEXT — READ BEFORE ANYTHING ELSE

This unit is **different from the other FE units** in one critical way:

The backend for notifications (Unit 10) is **fully complete**. The
`app/notifications/page.tsx` already exists and already fetches real data.
The `NotificationList` and `NotificationBell` components already exist in
`components/notifications/`.

**This unit is NOT a fresh port — it is a replacement and upgrade of what
already exists**, bringing the visual design from the temp frontend into
the already-wired real implementation.

Before touching anything, read every existing file involved:

- `app/notifications/page.tsx` — already wired to `getNotifications()`
- `components/notifications/NotificationList.tsx` — already works, uses Tailwind
- `components/notifications/NotificationBell.tsx` — already works, polls unread count
- `features/notifications/actions/get-notifications-action.ts`
- `features/notifications/actions/mark-notification-read.ts`
- `features/notifications/actions/mark-all-notifications-read.ts`
- `features/notifications/actions/get-unread-count-action.ts`
- `features/notifications/queries/get-notifications.ts`
- `features/notifications/schemas/notification.ts`
- `prisma/schema.prisma` — `Notification` model fields

Then read the temp frontend source:
- `campushire_frontend (temp)/src/pages/student/NotificationsPage.jsx`
- `campushire_frontend (temp)/src/context/AppStateContext.jsx` — only to
  understand the mock `isNotifRead`, `markNotifRead`, `markAllNotifsRead`
  pattern (then confirm they are already replaced by real actions)

Also read from earlier units in this project:
- `components/shared/sidebar.tsx` (from FE-01) — the `NotificationBell` wiring
- `components/shared/topbar.tsx` (from FE-01) — confirm bell placement

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **Redesign `app/notifications/page.tsx`** — apply the temp frontend's
   visual layout while keeping all real data wiring intact
2. **Redesign `components/notifications/NotificationList.tsx`** — replace
   Tailwind-heavy implementation with the CSS-class-based design from the
   temp frontend while keeping all real server action calls intact
3. **Redesign `components/notifications/NotificationBell.tsx`** — align
   with FE-01 Topbar bell pattern, replace SVG bell with Lucide icon,
   keep real `getUnreadCountAction()` wiring intact
4. **Add filter tabs** — "All", "Unread", "Drives", "System" filter pills
   from the temp frontend, implemented as URL search params
5. **Add pagination** — wire the `Pagination` component from FE-01 to the
   notifications list (currently pagination info is only shown as text)
6. **Topbar bell wiring confirmation** — verify `NotificationBell` is
   correctly placed in the `Topbar` from FE-01 and the unread count
   refreshes after the user marks notifications as read

This unit does **NOT** implement:

- Any new server actions or queries — all exist already
- Any schema changes — `Notification` model is complete
- Any admin or super admin pages
- Real-time notifications (WebSocket/polling) — deferred
- Deep linking from notification to resource — deferred (noted in §8)
- Email or SMS notifications — out of V1 scope

---

# 3. NOTIFICATIONS PAGE REDESIGN

## 3.1 Target file

`app/notifications/page.tsx` — **REPLACE entirely**

## 3.2 Architecture

The page is already a server component fetching real data. Keep that.
Update the visual wrapper and add filter + pagination support via URL params.

```
NotificationsPage (Server Component)
  ├── calls requireAuth() → authenticated user (any role)
  ├── reads search params: ?filter=all|unread|drives|system&page=1
  ├── maps filter param → isRead flag for getNotifications():
  │     filter=unread  → getNotifications(userId, { isRead: false, page, pageSize: 25 })
  │     filter=all     → getNotifications(userId, { page, pageSize: 25 })
  │     filter=drives  → getNotifications(userId, { page, pageSize: 25 })
  │         then client-side filter by type === 'DRIVE'
  │     filter=system  → getNotifications(userId, { page, pageSize: 25 })
  │         then client-side filter by type === 'SYSTEM' | 'PROFILE' | 'ADMIN'
  └── renders:
      ├── page header (h1 + subtitle + "Mark all as read" button)
      ├── NotificationsFilterBar (client — filter pills)
      └── NotificationList (redesigned — client)
```

### Filter → type mapping

The `Notification` model has a `type` field with values:
`APPLICATION`, `DRIVE`, `PROFILE`, `ADMIN`, `SYSTEM`

Map the temp frontend's 4 filter tabs as follows:

| Filter tab | Server `isRead` param | Client type filter |
|---|---|---|
| `All` | not set (all) | none (show all types) |
| `Unread` | `isRead: false` | none (show all types, only unread) |
| `Drives` | not set | `type === 'DRIVE'` or `type === 'APPLICATION'` |
| `System` | not set | `type === 'SYSTEM'` or `type === 'PROFILE'` or `type === 'ADMIN'` |

For `Drives` and `System` filters, fetch all notifications and filter
client-side within `NotificationList`. The data volume is small enough
that this is acceptable. Do not add a `type` filter param to
`getNotifications()` unless you also update the schema and action — leave
the existing query untouched.

### Filter as URL param

Implement filter tabs as URL search params so the page re-renders on
the server when the filter changes:

```typescript
// In NotificationsFilterBar (client component):
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();

function handleFilter(f: string) {
  const params = new URLSearchParams(searchParams);
  params.set('filter', f.toLowerCase());
  params.delete('page'); // reset to page 1 on filter change
  router.push(`${pathname}?${params.toString()}`);
}
```

## 3.3 Page header

Port the page header exactly from `NotificationsPage.jsx`:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
  <div>
    <h1 className="page-title" style={{ marginBottom: 4 }}>Notifications</h1>
    <p className="text-secondary" style={{ fontSize: 13 }}>
      Stay updated with drive deadlines, assessment invitations, and profile reviews.
    </p>
  </div>
  <MarkAllReadButton />   {/* client component — calls markAllNotificationsRead() */}
</div>
```

`MarkAllReadButton` is a tiny `"use client"` component that:
- Only renders if there is at least one unread notification
- Calls `markAllNotificationsRead()` via `useTransition`
- Shows "Marking…" while pending
- Calls `router.refresh()` on success to re-fetch the server component
- Shows a success toast on completion

## 3.4 Unread count in page header

Optionally, show the total unread count next to the page title:

```
Notifications  ·  3 unread
```

Pass `unreadCount` from the server component by counting
`notifications.data.filter(n => !n.isRead).length` from the initial fetch.

---

# 4. `NotificationList` REDESIGN

## 4.1 Target file

`components/notifications/NotificationList.tsx` — **REPLACE entirely**

## 4.2 What to keep (all data wiring stays)

- `useState` for local notifications list
- `markNotificationRead()` server action call — exact same logic
- `markAllNotificationsRead()` server action call — exact same logic
- `formatTimestamp()` helper — keep identical
- The `initialNotifications` prop shape: `{ data, page, pageSize, totalCount }`
- Pagination info at the bottom

## 4.3 Visual redesign

Replace the Tailwind-heavy card layout with the CSS-class-based layout
from `NotificationsPage.jsx`. The key visual changes:

**From (current):**
```tsx
<div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 ...">
  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getTypeColor(...)}`}>
    {notification.type}
  </span>
  ...
</div>
```

**To (temp frontend design):**
```tsx
<div
  className="card"
  style={{ padding: 0, overflow: 'hidden' }}
>
  {notifications.map((n) => (
    <div
      key={n.id}
      onClick={() => !n.isRead && handleMarkAsRead(n.id)}
      style={{
        padding: '16px 20px',
        borderBottom: '0.5px solid var(--border)',
        background: n.isRead ? 'transparent' : 'var(--accent-light)',
        cursor: n.isRead ? 'default' : 'pointer',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Unread dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: n.isRead ? 'transparent' : 'var(--accent-dark)',
        marginTop: 6,
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1 }}>
        {/* Type badge */}
        <span className={`badge ${getTypeBadgeClass(n.type)}`}>
          {n.type}
        </span>
        {/* Title */}
        <div style={{
          fontSize: 13,
          fontWeight: n.isRead ? 400 : 600,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          marginTop: 4,
        }}>
          {n.title}
        </div>
        {/* Message */}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
          {n.message}
        </div>
        {/* Timestamp */}
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          {formatTimestamp(n.createdAt)}
        </div>
      </div>

      {/* New badge */}
      {!n.isRead && (
        <span className="badge badge-purple" style={{ fontSize: 10, flexShrink: 0 }}>
          New
        </span>
      )}
    </div>
  ))}
</div>
```

## 4.4 Type badge class helper

Replace `getTypeColor()` (which returned Tailwind classes) with
`getTypeBadgeClass()` (which returns CSS class names from `globals.css`):

```typescript
function getTypeBadgeClass(type: string): string {
  switch (type) {
    case 'APPLICATION': return 'badge-green';
    case 'DRIVE':       return 'badge-purple';
    case 'PROFILE':     return 'badge-amber';
    case 'ADMIN':       return 'badge-accent';
    case 'SYSTEM':
    default:            return 'badge-gray'; // from FE-01: .badge-gray
  }
}
```

## 4.5 Client-side type filtering

Add a `typeFilter` prop to `NotificationList` so the parent can tell
it which types to show (for the Drives and System filter tabs):

```typescript
interface NotificationListProps {
  initialNotifications: {
    data: Notification[];
    page: number;
    pageSize: number;
    totalCount: number;
  };
  typeFilter?: 'all' | 'drives' | 'system';  // ADD THIS
}
```

Apply the filter in the component:

```typescript
const visibleNotifications = useMemo(() => {
  if (typeFilter === 'drives') {
    return notifications.filter(n =>
      n.type === 'DRIVE' || n.type === 'APPLICATION'
    );
  }
  if (typeFilter === 'system') {
    return notifications.filter(n =>
      n.type === 'SYSTEM' || n.type === 'PROFILE' || n.type === 'ADMIN'
    );
  }
  return notifications; // 'all'
}, [notifications, typeFilter]);
```

## 4.6 Pagination

Replace the plain text "Page X of Y" with the `Pagination` component
from FE-01 (`components/ui/pagination.tsx`).

```typescript
<Pagination
  page={initialNotifications.page}
  pageSize={initialNotifications.pageSize}
  totalCount={initialNotifications.totalCount}
  onPageChange={(newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }}
/>
```

Because this triggers a URL change, the server component re-renders with
the new page and passes fresh `initialNotifications` to the list.
The client component does not need to manage its own page state.

## 4.7 Empty state

When `visibleNotifications.length === 0`:
```tsx
<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
  <div style={{ fontSize: 28, marginBottom: 10 }}>🔔</div>
  <p>No notifications in this category.</p>
</div>
```

---

# 5. `NotificationBell` REDESIGN

## 5.1 Target file

`components/notifications/NotificationBell.tsx` — **REPLACE entirely**

## 5.2 What to keep

- `getUnreadCountAction()` call in `useEffect` on mount
- The unread count badge rendering
- Navigation to `/notifications`

## 5.3 Visual redesign

Replace the custom SVG bell and Tailwind wrapper with the Lucide `Bell`
icon and `.sidebar-link` / `.topbar` CSS pattern:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getUnreadCountAction } from '@/features/notifications/actions/get-unread-count-action';

interface NotificationBellProps {
  size?: number;  // icon size, default 18
}

export function NotificationBell({ size = 18 }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadCountAction()
      .then((result) => {
        if (result.success) setUnreadCount(result.count);
      })
      .catch(() => {});
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
        <span style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent)',
        }} />
      )}
    </button>
  );
}
```

Key changes from current implementation:
- Replace custom SVG with Lucide `Bell` icon (consistent with FE-01 icon usage)
- Replace the numeric badge (`9+` number) with a simple dot — matches the
  temp frontend's topbar bell design
- Remove the `notificationsPath` prop — the bell always navigates to
  `/notifications` which is the universal notification page for all roles
- Simplified click handler using `useRouter().push()` instead of `<Link>`
  (because a button triggers navigation rather than an anchor)

## 5.4 Unread count refresh after marking notifications

When a user visits the notifications page and marks items as read,
the bell count in the Topbar should update. This is handled by
`router.refresh()` in the `MarkAllReadButton` and in the individual
mark-as-read handler — the server component re-fetches fresh data,
which causes the `NotificationBell` to re-mount and re-fetch its count.

No additional polling or real-time mechanism is needed for V1.

---

# 6. NOTIFICATIONS FILTER BAR COMPONENT

## 6.1 Target file

`components/notifications/notifications-filter-bar.tsx` (NEW FILE)

## 6.2 A small `"use client"` component

```typescript
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const FILTERS = ['All', 'Unread', 'Drives', 'System'] as const;
type FilterTab = typeof FILTERS[number];

interface NotificationsFilterBarProps {
  currentFilter: string;
}

export function NotificationsFilterBar({ currentFilter }: NotificationsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleFilter(f: FilterTab) {
    const params = new URLSearchParams(searchParams);
    params.set('filter', f.toLowerCase());
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {FILTERS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`filter-pill ${currentFilter === tab.toLowerCase() ? 'active' : ''}`}
          onClick={() => handleFilter(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
```

---

# 7. MARK-ALL-READ BUTTON COMPONENT

## 7.1 Target file

`components/notifications/mark-all-read-button.tsx` (NEW FILE)

## 7.2 Implementation

```typescript
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { markAllNotificationsRead } from '@/features/notifications/actions/mark-all-notifications-read';

interface MarkAllReadButtonProps {
  hasUnread: boolean;
}

export function MarkAllReadButton({ hasUnread }: MarkAllReadButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  if (!hasUnread) return null;

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.success) {
        toast({ title: 'Done', description: 'All notifications marked as read.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not mark notifications as read.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleMarkAll}
      disabled={isPending}
    >
      {isPending ? 'Marking…' : 'Mark all as read'}
    </button>
  );
}
```

---

# 8. TOPBAR BELL WIRING — VERIFICATION

The `Topbar` component built in FE-01 should already include
`NotificationBell`. Verify this is correctly placed.

In `components/shared/topbar.tsx`, the bell should appear in the right
section of the topbar, before the user avatar:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
  <NotificationBell size={18} />
  {/* user avatar / name */}
</div>
```

If it is missing or uses the old SVG implementation, update it to use
the redesigned `NotificationBell` from §5.

The `Sidebar` component from FE-01 also shows the unread count badge
on the "Notifications" nav item. Verify that the sidebar's
`getUnreadCountAction()` call still works correctly.

---

# 9. DEEP LINKING — DEFERRED

The temp frontend has notifications that, when clicked, navigate to
a related resource (e.g. clicking a DRIVE notification goes to the
drive detail page).

In V1:
- The `Notification` model has `resourceType` and `resourceId` fields
- Deep linking is deferred — clicking a notification only marks it as read
- Do NOT implement navigation to `/student-dashboard/drives/{resourceId}`
  or other resource-specific routes when clicking a notification

Add a code comment where the click handler is defined:

```typescript
// TODO FE-DEEP-LINK: When resourceType and resourceId are present,
// navigate to the relevant resource page instead of just marking as read.
// e.g. DRIVE → /student-dashboard/drives/{resourceId}
//      APPLICATION → /student-dashboard/applications
```

This is the only place this TODO needs to appear.

---

# 10. NEW FILES TO CREATE

```
components/notifications/
  ├── notifications-filter-bar.tsx    ← filter pill tabs (client)
  └── mark-all-read-button.tsx        ← mark all as read (client)
```

Files to **replace** (not create new — overwrite existing content):

```
app/notifications/page.tsx            ← add filters, pagination, new visual shell
components/notifications/
  ├── NotificationList.tsx            ← redesign visual, add typeFilter prop
  └── NotificationBell.tsx            ← replace SVG with Lucide Bell, simplify
```

---

# 11. WHAT NOT TO DO

- Do NOT change any server action files in `features/notifications/`
- Do NOT change `features/notifications/queries/get-notifications.ts`
- Do NOT change `features/notifications/schemas/notification.ts`
- Do NOT add a new `type` filter parameter to `getNotifications()` —
  the Drives/System filter tabs work by client-side type filtering
- Do NOT implement real-time notifications (WebSocket, polling) — deferred
- Do NOT implement deep linking (navigate to resource on click) — deferred,
  just add the TODO comment in §9
- Do NOT add a numeric badge (`9+`) to `NotificationBell` — use a dot only
  (matches the temp frontend's minimal topbar bell design)
- Do NOT touch any admin or super admin pages
- Do NOT run any Prisma migrations — no schema changes in this unit
- Do NOT add new shadcn components — use the ones already added in FE-01

---

# 12. TYPESCRIPT RULES

- All files: `.tsx`, strict mode, no `any`
- `Notification` type: import from `@prisma/client`
- `useRouter`, `usePathname`, `useSearchParams`: import from `'next/navigation'`
- `Bell`: import from `'lucide-react'`
- No new npm packages needed for this unit
- `useTransition` + `startTransition` for all server action calls
- `router.refresh()` after every successful mutation to re-sync server state

---

# 13. VERIFICATION

Run in order:

```bash
npx tsc --noEmit
npm run lint
npm run test          # all existing tests must still pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Notifications page
- [ ] Page loads at `/notifications` for an authenticated student
- [ ] Page header shows "Notifications" title and subtitle
- [ ] Unread count shows next to title if unread notifications exist
- [ ] "Mark all as read" button is visible when there are unread notifications
- [ ] "Mark all as read" button disappears when all are read
- [ ] Filter tabs "All", "Unread", "Drives", "System" are visible
- [ ] "All" filter shows all notifications with correct visual style
- [ ] "Unread" filter shows only unread notifications
- [ ] "Drives" filter shows only APPLICATION and DRIVE type notifications
- [ ] "System" filter shows SYSTEM, PROFILE, ADMIN type notifications
- [ ] Switching filters updates URL search param and re-renders correctly
- [ ] Unread notifications have terracotta `var(--accent-light)` background
- [ ] Read notifications have transparent background
- [ ] Unread dot (8px accent circle) shows for unread notifications
- [ ] "New" badge (badge-purple) shows for unread notifications
- [ ] Type badge (APPLICATION=green, DRIVE=purple, PROFILE=amber) displays correctly
- [ ] Clicking an unread notification marks it as read (background clears)
- [ ] Relative timestamp shows correctly ("Just now", "3 hours ago", "2 days ago")
- [ ] Empty state message shows when no notifications in a filter category
- [ ] Pagination component renders when `totalCount > 25`
- [ ] Navigating to page 2 shows next batch of notifications

### NotificationBell in Topbar
- [ ] Bell icon (Lucide `Bell`) shows in the topbar for all roles
- [ ] Red dot shows when there are unread notifications
- [ ] No dot shows when all notifications are read
- [ ] Clicking the bell navigates to `/notifications`
- [ ] After marking all notifications as read on the notifications page,
      navigating back shows the bell dot is gone

### NotificationBell in Sidebar
- [ ] Unread count badge shows on the "Notifications" nav item in the sidebar
- [ ] Badge disappears after all notifications are marked as read

### All roles
- [ ] Notifications page is accessible to students, admins, and super admins
      (it uses `requireAuth()` not `requireStudent()`)
- [ ] Each role sees only their own notifications

---

# 14. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-04 complete
- `app/notifications/page.tsx` redesigned with filters and pagination
- `NotificationList` redesigned with CSS-class-based layout, typeFilter prop
- `NotificationBell` redesigned with Lucide Bell icon, dot-only unread indicator
- `NotificationsFilterBar` created
- `MarkAllReadButton` created
- Bell confirmed in Topbar and Sidebar
- All tests still passing
- Build passing

Set next unit: **FE-05 — Department Admin Home & Student Roster**

---

# 15. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Department admin pages (FE-05)
- Admin drives management (FE-06)
- Excel bulk import (FE-07)
- Super admin pages (FE-08)

The next unit is **FE-05**.

---

# FINAL REPORT

When finished, provide a summary covering:

## Notifications Page
- Filters implemented and how they map to server params vs client filtering
- Pagination wired
- Visual changes from current implementation

## NotificationList
- Visual changes made
- `typeFilter` prop
- What was kept identical (data wiring, server action calls)

## NotificationBell
- Changes from current implementation
- Dot vs numeric badge decision

## New Components
- `NotificationsFilterBar`: implementation notes
- `MarkAllReadButton`: implementation notes

## Topbar & Sidebar Bell
- Confirmed placement and wiring

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (test count)
- `npm run build` result

## Deep Linking
- Confirm TODO comment placed, no implementation done

## Scope Confirmation
Explicitly confirm:
**No schema changes. No new server actions. No real-time notifications.
No deep linking implemented. No admin or super admin pages touched.**
