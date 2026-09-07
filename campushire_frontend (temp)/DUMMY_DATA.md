# DUMMY_DATA.md

Every piece of fake/demo data in this codebase, where it lives, and exactly what
should replace it when you wire this project up to a real backend.

**Rule of thumb:** anything imported from `src/data/*.js` is demo content.
Anything imported from `src/api/*.js` is a placeholder waiting for your real
endpoints. Search the codebase for `TODO(real-data)` to find every call site —
every file below has one or more comments tagged that way.

---

## 1. `src/data/mockData.js`

Ported verbatim from the prototype's `mockData.js`. Eleven exports, each used
in multiple pages.

| Export | Used in | Replace with |
|---|---|---|
| `STUDENT` | `hooks/useStudent.js`, student pages | `GET /api/students/me` via `api/studentService.js` → `getMe()`. This is the single logged-in student's full profile (personal info, academics, skills, projects, experience, certifications, preferences, scores). |
| `DEPT_ADMIN` | Admin pages (`AdminHomePage`, `AdminDashboardPage`, etc.) | The logged-in dept admin's identity, from your auth/session response (`authService.login()` result) or `GET /api/admin/me`. |
| `SUPER_ADMIN` | Super-admin pages | Same as above — logged-in TPO/super-admin identity from auth response or `GET /api/super-admin/me`. |
| `STUDENTS_LIST` | `AdminDashboardPage`, `SuperAdminStudentsPage`, `ReportsAnalyticsPage`, `GlobalReportsPage` | `studentService.list({ dept, search })` — paginated student directory, scoped by department for dept admins, unscoped for super admin. **Note:** fields are `roll` (not `rollNo`), `dept` (not `department`), and `status` is one of `'eligible' \| 'attention_needed' \| 'placed'`. Keep this shape when wiring the real API, or update the page components if your backend uses different field names. |
| `DRIVES` | `StudentDashboardPage`, `PostDrivePage` | `driveService.listForStudent()` (student-scoped) or `driveService.listForDept(dept)` (dept-admin-scoped). |
| `NOTIFICATIONS` | `Topbar`, `Sidebar`, `NotificationsPage`, `StudentDashboardPage`, `AdminHomePage` | `GET /api/notifications` — should be a live, per-user feed. Read/unread state currently lives in `AppStateContext` (`notifReadIds`) purely as a client cache; move it server-side (`PATCH /api/notifications/:id/read`). |
| `DEADLINES` | `StudentDashboardPage` | Derive from real `DRIVES`/`CENTRAL_DRIVES` deadlines once those come from the API, rather than a separate mock list. |
| `QUESTIONS` | `SelfAssessmentPage` | `GET /api/assessment/questions` (or a static config file if the question set is fixed) — currently a hardcoded 1–5 Likert list. |
| `DEPT_MATRIX` | `SuperAdminDashboardPage`, `DepartmentManagementPage`, `GlobalReportsPage` | `superAdminService.getDeptMatrix()` — per-department aggregate stats (students, avg completion, avg readiness, placed, rate). |
| `EXCEL_ROWS` | `ExcelUploadPage` | Replace the whole "static preview" flow: `studentService.bulkImport(formData)` should return the parsed/validated rows from the server, including per-row error messages. |
| `CENTRAL_DRIVES` | `SuperAdminDashboardPage`, `SuperAdminDrivesPage` | `driveService.listCentral()` for the list; `driveService.updateAdminConfig(driveId, config)` for the venue/logistics form; the `applicationFields` toggle array should be persisted via the same call. |

## 2. `src/data/driveStore.js` (`DRIVE_STORE`)

Ported from the prototype's `drive-data.js`. Used by `HomePage` (the main
student drives catalogue) and rendered through `components/drives/DriveCard.jsx`.

Replace with `driveService.listForStudent()`. The shape driveService expects
back matches `DRIVE_STORE`'s fields (`id, company, role, ctc, minCgpa,
departments, driveDate, driveDeadlineRaw, driveDateRaw, deadline, rounds,
stage, stageLabel, statusBadge, stepper, applyLink, applicants, open`) — keep
that shape server-side, or adjust `DriveCard.jsx` if your API differs.

**Also replace:** `utils/driveUtils.js` exports a fixed `DEMO_TODAY = new
Date('2026-08-09')` so the seeded deadlines/badges line up with the mock
dates. Once real drives exist, delete `DEMO_TODAY` and use `new Date()`
directly in `deadlinePassed()`, `drivePassed()`, and `daysUntil()`.

## 3. Client-side "fake persistence" — `src/context/AppStateContext.jsx`

This is the biggest structural thing to unwind. The original HTML prototype
had no backend, so an `AppState` singleton in `localStorage` faked: which
drives you'd applied to, your resume/readiness/profile-completion scores,
which notifications you'd read, and any profile edits you made. This got
ported into a React context so the app is interactive out of the box — but
none of it should ship to production as-is.

| State field | Currently | Replace with |
|---|---|---|
| `resumeScore`, `readinessScore`, `profileCompletion` | Numbers held in React state + localStorage, seeded from `STUDENT` | Server-computed values returned by `studentService.getMe()`. Delete the local setters (`setResumeScore` etc.) once the backend recomputes these after resume upload / assessment submission / profile save, and just refetch instead. |
| `resumeOptimized` | Boolean flag, flipped by `ResumeBuilderPage`'s "Auto-optimize" button | Response flag from `studentService.optimizeResume()`. |
| `appliedDrives` (array of drive IDs) | Local array, mutated by `applyDrive()`/`withdrawDrive()` | `driveService.myApplications()` to read; `driveService.apply()` / `driveService.withdraw()` to mutate. Don't keep a separate local list — refetch or optimistically update from the real response. |
| `notifReadIds` | Local array | Server-tracked read state, see `NOTIFICATIONS` row above. |
| `student` (profile-edit overrides) | Local object merged over `STUDENT` in `hooks/useStudent.js` | Should disappear entirely. `StudentProfilePage`'s save handler should `PUT`/`PATCH` straight to `studentService.updateProfile(form)` and then refetch `getMe()` — no local override layer needed once there's a real database of record. |

Practically: once your API exists, replace `AppStateContext` with a proper
data-fetching layer (React Query / RTK Query / SWR are all reasonable) rather
than trying to patch the localStorage version. The context is left in place
so the UI is fully clickable today, but it is a mock, not an architecture
decision to keep.

## 4. Illustrative-only copy (not structured mock data, just placeholder text)

These aren't in `src/data/` — they're small inline arrays/strings inside
individual page files, used only to make a screen look populated. Each has a
`TODO(real-data)` comment at its definition site.

| Location | What it is | Replace with |
|---|---|---|
| `pages/student/AiAnalyzerPage.jsx` → `SUGGESTIONS` | 4 hardcoded resume-improvement bullet points | Real response from an "analyze resume" endpoint (`studentService.optimizeResume()` or a dedicated `/analyze` call). |
| `pages/student/ReadinessDashboardPage.jsx` → `TREND`, `BREAKDOWN` | 5-point trend line + 4-category breakdown, invented numbers | Historical readiness snapshots + category scores from the backend — likely a new endpoint, e.g. `GET /api/students/me/readiness-history`. |
| `pages/admin/AnnouncementsPage.jsx` → `sent` (initial state) | 2 fake "already sent" announcements | `GET /api/admin/announcements` on mount; `adminService.postAnnouncement()` already exists as a stub for sending new ones. |
| `pages/superadmin/AdminAccountsPage.jsx` → `SEED_ACCOUNTS` | 3 fake dept-admin staff accounts | `superAdminService.listAdminAccounts()` (stub already written in `api/adminService.js`). |
| `pages/superadmin/AuditLogPage.jsx` → `SEED_LOG` | 4 fake audit trail entries | `superAdminService.getAuditLog(params)` (stub already written). |
| `pages/public/LandingPage.jsx` | The "modules" grid copy is real (describes actual features), but any stat/metric claims should be checked before launch | If you add real usage stats to the landing page, source them from an aggregate endpoint rather than hardcoding. |

## 5. Auth flow simulation

`pages/public/LoginPage.jsx`, `RegisterPage.jsx`, `OtpVerificationPage.jsx`,
`ResetPasswordPage.jsx` all simulate their flows client-side:

- **Login** routes to a role's home page by checking if the email string
  contains `"admin"` or `"tpo"`/`"super"`. Replace with `authService.login()`
  returning a real `{ role, token, user }`, and route based on `role`.
- **Register → OTP** uses a hardcoded demo code `528914` and a visible
  "auto-fill" button. Replace with `authService.register()` →
  `authService.verifyOtp()`; remove the auto-fill button entirely (it exists
  only so the prototype is clickable without a backend).
- **Reset password** is a pure 3-step client-side state machine with no
  actual email being sent. Replace with `authService.requestPasswordReset()`
  (step 1) and `authService.resetPassword()` (step 2).

All four pages' corresponding service stubs already exist in
`src/api/authService.js` with documented request/response shapes — the page
components just need their `// TODO(real-data)` lines swapped for real calls.

## 6. What's already backend-shaped and just needs wiring

`src/api/*.js` (`authService`, `studentService`, `driveService`,
`adminService`, `superAdminService`) contain fully-typed function stubs (JSDoc
comments describing exact request/response shapes) for every mock data point
above. They currently point at `${VITE_API_BASE_URL}/...` via
`src/api/client.js`. To go live:

1. Set `VITE_API_BASE_URL` in a `.env` file to your real API origin.
2. Add auth token attachment in `api/client.js` (marked with a `TODO`).
3. Go through each page's `TODO(real-data)` comment and swap the mock-data
   import / local state mutation for the matching service call.
4. Delete `src/data/mockData.js` and `src/data/driveStore.js` once nothing
   imports them anymore.
