# CampusHire — Integration Unit FE-M03: Admin & Super Admin Mobile

You are completing mobile responsiveness work on the CampusHire Next.js project.

## Current Status

Mobile units completed:

- **FE-M01 — Mobile Shell & CSS Foundation ✅**
- **FE-M02 — Student Mobile Experience ✅**
  - Profile horizontal tab strip live
  - Drives, applications, notifications, settings responsive
  - `npm run build` passes ✅

Now implement the final mobile unit:

# FE-M03 — Admin & Super Admin Mobile

**Goal:** Admin and super admin interfaces are usable on tablet (768px)
and functional on phone (375px) for the most common tasks.

**Priority is tablet-first for admin.** Admins primarily work on
desktops and tablets — managing 200+ students from a phone is not
the primary use case. The target is:
- Tablet (768px): everything fully usable
- Phone (375px): core read and quick-action tasks work (view roster,
  view drive details, view reports). Heavy data-entry tasks like
  "Post Drive" are acceptable with horizontal scroll on phone.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, read:

- `app/globals.css` — the full CSS after FE-M01 and FE-M02. Understand
  the existing mobile section structure.
- All admin pages in `app/(admin)/admin-dashboard/`
- All super admin pages in `app/(super-admin)/super-admin-dashboard/`
- `app/(super-admin)/audit-logs/page.tsx`
- `components/audit/AuditLogsTable.tsx`
- `components/admin/students/student-details-dialog.tsx`
- `components/admin/drives/admin-drive-preview-card.tsx`
- `components/shared/department-scope-banner.tsx`

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

**Admin pages:**
1. Admin home — KPI grid already handled by FE-M01, lower section stack fix
2. Student roster — table scroll at tablet, card view at phone
3. Student details dialog — single-column layout on mobile
4. Add student form — already handled by FE-M01 field-row fix
5. Drive management list — table scroll
6. Post drive form — section stacking, hide preview card on mobile
7. Drive applications table — scroll at tablet, cards at phone
8. Announcements — 2-col → 1-col at phone
9. Reports — KPI + progress bars responsive

**Super admin pages:**
10. Dashboard — KPI grid (FE-M01) + dept table scroll
11. Department management — table scroll, dialogs full-screen on phone
12. Admin accounts — table scroll, create dialog full-screen
13. Students — dept filter pills scroll, table scroll
14. Drives — table scroll
15. Reports — progress bars + table
16. Audit log — filter panel stack, table scroll

This unit does **NOT** implement:
- Student pages (FE-M02)
- Any new server actions, queries, or schema changes
- Any feature changes

---

# 3. CSS ADDITIONS FOR THIS UNIT

Add a third labelled section to the mobile `@layer` block in `globals.css`:

```css
/* ============================================================
   FE-M03 — Admin & Super Admin mobile styles
   ============================================================ */
```

All CSS in sections below goes inside this label.

## 3.1 Admin home lower section

```css
@media (max-width: 768px) {
  /* Attention + Drives cards: side-by-side → stacked */
  .admin-home-lower {
    grid-template-columns: 1fr !important;
  }
}
```

Add `className="admin-home-lower"` to the 2-column lower grid in
`app/(admin)/admin-dashboard/page.tsx`.

## 3.2 Student roster search + filter bar

```css
@media (max-width: 768px) {
  /* Search input + status buttons: wrap to separate rows */
  .roster-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .roster-toolbar input {
    max-width: 100% !important;
  }

  /* Status filter buttons — scrollable row */
  .roster-status-filters {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 6px;
    flex-shrink: 0;
  }

  .roster-status-filters button {
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  /* Action buttons row above table: stack vertically */
  .roster-actions {
    flex-direction: column;
    gap: 8px;
  }

  .roster-actions .btn {
    width: 100%;
    justify-content: center;
  }
}
```

Add class names:
- `className="roster-toolbar"` → search + filter container
- `className="roster-status-filters"` → status button group
- `className="roster-actions"` → Export/Bulk Import/Add Student buttons row

## 3.3 Student details dialog — mobile

```css
@media (max-width: 768px) {
  /* Academic metrics grid: 4-col → 2-col on tablet */
  .student-details-metrics {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* Institutional + Contact cards: side-by-side → stacked */
  .student-details-cards {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 480px) {
  /* Academic metrics: 2-col → 1-col on phone */
  .student-details-metrics {
    grid-template-columns: 1fr !important;
  }
}
```

Add class names in `components/admin/students/student-details-dialog.tsx`:
- `className="student-details-metrics"` → 4-tile KPI grid
- `className="student-details-cards"` → 2-column info cards grid

## 3.4 Drive applications table → cards on phone

```css
/* Applied the same pattern as student applications (FE-M02) */
@media (max-width: 480px) {
  .drive-apps-table-wrap {
    display: none;
  }

  .drive-app-card {
    display: block;
  }
}

/* Hidden on desktop */
.drive-app-card {
  display: none;
}
```

## 3.5 Post drive form sections

```css
@media (max-width: 768px) {
  /* Eligible departments checkbox grid: multi-col → 2-col on tablet */
  .eligible-depts-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 480px) {
  /* Eligible departments: 2-col → 1-col on phone */
  .eligible-depts-grid {
    grid-template-columns: 1fr !important;
  }
}
```

## 3.6 Hide admin drive preview card on mobile

The `AdminDrivePreviewCard` on the Post Drive form is optional on small
screens — it's a "nice to have" preview that takes significant vertical
space on mobile.

```css
@media (max-width: 768px) {
  /* Hide the live preview card on tablet/phone.
     A collapsed "Preview" toggle button replaces it (see §6.4). */
  .admin-drive-preview-card {
    display: none;
  }

  .admin-drive-preview-toggle {
    display: flex; /* show the toggle button */
  }
}

/* Hidden on desktop — preview card is always shown */
.admin-drive-preview-toggle {
  display: none;
}
```

## 3.7 Announcements page — 2-col → 1-col

```css
@media (max-width: 768px) {
  .announcements-grid {
    grid-template-columns: 1fr !important;
  }
}
```

Add `className="announcements-grid"` to the 2-column grid in
`app/(admin)/admin-dashboard/announcements/page.tsx`.

## 3.8 Admin reports page

```css
@media (max-width: 768px) {
  /* Progress bar label row: flex-row → flex-wrap */
  .reports-bar-row {
    flex-wrap: wrap;
    gap: 4px;
  }
}
```

## 3.9 Super admin department filter pills

```css
@media (max-width: 768px) {
  /* Dept filter pills on students/drives pages: scrollable row */
  .dept-filter-pills {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
  }

  .dept-filter-pills .filter-pill {
    flex-shrink: 0;
  }
}
```

Add `className="dept-filter-pills"` to the department filter pill
containers on:
- `app/(super-admin)/super-admin-dashboard/students/page.tsx`
- `app/(super-admin)/super-admin-dashboard/drives/page.tsx`

## 3.10 Audit log filter panel — single column

```css
@media (max-width: 768px) {
  /* Audit log filter grid: 4-col → 2-col on tablet */
  .audit-filter-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 480px) {
  /* Audit log filter grid: 2-col → 1-col on phone */
  .audit-filter-grid {
    grid-template-columns: 1fr !important;
  }
}
```

Add `className="audit-filter-grid"` to the 4-column filter grid in
`components/audit/AuditLogsTable.tsx`.

## 3.11 Dialogs — full-screen on phone

On very small phones, shadcn dialogs benefit from nearly full-screen
sizing:

```css
@media (max-width: 480px) {
  /* shadcn Dialog content — nearly full-screen on phone */
  [data-radix-dialog-content] {
    max-width: calc(100vw - 24px) !important;
    max-height: calc(100dvh - 48px) !important;
    margin: 24px 12px 12px !important;
    overflow-y: auto;
  }
}
```

This applies to all dialogs (create department, create admin account,
student details, etc.) on phone without needing per-dialog CSS.

## 3.12 Department scope banner — compact on mobile

```css
@media (max-width: 480px) {
  .dept-scope-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 12px;
  }
}
```

---

# 4. ADMIN HOME PAGE — MOBILE

## 4.1 File

`app/(admin)/admin-dashboard/page.tsx`

## 4.2 Changes

- KPI grid: `className="kpi-grid"` already added in FE-M01
- Lower 2-column section: add `className="admin-home-lower"` (§3.1)

```tsx
{/* Before: */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

{/* After: */}
<div className="admin-home-lower" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
```

No other changes.

---

# 5. ADMIN STUDENT ROSTER — MOBILE

## 5.1 File

`app/(admin)/admin-dashboard/students/page.tsx` (server) and its
client `StudentRosterTable` / `StudentRosterFilters` components.

## 5.2 Toolbar class additions

Add class names per §3.2:

```tsx
{/* Toolbar wrapping search + status filters */}
<div
  className="roster-toolbar"
  style={{ display: 'flex', gap: 12, marginBottom: 16,
           flexWrap: 'wrap', alignItems: 'center',
           justifyContent: 'space-between' }}
>
  <input className="..." style={{ maxWidth: 360, flex: 1, ... }} />
  <div className="roster-status-filters" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    {/* status buttons */}
  </div>
</div>

{/* Action buttons row */}
<div
  className="roster-actions"
  style={{ display: 'flex', gap: 8, marginBottom: 16 }}
>
  <button className="btn btn-outline">Export CSV</button>
  <Link href=".../import">Bulk Import</Link>
  <Link href=".../add">+ Add Student</Link>
</div>
```

## 5.3 Table → card view on phone

Use the same two-element pattern from FE-M02 (table + cards, CSS controls
which is visible).

**Desktop table** — keep `.table-wrap` unchanged.

**Phone card list** — add after the table:

```tsx
{/* PHONE VIEW — hidden on desktop, shown at ≤480px */}
<div className="drive-app-card">  {/* reuses same CSS toggle pattern */}
  {students.data.map((student) => (
    <div key={student.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
      {/* Name + roll number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {student.rollNumber} · {student.department.code}
          </div>
        </div>
        <StatusBadge variant={...}>{statusLabel}</StatusBadge>
      </div>

      {/* Academic meta */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        <span>CGPA: {student.academic?.currentCGPA ?? '—'}</span>
        <span>Backlogs: {student.academic?.activeBacklogs ?? 0}</span>
      </div>

      {/* View details button */}
      <button
        className="btn btn-outline btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => setSelectedStudentId(student.id)}
      >
        View Details ↗
      </button>
    </div>
  ))}
</div>
```

**Note:** The `.drive-app-card` CSS class (defined in §3.4) is reused
here — both drive applications and student roster use the same
show/hide pattern. The class name is not drive-specific; it's a toggle.
Rename it to `.mobile-card-list` if you prefer semantic naming — just
update both FE-M02 and FE-M03 CSS to match.

---

# 6. POST DRIVE FORM — MOBILE

## 6.1 File

`app/(admin)/admin-dashboard/drives/new/page.tsx` and
`app/(admin)/admin-dashboard/drives/[id]/edit/page.tsx`

## 6.2 Field grids

The `.field-row` grids already stack to single column at 480px via
FE-M01. The main structural changes here are:

**Eligible departments checkbox grid:** Add `className="eligible-depts-grid"`
to the departments checkbox container (§3.5).

**Selection rounds list:** Already full-width flex column — no changes needed.

## 6.3 `AdminDriveLogisticsPanel`

The panel uses `.field-row` grids internally which are already handled
by FE-M01. No additional CSS needed.

## 6.4 Hide / show `AdminDrivePreviewCard` on mobile

The `AdminDrivePreviewCard` is always rendered on desktop below the
logistics panel. On mobile it's hidden by `.admin-drive-preview-card`
CSS (§3.6).

Add a "Preview" toggle button that shows the card in a dialog on mobile:

In the post drive form client component, above where
`AdminDrivePreviewCard` is rendered:

```tsx
{/* Mobile: show preview in a dialog */}
<button
  type="button"
  className="btn btn-outline admin-drive-preview-toggle"
  onClick={() => setPreviewModalOpen(true)}
>
  👁 Preview Drive Card
</button>

{/* Desktop: inline preview card */}
<div className="admin-drive-preview-card">
  <AdminDrivePreviewCard drive={form} deptCode={deptCode} />
</div>

{/* Preview dialog for mobile */}
{previewModalOpen && (
  <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
    <DialogContent>
      <AdminDrivePreviewCard drive={form} deptCode={deptCode} />
    </DialogContent>
  </Dialog>
)}
```

Add `previewModalOpen` state (`useState<boolean>(false)`) to the
post drive form client component.

---

# 7. DRIVE APPLICATIONS PAGE — MOBILE

## 7.1 File

`app/(admin)/admin-dashboard/drives/[id]/applications/page.tsx`

## 7.2 Changes

Same two-element pattern (table + cards). Use the CSS from §3.4.

Application card for drive applicants:

```tsx
{/* PHONE VIEW */}
<div className="drive-app-card">
  {applications.data.map((app) => (
    <div key={app.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{app.student.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {app.student.rollNumber} · {app.student.department.code}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>CGPA: {app.snapshotCgpa ?? '—'}</span>
        <span>Backlogs: {app.snapshotBacklogs ?? 0}</span>
        <span>Applied: {formatRelativeDate(app.appliedAt)}</span>
      </div>
    </div>
  ))}
</div>
```

Reuse `formatRelativeDate` from FE-M02 by moving it to `lib/date-helpers.ts`
(or `lib/drive-date-helpers.ts` if that file exists).

---

# 8. ADMIN ANNOUNCEMENTS — MOBILE

## 8.1 File

`app/(admin)/admin-dashboard/announcements/page.tsx`

## 8.2 Change

Add `className="announcements-grid"` to the 2-column grid (§3.7):

```tsx
<div
  className="announcements-grid"
  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
>
  {/* compose form + sent list */}
</div>
```

No other changes needed. The form fields inside stack automatically
from FE-M01's `.field-row` fix.

---

# 9. ADMIN REPORTS — MOBILE

## 9.1 File

`app/(admin)/admin-dashboard/reports/page.tsx`

## 9.2 Changes

- KPI cards: `className="kpi-grid"` already from FE-M01
- Progress bar label rows: add `className="reports-bar-row"` to each
  row div (§3.8)
- Student table at bottom: `.table-wrap` horizontal scroll from FE-M01

```tsx
{/* Each bar row */}
<div
  className="reports-bar-row"
  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}
>
  <span>{label}</span>
  <strong>{value}</strong>
</div>
```

---

# 10. SUPER ADMIN DASHBOARD — MOBILE

## 10.1 File

`app/(super-admin)/super-admin-dashboard/page.tsx`

## 10.2 Changes

- 4 KPI cards: `className="kpi-grid"` already from FE-M01
- Department comparison table: `.table-wrap` horizontal scroll from FE-M01

No additional changes needed. The KPI grid and table scroll are already
handled.

---

# 11. SUPER ADMIN DEPARTMENT MANAGEMENT — MOBILE

## 11.1 File

`app/(super-admin)/super-admin-dashboard/departments/page.tsx`

## 11.2 Changes

**Table:** `.table-wrap` horizontal scroll from FE-M01 — no changes.

**Dialogs (create/edit department, confirm deactivate):**
The §3.11 CSS rule applies automatically to all shadcn `Dialog` and
`AlertDialog` on phone. No per-dialog changes needed.

**"Add Department" button on mobile:**
On a 375px screen, the page title + "Add Department" button should
stack vertically. Add:

```css
@media (max-width: 480px) {
  .page-header-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .page-header-row .btn {
    width: 100%;
    justify-content: center;
  }
}
```

Add `className="page-header-row"` to the flex row containing the
page title and the action button. Apply this to ALL admin and super
admin pages that have a title + button row pattern:

- `app/(super-admin)/super-admin-dashboard/departments/page.tsx`
- `app/(super-admin)/super-admin-dashboard/admins/page.tsx`
- `app/(admin)/admin-dashboard/students/page.tsx` (uses `roster-actions` instead)
- `app/(admin)/admin-dashboard/drives/page.tsx`

---

# 12. SUPER ADMIN ADMIN ACCOUNTS — MOBILE

## 12.1 File

`app/(super-admin)/super-admin-dashboard/admins/page.tsx`

## 12.2 Changes

- Table: `.table-wrap` horizontal scroll from FE-M01
- "Create Admin Account" button: `page-header-row` (§11 CSS)
- Create/Assign dialogs: `[data-radix-dialog-content]` CSS from §3.11
- Department filter: if rendered as pills, add `dept-filter-pills`
  class (§3.9). If rendered as a `<select>`, no changes needed.

---

# 13. SUPER ADMIN STUDENTS PAGE — MOBILE

## 13.1 File

`app/(super-admin)/super-admin-dashboard/students/page.tsx`

## 13.2 Changes

**Department filter pills:** Add `className="dept-filter-pills"` (§3.9)
to the filter pill container.

**Status filter + search:** Add `className="roster-toolbar"` to the
wrapping div (reuses the same CSS as admin roster, §3.2).

**Table:** `.table-wrap` horizontal scroll from FE-M01.

**Export button:** `page-header-row` pattern (§11).

---

# 14. SUPER ADMIN DRIVES PAGE — MOBILE

## 14.1 File

`app/(super-admin)/super-admin-dashboard/drives/page.tsx`

## 14.2 Changes

**Department filter:** `className="dept-filter-pills"` (§3.9).

**Table:** `.table-wrap` horizontal scroll from FE-M01.

No other changes needed.

---

# 15. GLOBAL REPORTS PAGE — MOBILE

## 15.1 File

`app/(super-admin)/super-admin-dashboard/reports/page.tsx`

## 15.2 Changes

- 3 KPI cards: `className="kpi-grid"` already from FE-M01
- Placement rate bars: add `className="reports-bar-row"` (§3.8)
- Student table at bottom: `.table-wrap` scroll from FE-M01

---

# 16. AUDIT LOG — MOBILE

## 16.1 File

`components/audit/AuditLogsTable.tsx`

## 16.2 Changes

**Filter panel:**
Add `className="audit-filter-grid"` to the 4-column filter grid:

```tsx
{/* Before: */}
<div className="card" style={{ marginBottom: 20 }}>
  <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>

{/* After: */}
<div className="card" style={{ marginBottom: 20 }}>
  <div className="audit-filter-grid field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
```

The `audit-filter-grid` CSS (§3.10) overrides `gridTemplateColumns` with
`!important` at the relevant breakpoints.

**Table:** `.table-wrap` horizontal scroll from FE-M01. The audit log
table has many columns (Timestamp, Actor, Action, Entity Type, Entity ID,
Details) — on mobile, sticky first column would be ideal but is complex.
Horizontal scroll is the pragmatic V1 solution.

**Expandable metadata:** Already full-width `<pre>` block — works fine
at any width.

**Pagination:** Already uses the `Pagination` component from FE-M01
which is responsive.

---

# 17. `formatRelativeDate` — SHARED UTILITY

In FE-M02, `formatRelativeDate` was added inline in the applications
page. Now that FE-M03 also needs it (drive applications card), move it
to a shared location.

**Move to:** `lib/date-helpers.ts` (NEW FILE or add to existing
`lib/drive-date-helpers.ts` if that file was created in FE-03)

```typescript
/**
 * Format a date as a relative human-readable string.
 * e.g. "today", "yesterday", "3d ago", "15 Sep"
 */
export function formatRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0)  return 'today';
  if (days === 1)  return 'yesterday';
  if (days < 30)   return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
```

Update FE-M02's applications page to import from this shared location.

---

# 18. NEW FILES TO CREATE

```
lib/
  └── date-helpers.ts         ← shared formatRelativeDate (if not already in drive-date-helpers.ts)
```

Files to **update** (CSS additions in `globals.css`):

```
app/globals.css               ← add FE-M03 section (§3)
```

Files to **update** (minor class additions and card view TSX):

```
app/(admin)/admin-dashboard/page.tsx
  └── admin-home-lower class

app/(admin)/admin-dashboard/students/page.tsx
  └── roster-toolbar, roster-status-filters, roster-actions classes
  └── mobile card view TSX

app/(admin)/admin-dashboard/drives/new/page.tsx
  └── eligible-depts-grid class
  └── admin-drive-preview-card + toggle pattern

app/(admin)/admin-dashboard/drives/[id]/edit/page.tsx
  └── same as new/page.tsx (eligible-depts-grid, preview toggle)

app/(admin)/admin-dashboard/drives/[id]/applications/page.tsx
  └── drive-app-card TSX

app/(admin)/admin-dashboard/announcements/page.tsx
  └── announcements-grid class

app/(admin)/admin-dashboard/reports/page.tsx
  └── reports-bar-row class

components/admin/students/student-details-dialog.tsx
  └── student-details-metrics + student-details-cards classes

app/(super-admin)/super-admin-dashboard/departments/page.tsx
  └── page-header-row class

app/(super-admin)/super-admin-dashboard/admins/page.tsx
  └── page-header-row class

app/(super-admin)/super-admin-dashboard/students/page.tsx
  └── dept-filter-pills, roster-toolbar classes

app/(super-admin)/super-admin-dashboard/drives/page.tsx
  └── dept-filter-pills class

app/(super-admin)/super-admin-dashboard/reports/page.tsx
  └── reports-bar-row class

components/audit/AuditLogsTable.tsx
  └── audit-filter-grid class

lib/date-helpers.ts (or drive-date-helpers.ts)
  └── formatRelativeDate moved here
```

---

# 19. WHAT NOT TO DO

- Do NOT change any server actions, queries, or Prisma models
- Do NOT change any business logic in any file
- Do NOT touch student pages — those are done in FE-M02
- Do NOT use arbitrary breakpoints other than `768px` and `480px`
- Do NOT implement the `AdminDrivePreviewCard` as a fully separate mobile
  component — just use the toggle button + Dialog pattern (§6.4)
- Do NOT make the audit log table convert to cards — horizontal scroll
  is the V1 approach for the audit log (super admin primarily on desktop)
- Do NOT add sticky columns to any table — too complex for V1, horizontal
  scroll is sufficient

---

# 20. TYPESCRIPT RULES

- `formatRelativeDate` — accepts `Date | string`, no `any`
- All class name additions are `string` values — no type issues
- The preview modal state in post drive form: `useState<boolean>(false)`
- No new interfaces needed — all changes are CSS + minor TSX class additions

---

# 21. VERIFICATION

Run in order:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass.

Then open browser dev tools and verify:

### At 768px (tablet) — admin role

- [ ] Admin home: KPI cards 2×2, attention + drives cards stacked
- [ ] Student roster: search + status filters wrap correctly,
      action buttons (Export/Import/Add) accessible
- [ ] Student details dialog: metric tiles 2-col, info cards stacked
- [ ] Post drive form: all sections readable, no horizontal overflow
- [ ] Drive applications table: horizontal scroll with min-width
- [ ] Announcements: compose + sent list stacked
- [ ] Reports: KPI + progress bars readable

### At 375px (phone) — admin role

- [ ] Admin home: KPI 1-col, sections stacked
- [ ] Student roster table: horizontal scroll only, table not broken
- [ ] Student roster card view: visible, shows name/roll/CGPA/status/button
- [ ] Student details dialog: fills most of screen, content readable
- [ ] Post drive form: field rows single column, preview card hidden,
      "Preview Drive Card" button visible
- [ ] Drive applications card view: visible, shows applicant info
- [ ] Department scope banner: wraps gracefully
- [ ] Hamburger drawer opens and closes correctly (from FE-M01)

### At 768px (tablet) — super admin role

- [ ] Dashboard: 2×2 KPI, dept table scrolls horizontally
- [ ] Department management: table scrolls, dialogs fill screen
- [ ] Admin accounts: table scrolls, create dialog fills screen
- [ ] Students: dept filter pills scroll horizontally, table scrolls
- [ ] Drives: filter pills scroll, table scrolls
- [ ] Reports: progress bars readable
- [ ] Audit log: filter panel 2-col, table scrolls

### At 375px (phone) — super admin role

- [ ] Dashboard: KPI 1-col, table scrolls
- [ ] Department management: "Add Department" button full-width
- [ ] Admin accounts: "Create Admin Account" button full-width
- [ ] Audit log: filter panel 1-col, "Apply Filters" button full-width,
      table scrolls horizontally

### Dialogs on phone (375px)
- [ ] Create department dialog: nearly full-screen, inputs accessible
- [ ] Create admin account dialog: nearly full-screen
- [ ] Student details dialog: fills screen, scrollable
- [ ] All dialogs: close with ✕ or tap outside works

### Shared utility
- [ ] `formatRelativeDate` imported from shared location in both
      student applications (FE-M02) and drive applications (FE-M03)

---

# 22. FINAL MOBILE POLISH CHECKLIST

After FE-M03 is complete, do a final pass across the entire app
at 375px and confirm:

- [ ] No page has horizontal overflow on the `<body>` itself
      (tables scroll within `.table-wrap`, not the whole page)
- [ ] All pages load without console errors
- [ ] Bottom nav (student) never overlaps content due to padding
- [ ] Hamburger drawer (admin/super admin) opens and closes
      from every page in those roles
- [ ] All dialogs are accessible and closeable on 375px
- [ ] `npm run build` passes with zero TypeScript errors

---

# 23. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-M03 complete
- Admin home lower section responsive
- Student roster: toolbar, card view on phone
- Student details dialog: responsive metric grid
- Post drive: eligible depts grid, preview card toggle on mobile
- Drive applications: card view on phone
- Announcements: 1-col on tablet
- Reports: bar rows responsive
- Super admin: dept filter pills scrollable, page-header-row pattern
- Audit log filter panel: 2-col tablet / 1-col phone
- `formatRelativeDate` moved to shared `lib/date-helpers.ts`
- Final mobile polish checklist passed
- Build passing

**Mark the mobile integration as complete:**

```
## Mobile Responsiveness — COMPLETE

All 3 mobile units implemented (FE-M01, FE-M02, FE-M03).
Option B mobile design:
- Students: bottom navigation bar (5 items)
- Admin / Super Admin: hamburger slide-out drawer
Breakpoints: ≤768px (tablet), ≤480px (phone)
Desktop layout: unchanged
```

---

# 24. STRICT STOP CONDITION

**FE-M03 is the final unit.** When this unit is done and the final
mobile polish checklist passes, the mobile integration is complete.

The full CampusHire frontend integration project is now complete:
- FE-01 through FE-09: desktop integration ✅
- FE-M01 through FE-M03: mobile responsiveness ✅

---

# FINAL REPORT

When finished, provide:

## CSS Additions
- Count of new rules in FE-M03 section of `globals.css`
- Any `!important` overrides used and why

## Class Name Changes
- Full list of pages where class names were added

## Card View Implementations
- Admin student roster: confirmed working at 375px
- Drive applications: confirmed working at 375px

## Post Drive Preview Toggle
- How implemented, dialog pattern

## Shared Utility
- Confirm `formatRelativeDate` location and imports updated

## Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run build` result

## Final Mobile Polish
- Confirm final pass at 375px — no body overflow on any page

## Scope Confirmation
Explicitly confirm:
**No server actions changed. No database changes. No student pages
touched. No features added or removed. Desktop layout unchanged.
Audit log uses horizontal scroll — no card conversion.**
