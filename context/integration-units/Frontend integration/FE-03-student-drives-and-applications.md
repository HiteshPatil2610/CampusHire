# CampusHire — Integration Unit FE-03: Student Drives & Applications

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
  - Schema migration `frontend-student-fields` applied
  - `SemesterMark` model added
  - All 7 profile tabs wired to server actions
  - Student dashboard wired to real data
  - `npm run build` passes ✅

Now implement:

# FE-03 — Student Drives & Applications

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md` — pay close attention to:
  - Applications are **immutable**: no edit, no withdrawal, no re-applying
  - Drive status is **never stored** — always computed from `applicationDeadline`
  - Eligibility filtering is **server-side only**
- `context/architecture.md` — invariants §3–8
- `INTEGRATION_GUIDE.md` §6.2 "Adapt" table — critical V1 behavioral constraints
- `prisma/schema.prisma` — `Drive`, `DriveApplication` models and their exact field names
- `features/drives/utils/drive-status.ts` — `getDriveStatus()`, `isDriveOpen()`, `getDaysUntilDeadline()`
- `features/drives/queries/drive-eligibility.ts` — `isStudentEligibleForDrive()`, `getIneligibilityReasons()`
- `features/drives/queries/get-eligible-drives.ts` — exact query params, return shape `StudentDrivesResult`
- `features/drives/queries/get-drive-detail.ts` — how drive detail enforces eligibility server-side
- `features/drives/actions/get-admin-drives.ts` — to understand the admin drive shape (do NOT use for student pages)
- `features/drives/schemas/drive.ts` — Zod schemas
- `features/applications/actions/apply-to-drive.ts` — the complete server action: reads every step
- `features/applications/queries/get-my-applications.ts` — `getMyApplications()` return shape `PaginatedApplications`
- `features/applications/queries/check-application-exists.ts`
- `lib/auth.ts` — `requireStudent()`

Then read all temp frontend source files relevant to this unit:

- `campushire_frontend (temp)/src/pages/student/HomePage.jsx`
- `campushire_frontend (temp)/src/components/drives/DriveCard.jsx`
- `campushire_frontend (temp)/src/components/drives/ApplicationReviewModal.jsx`
- `campushire_frontend (temp)/src/components/drives/WithdrawModal.jsx` (to understand what it does — then confirm it is NOT ported)
- `campushire_frontend (temp)/src/utils/driveUtils.js`

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **Schema additions** — new fields on `Drive` and `DriveApplication` models
2. **Prisma migration** — one migration for all schema changes
3. **Extend existing queries/actions** — wire new Drive fields into existing queries
4. **Drives catalogue page** — port `HomePage.jsx`
5. **`DriveCard` component** — port with V1 behavioral constraints applied
6. **Drive detail page** — new page, apply button wired to `applyToDrive()`
7. **Application confirmation dialog** — simplified V1 version of `ApplicationReviewModal`
8. **My Applications page** — port application history

This unit does **NOT** implement:

- Admin drives management (FE-06)
- Admin view of applicants (FE-06)
- Notifications page (FE-04)
- Any admin or super admin pages
- Withdrawal of applications (V1 — applications are immutable)
- Application stage tracking (V1 — no stage tracking beyond "Applied")
- Application editing (V1 — applications are immutable)

---

# 3. SCHEMA ADDITIONS

## 3.1 Add to `Drive` model in `prisma/schema.prisma`

The temp frontend's `DriveCard` and the admin's logistics panel use fields
not yet on the `Drive` model. Add them:

```prisma
model Drive {
  // ... ALL existing fields remain unchanged ...

  // Visual / display fields
  companyLogoUrl  String?   // URL to company logo image (optional)

  // Package display — stored as formatted string for flexibility
  // e.g. "12.0 – 16.0 LPA" or "18 LPA"
  // The existing `packageOffered Float` stores the numeric value.
  // This field stores the display string.
  packageDisplay  String?

  // Drive logistics — configured by dept admin after drive creation
  venue           String?   // "Campus Convention Hall, Block B"
  reportingTime   String?   // "08:30 AM"
  contactPerson   String?   // Name of POC
  contactPhone    String?   // Phone number of POC
  pptLink         String?   // Pre-Placement Talk meeting URL

  // Application fields config — JSON array stored as Text
  // Each element: { fieldKey, fieldLabel, isRequired, isEnabled }
  // Used by admin to configure which student fields are shown on apply
  applicationFields String? @db.Text
}
```

> **Check first:** Read `prisma/schema.prisma` before adding. If any of these
> fields already exist (added in a prior migration), do not add them again.
> Only add the truly missing ones.

## 3.2 Add to `DriveApplication` model in `prisma/schema.prisma`

Add snapshot fields to capture academic standing at the moment of application.
These are read-only once written — they document what the student's CGPA and
backlogs were when they applied.

```prisma
model DriveApplication {
  // ... ALL existing fields remain unchanged ...

  snapshotCgpa     Float?   // Student's CGPA at time of application
  snapshotBacklogs Int?     // Student's active backlogs at time of application
}
```

## 3.3 Migration

```bash
npx prisma validate
npx prisma migrate dev --name "frontend-drive-fields"
npx prisma generate
npx tsc --noEmit              # must pass before any UI work
npm run test                  # all existing tests must still pass
```

## 3.4 Update `features/applications/actions/apply-to-drive.ts`

After migration, update the `prisma.driveApplication.create()` call to write
the snapshot fields at application time:

```typescript
const application = await prisma.driveApplication.create({
  data: {
    studentId: studentWithAcademic.id,
    driveId: drive.id,
    snapshotCgpa: studentWithAcademic.academic.currentCGPA,
    snapshotBacklogs: studentWithAcademic.academic.activeBacklogs,
  },
});
```

This is the only change to `apply-to-drive.ts`. Do not alter any other logic.

## 3.5 Update `features/drives/queries/get-eligible-drives.ts`

The current query returns `Drive[]` without the new fields (they will be
populated by the DB once the migration runs). No query code change is needed —
Prisma auto-includes all columns. However, update the `StudentDrivesResult`
type if needed so `data: Drive[]` matches the current schema including new fields.

---

# 4. STUDENT DRIVES CATALOGUE PAGE

## 4.1 Target file

`app/(student)/student-dashboard/drives/page.tsx` (NEW FILE)

Create directory: `app/(student)/student-dashboard/drives/`

## 4.2 Source

`campushire_frontend (temp)/src/pages/student/HomePage.jsx`

## 4.3 Architecture

```
DrivesPage (Server Component)
  ├── calls requireStudent() → gets { user, student }
  ├── reads search params: ?filter=open|all&q=searchTerm&page=1
  ├── calls getEligibleDrives({ status, search, page, pageSize: 25 })
  │     → returns StudentDrivesResult { data, page, pageSize, totalCount }
  ├── for each drive: calls getDriveStatus(drive.applicationDeadline)
  ├── for each drive: calls checkApplicationExists(student.id, drive.id)
  │     → builds an appliedDriveIds Set<string>
  └── renders:
      ├── StudentIdentityCard (the .student-id-card strip — server rendered)
      ├── DrivesFilterBar (client — filter pills)
      └── DrivesGrid (client — DriveCard list + pagination)
```

Because search params drive the data fetching, this is a fully server-rendered
page. Filter changes update the URL (`?filter=all&q=keyword&page=2`), which
re-runs the server component with new params.

## 4.4 Student identity card

Port the `.student-id-card` strip from `HomePage.jsx`. Use real data:
- `student.name` — full name
- `student.department.name` — department
- Derived initials (first letter of each word, 2 chars max)
- `student.rollNumber`
- `student.academic?.currentCGPA`
- `student.email`
- `profileCompletion.percentage` — call `calculateProfileCompletion()` from FE-02

**Remove** from the identity card (V1 out of scope):
- `student.readinessScore` pill — remove
- `student.resumeScore` pill — remove
- `student.placementBadge` — remove
- "View readiness" button → replace with "My Applications" button →
  `/student-dashboard/applications`
- "Build resume" button → remove entirely

**Keep:**
- "Edit profile" button → `/student-dashboard/profile`

## 4.5 Filter pills

Port the 5 filter pills from `HomePage.jsx`.

Replace `AppStateContext.isApplied()` with the real `appliedDriveIds` Set
passed as a prop from the server component.

Filter logic (applied on the server via `getEligibleDrives` params, or
via URL params):

| Filter label | Server behavior |
|---|---|
| `All drives` | `getEligibleDrives({ status: 'all' })` |
| `Open` | `getEligibleDrives({ status: 'open' })` — deadline not passed |
| `Applied` | filter client-side from `appliedDriveIds` (no extra query needed) |
| `Upcoming` | drives where `driveDate > now` (open but drive hasn't happened yet) |
| `Closed` | drives where `applicationDeadline < now` — deadline passed |

Implement filters as URL search params so the server re-fetches on change:

```typescript
// In the client filter bar:
const router = useRouter();
const pathname = usePathname();

function handleFilter(f: string) {
  const params = new URLSearchParams(searchParams);
  params.set('filter', f);
  params.delete('page'); // reset to page 1 on filter change
  router.push(`${pathname}?${params.toString()}`);
}
```

## 4.6 Drives grid

Render drives in the `.drives-grid` CSS grid using `DriveCard` components
(ported in §5). Pass `Pagination` component below the grid.

Empty state: when `totalCount === 0`, show `.drives-empty` with appropriate
message per filter (e.g. "No eligible drives match this filter").

---

# 5. DRIVECARD COMPONENT

## 5.1 Target file

`components/drives/drive-card.tsx`

## 5.2 Source

`campushire_frontend (temp)/src/components/drives/DriveCard.jsx`

## 5.3 V1 behavioral constraints — CRITICAL

Read `INTEGRATION_GUIDE.md §6.2` and apply these changes from the source:

| Temp Frontend Behavior | V1 Required Behavior |
|---|---|
| Shows stage stepper (`<StageStepper steps={drive.stepper}>`) | **Remove entirely.** V1 has no application stage tracking. The stepper assumed `drive.stepper[]` which does not exist in the Prisma schema. |
| "Withdraw" button calls `onWithdraw()` → `WithdrawModal` | **Remove entirely.** V1 applications are immutable. |
| "Edit" button calls `onEdit()` to edit an application | **Remove entirely.** V1 applications are immutable. |
| "View Application" opens `ApplicationReviewModal` in read mode | **Remove.** Replace with a simple "Applied ✓" chip — no modal needed. |
| `drive.open` boolean stored on drive | **Compute from deadline.** Call `getDriveStatus(drive.applicationDeadline)`. A drive is open if `getDriveStatus() === 'open'`. |
| `deadlinePassed(drive.driveDeadlineRaw)` using `DEMO_TODAY` | Use `isDriveOpen(drive.applicationDeadline)` from `features/drives/utils/drive-status.ts` — uses real `new Date()`. |
| `drive.statusBadge.cls` stored field | **Compute.** Status is derived, not stored. Compute it with `getDriveStatus()`. |
| `drive.stepper`, `drive.stage`, `drive.stageLabel` | **Do not use.** Not in Prisma schema. |
| Eligibility computed client-side from `student.cgpa` | **Only show drives that are eligible** — `getEligibleDrives()` already filters server-side. DriveCard receives eligible drives only. No need for client eligibility computation in the card itself. Just show "✓ Eligible" badge always. |

## 5.4 Props interface

```typescript
interface DriveCardProps {
  drive: Drive;                     // Prisma Drive type with new fields
  isApplied: boolean;               // Whether this student has applied
  applicantCount?: number;          // Optional: total applicants count
  onApplyClick: (driveId: string) => void; // Navigate to drive detail
}
```

Note: `onApplyClick` navigates to the drive detail page — it does NOT open a
modal. The modal/confirmation is on the detail page, not the card.

## 5.5 Field name mapping — Prisma schema to DriveCard UI

| Temp Frontend `drive.*` | Prisma `Drive.*` |
|---|---|
| `drive.company` | `drive.companyName` |
| `drive.role` | `drive.roleName` |
| `drive.ctc` / `drive.package` | `drive.packageDisplay` (new) or format `drive.packageOffered` as string |
| `drive.minCgpa` | `drive.minCGPA` |
| `drive.maxBacklogs` | `drive.maxActiveBacklogs` |
| `drive.driveDate` | `drive.driveDate` |
| `drive.driveDeadlineRaw` | `drive.applicationDeadline` |
| `drive.deadline` (formatted string) | Format `drive.applicationDeadline` with `toLocaleDateString()` |
| `drive.departments[]` | Parse `JSON.parse(drive.eligibleDepartments)` — array of department IDs, not names |
| `drive.logoText` | First 4 chars of `drive.companyName.toUpperCase()` |
| `drive.rounds` | `drive.roundsDescription` (new field, or `drive.selectionRounds`) |
| `drive.jd` | `drive.jobDescriptionUrl` — show link to open PDF, not inline text |
| `drive.applyLink` | `drive.externalApplyUrl` |
| `drive.adminConfig.venue` | `drive.venue` (new field) |
| `drive.adminConfig.reportingTime` | `drive.reportingTime` (new field) |
| `drive.adminConfig.contactPerson` | `drive.contactPerson` (new field) |
| `drive.adminConfig.pptLink` | `drive.pptLink` (new field) |

## 5.6 Status badge computation

```typescript
import { getDriveStatus, getDaysUntilDeadline } from '@/features/drives/utils/drive-status';

const status = getDriveStatus(drive.applicationDeadline);
const daysLeft = getDaysUntilDeadline(drive.applicationDeadline);

// Badge logic:
// status === 'closed' → <StatusBadge variant="red">Closed</StatusBadge>
// status === 'open' && daysLeft <= 3 → <StatusBadge variant="amber">⏰ {Math.ceil(daysLeft)}d left</StatusBadge>
// status === 'open' && daysLeft > 3 → <StatusBadge variant="green">Open</StatusBadge>
```

## 5.7 Department display

`drive.eligibleDepartments` is a JSON string of department IDs (UUIDs).
The DriveCard cannot join to get department names (server-side query context).

Two options:
1. Pass a `departmentMap: Record<string, string>` prop from the server component
   that maps dept IDs to dept codes/names, and use it in the card.
2. Show the number of eligible departments: "3 departments eligible".

**Choose option 1.** The server component already has access to all departments.
Fetch them once in the page and pass a map down. This gives a better UX.

Add to the drives page query:
```typescript
const departments = await prisma.department.findMany({
  where: { isActive: true },
  select: { id: true, code: true, name: true },
});
const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.code]));
```

Pass `deptMap` to `DrivesGrid`, which passes it to each `DriveCard`.

## 5.8 Action strip (V1 simplified)

Replace the complex action strip from the temp frontend with this V1 version:

```
If applied:
  [ ✓ Applied chip ] [ View details → ]
  
If open (not applied):
  [ {count} applicants ] [ View & Apply → ]
  
If closed:
  [ {count} applicants ] [ View details → ] [ Closed chip ]
```

Both "View & Apply" and "View details" navigate to the drive detail page
`/student-dashboard/drives/{drive.id}`.

The "Apply now" action happens on the detail page — never directly from the card.

## 5.9 Expandable details panel

Keep the expandable "▼ Drive info" / "▲ Less" toggle from the source.

In the expanded panel show:
- Job description (if `drive.jobDescriptionUrl` is set: show "View JD (PDF) ↗" link)
- Selection process (`drive.selectionRounds` or `drive.roundsDescription`)
- Venue & logistics (venue, reportingTime, contactPerson, contactPhone, pptLink)
- Apply link (if `drive.applyMethod === 'EXTERNAL'` and `drive.externalApplyUrl`)

Do not show the PPT link or external apply link in the collapsed state.

---

# 6. DRIVE DETAIL PAGE

## 6.1 Target file

`app/(student)/student-dashboard/drives/[id]/page.tsx` (NEW FILE)

Create directory: `app/(student)/student-dashboard/drives/[id]/`

## 6.2 Architecture

```
DriveDetailPage (Server Component)
  ├── params: { id: string }
  ├── calls requireStudent() → { user, student }
  ├── calls getDriveDetail(id)
  │     → re-checks eligibility server-side, throws AuthorizationError if not eligible
  │     → returns DriveWithDepartment
  ├── calls getDriveStatus(drive.applicationDeadline)
  ├── calls checkApplicationExists(student.id, drive.id)
  │     → hasApplied: boolean
  └── renders:
      ├── Drive header (company, role, package, badges)
      ├── Eligibility checklist (computed from student vs drive criteria)
      ├── Job description section
      ├── Selection rounds section
      ├── Logistics section (venue, reporting time, contact)
      └── ApplySection (client component — handles apply button state)
```

## 6.3 Error handling for ineligible access

If `getDriveDetail()` throws `AuthorizationError` (student accessed an
ineligible drive by typing the URL directly), catch it and render a
"You are not eligible for this drive" page with a Back button.

```typescript
// In the server component:
import { notFound } from 'next/navigation';

try {
  drive = await getDriveDetail(params.id);
} catch (error) {
  if (error instanceof AuthorizationError) {
    // Render ineligible page, not a 404
    return <IneligibleDrivePage />;
  }
  notFound(); // Drive doesn't exist
}
```

## 6.4 Eligibility checklist

Show a visual checklist comparing the student's academic profile against
the drive's eligibility criteria. Use `getIneligibilityReasons()` to
derive the list of failed criteria.

```
✓ CGPA: 8.4 ≥ 7.5 (required)       ← green teal check
✓ Active backlogs: 0 ≤ 0 (allowed)  ← green teal check
✓ Department: CSE (eligible)         ← green teal check
✓ Drive open: Deadline 2026-09-18   ← green teal check
```

If the student somehow passes the server check but has marginal criteria,
show amber warnings rather than green checks for borderline items.

## 6.5 Apply section (`components/drives/apply-section.tsx`)

This is the **only** client component on the detail page. It handles
the apply button state machine.

```typescript
'use client';

interface ApplySectionProps {
  driveId: string;
  driveStatus: 'open' | 'closed';
  hasApplied: boolean;
  applyMethod: 'IN_APP' | 'EXTERNAL';
  externalApplyUrl?: string;
}
```

State machine:

```
State: idle
  → if hasApplied: show "✓ Applied" chip (no action)
  → if driveStatus === 'closed': show "Applications Closed" (no action)
  → if applyMethod === 'EXTERNAL': show "Apply on Company Website ↗" link
  → if applyMethod === 'IN_APP' and !hasApplied and open:
      show "Apply Now" button → onClick → open confirmation dialog

State: confirm (dialog open)
  → shadcn AlertDialog
  → Title: "Confirm Application"
  → Body: "You are about to apply to {roleName} at {companyName}.
           Applications are final — you cannot withdraw or edit after submitting."
  → Buttons: [Cancel] [Confirm & Submit]
  → Confirm → State: submitting

State: submitting
  → call applyToDrive(driveId) server action via useTransition
  → show loading spinner on button
  → on success: show "✓ Applied" chip, call router.refresh()
  → on error: show error toast, return to idle
```

**Important:** The confirmation dialog body must include the text
"Applications are final — you cannot withdraw or edit after submitting."
This is a V1 constraint per `project-overview.md`.

## 6.6 `ApplicationReviewModal` — NOT PORTED IN V1

The full `ApplicationReviewModal.jsx` from the temp frontend is a complex
component with:
- Resume selection from multiple saved resumes
- Editable profile fields (name, phone, links) before submitting
- Custom drive fields configured by admin

In V1:
- Resume management is out of scope (resume builder deferred)
- Application custom fields are out of scope (no `applicationFields` UI yet)
- Applications are immutable — editing before submit is removed

**Replace `ApplicationReviewModal` with the simple `ApplySection` (§6.5).**
The confirmation dialog shows the locked institutional details (CGPA, roll number,
backlogs) as a read-only summary before the student confirms, but does not
allow editing anything.

The confirmation dialog body:
```
Applying to: {roleName} at {companyName}
Drive date: {driveDate formatted}
Deadline: {applicationDeadline formatted}

Your application will include:
• CGPA: {student.academic.currentCGPA}
• Active backlogs: {student.academic.activeBacklogs}
• Department: {student.department.name}

Applications are final — you cannot withdraw or edit after submitting.
```

---

# 7. MY APPLICATIONS PAGE

## 7.1 Target file

`app/(student)/student-dashboard/applications/page.tsx` (NEW FILE)

Create directory: `app/(student)/student-dashboard/applications/`

## 7.2 Architecture

```
ApplicationsPage (Server Component)
  ├── calls requireStudent() → { user, student }
  ├── reads search params: ?page=1
  ├── calls getMyApplications(student.id, page, pageSize=25)
  │     → PaginatedApplications { data: ApplicationWithDrive[], page, pageSize, totalCount }
  ├── for each application: calls getDriveStatus(app.drive.applicationDeadline)
  └── renders:
      ├── Page header
      ├── ApplicationsTable or ApplicationCardList
      └── Pagination
```

## 7.3 Application list UI

Show applications in a table (`.table-wrap`) with these columns:

| Column | Value |
|---|---|
| Company | `application.drive.companyName` |
| Role | `application.drive.roleName` |
| Package | `application.drive.packageDisplay` or formatted `packageOffered` |
| Applied on | `application.appliedAt` formatted as date |
| Drive date | `application.drive.driveDate` formatted |
| Drive status | `getDriveStatus(application.drive.applicationDeadline)` → "Open" or "Closed" badge |
| Action | "View drive →" link to `/student-dashboard/drives/{driveId}` |

Show snapshot values in a tooltip or sub-row if desired:
"Applied with CGPA {snapshotCgpa}" — these come from the new `snapshotCgpa`
and `snapshotBacklogs` fields added in §3.2.

## 7.4 Empty state

When `totalCount === 0`:
```
🗂  No applications yet.
Browse eligible drives and apply to get started.
[Browse Drives →]  ← links to /student-dashboard/drives
```

## 7.5 Application card (mobile-friendly alternative)

Optionally, below the table for each application show a simplified card
version for mobile. This is optional — implement the table first.

---

# 8. UPDATE STUDENT DASHBOARD (FE-02 KPI WIRING)

In FE-02, the student dashboard had two placeholder KPIs:
- "Eligible Drives: 0 — Available soon"
- "Applications Submitted: 0"

Now that drives and applications are implemented, wire them:

In `app/(student)/student-dashboard/page.tsx`, add two additional server calls:

```typescript
// Count eligible open drives
const eligibleDrivesResult = await getEligibleDrives({ status: 'open', pageSize: 1 });
const eligibleDrivesCount = eligibleDrivesResult.totalCount;

// Count submitted applications
const applicationsResult = await getMyApplications(student.id, 1, 1);
const applicationsCount = applicationsResult.totalCount;
```

Update the KPI cards:
- "Eligible Drives" → `eligibleDrivesCount`, clicking → `/student-dashboard/drives`
- "Applications Submitted" → `applicationsCount`, clicking → `/student-dashboard/applications`

---

# 9. `lib/drive-date-helpers.ts` — REPLACE `driveUtils.js`

The temp frontend's `driveUtils.js` uses a hardcoded `DEMO_TODAY` constant.
The real project has `features/drives/utils/drive-status.ts` with `getDriveStatus()`,
`isDriveOpen()`, `getDaysUntilDeadline()` — all using real `new Date()`.

For any formatting needs in UI components (not covered by the existing utils),
create `lib/drive-date-helpers.ts` with client-safe pure functions:

```typescript
// Format application deadline for display
export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Format drive date for display
export function formatDriveDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Format relative deadline (e.g. "3 days left" or "2 hours left")
export function formatDeadlineRelative(deadline: Date): string {
  const daysLeft = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft <= 0) return 'Deadline passed';
  if (daysLeft === 1) return '1 day left';
  if (daysLeft <= 7) return `${daysLeft} days left`;
  return formatDeadline(deadline);
}
```

Do NOT use `DEMO_TODAY` anywhere. Delete it if it appears anywhere during porting.

---

# 10. NEW FILES TO CREATE

```
app/(student)/student-dashboard/drives/
  ├── page.tsx                       ← drives catalogue page (server)
  └── [id]/
      └── page.tsx                   ← drive detail page (server)

app/(student)/student-dashboard/applications/
  └── page.tsx                       ← my applications page (server)

components/drives/
  ├── drive-card.tsx                 ← ported DriveCard (adapted for V1)
  ├── drives-filter-bar.tsx         ← client filter pills component
  ├── drives-grid.tsx               ← client grid + pagination wrapper
  └── apply-section.tsx             ← client apply button + confirmation

lib/
  └── drive-date-helpers.ts          ← formatting utilities (no DEMO_TODAY)
```

Files to **update** (not create):

```
app/(student)/student-dashboard/page.tsx
  └── wire eligibleDrivesCount and applicationsCount KPIs

features/applications/actions/apply-to-drive.ts
  └── add snapshotCgpa + snapshotBacklogs to driveApplication.create()

prisma/schema.prisma
  └── schema additions from §3.1 and §3.2
```

---

# 11. WHAT NOT TO DO

- Do NOT port `WithdrawModal.jsx` — withdrawal is out of V1 scope
- Do NOT implement application editing — applications are immutable in V1
- Do NOT implement application stage tracking (stepper, stage labels)
- Do NOT implement `ApplicationReviewModal` with resume selection and editable
  fields — replace with the simple `ApplySection` confirmation dialog (§6.5)
- Do NOT use `DEMO_TODAY` — use real `new Date()` via existing drive-status utils
- Do NOT compute eligibility client-side — `getEligibleDrives()` already filters
  server-side; DriveCard receives eligible drives only
- Do NOT store drive status anywhere — always compute with `getDriveStatus()`
- Do NOT fetch all drives and filter client-side — use `getEligibleDrives()` with
  server-side filtering
- Do NOT implement admin drives management — that is FE-06
- Do NOT implement any notifications page — that is FE-04
- Do NOT use `drive.stepper`, `drive.stage`, `drive.stageLabel` — these are mock
  fields not present in the Prisma schema
- Do NOT allow a second application to the same drive — `applyToDrive()` already
  prevents this at both the application and database level

---

# 12. TYPESCRIPT RULES

- All new files: `.tsx` or `.ts`, strict mode, no `any`
- `Drive` type from Prisma — import from `@prisma/client`
- `DriveStatus` type from `features/drives/utils/drive-status.ts`
- Use `@/` alias for all imports
- `getDriveStatus()`, `isDriveOpen()`, `getDaysUntilDeadline()` — import from
  `@/features/drives/utils/drive-status` (not re-implemented inline)
- `getIneligibilityReasons()` — import from `@/features/drives/queries/drive-eligibility`
- `applyToDrive()` — imported directly in the `ApplySection` client component
  (Next.js supports calling server actions from client components)
- Use `useTransition` + `startTransition` for all server action calls in
  client components — the same pattern as FE-02

---

# 13. VERIFICATION

Run in order after all implementation:

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test          # all existing tests must still pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Drives catalogue
- [ ] Page loads at `/student-dashboard/drives`
- [ ] Student identity card shows correct name, department, CGPA, roll number
- [ ] KPI pills: Profile completion %, no readiness/resume score shown
- [ ] "Edit profile" button links to `/student-dashboard/profile`
- [ ] Drive cards render for eligible drives (or empty state if none)
- [ ] Each drive card shows company, role, package, min CGPA, drive date,
      deadline badge, eligible departments
- [ ] Status badge: "Open" / "⏰ Xd left" / "Closed" — computed from deadline
- [ ] "✓ Eligible" badge shown on all cards (server only returns eligible drives)
- [ ] Filter pill "Open" shows only open drives
- [ ] Filter pill "Applied" shows drives the student has applied to
- [ ] Filter pill "Closed" shows drives with passed deadline
- [ ] Pagination works when `totalCount > 25`
- [ ] Expandable panel shows JD link, rounds, venue, logistics

### Drive detail page
- [ ] Page loads at `/student-dashboard/drives/{validDriveId}`
- [ ] Navigating to an ineligible drive's ID shows "Not eligible" page, not 404
- [ ] Eligibility checklist shows CGPA, backlogs, department checks
- [ ] All green checks for an eligible student
- [ ] "Apply Now" button visible for open, unnapplied drives
- [ ] Clicking "Apply Now" opens confirmation dialog with drive summary
- [ ] Dialog body includes "Applications are final — you cannot withdraw or
      edit after submitting"
- [ ] "Cancel" dismisses dialog, no application created
- [ ] "Confirm & Submit" calls `applyToDrive()`, shows success toast
- [ ] After successful apply: button replaced with "✓ Applied" chip
- [ ] Applying twice is rejected — show error toast "Already applied"
- [ ] For a closed drive: "Applications Closed" shown, no Apply button
- [ ] For external apply method: "Apply on Company Website ↗" link shown

### My Applications page
- [ ] Page loads at `/student-dashboard/applications`
- [ ] Empty state shown for new students with no applications
- [ ] After applying to a drive, application appears in the list
- [ ] Table shows company, role, applied date, drive status, snapshot CGPA
- [ ] Drive status badge shows "Open"/"Closed" correctly based on deadline
- [ ] "View drive →" link navigates to the drive detail page
- [ ] Pagination works

### Dashboard KPI wiring
- [ ] Student dashboard KPI "Eligible Drives" shows real count (not 0)
- [ ] Student dashboard KPI "Applications Submitted" shows real count
- [ ] Both KPIs update after applying to a drive (re-visit dashboard)

---

# 14. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-03 complete
- Schema migration: `frontend-drive-fields` applied
- `Drive` model extended with `companyLogoUrl`, `packageDisplay`, `venue`,
  `reportingTime`, `contactPerson`, `contactPhone`, `pptLink`, `applicationFields`
- `DriveApplication` model extended with `snapshotCgpa`, `snapshotBacklogs`
- `apply-to-drive.ts` updated to snapshot academic standing
- Drives catalogue page created, wired to `getEligibleDrives()`
- `DriveCard` component ported with V1 constraints (no stepper, no withdraw,
  no edit, status computed from deadline)
- Drive detail page created, `ApplySection` with confirmation dialog
- My Applications page created, wired to `getMyApplications()`
- Dashboard KPIs wired with real counts
- `lib/drive-date-helpers.ts` created
- All tests still passing
- Build passing

Set next unit: **FE-04 — Notifications Page**

---

# 15. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Notifications page (FE-04)
- Admin student roster (FE-05)
- Admin drives management (FE-06)
- Excel bulk import (FE-07)
- Super admin pages (FE-08)

The next unit is **FE-04**.

---

# FINAL REPORT

When finished, provide a summary covering:

## Schema
- Fields added to `Drive`
- Fields added to `DriveApplication`
- Migration name and status

## Backend Updates
- `apply-to-drive.ts`: snapshot fields added
- Any other changes to existing server actions or queries

## Drives Catalogue
- Data wired
- Filter behavior
- Mock data removed (DEMO_TODAY deleted)

## DriveCard
- V1 constraints applied (list exactly what was removed)
- Field mapping from temp → Prisma
- Status computation

## Drive Detail Page
- Eligibility check flow
- ApplySection state machine
- Confirmation dialog content

## My Applications Page
- Data wired
- Table columns

## Dashboard KPI Update
- Count queries added

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (test count)
- `npm run build` result

## Open Questions
Any ambiguities resolved and how.

## Scope Confirmation
Explicitly confirm:
**WithdrawModal was not ported. ApplicationReviewModal (full version) was not
ported. No application editing or stage tracking was implemented. No admin
pages were touched. Drive status is computed — never stored.**
