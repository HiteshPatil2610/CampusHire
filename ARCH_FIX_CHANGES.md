# `arch-fix` vs `integration-dev` — Full Change Report

> **Scope of this report.** The body below was written against `8a965d5` and
> covers the 12 commits up to it. `arch-fix` has since moved on: it is now
> **32 commits · 238 files changed · +15,645 / −1,446 · 4 migrations** ahead of
> `integration-dev`. The 20 commits after `8a965d5` are *not* described below,
> except for the six from the 2026-09-17 database session, which are summarised
> in "Later work" at the end. Still a fast-forward — nothing on
> `integration-dev` is missing from `arch-fix`.

Base comparison: `git diff integration-dev..arch-fix`
**12 commits · 127 files changed · +6,557 / −729** · 3 new Prisma migrations · fast-forward (nothing on `integration-dev` is missing from `arch-fix`)

Commit list, oldest first:

| Commit | Summary |
|---|---|
| `7fe1bb4` | chore(db): bound Prisma connection pool for serverless |
| `78bbe2d` | fix(db): derive placement, model diploma entry, store opt-in and admin name |
| `9fe8a8e` | docs(context): sync spec files with the derived-placement schema |
| `d79ddaf` | docs(context): correct the build-status note — the build passes |
| `2b88614` | feat(landing): add department/super admin login buttons to footer |
| `4a274cd` | fix(admin-accounts): retire a promoted user's leftover Student record |
| `330a67d` | chore(dev): add dev server launch config for the preview pane |
| `e2c90a9` | feat(notifications): priority tiers, deep links, grouping, and the missing producers |
| `ba62f4d` | feat(students): ask entry type at registration, defer roll number for diploma |
| `42912fb` | feat(excel-import): Diploma column, required contact fields, per-row import |
| `1fd0600` | feat(students): admin approval queue for unmatched self-registrations |
| `8a965d5` | docs(context): sync context files with the work since the last doc update |

---

## 1. Database schema changes

Three migrations, all applied to the live Neon database.

### `20260916100000_placement_derivation_diploma_entry_opt_in`

- **Dropped** `Student.placementStatus`, `Student.placedCompany`, `Student.placedPackage`.
  These were dead: the only writer set `"UNPLACED"`, and readers compared against four different casings (`'placed'`, `'unplaced'`, `'PLACED'`, `'UNPLACED'`) across four files. No path ever wrote a placed value, so every "Placed" KPI on the super-admin reports was structurally always zero.
- **Added** `Student.optedIn` (Boolean, default `true`) and `Student.optedInLocked` (Boolean, default `false`) — placement participation, settable by the student, lockable by a department admin.
- **Added** `User.name` (String, nullable) — previously collected on the admin-creation form and discarded; now stored and mirrored from Clerk webhooks.
- **Added diploma fields on `StudentAcademic`**: `entryType` (later moved, see below), `diplomaPercentage`, `diplomaBoard`, `diplomaYear`, `diplomaMarksheetUrl`. `twelfthPercentage` made nullable.
- **Added `DriveApplication.stageUpdatedAt` / `stageUpdatedById`** — records who last advanced an application's stage and when.
- **New enum** `EntryType` (`REGULAR` | `DIPLOMA`).

### `20260916180000_entry_type_on_student_nullable_roll_number`

- **Moved `entryType`** from `StudentAcademic` to `Student`. Reason: it is known at registration, before any `StudentAcademic` row exists (that table's CGPA/semester columns are `NOT NULL`, so capturing entry type there would require a placeholder row with a fabricated `0.0` CGPA — which every eligibility check would then read as a real value).
- **`Student.rollNumber` made nullable.** A lateral-entry (diploma) student may register before a roll number is issued. Postgres allows multiple `NULL`s under a unique index, so uniqueness is preserved for everyone who has one.

### `20260916210000_student_access_requests`

- **New table `StudentAccessRequest`** — one row per `User`, holding self-asserted registration details for a sign-up that did not match any admin-imported roster row: `name`, `email`, `rollNumber` (nullable), `departmentId`, `phoneNumber`, `entryType`, `status`, `reviewedById`, `reviewedAt`, `reviewNote`.
- **New enum** `AccessRequestStatus` (`PENDING` | `APPROVED` | `REJECTED`).
- Indexed on `status`, `departmentId`, and `(departmentId, status)` for the admin queue query.

### Net schema effect

| Model | Change |
|---|---|
| `Student` | `-placementStatus, -placedCompany, -placedPackage`; `+optedIn, +optedInLocked, +entryType`; `rollNumber` now nullable |
| `StudentAcademic` | `+diplomaPercentage, +diplomaBoard, +diplomaYear, +diplomaMarksheetUrl`; `twelfthPercentage` now nullable; `entryType` removed (moved to `Student`) |
| `User` | `+name` |
| `DriveApplication` | `+stageUpdatedAt, +stageUpdatedById` |
| `StudentAccessRequest` | new model |
| Enums | `+EntryType`, `+AccessRequestStatus` |

---

## 2. Bug fixes

### Placement was silently always zero
`Student.placementStatus` had no working writer. Every "Placed" KPI on the super-admin Global Reports and Department Matrix pages read a value that could never appear in the table. **Fixed by deriving placement** from `DriveApplication.status = "SELECTED"` via a new shared module, `features/students/utils/placement-status.ts` (`PLACED_STUDENT_FILTER`, `resolvePlacementState`). One definition, used everywhere, so the panels can't disagree again.

### Application stage/status had no writer
`DriveApplication.stage` and `.status` existed and displayed on the student dashboard, but nothing in the codebase ever advanced them. **Fixed** with `features/applications/actions/update-application-stage.ts` — the sole write path, restricted to a department admin who both runs the drive and owns the applicant's department, audit-logged, and notifies the student. Validated by a pure, unit-tested rule (`application-progress.ts`) that refuses to let an admin withdraw on a student's behalf or touch a withdrawn application.

### `User.name` was collected and discarded
The "create department admin" form took a name, split it for Clerk, and never stored it — `User` had no `name` column, so admin rosters showed only email. **Fixed**: column added, written on admin creation, mirrored from Clerk's `user.created`/`user.updated` webhooks.

### "Opted Out" KPI was hardcoded to zero
`app/(admin)/admin-dashboard/reports/page.tsx` had `const optedOutStudents = 0 // Not tracking opted-out status in V1`. **Fixed** with the real `optedIn`/`optedInLocked` columns, settable by both student (Settings page) and admin (student details dialog); only the admin can lock it.

### Dead component and unreachable column
`StudentIdentityCard` accepted `readinessScore`/`resumeScore` props with no backing feature and was never imported anywhere — **deleted**. `Drive.companyLogoUrl` had a column but no upload path — **wired up** via a new Vercel Blob upload endpoint (`app/api/admin/drives/logo/route.ts`) and a shared `CompanyLogoField` component, used in both the department and central drive-posting forms.

### Promoted admin accounts kept their Student record
Promoting a user to `DEPT_ADMIN`/`SUPER_ADMIN` (via `scripts/make-dept-admin.ts` / `make-super-admin.ts`) flipped `User.role` but left their `Student` row in place, so the admin kept appearing in the department roster and in `totalStudents`. **Fixed** with `features/admin-accounts/utils/retire-student-record.ts`: both scripts now retire the leftover row on promotion, but *refuse* if it carries any `DriveApplication` records, since deleting a `Student` cascades and would destroy that application history.

### Excel import: one bad row blocked the entire file
`commitImport` aborted the whole upload if any row failed validation — a single typo in a 300-row sheet blocked all 300, contradicting the architecture's own stated invariant ("a row is either fully validated and inserted, or fully rejected and reported"). **Fixed** with `features/excel-import/validator/partition-rows.ts`, a pure function shared by the preview and the commit that splits a file into importable and rejected rows; only the rejected ones are skipped. This also exposed and fixed an index-alignment bug where the per-row academic-record loop iterated the *original* row list while the created students came from the *filtered* list — it would have paired a student with another row's marks.

### Notification category filter ran after pagination
The Drives/System filter on `/notifications` was applied client-side to an already-paginated page of results, so it could show 3 rows out of 25 while more matches sat on page two, and the displayed total disagreed with the rows shown. **Fixed**: the filter now runs in the database query (`get-notifications.ts`).

### Two notification types were never triggered
`createNewDriveNotification` and `createProfileIncompleteNotification` existed in `lib/notifications.ts` since the start of the project but were never called — a student was never told a new drive opened. **Fixed** with `features/notifications/actions/notify-eligible-students-of-drive.ts`, which fans out to eligible, opted-in students on both drive-creation paths (department and central), using the same eligibility function the student drive list uses. A deduplicated (one-per-week) profile-completion nudge fires from the same place for students blocked only by a missing academic record.

### Diagnostic false alarms (not code bugs, recorded so they aren't re-investigated)
- A `/404` prerender failure earlier in the session was caused by an inherited `NODE_ENV=development` in the build shell overriding `next build`'s own `production` value — not a project defect. `next build` passes cleanly with `NODE_ENV` unset.
- Repeated `[object Event]` / "Cannot find module './vendor-chunks/@clerk.js'" / unstyled-page symptoms were `.next` build-directory corruption caused by running `next build` against a live `next dev` server, or two `next dev` processes sharing one `.next` directory — never a source-code issue. Documented in `progress-tracker.md` with the fix (stop server → confirm process gone → delete `.next` → restart).

---

## 3. New features

### A. Diploma / lateral-entry student support
- `Student.entryType` (`REGULAR` | `DIPLOMA`), asked on the registration card and **locked thereafter** — the profile's Academic tab shows it read-only, because switching it used to silently delete semester 1–2 marks.
- A `DIPLOMA` student's profile shows a diploma-marks panel instead of 12th-standard fields, and their semester-marks table starts at semester 3 (`features/students/utils/entry-type.ts` owns the semester range and "which percentage counts" resolution).
- The unused branch (12th for a diploma student, diploma for a regular one) is stored as `NULL`, never zero-filled — a `0` would read as a real score to every eligibility comparison.
- Excel import gained a **Diploma** column (accepts `1`/`0`, `Yes`/`No`, `True`/`False`, or the words themselves) mapping onto the same `entryType` field — no separate diploma flag, avoiding a second source of truth for the same fact.

### B. Application stage tracking (admin-driven)
- New action `updateApplicationStage`, new UI control `application-stage-control.tsx` on the admin's drive-applicants page, letting a department admin move an application through `APPLIED → APTITUDE → INTERVIEW → OFFER` and set `IN_PROGRESS / SELECTED / REJECTED / WITHDRAWN`.
- The student dashboard's stage tracker (`stage-track.tsx`) now reflects the real, admin-set stage instead of a static display.

### C. Placement opt-in / opt-out
- Student-side: a toggle in Settings (`set-placement-opt-in.ts`, `placement-opt-in.ts` schema).
- Admin-side: a toggle + lock control in the student details dialog, scoped to their department.
- Drives fan-out and reports now exclude/include based on this field.

### D. Notification system overhaul
- **Derived priority tiers** (`critical` / `attention` / `info` / `confirmation`) computed from a notification's type, title and resource — not stored — via `features/notifications/utils/notification-priority.ts`. Reuses the existing semantic colour tokens.
- **Deep links**: clicking a notification now navigates to the relevant drive/application/profile page (`getNotificationHref`) instead of only marking it read.
- **Grouping**: the full notification list sections into "Needs your attention / Today / Earlier this week / Older" (`notification-grouping.ts`); an unread critical item is pinned to the attention section regardless of age.
- **Real unread count + urgency signal** on the bell (`get-unread-summary.ts`/`-action.ts`), replacing a plain read/unread dot; the bell turns red when an unread item is critical.
- **New producers**: eligible-student drive announcements and profile-completion nudges (see Bug Fixes above) — both previously dead code paths, now live.

### E. Self-registration approval flow
Public sign-up is kept, but no longer grants immediate access:

1. Student submits the registration card (name, department, phone — now **required** — entry type, optional roll number).
2. Their **Clerk-verified email** is checked against the department admin's already-imported roster (`features/students/utils/registration-match.ts`):
   - **Match** → the account links to that imported `Student` row (`isPending → false`), immediate dashboard access. The admin already vouched for them by importing them.
   - **No match** → a `StudentAccessRequest` is created; the student sees a new `AwaitingApproval` waiting screen until a department admin decides.
3. Admin side: a new "Student access requests" panel on the bulk-import page (`access-requests-panel.tsx`, `get-access-requests.ts`, `review-access-request.ts`), scoped to the admin's own department, with Approve/Decline + an optional note shown to the student. Both outcomes notify the student and are audit-logged.
4. On approval, the merge is **asymmetric by design**: the student's submitted phone number is taken, but roll number, department and entry type stay as the admin imported them (`mergeOntoImportedRecord`) — those fields decide eligibility and cannot be overridden by a self-asserted value. A roll number the import left blank is the one thing the student may fill.
5. A roster row already linked to another account is refused outright (never silently re-linked), which would otherwise hand one student another student's record.

### F. Bulk Excel import rework
- Sheet columns now match the registration card: Full Name, College Email, Phone Number (required), **Diploma** (required), Roll Number (required unless Diploma), academic fields (optional).
- **Per-row import**: `partitionRows` (new, pure, shared by preview and commit) splits a file into importable and rejected rows; only rejected rows are skipped, with every issue on that row collected together, shaped for a downloadable CSV error export.
- Duplicate detection skips blank roll numbers (a diploma student without one is not a "duplicate" of another diploma student without one).

### G. Landing page
- Added "Department Admin Login" / "Super Admin Login" buttons to the footer, each carrying a `redirect_url` to the appropriate dashboard. These are routing shortcuts only — Clerk has a single sign-in flow, and middleware still enforces that the signed-in account holds the matching role.

### H. Minor / infrastructure
- `lib/prisma.ts`: bounded connection pool (`connection_limit=5`, `pool_timeout=20`) for serverless deployment.
- `.claude/launch.json`: dev server preview configuration (kept to a single `npm run dev` entry — `next dev` and `next start` share `.next` and corrupt each other if both run).
- `next.config.ts`: Vercel Blob remote image pattern allow-listed for `next/image` (needed for the new company-logo uploads).

---

## 4. Architectural changes / conventions established

- **"Derive, don't store" is now a documented standard** (new "Derived State" section in `context/code-standards.md`). Applied three times this cycle: drive status (pre-existing), placement (`placement-status.ts`), notification priority (`notification-priority.ts`). Rule: if a value is computable from data already stored, write one exported function and route every screen through it — a stored duplicate has to be kept correct at every write site, and `placementStatus` is the worked example of what happens when one is forgotten.
- **`architecture.md` invariant 4** (Excel import atomicity) reworded to match what the code now actually does — per-row, not whole-file.
- **New invariants added**: self-asserted registration data must never enter `Student` before admin approval (protects roster/KPI integrity); `rollNumber` is nullable but not optional (blocks drive applications, not registration); "derive rather than store" as a general rule.
- **Pure-function-first pattern** used consistently for business rules introduced this cycle: `decideRegistrationOutcome`, `mergeOntoImportedRecord`, `decideStudentRetirement`, `partitionRows`, `getNotificationPriority`, `validateStageTransition` — each is a plain-argument function, unit tested independently of Prisma/Clerk, with the server action kept thin around it.

---

## 5. Testing

**95 new unit tests** across 9 new test files, all passing:

| File | Tests | Covers |
|---|---|---|
| `retire-student-record.test.ts` | — | Admin-promotion cleanup rule |
| `application-progress.test.ts` | — | Stage transition validation |
| `notification-priority.test.ts` | — | Priority derivation |
| `notification-grouping.test.ts` | — | Section bucketing |
| `entry-type.test.ts` | — | Diploma semester range / pre-college percentage resolution |
| `placement-status.test.ts` | — | Placement state derivation |
| `registration-schema.test.ts` | — | Registration card validation |
| `registration-match.test.ts` | — | Roster-matching and merge rules |
| `partition-rows.test.ts` | — | Excel per-row import split |

Typecheck (`tsc --noEmit`) clean after every commit. Full `vitest` suite checked after every commit against a captured baseline — **same 30 pre-existing failures throughout** (admin-assignment, admin-security, department-crud, excel-import, notification-authorization tests unrelated to this work), **zero new failures introduced**.

---

## 6. Files touched, by area

```
features/     67
app/          19
components/   17
context/      11   (docs — see below)
lib/           5
prisma/        4   (schema.prisma + 3 migrations)
scripts/       2   (make-dept-admin.ts, make-super-admin.ts)
next.config.ts 1
.claude/       1
```

### Notable new files

```
features/students/utils/
  entry-type.ts
  placement-status.ts
  registration-match.ts

features/students/actions/
  set-placement-opt-in.ts
  review-access-request.ts

features/students/queries/
  get-access-requests.ts
  get-my-access-request.ts

features/applications/
  actions/update-application-stage.ts
  utils/application-progress.ts

features/notifications/
  utils/notification-priority.ts
  utils/notification-grouping.ts
  actions/notify-eligible-students-of-drive.ts
  actions/get-unread-summary-action.ts
  queries/get-unread-summary.ts

features/excel-import/validator/partition-rows.ts
features/admin-accounts/utils/retire-student-record.ts

components/students/AwaitingApproval.tsx
components/admin/students/access-requests-panel.tsx
components/shared/company-logo-field.tsx

app/api/admin/drives/logo/route.ts
app/(admin)/admin-dashboard/drives/[id]/applications/application-stage-control.tsx
```

### Documentation kept in sync

`context/architecture.md`, `context/code-standards.md`, `context/progress-tracker.md`, `context/project-overview.md`, `context/specs_architecture/02-database-and-student-foundation.md`, `context/specs_architecture/07-excel-csv-bulk-import.md` — plus five `integration-units/` documents that describe the now-removed `placementStatus` field, each given a "SUPERSEDED IN PART" banner pointing at the current source of truth rather than being rewritten (they are delivery records of completed units).

---

## 7. Known open items (recorded in `progress-tracker.md`)

1. **Two-list import UI not built.** `partitionRows` returns both the importable and rejected lists plus the CSV shape, but the import screen still renders the old single blocked-errors view.
2. **No student test account exists.** Both of the project owner's accounts were promoted to admin roles; the diploma profile branch, opt-in toggle, and stage tracker have not been exercised end-to-end against a real student session.
3. **OTP / set-password first-login flow was discussed but not built** — Clerk's own sign-up flow already handles password + email verification, so it was judged redundant given the approval-queue design that was actually implemented.
4. **30 pre-existing test failures remain**, verified unchanged and unrelated to this work.

---

*Generated from `git log`/`git diff integration-dev..arch-fix` and the session's own commit messages. All figures above are drawn directly from the repository, not reconstructed from memory.*

---

## Later work — 2026-09-17 database session

Six commits, added after the report body above was written. They are the
database-layer work, not feature work.

| Commit | Summary |
|---|---|
| `049b984` | verify-role-sync prints which Clerk app and database answered |
| `cddeccb` | getOrCreateUser re-links a user whose email belongs to another clerkId |
| `ce4dfab` | updateAcademicInfo stops writing `entryType` to `StudentAcademic` |
| `643510c` | `Drive.eligibleDepartments` normalised into `DriveEligibleDepartment` |
| `9e94480` | `Drive.packageOffered` changed from `Float` to `NUMERIC(10,2)` |
| `3f2ae22` | promotion takes an account off the student waiting list |

### Schema

Three migrations, all applied to the live Neon database, all verified against
real data before the destructive step:

- `20260917103251_drive_eligible_department_join_table` — creates
  `DriveEligibleDepartment` (FKs to `Drive` and `Department`, both cascading,
  unique on the pair, indexed on `departmentId`) and backfills it from the JSON
  column in the same statement, dropping IDs with no matching department.
- `20260917110000_drop_legacy_drive_eligible_departments_json` — drops
  `Drive.eligibleDepartments`, after membership parity was confirmed for all 59
  drives.
- `20260917120000_drive_package_offered_decimal` — `packageOffered` from
  `double precision` to `NUMERIC(10,2)`, confirmed lossless for every existing
  row first.

### The two things worth knowing

**Eligibility is now a real FK test.** `getEligibleDrives` filtered with a
JSON-text `contains` substring prefilter that over-matched and needed an exact
re-check in JavaScript; it is now
`eligibleDepartmentLinks: { some: { departmentId } }`. Two central-drive
queries that fetched every central drive and filtered in JS now filter in the
query. Writes go through one helper, `setEligibleDepartments`, inside the same
transaction as the drive.

**`Decimal` is not a number, and is a `string` in client components.** Prisma
returns `packageOffered` as a `Decimal`; decimal.js defines `toJSON`, and
React's serializer calls it before inspecting the value, so the field arrives in
a client component as a plain `string` while TypeScript still calls it
`Decimal`. Nothing catches the difference — after the type change `tsc` reported
13 errors and none of them was a display site. Display is therefore centralised
in `formatPackage`, which accepts all three runtime shapes and replaced the
`packageDisplay || \`${packageOffered} LPA\`` expression duplicated across 13
files.

### Also fixed

A promoted account could stay on the student waiting list: `retireStudentRecord`
runs at promotion time, but an account promoted while its `StudentAccessRequest`
was still `PENDING` has no `Student` row to retire, and approving the request
afterwards created one — which is how two admins ended up in the COMP roster.
`retireStudentAccess` now retires the row *and* deletes a pending request, every
promotion path calls it (the in-app `assignDepartmentAdmin` was not calling the
retirement at all), and `reviewAccessRequest` refuses to approve anyone who is
no longer a `STUDENT`.
