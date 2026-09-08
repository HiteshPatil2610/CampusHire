# CampusHire — Integration Unit FE-01: Design System & App Shell

You are integrating the `campushire_frontend (temp)` React/Vite frontend into the
existing CampusHire Next.js project.

## Current Status

Backend units completed:

- Unit 01 — Project Setup ✅
- Unit 02 — Database & Student Foundation ✅
- Unit 03 — Authentication & Role Synchronization ✅
- Unit 04 — Student Registration & Profile Management ✅
- Unit 05 — Drive Management & Eligibility ✅
- Unit 06 — Student Applications ✅
- Unit 07 — Excel/CSV Bulk Import (spec complete, backend pending) 🟡
- Unit 08 — Department & Admin Account Management ✅
- Unit 09 — Audit Logging ✅
- Unit 10 — In-App Notifications ✅

Frontend integration in progress:

- **FE-01 — Design System & App Shell ← YOU ARE HERE**

Now implement:

# FE-01 — Design System & App Shell

This is the **foundation unit**. Every subsequent FE unit depends on the shell
and CSS produced here. Do not begin any page-level integration (FE-02 onward)
until this unit is verified end to end.

This unit is **pure UI work** — no database migrations, no Prisma changes,
no new server actions, no new queries. The existing backend is untouched.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md`
- `context/architecture.md`
- `context/ui-context.md`
- `context/code-standards.md`
- `context/progress-tracker.md`
- `INTEGRATION_GUIDE.md` (root of project)
- All files currently in `app/` — understand what is a placeholder and what is real
- `app/globals.css` — the existing token definitions
- `app/layout.tsx` — root layout with `ClerkProvider` and Inter font
- `middleware.ts` — current role-based route protection
- `app/(auth)/layout.tsx` — existing auth layout
- `app/(student)/layout.tsx` — current placeholder layout
- `app/(admin)/layout.tsx` — current placeholder layout
- `app/(super-admin)/layout.tsx` — current placeholder layout
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` — current Clerk SignIn page
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx` — current Clerk SignUp page
- `app/page.tsx` — current placeholder landing page
- `app/not-found.tsx` — current 404 page
- `components/` — existing shared components

Then read all temp frontend source files relevant to this unit:

- `campushire_frontend (temp)/src/styles/tokens.css` — design tokens (already match `globals.css`)
- `campushire_frontend (temp)/src/styles/base.css`
- `campushire_frontend (temp)/src/styles/layout.css`
- `campushire_frontend (temp)/src/styles/forms-buttons.css`
- `campushire_frontend (temp)/src/styles/components.css`
- `campushire_frontend (temp)/src/styles/datepicker.css`
- `campushire_frontend (temp)/src/components/layout/AppShell.jsx`
- `campushire_frontend (temp)/src/components/layout/Sidebar.jsx`
- `campushire_frontend (temp)/src/components/layout/Topbar.jsx`
- `campushire_frontend (temp)/src/components/ui/Button.jsx`
- `campushire_frontend (temp)/src/components/ui/Badge.jsx`
- `campushire_frontend (temp)/src/components/ui/Modal.jsx`
- `campushire_frontend (temp)/src/components/ui/DatePicker.jsx`
- `campushire_frontend (temp)/src/components/ui/UrlField.jsx`
- `campushire_frontend (temp)/src/components/ui/TagInput.jsx`
- `campushire_frontend (temp)/src/components/ui/ProgressBar.jsx`
- `campushire_frontend (temp)/src/components/ui/KpiCard.jsx`
- `campushire_frontend (temp)/src/components/ui/Pagination.jsx`
- `campushire_frontend (temp)/src/pages/public/LandingPage.jsx`
- `campushire_frontend (temp)/src/pages/public/NotFoundPage.jsx`

Treat the existing Next.js project as the source of truth for architecture.
The temp frontend is the source of truth for visual design and CSS.

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **CSS merge** — bring all temp frontend styles into `app/globals.css`
2. **UI primitives** — port 8 components from `src/components/ui/` to `components/ui/`
3. **App shell** — port `AppShell`, `Sidebar`, `Topbar` to `components/shared/`
4. **Role layouts** — replace all 3 placeholder layouts with real `AppShell`
5. **Auth page wrappers** — add the visual card/brand wrapper around Clerk components
6. **Landing page** — port `LandingPage.jsx` to replace `app/page.tsx`
7. **404 page** — port `NotFoundPage.jsx` to replace `app/not-found.tsx`

This unit does **NOT** implement:

- Any student pages (FE-02)
- Any drives pages (FE-03)
- Any admin pages (FE-05, FE-06, FE-07)
- Any super admin pages (FE-08)
- Any notifications page integration (FE-04)
- Any database or Prisma changes
- Any new server actions or queries
- Resume builder, AI analyzer, self-assessment, readiness gauge (out of V1 scope)

---

# 3. CSS MERGE — `app/globals.css`

## What already exists

`app/globals.css` already contains all design tokens (CSS custom properties). They are
**identical** to `campushire_frontend (temp)/src/styles/tokens.css`. Do not re-add tokens.
Do not change any existing `--variable` definitions.

## What needs to be added

Read every file in `campushire_frontend (temp)/src/styles/` except `tokens.css` and
`index.css`. Add their contents to `app/globals.css` using `@layer` blocks:

```css
@layer base {
  /* content of base.css goes here */
}

@layer components {
  /* content of layout.css goes here */
  /* content of forms-buttons.css goes here */
  /* content of components.css goes here */
  /* content of datepicker.css goes here */
}
```

### Rules for the merge

- Do NOT modify any existing content in `app/globals.css`
- Append the new `@layer` blocks at the end of the file
- Do NOT copy `tokens.css` — tokens are already in `globals.css`
- Do NOT copy `index.css` — it is just an import aggregator, irrelevant here
- If any CSS class in the temp styles conflicts with an existing Tailwind utility,
  the class-based version wins (Tailwind utilities are applied inline, not here)
- After merging, all CSS classes used in the temp frontend
  (`.app-shell`, `.app-sidebar`, `.sidebar-link`, `.btn`, `.btn-primary`, `.card`,
  `.kpi-card`, `.badge`, `.badge-green`, `.drive-card`, `.profile-tab`, etc.)
  must be available globally in the Next.js project

---

# 4. UI PRIMITIVE COMPONENTS

Port the following 8 components from the temp frontend into `components/ui/`.

All files must be TypeScript (`.tsx`). Add proper prop types for every component.
Use CSS classes from the merged `globals.css` — do NOT use inline styles where
a class already exists. Keep the component logic identical to the temp frontend source.

### Rules for all UI primitives

- Convert `.jsx` → `.tsx`
- Add TypeScript prop interfaces
- Replace any `import` of React Router with nothing (these are pure components)
- Remove any `import` of `AuthContext`, `AppStateContext`, or mock data
- Do NOT add `"use client"` unless the component genuinely requires browser interactivity
  (state, event handlers, effects). All 8 primitives below require `"use client"`.
- Do not add shadcn wrappers around these — keep them as standalone components
- File naming: `kebab-case.tsx`

---

### 4.1 `DatePicker` → `components/ui/date-picker.tsx`

Source: `campushire_frontend (temp)/src/components/ui/DatePicker.jsx`

This is a standalone dropdown calendar with:
- Month and Year `<select>` dropdowns for rapid navigation
- Day grid click to select
- "Today" and "Clear" shortcut buttons
- Keyboard arrow navigation between days

Props interface:
```typescript
interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}
```

Port the component logic exactly. Replace emoji icons with Lucide icons
(`ChevronLeft`, `ChevronRight` for month navigation if used).

---

### 4.2 `UrlField` → `components/ui/url-field.tsx`

Source: `campushire_frontend (temp)/src/components/ui/UrlField.jsx`

A URL input with:
- Auto-prefixing (`https://`, `linkedin.com/in/`, `github.com/`)
- Automatic prefix stripping on paste
- A direct `↗` launch button (disabled when empty)

Props interface:
```typescript
interface UrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  platform?: 'linkedin' | 'github' | 'portfolio' | 'url';
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
```

Use the `.url-field-wrap`, `.url-prefix`, `.url-open-btn` classes from `globals.css`.
Replace the `↗` character with Lucide `ExternalLink` icon.

---

### 4.3 `TagInput` → `components/ui/tag-input.tsx`

Source: `campushire_frontend (temp)/src/components/ui/TagInput.jsx`

A tokenized chip input where:
- Pressing Enter or comma adds a tag
- Each tag has an ✕ remove button
- Supports a `maxTags` limit

Props interface:
```typescript
interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}
```

Use `.tag-input-wrap`, `.tag`, `.tag-input` classes from `globals.css`.
Replace ✕ with Lucide `X` icon.

---

### 4.4 `ProgressBar` → `components/ui/progress-bar.tsx`

Source: `campushire_frontend (temp)/src/components/ui/ProgressBar.jsx`

A linear horizontal progress bar:
- Animates fill from 0 to target width on mount
- Supports color variants: `accent` (default), `teal`, `amber`
- Shows percentage label optionally

Props interface:
```typescript
interface ProgressBarProps {
  value: number;          // 0–100
  variant?: 'accent' | 'teal' | 'amber';
  showLabel?: boolean;
  className?: string;
}
```

Use `.progress-track`, `.progress-fill`, `.progress-fill.teal`, `.progress-fill.amber`
classes from `globals.css`.

---

### 4.5 `KpiCard` → `components/shared/kpi-card.tsx`

Source: `campushire_frontend (temp)/src/components/ui/KpiCard.jsx`

A metric summary tile used on admin and super admin dashboards:
- Large numeric value
- Label below the value
- Optional trend badge (+ / - delta with colour)
- Optional icon in top-right corner

Props interface:
```typescript
interface KpiCardProps {
  value: string | number;
  label: string;
  trend?: string;           // e.g. "+12%" or "-3%"
  trendPositive?: boolean;  // true = green, false = red
  icon?: React.ReactNode;
  className?: string;
}
```

Use `.kpi-card`, `.kpi-value`, `.kpi-label` classes from `globals.css`.

---

### 4.6 `Pagination` → `components/ui/pagination.tsx`

Source: `campushire_frontend (temp)/src/components/ui/Pagination.jsx`

Offset-based table pagination:
- Page number buttons
- Previous / Next arrows
- Rows-per-page selector (25, 50, 100)
- Current page info ("Showing 1–25 of 120")

Props interface:
```typescript
interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}
```

This component must match the server-side pagination shape
`{ data, page, pageSize, totalCount }` used throughout the project.

---

### 4.7 `Badge` → `components/ui/status-badge.tsx`

Source: `campushire_frontend (temp)/src/components/ui/Badge.jsx`

**Note:** shadcn/ui already has a `Badge` component in `components/ui/badge.tsx`.
Do NOT replace or modify that file.
Create a **separate** `status-badge.tsx` for the CampusHire semantic badges
(`.badge-green`, `.badge-amber`, `.badge-red`, `.badge-purple`, `.badge-accent`).

Props interface:
```typescript
type StatusVariant = 'green' | 'amber' | 'red' | 'purple' | 'accent' | 'gray';

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}
```

Use `.badge`, `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-purple`,
`.badge-accent` classes from `globals.css`.
Add `.badge-gray` to `globals.css` if not present:
```css
.badge-gray { background: var(--surface-1); color: var(--text-secondary); }
```

---

### 4.8 `Modal` — Use shadcn `Dialog`

Source: `campushire_frontend (temp)/src/components/ui/Modal.jsx`

Do NOT port `Modal.jsx`. The shadcn `Dialog` component already provides:
- Backdrop with blur
- `Esc` key dismissal
- Focus trap
- Accessible structure

All subsequent pages in this integration use the shadcn `Dialog` component
directly. The temp frontend's `Modal.jsx` is discarded.

If `components/ui/dialog.tsx` does not yet exist (shadcn may not have been
generated yet), add it via the shadcn CLI:
```
npx shadcn@latest add dialog
```

---

# 5. APP SHELL COMPONENTS

Port the following 3 components from the temp frontend.

All must be `"use client"` components because they use `usePathname()` / `useUser()` hooks.
Place them in `components/shared/`.

---

### 5.1 `AppShell` → `components/shared/app-shell.tsx`

Source: `campushire_frontend (temp)/src/components/layout/AppShell.jsx`

The authenticated 2-column grid layout (220px sidebar + main content area).

```typescript
interface AppShellProps {
  role: 'student' | 'admin' | 'superadmin';
  children: React.ReactNode;
}
```

Implementation:
- Use the `.app-shell` CSS class (grid layout from `globals.css`)
- Renders `<Sidebar role={role} />` on the left
- Renders `<Topbar role={role} />` at the top of the right column
- Renders `{children}` inside `.app-content`
- The `.page-enter` animation on `.app-content` uses `var(--ease-admin)` — keep it
- Remove the `useLocation()` call (was React Router). In Next.js, page-level animation
  is handled by the CSS animation on `.app-content` which fires on every render — no
  pathname tracking needed

---

### 5.2 `Sidebar` → `components/shared/sidebar.tsx`

Source: `campushire_frontend (temp)/src/components/layout/Sidebar.jsx`

The fixed 220px left navigation panel.

```typescript
interface SidebarProps {
  role: 'student' | 'admin' | 'superadmin';
}
```

#### Nav items per role

Define nav items using Next.js routes (NOT React Router PATHS):

```typescript
const NAV_ITEMS = {
  student: [
    { label: 'Dashboard',    href: '/student-dashboard',              icon: LayoutDashboard },
    { label: 'Drives',       href: '/student-dashboard/drives',       icon: Briefcase       },
    { label: 'Profile',      href: '/student-dashboard/profile',      icon: User            },
    { label: 'Applications', href: '/student-dashboard/applications', icon: FileCheck       },
    { label: 'Notifications',href: '/notifications',                  icon: Bell, badge: true },
    { label: 'Settings',     href: '/student-dashboard/settings',     icon: Settings        },
  ],
  admin: [
    { label: 'Dashboard',    href: '/admin-dashboard',                icon: LayoutDashboard },
    { label: 'Students',     href: '/admin-dashboard/students',       icon: Users           },
    { label: 'Drives',       href: '/admin-dashboard/drives',         icon: Briefcase       },
    { label: 'Announcements',href: '/admin-dashboard/announcements',  icon: Megaphone       },
    { label: 'Reports',      href: '/admin-dashboard/reports',        icon: BarChart2       },
  ],
  superadmin: [
    { label: 'Overview',       href: '/super-admin-dashboard',                      icon: Globe         },
    { label: 'Students',       href: '/super-admin-dashboard/students',             icon: Users         },
    { label: 'Drives',         href: '/super-admin-dashboard/drives',               icon: Briefcase     },
    { label: 'Departments',    href: '/super-admin-dashboard/departments',          icon: Building2     },
    { label: 'Admin Accounts', href: '/super-admin-dashboard/admins',               icon: UserCog       },
    { label: 'Reports',        href: '/super-admin-dashboard/reports',              icon: BarChart2     },
    { label: 'Audit Log',      href: '/audit-logs',                                 icon: ClipboardList },
    { label: 'Settings',       href: '/super-admin-dashboard/settings',             icon: Settings      },
  ],
};
```

All icons are from `lucide-react`. Choose sensible alternatives if any named
above are unavailable in the installed version.

#### Active route detection

Use `usePathname()` from `'next/navigation'` to detect the active route.
A nav item is active when `pathname === href` or `pathname.startsWith(href + '/')`.
Apply the `.sidebar-link.active` class for active items.

#### Notification badge

For the Notifications nav item, the unread count badge must show a real number.
Import and call `getUnreadCountAction()` from
`features/notifications/actions/get-unread-count-action.ts`.

Because `Sidebar` is a client component, use `useEffect` + `useState` to call
the server action on mount:

```typescript
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  getUnreadCountAction()
    .then((result) => {
      if (result.success) setUnreadCount(result.count);
    })
    .catch(() => {}); // Silently ignore if unauthenticated
}, []);
```

#### Brand mark

```tsx
<div className="brand-mark">
  <span className="brand-dot" />
  <span>CampusHire</span>
</div>
```

Below the brand mark, show a role label pill:
- `student` → "Student Portal"
- `admin` → "Dept Admin"
- `superadmin` → "Super Admin"

Style: `.badge .badge-accent` or inline equivalent.

#### Log out button

Use Clerk's `useClerk()` hook for sign-out:

```typescript
import { useClerk } from '@clerk/nextjs';
const { signOut } = useClerk();

// Button:
<button
  className="sidebar-link"
  onClick={() => signOut({ redirectUrl: '/sign-in' })}
>
  <LogOut size={16} />
  <span>Log out</span>
</button>
```

#### Links

Use Next.js `<Link href={item.href}>` — not `<NavLink>`.
For the brand mark, use `<Link href="/">`.

---

### 5.3 `Topbar` → `components/shared/topbar.tsx`

Source: `campushire_frontend (temp)/src/components/layout/Topbar.jsx`

The sticky top header bar.

```typescript
interface TopbarProps {
  role: 'student' | 'admin' | 'superadmin';
}
```

#### What to keep from the temp frontend

- `.app-topbar` CSS class structure
- Notification bell button with unread dot indicator
- User avatar + name (right side)
- Page title slot (left side — empty by default, pages can fill it)

#### What to remove from the temp frontend

- The **Role Switcher** button (`Role: student ▼`) — this was a demo-only feature.
  Remove it entirely. In the real app, the role is determined by Clerk auth,
  not by a dropdown.
- All references to `useAuth()`, `AuthContext`, `AppStateContext`
- All references to mock `NOTIFICATIONS` data

#### User identity

Use Clerk's `useUser()` hook:

```typescript
import { useUser } from '@clerk/nextjs';
const { user } = useUser();

// Display:
const displayName = user?.fullName ?? user?.firstName ?? 'User';
const initials = displayName
  .split(' ')
  .map((n) => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2);
```

#### Notification bell

Show a bell icon with a red dot when unread count > 0.
Reuse the same `unreadCount` pattern as the Sidebar:
call `getUnreadCountAction()` on mount.

Clicking the bell navigates to `/notifications` via `useRouter().push('/notifications')`.
Do NOT implement a dropdown notification panel in the Topbar — the dedicated
`/notifications` page handles that. The bell is just a navigation shortcut.

#### User avatar

Clicking the avatar should navigate:
- `student` role → `/student-dashboard/profile`
- `admin` role → `/admin-dashboard`
- `superadmin` role → `/super-admin-dashboard`

Use `useRouter()` from `'next/navigation'` for this.

If the user has a Clerk profile image (`user?.imageUrl`), show it.
Otherwise show the initials avatar with `.sid-avatar` styling.

---

# 6. ROLE LAYOUTS

Replace all three role layout files. Each layout wraps `AppShell` with the
correct role. These are **server components** — they call `auth()` from Clerk
to verify the session, then pass role down to the client `AppShell`.

### 6.1 `app/(student)/layout.tsx`

```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return <AppShell role="student">{children}</AppShell>;
}
```

### 6.2 `app/(admin)/layout.tsx`

```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return <AppShell role="admin">{children}</AppShell>;
}
```

### 6.3 `app/(super-admin)/layout.tsx`

```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return <AppShell role="superadmin">{children}</AppShell>;
}
```

**Note:** Middleware already blocks the wrong role from reaching the wrong
route group. The layout adds a second guard for the unauthenticated case only.
Do NOT duplicate role-checking logic here — that belongs in individual page
server actions.

---

# 7. AUTH PAGE WRAPPERS

Update the sign-in and sign-up pages to add the CampusHire visual wrapper
around Clerk's components. The Clerk `<SignIn>` and `<SignUp>` components
remain unchanged — only the surrounding layout is added.

### 7.1 `app/(auth)/layout.tsx`

Replace the current centered layout with the auth shell wrapper:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--surface-0)' }}
      className="flex items-center justify-center"
    >
      {children}
    </div>
  );
}
```

### 7.2 `app/(auth)/sign-in/[[...sign-in]]/page.tsx`

Wrap the existing `<SignIn>` in the auth card visual from `LandingPage.jsx` /
`login.html` prototype:

```tsx
import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-mark" style={{ marginBottom: 24 }}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-0 p-0',
            },
          }}
        />
      </div>
    </div>
  );
}
```

### 7.3 `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

Same pattern as sign-in:

```tsx
import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-mark" style={{ marginBottom: 24 }}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-0 p-0',
            },
          }}
        />
      </div>
    </div>
  );
}
```

---

# 8. LANDING PAGE

Replace `app/page.tsx` with a port of `LandingPage.jsx` from the temp frontend.

Source: `campushire_frontend (temp)/src/pages/public/LandingPage.jsx`

Read the file fully before porting. Key points:

- This is a **server component** — no `"use client"` needed unless interactive
  elements require it (check the source)
- Use Clerk's `auth()` to detect if the user is already signed in. If they are,
  show a "Go to Dashboard" button pointing to their role's route. If not,
  show the public landing with Sign In / Sign Up CTAs.
- Replace React Router `<Link>` with Next.js `<Link>`
- Replace any `useNavigate` with Next.js `<Link>` or `redirect()`
- Keep all marketing copy, feature cards, and visual structure from the source
- Use `.icon-tile`, `.brand-mark`, `.brand-dot`, `.public-navbar` classes
  from `globals.css`
- The public navbar at the top should have:
  - Brand mark (left)
  - "Sign In" and "Sign Up" links (right) — pointing to `/sign-in` and `/sign-up`
  - If authenticated, show "Go to Dashboard" instead
- Remove any stat/metric claims that were hardcoded fake numbers

---

# 9. 404 PAGE

Replace `app/not-found.tsx` with a port of `NotFoundPage.jsx` from the temp frontend.

Source: `campushire_frontend (temp)/src/pages/public/NotFoundPage.jsx`

- This is a server component
- Keep the visual design: 404 heading, short message, "Go Home" button
- Replace React Router `<Link>` with Next.js `<Link href="/">`
- Use design tokens from `globals.css`

---

# 10. TOASTER — Ensure it is in Root Layout

The shadcn `useToast` + `<Toaster />` pattern is used by all subsequent units
for success/error feedback. Ensure this is set up now so every FE unit can use it.

Steps:
1. If `components/ui/toaster.tsx` does not exist, add it:
   ```
   npx shadcn@latest add toast
   ```
2. Add `<Toaster />` to `app/layout.tsx`, inside `<ClerkProvider>`:
   ```tsx
   import { Toaster } from '@/components/ui/toaster';

   // Inside <body>:
   {children}
   <Toaster />
   ```

---

# 11. TYPESCRIPT RULES FOR THIS UNIT

- All new files must be `.tsx` (not `.jsx`)
- `tsconfig.json` is set to strict mode — no `any`, no implicit `any`
- Prop interfaces must be explicit — do not rely on inferred props
- Import paths use the `@/` alias (configured in `tsconfig.json`)
- Do not use `React.FC<Props>` — use plain function declarations with typed props
- CSS class strings: use string literals, not dynamic class builders unless
  the component genuinely needs conditional classes (then use the `cn()` helper
  from `lib/utils.ts`)
- Server components: no `"use client"`, no hooks. Client components: `"use client"`
  at the top, hooks allowed.

---

# 12. WHAT NOT TO DO

- Do NOT modify `prisma/schema.prisma`
- Do NOT run any Prisma migrations
- Do NOT create new server actions or queries
- Do NOT touch any `features/` files
- Do NOT touch `middleware.ts`
- Do NOT touch `lib/auth.ts`
- Do NOT port `Gauge.jsx` (deferred — only used by out-of-scope readiness pages)
- Do NOT port `WithdrawModal.jsx` (deleted — withdrawal is out of V1 scope)
- Do NOT port `ProtectedRoute.jsx` (deleted — replaced by middleware)
- Do NOT port `AuthContext.jsx` (deleted — replaced by Clerk)
- Do NOT port `AppStateContext.jsx` (deleted — replaced by server actions)
- Do NOT add a Role Switcher to the Topbar (demo-only feature, removed)
- Do NOT hardcode any hex values in components — always use `var(--token)` or
  Tailwind `bg-[var(--token)]` syntax
- Do NOT install new npm packages without checking if an equivalent already
  exists in the project

---

# 13. VERIFICATION

After implementing all steps above, run the following in order:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass with zero errors.

Then manually verify in the browser (run `npm run dev`):

### Layout verification
- [ ] Navigate to `/student-dashboard` — AppShell renders with sidebar and topbar
- [ ] Sidebar shows "Student Portal" role label
- [ ] Sidebar nav links are visible and clickable
- [ ] Active route highlights correctly (`.sidebar-link.active` applied)
- [ ] Brand mark visible at top of sidebar
- [ ] Log Out button calls Clerk sign-out and redirects to `/sign-in`
- [ ] Topbar shows user name and avatar
- [ ] Topbar bell icon visible
- [ ] Notification red dot shows when there are unread notifications

- [ ] Navigate to `/admin-dashboard` — AppShell renders with admin sidebar
- [ ] Sidebar shows "Dept Admin" role label and admin nav items

- [ ] Navigate to `/super-admin-dashboard` — AppShell renders with super admin sidebar
- [ ] Sidebar shows "Super Admin" role label and super admin nav items

### Auth page verification
- [ ] Navigate to `/sign-in` — auth card wrapper visible, brand mark visible, Clerk form inside
- [ ] Navigate to `/sign-up` — same layout as sign-in

### Landing page verification
- [ ] Navigate to `/` — landing page renders from temp frontend port
- [ ] Public navbar has brand mark + Sign In / Sign Up links
- [ ] Feature cards visible with correct icons and copy
- [ ] Authenticated user sees "Go to Dashboard" instead of Sign In/Sign Up

### 404 page verification
- [ ] Navigate to `/some-nonexistent-path` — 404 page renders correctly
- [ ] "Go Home" button links to `/`

### CSS class verification
- [ ] `.btn.btn-primary` — renders correctly on any page with a primary button
- [ ] `.badge.badge-green` — renders correctly on any status badge
- [ ] `.kpi-card` — renders correctly on admin dashboard placeholder
- [ ] `.sidebar-link.active` — correct terracotta highlight on active item
- [ ] `.app-content` — page-enter animation plays on navigate

---

# 14. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-01 complete
- CSS merged from temp frontend
- UI primitives ported (DatePicker, UrlField, TagInput, ProgressBar, KpiCard,
  Pagination, StatusBadge)
- AppShell, Sidebar, Topbar ported and wired to Clerk
- All three role layouts replaced
- Auth page wrappers added
- Landing page ported
- 404 page ported
- Toaster confirmed in root layout
- Build passing

Set next unit: **FE-02 — Student Dashboard & Profile**

---

# 15. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Student dashboard or profile pages
- Drive pages
- Any admin pages
- Any super admin pages
- Any Prisma changes

The next unit is FE-02.

---

# FINAL REPORT

When finished, provide a summary covering:

## CSS
- Files merged into `globals.css`
- Any conflicts resolved

## UI Primitives
- Each component: file created, props, any deviations from source

## App Shell
- AppShell, Sidebar, Topbar: files created, Clerk integration points

## Layouts
- Each role layout: what changed

## Auth Pages
- Sign-in, sign-up: visual wrapper added

## Landing & 404
- What was ported, what was changed

## Toaster
- Status

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run build` result

## Open Questions
List any genuinely ambiguous decisions made during implementation
that should be noted for future units.

## Scope Confirmation
Explicitly confirm:
**No database changes, no new server actions, no page-level content beyond
landing/404, no student/admin/super-admin page content was implemented.**
