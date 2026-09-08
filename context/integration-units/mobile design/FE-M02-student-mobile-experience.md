# CampusHire — Integration Unit FE-M02: Student Mobile Experience

You are continuing mobile responsiveness work on the CampusHire Next.js project.

## Current Status

Mobile units completed:

- **FE-M01 — Mobile Shell & CSS Foundation ✅**
  - Breakpoints added to `globals.css`
  - Student bottom nav bar live
  - Admin/super admin hamburger drawer live
  - AppShell, Topbar, Sidebar updated
  - `npm run build` passes ✅

Now implement:

# FE-M02 — Student Mobile Experience

**Goal:** The complete student flow works perfectly at 375px (iPhone SE).
This is the most important mobile use case — students browse drives,
apply, and check their profile on their phones far more than on desktops.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, read:

- `context/ui-context.md` — §2 Student-Facing Component System,
  §2.3 Profile Tabbed Navigation, §2.1 Drive Card spec
- `app/(student)/student-dashboard/page.tsx` — dashboard page
- `app/(student)/student-dashboard/drives/page.tsx` — drives catalogue
- `app/(student)/student-dashboard/drives/[id]/page.tsx` — drive detail
- `app/(student)/student-dashboard/profile/page.tsx` — profile page
- `app/(student)/student-dashboard/applications/page.tsx` — applications
- `app/(student)/student-dashboard/settings/page.tsx` — settings
- `app/notifications/page.tsx` — notifications
- All student profile tab components in `components/students/profile/`
- `components/drives/drive-card.tsx` — drive card component
- `components/drives/apply-section.tsx` — apply button + dialog

Do not begin implementation until you have read all of the above
and understand what each page currently renders.

---

# 2. SCOPE OF THIS UNIT

This unit covers the following **student-facing pages only**:

1. **Student dashboard** — mobile KPI layout + quick actions
2. **Drives catalogue** — student identity card mobile, filter pills,
   drive card touch improvements
3. **Drive detail page** — eligibility checklist + apply button mobile
4. **Student profile page** — horizontal scrollable tab strip replacing
   the 190px vertical sidebar (the most complex change in this unit)
5. **My Applications** — table → card list on phone
6. **Notifications** — padding and spacing fixes only
7. **Settings** — card stacking fix

This unit does **NOT** implement:

- Admin or super admin page mobile (FE-M03)
- Any new server actions, queries, or schema changes
- Any feature changes — purely structural/visual responsive work

---

# 3. CSS ADDITIONS FOR THIS UNIT

Add a second section inside the mobile `@layer` block in `globals.css`
(after the FE-M01 rules). Label it clearly:

```css
/* ============================================================
   FE-M02 — Student page mobile styles
   ============================================================ */
```

Add all CSS from the sections below inside this label.

## 3.1 Student identity card (`.student-id-card`)

The identity card on the drives catalogue page uses a flex row with
avatar, info, and action buttons side by side. On phone it overflows.

```css
@media (max-width: 480px) {
  .student-id-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  /* Scores pills row — allow wrapping */
  .sid-scores {
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Action buttons — full width stack */
  .sid-actions {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: 0;
    width: 100%;
  }

  .sid-actions .btn {
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }
}
```

## 3.2 Filter pills — horizontal scroll

```css
@media (max-width: 768px) {
  .drives-filters {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px; /* space for scrollbar */
    gap: 6px;
  }

  /* Prevent pills from shrinking */
  .drives-filters .filter-pill {
    flex-shrink: 0;
  }
}
```

## 3.3 Drive card — touch target improvements

```css
@media (max-width: 480px) {
  .drive-card {
    padding: 14px;
  }

  /* Ensure action buttons are finger-friendly */
  .dc-action-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .dc-action-row .btn,
  .dc-action-row .dc-action-btn {
    min-height: 36px;
    padding: 8px 14px;
  }
}
```

## 3.4 Profile tab strip (horizontal)

FE-M01 already hides `.profile-tabs` (the vertical left sidebar) on
mobile and collapses `.profile-layout` to single column.

This unit adds the **horizontal scrollable tab strip** that replaces it:

```css
/* The mobile tab strip container — hidden on desktop */
.profile-tabs-mobile {
  display: none; /* hidden by default */
}

@media (max-width: 768px) {
  /* Show mobile strip, hide desktop vertical tabs */
  .profile-tabs-mobile {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 4px;
    padding-bottom: 8px;
    margin-bottom: 16px;
    border-bottom: 0.5px solid var(--border);
    /* Hide scrollbar but keep scroll functionality */
    scrollbar-width: none;
  }

  .profile-tabs-mobile::-webkit-scrollbar {
    display: none;
  }

  /* Individual tab pill in mobile strip */
  .profile-tab-pill {
    flex-shrink: 0;
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 0.5px solid var(--border-strong);
    background: var(--surface-2);
    color: var(--text-secondary);
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .profile-tab-pill.active {
    background: var(--accent-light);
    color: var(--accent-dark);
    border-color: var(--accent-light);
    font-weight: 600;
  }
}
```

## 3.5 Application card (table → cards on phone)

```css
/* Mobile application cards — rendered instead of table rows on phone */
.application-card {
  display: none; /* hidden on desktop — table rows are shown instead */
}

/* Hide table on phone, show cards */
@media (max-width: 480px) {
  .applications-table-wrap {
    display: none;
  }

  .application-card {
    display: block;
  }
}
```

## 3.6 Profile header strip — compact on mobile

```css
@media (max-width: 480px) {
  /* Profile header strip wraps on very small screens */
  .profile-header-strip-inner {
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Progress bar section goes full width */
  .profile-header-progress {
    width: 100%;
    min-width: 0;
  }
}
```

## 3.7 Settings cards — single column

```css
@media (max-width: 768px) {
  /* Settings uses auto-fit grid — collapse to 1-col on tablet/phone */
  .settings-grid {
    grid-template-columns: 1fr !important;
  }
}
```

Add `className="settings-grid"` to the settings page grid container.

## 3.8 Apply section dialog — full width on mobile

```css
@media (max-width: 480px) {
  /* shadcn AlertDialog content — full width on mobile */
  [data-radix-alert-dialog-content] {
    max-width: calc(100vw - 32px) !important;
    margin: 0 16px;
  }

  /* Dialog footer buttons — stack vertically */
  [data-radix-alert-dialog-footer] {
    flex-direction: column-reverse;
    gap: 8px;
  }

  [data-radix-alert-dialog-footer] button {
    width: 100%;
    justify-content: center;
  }
}
```

---

# 4. STUDENT DASHBOARD — MOBILE

## 4.1 File

`app/(student)/student-dashboard/page.tsx`

## 4.2 Changes

The KPI grid already gets `className="kpi-grid"` from FE-M01. No further
structural changes needed for the KPI row.

**Quick actions grid** — the 3-card quick actions row uses inline
`gridTemplateColumns: 'repeat(3, 1fr)'`. Replace with a class:

```tsx
{/* Before: */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>

{/* After: */}
<div className="quick-actions-grid" style={{ display: 'grid', gap: 16, marginBottom: 28 }}>
```

Add to `globals.css` in the FE-M02 section:

```css
.quick-actions-grid {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 480px) {
  .quick-actions-grid {
    grid-template-columns: 1fr;
  }
}
```

**Recent notifications + deadlines grid** — the 2-column lower grid:

```tsx
{/* Before: */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

{/* After: */}
<div className="dashboard-lower-grid" style={{ display: 'grid', gap: 16 }}>
```

```css
.dashboard-lower-grid {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 768px) {
  .dashboard-lower-grid {
    grid-template-columns: 1fr;
  }
}
```

---

# 5. DRIVES CATALOGUE — MOBILE

## 5.1 File

`app/(student)/student-dashboard/drives/page.tsx` and
`components/drives/drive-card.tsx`

## 5.2 Student identity card

The `.student-id-card` CSS fix is in §3.1. No TSX changes needed — the
CSS handles the layout shift.

However, remove the "View readiness" and "Build resume" buttons from
the `.sid-actions` (these were already removed in FE-03 per V1 scope).
Confirm the only remaining actions are "Edit profile →" and
"My Applications →". If any V1-out-of-scope buttons are still present,
remove them now.

## 5.3 Filter pills

The `.drives-filters` CSS fix is in §3.2. No TSX changes needed.

## 5.4 Drive card

The `.dc-action-row` CSS fix is in §3.3. No TSX changes needed.

The drive card already works well at mobile width (it's a vertical flex
column by default). Only the action strip needed the fix above.

**Expandable detail panel:** On mobile, the expanded panel content
(JD link, rounds, venue) already stacks vertically. No changes needed.

---

# 6. DRIVE DETAIL PAGE — MOBILE

## 6.1 File

`app/(student)/student-dashboard/drives/[id]/page.tsx` and
`components/drives/apply-section.tsx`

## 6.2 Eligibility checklist

The checklist is already a vertical list. Only ensure padding/font
size is comfortable on 375px. No structural changes needed — the
CSS from FE-M01 covers it.

## 6.3 Apply button — thumb-friendly

The "Apply Now" button in `ApplySection` must be at least 48px tall
on mobile. Add to the CSS:

```css
@media (max-width: 480px) {
  /* Apply button on drive detail — full width and thumb-friendly */
  .apply-action-btn {
    width: 100%;
    min-height: 48px;
    font-size: 15px;
    justify-content: center;
  }
}
```

Add `className="apply-action-btn btn btn-primary"` to the "Apply Now"
button in `apply-section.tsx`. The existing `.btn.btn-primary` styles
are preserved; this class adds mobile sizing on top.

## 6.4 Confirmation dialog

The `shadcn AlertDialog` CSS fix is in §3.8. No TSX changes needed.

---

# 7. STUDENT PROFILE PAGE — MOBILE

This is the most complex change in this unit. The vertical 190px tab
sidebar must become a **horizontal scrollable tab strip** on mobile.

## 7.1 Files

- `app/(student)/student-dashboard/profile/page.tsx` (server shell)
- `components/students/profile/student-profile-client.tsx` (client component)

## 7.2 Current desktop structure (from FE-02)

```
.profile-layout  (190px sidebar | content)
  ├── .profile-tabs (vertical button list — desktop only)
  │     ├── button.profile-tab "Personal Info"
  │     ├── button.profile-tab "Academic Info"
  │     └── ... 7 tabs total
  └── .card (active tab content)
```

FE-M01 already:
- Sets `.profile-layout` to `grid-template-columns: 1fr` on mobile
- Sets `.profile-tabs` to `display: none` on mobile

This unit adds the **mobile tab strip** that replaces the hidden sidebar.

## 7.3 Mobile tab strip component

Create: `components/students/profile/mobile-profile-tabs.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface MobileProfileTabsProps {
  tabs:      string[];          // e.g. ['Personal Info', 'Academic Info', ...]
  activeTab: string;
  onChange:  (tab: string) => void;
}

export function MobileProfileTabs({
  tabs, activeTab, onChange
}: MobileProfileTabsProps) {
  const stripRef  = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll the active tab into view when it changes
  useEffect(() => {
    if (activeRef.current && stripRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block:    'nearest',
        inline:   'center',
      });
    }
  }, [activeTab]);

  return (
    /* hide-desktop: only shows at ≤768px via CSS */
    <div ref={stripRef} className="profile-tabs-mobile hide-desktop">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            ref={isActive ? activeRef : undefined}
            type="button"
            className={`profile-tab-pill${isActive ? ' active' : ''}`}
            onClick={() => onChange(tab)}
          >
            {/* Shorten long labels for narrow screens */}
            {shortenTabLabel(tab)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shorten tab labels so all 7 fit on a 375px screen without excessive
 * horizontal scrolling.
 */
function shortenTabLabel(tab: string): string {
  const MAP: Record<string, string> = {
    'Personal Info':            'Personal',
    'Academic Info':            'Academic',
    'Skills & Links':           'Skills',
    'Projects':                 'Projects',
    'Internships & Experience': 'Experience',
    'Certifications':           'Certs',
    'Preferences':              'Preferences',
  };
  return MAP[tab] ?? tab;
}
```

## 7.4 Update `StudentProfileClient`

In `components/students/profile/student-profile-client.tsx`, add the
`MobileProfileTabs` component just above the `.profile-layout` container:

```tsx
import { MobileProfileTabs } from './mobile-profile-tabs';

// Inside the render:
<div style={{ maxWidth: 1080, margin: '0 auto' }}>
  {/* ... ProfileHeaderStrip ... */}

  {/* Mobile tab strip — only visible at ≤768px via hide-desktop CSS */}
  <MobileProfileTabs
    tabs={TABS}
    activeTab={tab}
    onChange={setTab}
  />

  {/* Desktop layout — profile-tabs hidden on mobile via FE-M01 CSS */}
  <div className="profile-layout">
    <div className="profile-tabs">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          className={`profile-tab ${tab === t ? 'active' : ''}`}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </div>

    <div className="card" style={{ padding: 24, minHeight: 480 }}>
      {/* active tab component */}
    </div>
  </div>
</div>
```

The `hide-desktop` class (added in FE-M01's utility classes) ensures
`MobileProfileTabs` is invisible on desktop. On mobile, `.profile-tabs`
is hidden and `MobileProfileTabs` is shown. Both are in the DOM but only
one is visible at any given viewport width.

## 7.5 Profile header strip — mobile

Add `className="profile-header-strip-inner"` and
`className="profile-header-progress"` to the relevant elements in
`components/students/profile/profile-header-strip.tsx` to match the
CSS targets defined in §3.6.

Specifically:
- The outer flex row inside `.card` → add `profile-header-strip-inner`
- The min-width: 160px div containing the progress bar label + bar →
  add `profile-header-progress`

---

# 8. MY APPLICATIONS — MOBILE CARD VIEW

## 8.1 File

`app/(student)/student-dashboard/applications/page.tsx` and any
`ApplicationsTable` client component.

## 8.2 Strategy

On mobile (≤480px): hide the `.table-wrap` table entirely and show
a card list instead.

Both elements are rendered in the DOM simultaneously. CSS controls
which is visible:
- Desktop: table visible, cards hidden
- Phone (≤480px): table hidden, cards visible

The CSS is already defined in §3.5. All that's needed is the TSX
structure.

## 8.3 Application card structure

```tsx
{/* MOBILE VIEW — only shown at ≤480px via CSS */}
<div className="application-card">
  {applications.map((app) => (
    <div
      key={app.id}
      className="card"
      style={{ marginBottom: 12, padding: 16 }}
    >
      {/* Company + role */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {app.drive.companyName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {app.drive.roleName}
          </div>
        </div>
        {/* Drive status badge */}
        <StatusBadge
          variant={getDriveStatus(app.drive.applicationDeadline) === 'open' ? 'green' : 'gray'}
        >
          {getDriveStatus(app.drive.applicationDeadline) === 'open' ? 'Open' : 'Closed'}
        </StatusBadge>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        <span>Applied {formatRelativeDate(app.appliedAt)}</span>
        {app.snapshotCgpa && <span>CGPA {app.snapshotCgpa}</span>}
      </div>

      {/* View drive link */}
      <Link
        href={`/student-dashboard/drives/${app.driveId}`}
        className="btn btn-outline btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        View drive →
      </Link>
    </div>
  ))}
</div>
```

Where `formatRelativeDate` is a simple helper:

```typescript
function formatRelativeDate(date: Date): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
```

## 8.4 Empty state

Already exists from FE-03. Confirm it is visible on mobile — no changes needed.

---

# 9. NOTIFICATIONS PAGE — MOBILE

## 9.1 File

`app/notifications/page.tsx` and `components/notifications/NotificationList.tsx`

## 9.2 Changes needed

The notifications page is already card-based from FE-04. On mobile:
- Filter pills need horizontal scroll (§3.2 covers `.drives-filters`;
  the notifications filter bar uses the same `.filter-pill` elements,
  so the same CSS applies automatically)
- `Pagination` component is full-width and works fine
- Individual notification rows use inline padding — no structural changes

**One fix:** The "Mark all as read" button sits in a flex row with the
page title. On very small screens this can overflow. Fix with:

```css
@media (max-width: 480px) {
  .notifications-header {
    flex-wrap: wrap;
    gap: 10px;
  }

  .notifications-header h1 {
    flex: 1 0 100%;  /* title takes full width */
  }
}
```

Add `className="notifications-header"` to the flex container in
`app/notifications/page.tsx`.

---

# 10. SETTINGS PAGE — MOBILE

## 10.1 File

`app/(student)/student-dashboard/settings/page.tsx`

## 10.2 Change

The settings page uses `auto-fit` grid for the cards. Add
`className="settings-grid"` to the container div:

```tsx
{/* Before: */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, maxWidth: 960 }}>

{/* After: */}
<div
  className="settings-grid"
  style={{ display: 'grid', gap: 20, maxWidth: 960 }}
>
```

The `settings-grid` CSS is in §3.7. No other changes needed.

---

# 11. MINIMUM TOUCH TARGET AUDIT

All interactive elements must be at least **44×44px** on mobile for
comfortable tap targets (WCAG 2.5.5 guideline).

Add to the FE-M02 CSS section:

```css
@media (max-width: 768px) {
  /* Ensure all buttons meet minimum touch target */
  .btn {
    min-height: 40px;
  }

  .btn.btn-sm {
    min-height: 36px;
  }

  /* Nav links in bottom nav already 64px height */

  /* Toggle switches — already 22px height (small but thumb-friendly) */

  /* Table action links */
  .row-actions a {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
  }
}
```

---

# 12. NEW FILES TO CREATE

```
components/students/profile/
  └── mobile-profile-tabs.tsx     ← horizontal scrollable tab strip
```

Files to **update** (CSS additions in `globals.css`):

```
app/globals.css                   ← add FE-M02 section (§3)
```

Files to **update** (minor class additions):

```
app/(student)/student-dashboard/page.tsx
  ├── quick-actions-grid class
  └── dashboard-lower-grid class

app/(student)/student-dashboard/drives/page.tsx
  └── confirm V1 scope buttons only in .sid-actions

components/drives/apply-section.tsx
  └── apply-action-btn class on Apply Now button

components/students/profile/student-profile-client.tsx
  └── add MobileProfileTabs above .profile-layout

components/students/profile/profile-header-strip.tsx
  └── add profile-header-strip-inner + profile-header-progress classes

app/(student)/student-dashboard/applications/page.tsx
  └── add application-card div alongside the table

app/notifications/page.tsx
  └── add notifications-header class

app/(student)/student-dashboard/settings/page.tsx
  └── add settings-grid class
```

---

# 13. WHAT NOT TO DO

- Do NOT change any server actions, queries, or Prisma models
- Do NOT change any business logic in any file
- Do NOT implement admin or super admin mobile changes — that is FE-M03
- Do NOT add the profile tab strip to admin pages — only student profile
- Do NOT convert admin tables to cards — that is FE-M03
- Do NOT change the bottom nav or hamburger drawer — those are from FE-M01
- Do NOT use arbitrary breakpoints other than `768px` and `480px`
- Do NOT remove the desktop `.profile-tabs` — both desktop and mobile
  tab navigations must coexist; CSS visibility handles which is shown

---

# 14. TYPESCRIPT RULES

- `MobileProfileTabs` props: `tabs: string[]`, `activeTab: string`,
  `onChange: (tab: string) => void` — all typed, no `any`
- `shortenTabLabel` is a pure function — no state, no hooks
- `formatRelativeDate` helper in applications page — pure function
- All new `.tsx` files: `'use client'` where needed, strict mode

---

# 15. VERIFICATION

Run in order:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass.

Then open browser dev tools at **375px (iPhone SE)**:

### Student Dashboard (375px)
- [ ] 3 KPI cards show in 2-col (2+1 layout) from FE-M01's kpi-grid
- [ ] Quick actions stack to single column
- [ ] Notifications + deadlines cards stack vertically (not side by side)
- [ ] No horizontal overflow on the page
- [ ] Bottom nav visible and all 5 items accessible

### Drives Catalogue (375px)
- [ ] Student identity card stacks vertically (avatar on left, info below,
      action buttons full-width at bottom)
- [ ] Filter pills scroll horizontally — no overflow, no wrapping
- [ ] Drive cards show in single column
- [ ] Drive card action buttons are finger-friendly (≥36px height)
- [ ] Expanded drive details panel readable at 375px

### Drive Detail + Apply (375px)
- [ ] Eligibility checklist items readable
- [ ] "Apply Now" button is full-width and at least 48px tall
- [ ] Confirmation dialog fits within screen (no overflow)
- [ ] Dialog action buttons stack vertically

### Profile Page (375px)
- [ ] Horizontal tab strip visible below profile header
- [ ] Desktop vertical sidebar (.profile-tabs) NOT visible at 375px
- [ ] Tab strip scrolls horizontally when 7 tabs don't fit
- [ ] Tapping a tab switches content AND auto-scrolls that tab to center
- [ ] Shortened labels fit within strip: Personal, Academic, Skills,
      Projects, Experience, Certs, Preferences
- [ ] Active tab shows accent background + bold label
- [ ] Profile header: avatar + name + completion bar + save button readable
- [ ] Photo upload section usable at 375px
- [ ] All form fields full-width (`.field-row` single column from FE-M01)
- [ ] `DatePicker` opens correctly on mobile
- [ ] `TagInput` enters tags on mobile keyboard (Return key)
- [ ] Save button thumb-friendly (≥40px)

### At 768px (tablet)
- [ ] Profile horizontal tab strip visible
- [ ] Desktop sidebar hidden (still using bottom nav at 768px)
- [ ] `.profile-layout` single column

### My Applications (375px)
- [ ] Table is hidden at 375px
- [ ] Application cards visible, show company, role, date, status, link
- [ ] "View drive →" button full-width
- [ ] Empty state message visible

### Notifications (375px)
- [ ] Filter pills scroll horizontally
- [ ] "Mark all as read" button doesn't cause layout overflow
- [ ] Notification items readable with correct padding

### Settings (375px)
- [ ] Cards stack to single column
- [ ] Toggle switches remain functional at 375px
- [ ] "Manage Password" button full-width

### Touch targets (all pages)
- [ ] All `.btn` elements are at least 40px tall on mobile
- [ ] All `.btn-sm` elements are at least 36px tall on mobile

---

# 16. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-M02 complete
- Student dashboard: quick-actions and lower-grid responsive
- Drives catalogue: identity card, filter pills, drive card fixed
- Drive detail: apply button full-width + thumb-friendly
- Profile page: `MobileProfileTabs` component created, horizontal strip live
- My Applications: card view on phone
- Notifications: header overflow fix
- Settings: grid collapses to 1-col
- Touch target minimum heights added
- Build passing

Set next unit: **FE-M03 — Admin & Super Admin Mobile**

---

# 17. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Admin mobile pages (FE-M03)
- Super admin mobile pages (FE-M03)

The next unit is **FE-M03**.

---

# FINAL REPORT

When finished, provide:

## CSS Additions
- How many rules added to the FE-M02 section of `globals.css`
- Any selector specificity conflicts encountered

## New Component
- `MobileProfileTabs`: tab count, auto-scroll behaviour, label shortening

## Page Changes
- List every file modified, what class was added or what JSX changed

## Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run build` result

## Verification
- Confirm profile tab strip tested at 375px and 768px
- Confirm application card view tested at 375px
- Confirm apply button touch target at 375px

## Scope Confirmation
Explicitly confirm:
**No server actions changed. No database changes. No admin or super admin
pages touched. No features added or removed. Desktop layout unchanged.**
