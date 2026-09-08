# CampusHire — Frontend Integration Guide

> **Purpose:** This document is the single authoritative reference for integrating the
> `campushire_frontend (temp)` React/Vite SPA into the existing Next.js project.
> It covers every architectural decision, every file that needs to change, every
> backend/database adjustment, and the step-by-step execution order.
>
> **Rule:** Do not begin implementation until you have read this document fully.
> Work through phases in the order listed. Do not skip a phase or combine two phases
> into one step.

---

## Table of Contents

1. [Situation Summary](#1-situation-summary)
2. [Architecture Comparison — What Needs to Change](#2-architecture-comparison--what-needs-to-change)
3. [Design System Alignment](#3-design-system-alignment)
4. [Database & Schema Changes Required](#4-database--schema-changes-required)
5. [Backend Changes Required](#5-backend-changes-required)
6. [Scope Decisions — What to Keep, Adapt, or Discard from the Temp Frontend](#6-scope-decisions--what-to-keep-adapt-or-discard-from-the-temp-frontend)
7. [Next.js Route Structure — Final Target](#7-nextjs-route-structure--final-target)
8. [Component Migration Map](#8-component-migration-map)
9. [Auth Integration — Replacing JWT with Clerk](#9-auth-integration--replacing-jwt-with-clerk)
10. [State Management Strategy](#10-state-management-strategy)
11. [Phase-by-Phase Execution Plan](#11-phase-by-phase-execution-plan)
12. [File-by-File Migration Reference](#12-file-by-file-migration-reference)
13. [Features Deferred / Out of Scope for V1](#13-features-deferred--out-of-scope-for-v1)
14. [Verification Checklist](#14-verification-checklist)

---

## 1. Situation Summary

### The Temp Frontend

`campushire_frontend (temp)` is a fully-built **React 18 + Vite SPA** containing:

- **24 pages** across 4 roles (Public, Student, Admin, Super Admin)
- **10+ reusable UI primitives** (Button, Badge, Modal, DatePicker, TagInput, Gauge, ProgressBar, etc.)
- **Role-based routing** via React Router v6 + `ProtectedRoute`
- **Mock data layer** (`src/data/`) and API service stubs (`src/api/`) documented with JSDoc
- **Complete CSS design system** (`src/styles/tokens.css`) — same tokens as the Next.js project's `ui-context.md`
- **`AppStateContext`** — a localStorage-backed fake persistence layer replacing real API calls

### The Target Project

The Next.js project already has:

- **Completed backend** (Units 01–10): database schema, Prisma models, server actions, auth (Clerk), notifications, audit logs — all tested
- **Minimal placeholder pages** in `app/` route groups
- **`app/globals.css`** with the same design tokens as `tokens.css`
- **`features/`** folder with all business logic, server actions, and queries

### The Goal

Replace the placeholder Next.js pages with the fully-designed UI from the temp frontend.
The temp frontend's **visual components and page layouts** are the goal.
The Next.js project's **server actions, Prisma queries, Clerk auth, and middleware** are the integration target — they replace all of the temp frontend's mock data and JWT auth entirely.

---

## 2. Architecture Comparison — What Needs to Change

| Concern | Temp Frontend (React/Vite SPA) | Next.js Project (Target) | What Changes |
|---|---|---|---|
| **Framework** | React 18 + Vite, SPA | Next.js 15+, App Router, SSR/RSC | All page files converted from `.jsx` to `.tsx`, move from React Router routes to `app/` file-based routing |
| **Auth** | `AuthContext` + JWT in `localStorage`, mock role-detection by email string | **Clerk** — session cookie, OTP email verification, role in user metadata | Remove `AuthContext`, `LoginPage` form logic, `OtpVerificationPage` logic. Replace with Clerk components (`<SignIn>`, `<SignUp>`) and `lib/auth.ts` helpers |
| **Routing** | `src/routes/paths.js` → React Router `<Routes>` | Next.js `app/` directory, route groups `(student)`, `(admin)`, `(super-admin)` | Map all PATHS constants to Next.js file paths (see §7) |
| **Route Protection** | `<ProtectedRoute allowedRoles={[...]}>` wrapping each route | `middleware.ts` (role-based redirect) + server-side role check in each page | Remove `ProtectedRoute` component. Middleware already handles this. |
| **Data Fetching** | `AppStateContext` (localStorage mock) + `src/api/*.js` service stubs | **Server Actions** in `features/` + `React.use()` / `useTransition` for client mutations | Replace every `TODO(real-data)` call site with the matching server action or query |
| **API Layer** | `src/api/client.js` (fetch wrapper, Bearer token) | No REST client needed — server actions run server-side | Delete `src/api/*.js` entirely. Wire pages to `features/` server actions. |
| **Styling** | `src/styles/*.css` — pure CSS custom properties, class-based | Tailwind CSS + `app/globals.css` CSS variables (same token values) | Migrate CSS classes to Tailwind utilities. Keep CSS variables as-is (tokens are identical). |
| **Icons** | `lucide-react` | `lucide-react` (same library — no change needed) | ✅ No change |
| **State** | `AppStateContext` (fake persistence) + `ToastContext` | Server Components (no state for read) + `useTransition` / shadcn `toast` | `AppStateContext` deleted. `ToastContext` replaced with shadcn/ui `useToast` |
| **TypeScript** | JavaScript (`.jsx`) | TypeScript strict mode (`.tsx`) | Add types to all ported components |
| **File Upload** | Client-side drag/drop UI only | `app/api/students/profile-photo/route.ts` (Vercel Blob) already exists | Wire existing upload API route to the DriveCard/Excel UI components |

---

## 3. Design System Alignment

The two design systems use **identical token values**. This is the best-case scenario — no visual redesign needed.

### Token Comparison

| Token | `tokens.css` (Temp) | `globals.css` (Next.js) | Match? |
|---|---|---|---|
| `--surface-0` | `#FAF9F5` | `#FAF9F5` | ✅ |
| `--surface-1` | `#F1EFE7` | `#F1EFE7` | ✅ |
| `--surface-2` | `#FFFFFF` | `#FFFFFF` | ✅ |
| `--text-primary` | `#1C1C1A` | `#1C1C1A` | ✅ |
| `--accent` | `#D85A30` | `#D85A30` | ✅ |
| `--teal`, `--amber`, `--red`, `--purple` | All match | All match | ✅ |
| `--radius`, `--radius-lg` etc. | Defined | Defined | ✅ |
| `--sidebar-width` | `220px` | `220px` | ✅ |

### What This Means

- All `var(--token)` references in ported components **work as-is** without changes.
- Do **not** convert CSS variable references to Tailwind hardcoded values.
- Do **not** add a new token that isn't already in `app/globals.css`. If the ported
  component uses a token not yet in `globals.css`, add it there first.
- The temp frontend's CSS files (`tokens.css`, `base.css`, `layout.css`, `forms-buttons.css`,
  `components.css`, `datepicker.css`) should be **reviewed and merged** into `app/globals.css`
  for any class-based styles that are referenced in the ported JSX components.

### Tailwind vs Pure CSS

The temp frontend uses class-based CSS (e.g. `.drive-card`, `.btn`, `.badge-green`).
The Next.js project uses Tailwind utilities.

**Strategy:** Do a **hybrid approach**:
1. Keep CSS variable references (`var(--accent)`) as Tailwind arbitrary values: `bg-[var(--accent)]`
2. For complex component classes (`.drive-card`, `.profile-tab`, `.stepper`), copy the CSS
   rules into `app/globals.css` under a `@layer components { }` block. This keeps them
   globally available and avoids rewriting every class with Tailwind utilities.
3. Layout primitives (flex, grid, padding, margin) can use Tailwind directly.
4. Never hardcode hex values — always use `var(--token)` or its Tailwind equivalent.

---

## 4. Database & Schema Changes Required

The Next.js project's Prisma schema is very close to what the temp frontend expects, but
there are gaps. These are the required changes before any UI work starts.

### 4.1 Changes Required for V1 Scope

#### A. `Drive` Model — Add Missing Fields

The temp frontend's `DriveCard` and `PostDrivePage` use fields not present in the current schema:

```prisma
// ADD to Drive model in prisma/schema.prisma:

model Drive {
  // ... existing fields ...

  // Missing fields needed by temp frontend UI:
  companyLogoUrl    String?          // Company logo for DriveCard avatar
  ctcBreakdown      Json?            // { base, variable, stocks } — displayed in DriveCard
  roundsDescription String?          // "Aptitude → Tech → HR" — displayed in drive detail
  applyMethod       ApplyMethod      // INTERNAL | EXTERNAL — already exists as enum? confirm
  applyUrl          String?          // External career portal link (only if applyMethod = EXTERNAL)
  
  // Drive logistics — the temp frontend has AdminDriveLogisticsPanel
  // These are needed for admin to configure venue, reporting time, PPT link
  venue             String?          // On-campus venue or "Online"
  reportingTime     String?          // "08:30 AM"
  contactPerson     String?          // Name of POC
  contactPhone      String?          // Phone number of POC
  pptLink           String?          // Pre-Placement Talk virtual meeting URL
  
  // Custom application fields config — the temp frontend has AdminApplicationFieldsPanel
  // These define which student fields are required when applying
  applicationFields Json?            // Array of { fieldKey, fieldLabel, isRequired, isEnabled }
}
```

> **Note on existing schema:** Confirm which fields already exist before adding.
> Run `npx prisma studio` or read `prisma/schema.prisma` to check current state.
> Add only the truly missing fields.

#### B. `Student` Model — Add Missing Fields

The temp frontend's profile pages and student data display use:

```prisma
// ADD to Student model in prisma/schema.prisma:

model Student {
  // ... existing fields ...

  // The temp frontend displays/edits these — confirm if any are missing:
  gender         String?      // "Male" | "Female" | "Other" | "Prefer not to say"
  dateOfBirth    DateTime?    // DOB for profile personal info tab
  address        String?      // Address field in personal info
  
  // Batch year — needed for roster filtering and reports
  batchYear      Int?         // e.g. 2026 — graduation year
  
  // Placement tracking fields — needed for admin roster + super admin reports
  placementStatus  String  @default("unplaced")  // "unplaced" | "placed" | "opted_out"
  placedCompany    String?    // Company name if placed
  placedPackage    String?    // Package string if placed
}
```

#### C. `StudentAcademic` Model — Semester-wise SGPA

The temp frontend shows semester-by-semester SGPA in the academic profile tab:

```prisma
// ADD new model in prisma/schema.prisma:

model SemesterMark {
  id         String   @id @default(cuid())
  studentId  String
  semester   Int      // 1, 2, 3, 4, 5, 6, 7, 8
  sgpa       Decimal  @db.Decimal(4, 2)
  
  student    Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  @@unique([studentId, semester])
}

// Also ADD to Student model:
semesterMarks  SemesterMark[]
```

> **If this is out of scope for V1:** The academic tab can still work without per-semester
> SGPA — just show overall CGPA, 10th, 12th as the existing `StudentAcademic` model has.
> Add semester marks in a later unit.

#### D. `Notification` Model — Already Exists (Unit 10)

The `Notification` model is complete. No changes needed. ✅

#### E. `AuditLog` Model — Already Exists (Unit 09)

The `AuditLog` model is complete. No changes needed. ✅

#### F. `Drive` — Confirm `applicationDeadline` Field Name

The temp frontend refers to `deadline`, `driveDeadlineRaw`, `deadline_date` interchangeably.
Your schema uses `applicationDeadline`. When porting DriveCard and related components,
standardize on `applicationDeadline` from the Prisma schema. Do not add duplicate fields.

#### G. Application Snapshot Fields

The temp frontend stores a snapshot of CGPA and backlogs at application time
(`snapshot_cgpa`, `snapshot_backlogs`). This is good practice. Check if
`DriveApplication` in your schema already captures this, and if not, add:

```prisma
// ADD to DriveApplication model:
snapshotCgpa     Decimal?   @db.Decimal(4, 2)   // CGPA at time of application
snapshotBacklogs Int?                             // Active backlogs at time of application
```

### 4.2 No-Change Items (Already Correct in Your Schema)

- `User` model with `clerkId`, `email`, `role` — ✅
- `Department` model with `name`, `code`, `isActive` — ✅
- `DepartmentAdmin` (many admins per department) — ✅
- `StudentAcademic` (10th, 12th, CGPA, semester, backlogs) — ✅
- `StudentSkill`, `StudentProject`, `StudentExperience`, `StudentCertification`, `StudentPreferences` — ✅
- `Drive` base fields (company, role, JD, minCgpa, maxBacklogs, eligibleDepts, driveDate, deadline) — ✅
- `DriveApplication` with unique `(studentId, driveId)` — ✅
- `Notification` — ✅
- `AuditLog` — ✅

### 4.3 Migration Plan

1. Update `prisma/schema.prisma` with all additions listed in §4.1
2. Run `npx prisma validate` — must pass with zero errors
3. Run `npx prisma migrate dev --name "frontend-integration-schema"` against Neon
4. Run `npx prisma generate`
5. Run `npx tsc --noEmit` — must pass
6. Run `npm run test` — all existing tests must still pass

---

## 5. Backend Changes Required

### 5.1 New Server Actions Needed

These server actions do not yet exist in `features/` and are needed by the ported UI:

#### `features/drives/actions/`

| Action File | What It Does | Called By |
|---|---|---|
| `create-drive.ts` | Create a new drive (dept admin scoped) | `PostDrivePage` / Create Drive Form |
| `update-drive.ts` | Edit an existing drive (dept admin, within their dept) | Edit Drive Form |
| `get-department-drives.ts` | Paginated list of drives for admin's dept | `AdminHomePage`, Drive Table |

#### `features/students/actions/`

| Action File | What It Does | Called By |
|---|---|---|
| `add-student-manual.ts` | Manually add a single student (dept admin) | `AddStudentPage` |

#### `features/departments/actions/`

| Action File | What It Does | Called By |
|---|---|---|
| `create-department.ts` | Create a new department (super admin) | Department Management Page |
| `update-department.ts` | Edit department name, code (super admin) | Department Management Page |
| `toggle-department-status.ts` | Activate / deactivate a department | Department Management Page |

#### `features/admin-accounts/actions/`

| Action File | What It Does | Called By |
|---|---|---|
| `create-admin-account.ts` | Create a Clerk account + DepartmentAdmin record | Admin Accounts Page |
| `remove-admin-account.ts` | Revoke admin access (delete DepartmentAdmin record) | Admin Accounts Page |

### 5.2 New Queries Needed

#### `features/drives/queries/`

| Query File | What It Returns | Used By |
|---|---|---|
| `get-available-drives.ts` | Drives the authenticated student is eligible for (paginated) | Student `HomePage` (drives catalogue) |
| `get-drive-by-id.ts` | Single drive details | Drive Detail Page |
| `get-department-drives.ts` | All drives for admin's dept (paginated) | Admin drive management |
| `get-drive-applications.ts` | All applications for a specific drive (paginated, dept admin scoped) | Drive Applications Page |

#### `features/students/queries/`

| Query File | What It Returns | Used By |
|---|---|---|
| `get-department-students.ts` | Paginated, searchable student roster scoped to dept | `AdminDashboardPage` |
| `get-student-detail.ts` | Single student full profile (dept admin view) | Student Details Modal |

#### `features/departments/queries/`

| Query File | What It Returns | Used By |
|---|---|---|
| `get-departments.ts` | All departments with stats (student count, admin count, drive count) | Super Admin departments page |
| `get-department-detail.ts` | Single department with full stats | Department detail page |

#### `features/admin-accounts/queries/`

| Query File | What It Returns | Used By |
|---|---|---|
| `get-department-admins.ts` | All DepartmentAdmin records with user info (super admin) | Admin Accounts Page |

#### `features/super-admin/queries/`

| Query File | What It Returns | Used By |
|---|---|---|
| `get-system-stats.ts` | Total students, departments, admins, placement % | Super Admin Dashboard KPIs |
| `get-department-matrix.ts` | Per-dept aggregate stats (student count, avg CGPA, placed count, rate) | Super Admin Dashboard + Global Reports |

### 5.3 Existing Items That Need Extension

#### `features/applications/actions/apply-to-drive.ts`

Currently applies to a drive but does not capture `snapshotCgpa` and `snapshotBacklogs`.
Update to snapshot academic standing at application time (once §4.1G migration is done).

#### `features/students/queries/get-profile.ts`

Extend to return the new fields added in §4.1B (`gender`, `dateOfBirth`, `address`,
`batchYear`, `placementStatus`, `placedCompany`, `placedPackage`) and the new
`SemesterMark` relation (if added).

#### `features/notifications/` (Unit 10)

Already complete — no changes. The `NotificationBell` and `NotificationsPage` components
from the temp frontend should be wired to the existing notification queries/actions.

### 5.4 API Route Handlers (Not Server Actions)

Only keep route handlers where a REST endpoint is genuinely needed. There are two:

| Route | Already Exists? | Notes |
|---|---|---|
| `app/api/students/profile-photo/route.ts` | ✅ Yes | Vercel Blob upload — wire to profile photo UI |
| `app/api/webhooks/clerk/route.ts` | ✅ Yes | Clerk webhook — no changes needed |

The temp frontend's `src/api/client.js` and all `src/api/*.js` service stubs are
**deleted entirely** — they are replaced by server actions in `features/`.

---

## 6. Scope Decisions — What to Keep, Adapt, or Discard from the Temp Frontend

### 6.1 Keep (Direct Port, Adapt to Next.js/TypeScript)

All of these exist in the temp frontend and are in V1 scope:

| Screen / Component | Temp Frontend Path | Target Path |
|---|---|---|
| Landing Page | `pages/public/LandingPage.jsx` | `app/page.tsx` |
| Sign In | `pages/public/LoginPage.jsx` | `app/(auth)/sign-in/[[...sign-in]]/page.tsx` |
| Sign Up / Register | `pages/public/RegisterPage.jsx` | `app/(auth)/sign-up/[[...sign-up]]/page.tsx` |
| OTP Verification | `pages/public/OtpVerificationPage.jsx` | Handled by Clerk's built-in OTP — no custom page |
| Student Dashboard | `pages/student/StudentDashboardPage.jsx` | `app/(student)/student-dashboard/page.tsx` |
| Student Drives Home | `pages/student/HomePage.jsx` | `app/(student)/student-dashboard/drives/page.tsx` |
| Student Profile | `pages/student/StudentProfilePage.jsx` | `app/(student)/student-dashboard/profile/page.tsx` |
| Notifications | `pages/student/NotificationsPage.jsx` | `app/notifications/page.tsx` |
| Settings | `pages/student/SettingsPage.jsx` | `app/(student)/student-dashboard/settings/page.tsx` |
| Admin Home | `pages/admin/AdminHomePage.jsx` | `app/(admin)/admin-dashboard/page.tsx` |
| Admin Student Roster | `pages/admin/AdminDashboardPage.jsx` | `app/(admin)/admin-dashboard/students/page.tsx` |
| Add Student (Manual) | `pages/admin/AddStudentPage.jsx` | `app/(admin)/admin-dashboard/students/add/page.tsx` |
| Excel Upload | `pages/admin/ExcelUploadPage.jsx` | `app/(admin)/admin-dashboard/students/import/page.tsx` |
| Post Drive | `pages/admin/PostDrivePage.jsx` | `app/(admin)/admin-dashboard/drives/new/page.tsx` |
| Drive Management | *(admin table, adapt from PostDrivePage)* | `app/(admin)/admin-dashboard/drives/page.tsx` |
| Announcements | `pages/admin/AnnouncementsPage.jsx` | `app/(admin)/admin-dashboard/announcements/page.tsx` |
| Reports & Analytics | `pages/admin/ReportsAnalyticsPage.jsx` | `app/(admin)/admin-dashboard/reports/page.tsx` |
| Super Admin Dashboard | `pages/superadmin/SuperAdminDashboardPage.jsx` | `app/(super-admin)/super-admin-dashboard/page.tsx` |
| Department Management | `pages/superadmin/DepartmentManagementPage.jsx` | `app/(super-admin)/super-admin-dashboard/departments/page.tsx` |
| Admin Accounts | `pages/superadmin/AdminAccountsPage.jsx` | `app/(super-admin)/super-admin-dashboard/admins/page.tsx` |
| Global Reports | `pages/superadmin/GlobalReportsPage.jsx` | `app/(super-admin)/super-admin-dashboard/reports/page.tsx` |
| Audit Log | `pages/superadmin/AuditLogPage.jsx` | `app/(super-admin)/audit-logs/page.tsx` |
| Super Admin Students | `pages/superadmin/SuperAdminStudentsPage.jsx` | `app/(super-admin)/super-admin-dashboard/students/page.tsx` |
| Super Admin Drives | `pages/superadmin/SuperAdminDrivesPage.jsx` | `app/(super-admin)/super-admin-dashboard/drives/page.tsx` |
| System Settings | `pages/superadmin/SystemSettingsPage.jsx` | `app/(super-admin)/super-admin-dashboard/settings/page.tsx` |
| Not Found | `pages/public/NotFoundPage.jsx` | `app/not-found.tsx` |

### 6.2 Adapt (Change UI to Match V1 Constraints)

These exist in the temp frontend but need behavioral changes to match the V1 spec:

| Feature | Temp Frontend Behavior | V1 Required Behavior | Change Needed |
|---|---|---|---|
| **Application Withdrawal** | `WithdrawModal.jsx` exists — students can withdraw | **V1: Applications are immutable — no withdrawal** | Remove `WithdrawModal` from DriveCard. Remove "Withdraw" button. Application is final once submitted. |
| **Drive Status** | `drive_status` enum stored in DB (`Draft`, `Upcoming`, `Open`, `In_Progress`, `Closed`, `Archived`) | **V1: Status is computed from `applicationDeadline` — never stored** | DriveCard should compute status with `getDriveStatus()` from `lib/`. Do not read a `status` field from the drive. |
| **Application Stages** | Shows `currentStage` (Applied, Technical Interview, HR, etc.) | **V1: No stage tracking** — application is created and that's it | Remove `stepper` / `stageLabel` / `currentStage` from DriveCard UI. Show only "Applied" state. Stage tracking is out of scope for V1. |
| **Drive Type: Central** | `SuperAdminDrivesPage` posts "Central Institutional Drives" across all depts | **V1: Only dept admins post drives** — super admin oversight only, no drive posting | Remove the "Post Central Drive" button/flow. Super Admin drives page shows read-only view of all drives across all departments. |
| **Announcements** | `AnnouncementsPage` posts dept announcements | **V1: Notifications are in-app only** (Unit 10 is complete) — no separate announcements model in the schema | Wire this page to the existing `Notification` system. An "announcement" is a notification targeted at a department. Or defer the admin announcements UI to a later unit. |
| **Login / Register** | Custom forms in `LoginPage.jsx` and `RegisterPage.jsx` | **Clerk** handles all auth UI with built-in components | Do not port the login/register form logic. Use Clerk's `<SignIn>` and `<SignUp>` components in the existing `(auth)` route group. Keep only the visual layout/wrapper from the temp frontend pages. |
| **OTP Verification** | `OtpVerificationPage.jsx` with hardcoded code `528914` and auto-fill button | **Clerk handles OTP natively** — built into Clerk's `<SignUp>` flow | Do not port this page. Clerk's sign-up handles email verification. |
| **Reset Password** | 3-step client-side state machine, no real email | **Clerk handles password reset** | Do not port `ResetPasswordPage.jsx`. Clerk has a built-in forgot password flow. |

### 6.3 Discard (Out of V1 Scope — Do Not Port)

These exist in the temp frontend but are explicitly out of V1 scope per `project-overview.md`:

| Feature | Temp Frontend File | Why Discarded |
|---|---|---|
| **Resume Builder** | `pages/student/ResumeBuilderPage.jsx` | Out of V1 scope — deferred |
| **AI Analyzer** | `pages/student/AiAnalyzerPage.jsx` | Out of V1 scope — deferred |
| **Self Assessment** | `pages/student/SelfAssessmentPage.jsx` | Out of V1 scope — readiness score/self-assessment deferred |
| **Readiness Dashboard** | `pages/student/ReadinessDashboardPage.jsx` | Out of V1 scope — readiness score deferred |
| **Readiness Circular Gauge** | `components/ui/Gauge.jsx` | Only used by deferred pages — skip |
| **`AppStateContext`** | `src/context/AppStateContext.jsx` | Entirely replaced by server actions + real data |
| **`AuthContext`**  | `src/context/AuthContext.jsx` | Replaced by Clerk — delete entirely |
| **`src/api/*.js`** | All files in `src/api/` | Replaced by Next.js server actions in `features/` |
| **`src/data/mockData.js`** | Mock data file | All replaced by real Prisma queries |
| **`src/data/driveStore.js`** | Mock drive data | Replaced by real drive queries |
| **`utils/driveUtils.js` `DEMO_TODAY`** | Fake date constant | Replace with `new Date()` in date helpers |

---

## 7. Next.js Route Structure — Final Target

Below is the complete file-based route structure after integration. New files are marked
with `[NEW]`. Existing placeholder files that need replacement are marked `[REPLACE]`.

```
app/
├── page.tsx                                          [REPLACE — port LandingPage.jsx]
├── layout.tsx                                        [KEEP — root layout with ClerkProvider]
├── globals.css                                       [EXTEND — merge tokens + component CSS]
├── not-found.tsx                                     [REPLACE — port NotFoundPage.jsx]
│
├── (auth)/
│   ├── layout.tsx                                    [REPLACE — port auth layout wrapper visual]
│   ├── sign-in/[[...sign-in]]/page.tsx               [KEEP — Clerk <SignIn>]
│   └── sign-up/[[...sign-up]]/page.tsx               [KEEP — Clerk <SignUp>]
│
├── (student)/
│   ├── layout.tsx                                    [REPLACE — port AppShell for student role]
│   └── student-dashboard/
│       ├── page.tsx                                  [REPLACE — port StudentDashboardPage.jsx]
│       ├── drives/
│       │   ├── page.tsx                              [NEW — port HomePage.jsx (drives catalogue)]
│       │   └── [id]/
│       │       └── page.tsx                          [NEW — Drive detail + apply button]
│       ├── profile/
│       │   └── page.tsx                              [NEW — port StudentProfilePage.jsx]
│       ├── applications/
│       │   └── page.tsx                              [NEW — My Applications page]
│       ├── notifications/
│       │   └── page.tsx                              [REDIRECT → /notifications]
│       └── settings/
│           └── page.tsx                              [NEW — port SettingsPage.jsx]
│
├── (admin)/
│   ├── layout.tsx                                    [REPLACE — port AppShell for admin role]
│   └── admin-dashboard/
│       ├── page.tsx                                  [REPLACE — port AdminHomePage.jsx]
│       ├── students/
│       │   ├── page.tsx                              [NEW — port AdminDashboardPage.jsx]
│       │   ├── add/
│       │   │   └── page.tsx                          [NEW — port AddStudentPage.jsx]
│       │   └── import/
│       │       └── page.tsx                          [NEW — port ExcelUploadPage.jsx]
│       ├── drives/
│       │   ├── page.tsx                              [NEW — drive management list]
│       │   ├── new/
│       │   │   └── page.tsx                          [NEW — port PostDrivePage.jsx]
│       │   └── [id]/
│       │       ├── edit/
│       │       │   └── page.tsx                      [NEW — edit drive form]
│       │       └── applications/
│       │           └── page.tsx                      [NEW — applicants for a drive]
│       ├── announcements/
│       │   └── page.tsx                              [NEW — port AnnouncementsPage.jsx]
│       └── reports/
│           └── page.tsx                              [NEW — port ReportsAnalyticsPage.jsx]
│
├── (super-admin)/
│   ├── layout.tsx                                    [REPLACE — port AppShell for super-admin role]
│   ├── super-admin-dashboard/
│   │   ├── page.tsx                                  [REPLACE — port SuperAdminDashboardPage.jsx]
│   │   ├── students/
│   │   │   └── page.tsx                              [NEW — port SuperAdminStudentsPage.jsx]
│   │   ├── drives/
│   │   │   └── page.tsx                              [NEW — port SuperAdminDrivesPage.jsx (read-only)]
│   │   ├── departments/
│   │   │   ├── page.tsx                              [NEW — port DepartmentManagementPage.jsx]
│   │   │   └── [id]/
│   │   │       └── page.tsx                          [NEW — dept detail]
│   │   ├── admins/
│   │   │   └── page.tsx                              [NEW — port AdminAccountsPage.jsx]
│   │   ├── reports/
│   │   │   └── page.tsx                              [NEW — port GlobalReportsPage.jsx]
│   │   └── settings/
│   │       └── page.tsx                              [NEW — port SystemSettingsPage.jsx]
│   └── audit-logs/
│       └── page.tsx                                  [REPLACE — port AuditLogPage.jsx]
│
├── notifications/
│   └── page.tsx                                      [REPLACE — port NotificationsPage.jsx]
│
└── api/
    ├── students/
    │   └── profile-photo/route.ts                    [KEEP — Vercel Blob upload, no changes]
    └── webhooks/
        └── clerk/route.ts                            [KEEP — webhook handler, no changes]
```

---

## 8. Component Migration Map

### 8.1 UI Primitives — Port from Temp Frontend

These components in `src/components/ui/` of the temp frontend should be ported to
`components/ui/` in the Next.js project. All must be converted to TypeScript.
Where a shadcn/ui equivalent already exists, prefer extending the shadcn component
rather than maintaining a parallel one.

| Temp Component | Target Path | Notes |
|---|---|---|
| `Button.jsx` | Use existing shadcn `Button` | shadcn already has variants. Map `primary→default`, `danger→destructive` |
| `Badge.jsx` | Use existing shadcn `Badge` | Extend with semantic color variants via `cn()` |
| `Modal.jsx` | Use existing shadcn `Dialog` | shadcn Dialog has focus trap, Esc dismissal built-in |
| `DatePicker.jsx` | `components/ui/date-picker.tsx` | Port this — unique year/month select dropdowns, worth keeping |
| `UrlField.jsx` | `components/ui/url-field.tsx` | Port this — auto-prefix logic is useful |
| `KpiCard.jsx` | `components/shared/kpi-card.tsx` | Port — shared by admin and super admin dashboards |
| `Gauge.jsx` | **SKIP for V1** | Only used by deferred readiness pages |
| `ProgressBar.jsx` | `components/ui/progress-bar.tsx` | Port — used by profile completion display |
| `TagInput.jsx` | `components/ui/tag-input.tsx` | Port — used for skills, locations |
| `Pagination.jsx` | `components/ui/pagination.tsx` | Port — used by all data tables |

### 8.2 Layout Components — Port from Temp Frontend

| Temp Component | Target Path | Changes Needed |
|---|---|---|
| `AppShell.jsx` | `components/shared/app-shell.tsx` | Replace `useAuth()` with Clerk's `useUser()` + `lib/auth.ts` helpers. Role-based menu sourced from Clerk session. |
| `Sidebar.jsx` | `components/shared/sidebar.tsx` | Replace role-based nav logic with server-side role from Clerk. Use Next.js `<Link>` instead of React Router `<Link>`. |
| `Topbar.jsx` | `components/shared/topbar.tsx` | Replace notification badge with real unread count from `features/notifications`. Replace profile pill with Clerk `<UserButton>` or custom using `useUser()`. |

### 8.3 Domain Components

| Temp Component | Target Path | Changes Needed |
|---|---|---|
| `drives/DriveCard.jsx` | `components/drives/drive-card.tsx` | Remove `WithdrawModal` trigger. Remove stage stepper. Compute status from `applicationDeadline`. Wire "Apply Now" to `applyToDrive` server action. |
| `drives/ApplicationReviewModal.jsx` | `components/drives/application-review-modal.tsx` | Remove custom question answers (out of V1). Prefill from real student profile. |
| `drives/WithdrawModal.jsx` | **DELETE — not ported** | Withdrawal is out of V1 scope |
| `admin/DepartmentScopeBanner.jsx` | `components/shared/department-scope-banner.tsx` | Replace mock dept from `AuthContext` with real dept from `requireDepartmentAdmin()` |
| `admin/drives/AdminDriveLogisticsPanel.jsx` | `components/admin/drives/admin-drive-logistics-panel.tsx` | Wire to updated `Drive` model logistics fields (§4.1A) |
| `admin/drives/AdminApplicationFieldsPanel.jsx` | `components/admin/drives/admin-application-fields-panel.tsx` | Wire to `applicationFields` JSON field on `Drive` model |
| `admin/drives/AdminDrivePreviewCard.jsx` | `components/admin/drives/admin-drive-preview-card.tsx` | Port as-is, adapt types |
| `admin/students/StudentDetailsModal.jsx` | `components/admin/students/student-details-modal.tsx` | Wire to real `getStudentDetail()` query |
| `auth/ProtectedRoute.jsx` | **DELETE — not ported** | Replaced by Next.js middleware + server-side role checks |

---

## 9. Auth Integration — Replacing JWT with Clerk

This is the most important architectural change. Every auth-related pattern
in the temp frontend must be completely replaced.

### 9.1 What Gets Deleted

| Temp Frontend File | Reason |
|---|---|
| `src/context/AuthContext.jsx` | Entire file deleted — Clerk replaces this |
| `src/components/auth/ProtectedRoute.jsx` | Deleted — middleware + server checks replace this |
| `src/pages/public/OtpVerificationPage.jsx` | Deleted — Clerk handles OTP |
| `src/pages/public/ResetPasswordPage.jsx` | Deleted — Clerk handles password reset |
| Login form logic in `LoginPage.jsx` | The visual layout is kept, the role-detection-by-email logic is deleted |
| Register form logic in `RegisterPage.jsx` | The visual layout is kept, the fake OTP logic is deleted |

### 9.2 What Replaces Each

| Deleted Pattern | Replacement |
|---|---|
| `useAuth()` to get current user | `import { useUser } from '@clerk/nextjs'` (client) or `auth()` from `@clerk/nextjs/server` (server) |
| `session.role` to check role | `requireRole()` / `requireStudent()` / `requireDepartmentAdmin()` from `lib/auth.ts` (server) |
| `session.user.department` | `requireDepartmentAdmin()` returns `{ user, admin }` where `admin.departmentId` is the scoped dept |
| `login(email, password)` | Clerk's `<SignIn>` component handles this entirely |
| `logout()` | Clerk's `<UserButton>` has built-in sign-out, or `signOut()` from `@clerk/nextjs/client` |
| JWT in `localStorage` | Clerk session cookie (managed by Clerk, not the app) |
| Role-based redirect after login | `middleware.ts` already redirects based on role after sign-in |
| `<ProtectedRoute allowedRoles={['student']}>` | `middleware.ts` blocks access + server page re-checks with `requireStudent()` |

### 9.3 How to Get User Identity in Ported Components

```typescript
// In a SERVER component / page (preferred):
import { requireStudent } from '@/lib/auth';

export default async function StudentDashboardPage() {
  const { user, student } = await requireStudent();
  // user.id, user.email, student.name, student.departmentId, etc.
  return <DashboardContent student={student} />;
}

// In a CLIENT component (use sparingly):
'use client';
import { useUser } from '@clerk/nextjs';

export function Topbar() {
  const { user } = useUser();
  // user.firstName, user.imageUrl, etc.
}

// Getting role in a client component:
// Pass role as a prop from a server component — don't re-fetch from Clerk on client.
```

### 9.4 Sign-In / Sign-Up Page Visual

The `(auth)` pages already use Clerk's `<SignIn>` and `<SignUp>` components.
The **only thing to port** from the temp frontend's auth pages is the **visual wrapper**:
the auth card layout, brand mark (terracotta dot + "CampusHire"), and background.
The actual form fields, OTP step, and password reset are all Clerk's responsibility.

```tsx
// app/(auth)/sign-in/[[...sign-in]]/page.tsx — FINAL FORM
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    // Port the auth card visual wrapper from LoginPage.jsx here:
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-dot" />
          <span className="brand-title">CampusHire</span>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
```

---

## 10. State Management Strategy

### 10.1 Replace `AppStateContext` with Real Data

Every field in `AppStateContext` must be replaced as follows:

| `AppStateContext` Field | Replacement in Next.js |
|---|---|
| `appliedDrives` (array of drive IDs) | Server query: `getMyApplications()` in `features/applications/queries/` |
| `applyDrive(driveId, formValues)` | Server action: `applyToDrive(driveId)` in `features/applications/actions/` |
| `withdrawDrive(driveId, reason)` | **Deleted — V1 applications are immutable** |
| `resumeScore`, `readinessScore` | **Deleted — out of V1 scope** |
| `profileCompletion` | Computed by `calculateProfileCompletion()` in `features/students/queries/` |
| `notifReadIds` | Server action: `markNotificationRead(id)` in `features/notifications/` |
| `student` (local profile overrides) | `getStudentProfile()` server query, re-fetch after mutations |

### 10.2 Client-Side Interactivity Pattern

Server Components handle all data fetching. Client components handle interactivity only.

```
Page (Server Component)
  └── fetches data with server action / query
      └── passes data as props to:
          └── InteractiveSection (Client Component, "use client")
              └── uses useTransition + startTransition for mutations
              └── calls server actions directly
              └── shows optimistic UI or loading state
```

### 10.3 Toast Notifications

Replace `ToastContext` from the temp frontend with shadcn/ui's `useToast`:

```typescript
// In any client component:
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

// On success:
toast({ title: 'Applied!', description: 'Your application was submitted.' });

// On error:
toast({ title: 'Error', description: err.message, variant: 'destructive' });
```

Ensure `<Toaster />` is added to `app/layout.tsx` if not already present.

---

## 11. Phase-by-Phase Execution Plan

Work through phases strictly in order. Do not start Phase 2 until Phase 1 is verified.

---

### Phase 0: Schema & Backend Preparation
**Must complete before any UI work.**

**Steps:**
1. Update `prisma/schema.prisma` with all additions from §4.1
2. Run `npx prisma validate`
3. Run `npx prisma migrate dev --name "frontend-integration-schema"`
4. Run `npx prisma generate`
5. Write/update server actions listed in §5.1 (create-drive, update-drive, etc.)
6. Write/update queries listed in §5.2
7. Run `npx tsc --noEmit` — zero errors
8. Run `npm run test` — all tests pass

**Verification:** Build passes, schema is migrated, new server actions exist and are type-safe.

---

### Phase 1: Design System & Shared Layout
**Port CSS and shared components before any page.**

**Steps:**
1. **Merge CSS:** Copy `src/styles/base.css`, `layout.css`, `forms-buttons.css`,
   `components.css`, and `datepicker.css` from the temp frontend into `app/globals.css`
   under `@layer base { }` and `@layer components { }` blocks.
   Do NOT copy `tokens.css` — the tokens are already in `globals.css`.
2. **Port `AppShell`:** Create `components/shared/app-shell.tsx` from `AppShell.jsx`.
   - Replace `useAuth()` with Clerk's `useUser()` or accept `role` as a prop from a server parent.
   - Replace React Router `<Link>` with Next.js `<Link>`.
   - The shell renders Sidebar + Topbar + `{children}`.
3. **Port `Sidebar`:** Create `components/shared/sidebar.tsx` from `Sidebar.jsx`.
   - Role-based nav links still sourced dynamically but now from Clerk session role.
   - Use Next.js `usePathname()` for active route detection.
   - Wire notification badge to real unread count from existing `features/notifications/`.
4. **Port `Topbar`:** Create `components/shared/topbar.tsx` from `Topbar.jsx`.
   - Replace profile pill with Clerk `<UserButton>` or custom using `useUser()`.
   - Wire notification dropdown to real notifications.
5. **Update Layouts:** Replace `app/(student)/layout.tsx`, `app/(admin)/layout.tsx`,
   `app/(super-admin)/layout.tsx` to use the new `AppShell` with the correct role.
6. **Port UI Primitives:** Port `DatePicker`, `UrlField`, `TagInput`, `ProgressBar`,
   `Pagination`, `KpiCard` from temp frontend into `components/ui/` as `.tsx` files.
7. **Port `ToastContext` → shadcn `useToast`:** Ensure `<Toaster />` is in `app/layout.tsx`.

**Verification:** `npm run build` passes. Layouts render with correct sidebar and topbar.

---

### Phase 2: Student Experience
**Build student-facing pages in this order.**

**Step 2A — Student Dashboard (`app/(student)/student-dashboard/page.tsx`)**
- Port `StudentDashboardPage.jsx`
- Wire to `getStudentProfile()` + `calculateProfileCompletion()`
- Wire notification summary to `features/notifications/`
- Wire quick stats (profile %, upcoming deadlines) to real data

**Step 2B — Student Profile (`app/(student)/student-dashboard/profile/page.tsx`)**
- Port `StudentProfilePage.jsx` with all 7 tabs
- Wire each tab's save button to the corresponding server action in `features/students/actions/`
- Wire profile photo upload to `app/api/students/profile-photo/route.ts`
- Wire profile completion % to `calculateProfileCompletion()`
- Add `DatePicker` component for DOB field
- Add `UrlField` component for LinkedIn/GitHub/portfolio fields
- Add `TagInput` component for skills

**Step 2C — Drives Catalogue (`app/(student)/student-dashboard/drives/page.tsx`)**
- Port `HomePage.jsx` (the drives list)
- Wire to `getAvailableDrives()` server query (eligibility-filtered)
- Port `DriveCard.jsx` — remove withdraw/stage elements, compute status from deadline
- Add pagination

**Step 2D — Drive Detail & Apply (`app/(student)/student-dashboard/drives/[id]/page.tsx`)**
- Create drive detail page with full JD
- Port eligibility checklist UI from `DriveCard`'s expanded panel
- Wire "Apply Now" button to `applyToDrive()` server action
- Show confirmation modal before applying (use shadcn `AlertDialog`)
- Handle already-applied state, deadline-passed state

**Step 2E — My Applications (`app/(student)/student-dashboard/applications/page.tsx`)**
- Port the applications history view
- Wire to `getMyApplications()` paginated query
- Show company, role, applied date, drive status (open/closed)

**Step 2F — Notifications Page (`app/notifications/page.tsx`)**
- Port `NotificationsPage.jsx`
- Wire to existing `features/notifications/` queries + mark-read action

**Step 2G — Settings (`app/(student)/student-dashboard/settings/page.tsx`)**
- Port `SettingsPage.jsx`
- Wire password change to Clerk's user management APIs
- Wire email/notification preferences if in scope

**Verification:** Student can: register → complete profile → browse drives → apply to a drive → view application in history. Profile completion % updates live.

---

### Phase 3: Department Admin Experience

**Step 3A — Admin Dashboard Home (`app/(admin)/admin-dashboard/page.tsx`)**
- Port `AdminHomePage.jsx`
- Wire KPI cards to real queries (`getDepartmentStats()`)
- Wire recent activity to notifications/audit log

**Step 3B — Student Roster (`app/(admin)/admin-dashboard/students/page.tsx`)**
- Port `AdminDashboardPage.jsx`
- Wire to `getDepartmentStudents()` paginated query (scoped to admin's dept)
- Wire search and filters
- Wire `StudentDetailsModal` to `getStudentDetail()` query
- Implement pagination with `Pagination` component

**Step 3C — Add Student Manually (`app/(admin)/admin-dashboard/students/add/page.tsx`)**
- Port `AddStudentPage.jsx`
- Wire to `addStudentManual()` server action

**Step 3D — Excel Import (`app/(admin)/admin-dashboard/students/import/page.tsx`)**
- Port `ExcelUploadPage.jsx`
- This requires Unit 07 backend implementation (see `context/specs/07-excel-csv-bulk-import.md`)
- Wire upload to Excel import server actions once Unit 07 is implemented
- For now, show the UI with a "Backend implementation pending" notice if Unit 07 is not done

**Step 3E — Drive Management (`app/(admin)/admin-dashboard/drives/page.tsx`)**
- Build drive list table with status, application counts
- Wire to `getDepartmentDrives()` query
- Link to create/edit drive pages

**Step 3F — Post Drive (`app/(admin)/admin-dashboard/drives/new/page.tsx`)**
- Port `PostDrivePage.jsx` with `AdminDriveLogisticsPanel` and `AdminApplicationFieldsPanel`
- Wire to `createDrive()` server action
- Include `DatePicker` for deadline, `UrlField` for PPT link and apply URL

**Step 3G — Drive Applications (`app/(admin)/admin-dashboard/drives/[id]/applications/page.tsx`)**
- Build applicants table for a specific drive
- Wire to `getDriveApplications()` query

**Step 3H — Announcements (`app/(admin)/admin-dashboard/announcements/page.tsx`)**
- Port `AnnouncementsPage.jsx`
- Wire to existing `Notification` system (a dept announcement is a notification broadcast)
- Wire `DatePicker` for event date, `UrlField` for document link

**Step 3I — Reports (`app/(admin)/admin-dashboard/reports/page.tsx`)**
- Port `ReportsAnalyticsPage.jsx`
- Wire to department-scoped stats queries

**Verification:** Admin can: view roster → view student detail → post a drive → view applicants. All data is scoped to admin's department.

---

### Phase 4: Super Admin Experience

**Step 4A — Super Admin Dashboard (`app/(super-admin)/super-admin-dashboard/page.tsx`)**
- Port `SuperAdminDashboardPage.jsx`
- Wire system-wide KPIs to `getSystemStats()` query
- Wire department matrix to `getDepartmentMatrix()` query

**Step 4B — Department Management (`app/(super-admin)/super-admin-dashboard/departments/page.tsx`)**
- Port `DepartmentManagementPage.jsx`
- Wire to `getDepartments()`, `createDepartment()`, `updateDepartment()`, `toggleDepartmentStatus()` actions

**Step 4C — Admin Accounts (`app/(super-admin)/super-admin-dashboard/admins/page.tsx`)**
- Port `AdminAccountsPage.jsx`
- Wire to `getDepartmentAdmins()` query
- Wire create to `createAdminAccount()` server action (creates Clerk account + DepartmentAdmin record)
- Wire remove to `removeAdminAccount()` server action

**Step 4D — All Students (`app/(super-admin)/super-admin-dashboard/students/page.tsx`)**
- Port `SuperAdminStudentsPage.jsx`
- Wire to unscoped student list query (all departments visible to super admin)

**Step 4E — All Drives (`app/(super-admin)/super-admin-dashboard/drives/page.tsx`)**
- Port `SuperAdminDrivesPage.jsx` as **read-only** (remove central drive posting — V1 scope)
- Wire to unscoped drives query

**Step 4F — Audit Log (`app/(super-admin)/audit-logs/page.tsx`)**
- Port `AuditLogPage.jsx`
- Wire to existing `features/audit/` queries (Unit 09 is complete)
- Add filter UI (by action type, entity, date range)

**Step 4G — Global Reports (`app/(super-admin)/super-admin-dashboard/reports/page.tsx`)**
- Port `GlobalReportsPage.jsx`
- Wire to `getDepartmentMatrix()` and aggregate stats

**Step 4H — System Settings (`app/(super-admin)/super-admin-dashboard/settings/page.tsx`)**
- Port `SystemSettingsPage.jsx`
- Wire toggle switches for system-wide settings if any are in scope

**Verification:** Super admin can: add a department → add an admin to that dept → view audit log → view department matrix.

---

### Phase 5: Auth Pages Visual Polish

**Step 5A — Sign-In Page**
- Update `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Port the visual wrapper (auth card, brand mark, warm background) from `LoginPage.jsx`
- Keep Clerk's `<SignIn>` component inside it

**Step 5B — Sign-Up Page**
- Update `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Port the visual wrapper from `RegisterPage.jsx`
- Keep Clerk's `<SignUp>` component inside it

**Step 5C — Landing Page**
- Port `LandingPage.jsx` to `app/page.tsx`
- Remove any fake metric claims, keep feature descriptions

**Verification:** Sign-in and sign-up visually match the temp frontend's auth card design. Clerk handles all form behavior.

---

### Phase 6: Final Polish & Cleanup

1. Remove `campushire_frontend (temp)` folder from the project (or move it outside the workspace)
2. Delete any remaining placeholder pages in `app/`
3. Update `context/progress-tracker.md` to reflect completed UI units
4. Update `context/ui-context.md` with any new component patterns introduced
5. Run `npm run build` — must pass with zero TypeScript errors
6. Run `npm run test` — all tests must pass
7. Manually test every role's full flow end to end

---

## 12. File-by-File Migration Reference

This is the quick-lookup table for every temp frontend file and its fate.

### `src/pages/public/`
| File | Action | Target |
|---|---|---|
| `LandingPage.jsx` | Port | `app/page.tsx` |
| `LoginPage.jsx` | Port visual wrapper only | `app/(auth)/sign-in/[[...sign-in]]/page.tsx` |
| `RegisterPage.jsx` | Port visual wrapper only | `app/(auth)/sign-up/[[...sign-up]]/page.tsx` |
| `OtpVerificationPage.jsx` | **Delete** — Clerk handles OTP | — |
| `ResetPasswordPage.jsx` | **Delete** — Clerk handles reset | — |
| `NotFoundPage.jsx` | Port | `app/not-found.tsx` |

### `src/pages/student/`
| File | Action | Target |
|---|---|---|
| `StudentDashboardPage.jsx` | Port | `app/(student)/student-dashboard/page.tsx` |
| `HomePage.jsx` | Port | `app/(student)/student-dashboard/drives/page.tsx` |
| `StudentProfilePage.jsx` | Port | `app/(student)/student-dashboard/profile/page.tsx` |
| `NotificationsPage.jsx` | Port | `app/notifications/page.tsx` |
| `SettingsPage.jsx` | Port | `app/(student)/student-dashboard/settings/page.tsx` |
| `ResumeBuilderPage.jsx` | **Skip — V1 out of scope** | — |
| `AiAnalyzerPage.jsx` | **Skip — V1 out of scope** | — |
| `SelfAssessmentPage.jsx` | **Skip — V1 out of scope** | — |
| `ReadinessDashboardPage.jsx` | **Skip — V1 out of scope** | — |

### `src/pages/admin/`
| File | Action | Target |
|---|---|---|
| `AdminHomePage.jsx` | Port | `app/(admin)/admin-dashboard/page.tsx` |
| `AdminDashboardPage.jsx` | Port | `app/(admin)/admin-dashboard/students/page.tsx` |
| `AddStudentPage.jsx` | Port | `app/(admin)/admin-dashboard/students/add/page.tsx` |
| `ExcelUploadPage.jsx` | Port | `app/(admin)/admin-dashboard/students/import/page.tsx` |
| `PostDrivePage.jsx` | Port | `app/(admin)/admin-dashboard/drives/new/page.tsx` |
| `AnnouncementsPage.jsx` | Port | `app/(admin)/admin-dashboard/announcements/page.tsx` |
| `ReportsAnalyticsPage.jsx` | Port | `app/(admin)/admin-dashboard/reports/page.tsx` |

### `src/pages/superadmin/`
| File | Action | Target |
|---|---|---|
| `SuperAdminDashboardPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/page.tsx` |
| `DepartmentManagementPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/departments/page.tsx` |
| `AdminAccountsPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/admins/page.tsx` |
| `SuperAdminStudentsPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/students/page.tsx` |
| `SuperAdminDrivesPage.jsx` | Port (read-only) | `app/(super-admin)/super-admin-dashboard/drives/page.tsx` |
| `GlobalReportsPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/reports/page.tsx` |
| `AuditLogPage.jsx` | Port | `app/(super-admin)/audit-logs/page.tsx` |
| `SystemSettingsPage.jsx` | Port | `app/(super-admin)/super-admin-dashboard/settings/page.tsx` |

### `src/components/`
| File | Action | Target |
|---|---|---|
| `layout/AppShell.jsx` | Port | `components/shared/app-shell.tsx` |
| `layout/Sidebar.jsx` | Port | `components/shared/sidebar.tsx` |
| `layout/Topbar.jsx` | Port | `components/shared/topbar.tsx` |
| `ui/Button.jsx` | Use shadcn `Button` | Extend variant styles |
| `ui/Badge.jsx` | Use shadcn `Badge` | Extend variant styles |
| `ui/Modal.jsx` | Use shadcn `Dialog` | — |
| `ui/DatePicker.jsx` | Port | `components/ui/date-picker.tsx` |
| `ui/UrlField.jsx` | Port | `components/ui/url-field.tsx` |
| `ui/TagInput.jsx` | Port | `components/ui/tag-input.tsx` |
| `ui/ProgressBar.jsx` | Port | `components/ui/progress-bar.tsx` |
| `ui/KpiCard.jsx` | Port | `components/shared/kpi-card.tsx` |
| `ui/Pagination.jsx` | Port | `components/ui/pagination.tsx` |
| `ui/Gauge.jsx` | **Skip — deferred** | — |
| `drives/DriveCard.jsx` | Port (adapted) | `components/drives/drive-card.tsx` |
| `drives/ApplicationReviewModal.jsx` | Port (adapted) | `components/drives/application-review-modal.tsx` |
| `drives/WithdrawModal.jsx` | **Delete** | — |
| `admin/DepartmentScopeBanner.jsx` | Port | `components/shared/department-scope-banner.tsx` |
| `admin/drives/AdminDriveLogisticsPanel.jsx` | Port | `components/admin/drives/admin-drive-logistics-panel.tsx` |
| `admin/drives/AdminApplicationFieldsPanel.jsx` | Port | `components/admin/drives/admin-application-fields-panel.tsx` |
| `admin/drives/AdminDrivePreviewCard.jsx` | Port | `components/admin/drives/admin-drive-preview-card.tsx` |
| `admin/students/StudentDetailsModal.jsx` | Port | `components/admin/students/student-details-modal.tsx` |
| `auth/ProtectedRoute.jsx` | **Delete** | Replaced by middleware |

### `src/context/`, `src/api/`, `src/data/`
| File | Action |
|---|---|
| `context/AuthContext.jsx` | **Delete** — replaced by Clerk |
| `context/AppStateContext.jsx` | **Delete** — replaced by server actions |
| `context/ToastContext.jsx` | **Delete** — replaced by shadcn `useToast` |
| `api/authService.js` | **Delete** — replaced by Clerk |
| `api/studentService.js` | **Delete** — replaced by `features/students/` |
| `api/driveService.js` | **Delete** — replaced by `features/drives/` |
| `api/adminService.js` | **Delete** — replaced by `features/admin-accounts/` |
| `api/client.js` | **Delete** — no REST client needed |
| `data/mockData.js` | **Delete** |
| `data/driveStore.js` | **Delete** |
| `data/applicationFieldsCatalog.js` | **Keep concept** — seed field catalog into DB or keep as config constant in `features/drives/` |

---

## 13. Features Deferred / Out of Scope for V1

These features exist in the temp frontend but must **not** be implemented in this integration.
They are recorded here so they can be picked up in a future phase without re-analysis.

| Feature | Temp Frontend File(s) | Why Deferred | Future Work Needed |
|---|---|---|---|
| Resume Builder | `ResumeBuilderPage.jsx` | Out of V1 scope per `project-overview.md` | Resume PDF storage, Vercel Blob integration, PDF generation library |
| AI Resume Analyzer | `AiAnalyzerPage.jsx` | Out of V1 scope | Gemini API integration, `POST /api/ai/analyze-resume` backend proxy |
| Readiness Self-Assessment | `SelfAssessmentPage.jsx` | Out of V1 scope — readiness score deferred | Assessment question model, scoring logic |
| Readiness Dashboard | `ReadinessDashboardPage.jsx` | Out of V1 scope | Depends on self-assessment + historical score snapshots |
| Application Withdrawal | `WithdrawModal.jsx` | V1 applications are immutable — intentional | Requires `DriveApplication` status field + withdrawal reason model |
| Application Stage Tracking | Stage stepper in `DriveCard.jsx` | V1 has no stage tracking beyond "Applied" | Requires `ApplicationStage` enum + admin stage-update action |
| Central Institutional Drives | `SuperAdminDrivesPage.jsx` post flow | V1 only dept admins post drives | Add `drive_type = 'central'` flow, super admin post drive form |
| Announcements Model | `AnnouncementsPage.jsx` | No `Announcement` model in V1 schema | Add `announcements` table, or wire to notification broadcast system |
| Transactional Email | Email sending in `AnnouncementsPage.jsx`, drive alerts | Out of V1 — in-app notifications only | Integrate SendGrid/SES, add mail queue |
| Real-time Notifications | WebSocket / polling | Out of V1 | Server-Sent Events or polling interval |
| Export (Excel/CSV) | Export buttons in admin pages | Out of V1 | Server-side Excel generation via `exceljs` |
| Semester-wise SGPA | `TabAcademicInfo.jsx` semester grid | Deferred if `SemesterMark` model not added | Add `SemesterMark` model (§4.1C) |
| NIRF/NAAC Reports | `GlobalReportsPage.jsx` export | Out of V1 | Defined report formats, export generation |

---

## 14. Verification Checklist

Run through this checklist after completing all phases. Every item must pass before
considering the integration complete.

### Build & Type Safety
- [ ] `npm run build` — zero TypeScript errors, zero ESLint warnings
- [ ] `npx tsc --noEmit` — passes
- [ ] `npm run lint` — passes
- [ ] `npm run test` — all existing tests still pass

### Database
- [ ] `npx prisma validate` — passes
- [ ] All schema additions from §4.1 are migrated and live in Neon
- [ ] `npx prisma studio` — new fields visible in the correct tables

### Auth Flows
- [ ] Student can register with college email → email OTP arrives → account verified → lands on student dashboard
- [ ] Second registration attempt with same email is rejected
- [ ] Department admin account created by super admin → admin logs in → sees only their dept's data
- [ ] Super admin can log in → sees system-wide data
- [ ] Unauthenticated user accessing `/student-dashboard` is redirected to `/sign-in`
- [ ] Student cannot access `/admin-dashboard` — middleware blocks it
- [ ] Admin cannot access `/super-admin-dashboard` — middleware blocks it

### Student Flows
- [ ] Profile completion % starts at 0, increases as sections are filled, reaches 100% only when all 7 sections have all required fields
- [ ] Profile photo uploads successfully to Vercel Blob
- [ ] Student can only see drives they are eligible for (test with a student below and above CGPA threshold)
- [ ] Student can apply to an eligible drive exactly once — second attempt is rejected
- [ ] Drive disappears from active list after deadline passes; remains visible to admin as "Closed"
- [ ] Applied drives appear in application history

### Admin Flows
- [ ] Admin can only see students in their own department
- [ ] Admin posting a drive sets eligibility criteria — only matching students see it
- [ ] Drive creation validates required fields before saving
- [ ] Student details modal shows correct profile data

### Super Admin Flows
- [ ] Super admin can add a department
- [ ] Super admin can add a dept admin and assign them to a department
- [ ] New admin can log in immediately and sees only their department's data
- [ ] Two admins assigned to the same department both see identical data
- [ ] Audit log shows entries for department creation, admin creation, drive posting

### Data Integrity
- [ ] Applying to a drive creates one `DriveApplication` row — cannot create a second one
- [ ] Cross-department access: admin from Dept A cannot view Dept B's students via any UI path
- [ ] Drive status is computed from deadline, never stored — changing `applicationDeadline` to the past immediately marks the drive closed

---

*End of Integration Guide. This document is the single source of truth for the
integration project. Update it if scope, architecture, or decisions change — do not
track divergences in code comments.*
