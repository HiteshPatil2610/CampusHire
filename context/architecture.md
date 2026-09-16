# Architecture Context

## Stack

| Layer          | Technology                          | Role                                                         |
| -------------- | ------------------------------------ | -------------------------------------------------------------- |
| Framework      | Next.js 14+ (App Router) + TypeScript | Full-stack app: pages, layouts, server actions, API routes    |
| UI             | Tailwind CSS + shadcn/ui             | Styling and component primitives, themed via ui-context.md     |
| Auth           | Clerk                                | Sign-up/sign-in, email verification (OTP), session, role storage in user metadata |
| Database       | PostgreSQL via Neon + Prisma         | System of record for all structured data                       |
| File Storage   | Vercel Blob                          | Profile photos and job description PDFs                        |
| Deployment     | Vercel                               | Hosting for the Next.js app, connected to Neon and Vercel Blob |
| Testing        | Vitest                               | Unit tests for core logic (eligibility matching, validation)    |

## System Boundaries

- `app/` — Route segments only (pages, layouts, route handlers). No business logic lives here — routes call into `features/`.
- `middleware.ts` (root) — Clerk session/route protection only. Redirects unauthenticated requests and blocks a role from entering another role's route group. Does not perform department-scope or resource-level checks — those live in the server action/route handler itself.
- `features/` — One folder per domain: `auth/`, `students/`, `drives/`, `departments/`, `admin-accounts/`, `excel-upload/`. Each feature folder owns its own server actions, data access, validation schemas, and feature-specific components.
- `components/ui/` — shadcn/ui generated components only. Not hand-edited beyond shadcn's own CLI updates.
- `components/shared/` — Cross-feature UI (sidebar, topbar, app shell, badges, cards) used by more than one feature.
- `lib/` — Cross-cutting utilities: Prisma client singleton, Clerk helpers, role/permission checks, Vercel Blob helpers, drive-status computation (deadline → open/closed).
- `prisma/` — `schema.prisma` and migrations. The only place the database schema is defined.
- `scripts/` — One-off operational scripts, not part of the app runtime. Currently just `seed-super-admin.ts` — creates the first Super Admin in Clerk and mirrors it into Postgres. Run manually, once, per environment.
- `context/` — This six-file system. Read before any implementation work.

## Storage Model

- **Database (Postgres via Prisma)**: all structured data — users, roles, departments, student profiles (personal/academic/skills/projects/experience/certifications/preferences), drives, eligibility rules, drive applications, admin accounts, audit log entries. This is the single source of truth for anything queried, filtered, or joined.
- A drive has no stored `status` column. Whether it's "open" or "closed" is computed at read time by comparing the current timestamp to its `applicationDeadline` — every query that lists or filters drives (student-facing or admin-facing) runs through the same shared `getDriveStatus()` helper in `lib/`, so the rule can never drift between screens.
- A `DriveApplication` has a unique constraint on `(studentId, driveId)` at the database level — this is what makes "apply once" a guarantee rather than a convention. The row's *content* is never edited by the student; its `stage` and `status` are owned by the department admin running the drive and advanced through the single server action `updateApplicationStage`. A student's only write path is withdrawal, which deletes the row while the drive is open and the application is still at `APPLIED` with status `IN_PROGRESS`.
- **Placement is derived, never stored.** A student counts as placed when they hold a `DriveApplication` with `status = SELECTED`. There is no placement column on `Student` — the former `placementStatus` text column was written by nothing and read with three different casings, so every "Placed" count built on it was structurally always zero. Every screen resolves placement through `features/students/utils/placement-status.ts` (`PLACED_STUDENT_FILTER` for queries, `resolvePlacementState` for a row), so the definition cannot drift between the dept-admin and super-admin panels again.
- `Student.optedIn` records whether a student is participating in campus placement at all; `Student.optedInLocked` lets a department admin freeze that choice so the student can no longer change it. Both the student (settings) and the department admin (student roster) can write `optedIn`; only the admin can write the lock, and the server re-reads the lock before accepting a student's change.
- A student's pre-college record branches on `Student.entryType`, captured on the registration card. It lives on `Student` rather than `StudentAcademic` because it is known before any academic record exists — that table's CGPA and semester columns are `NOT NULL`, so capturing it there would need a placeholder row, and a 0.0 CGPA reads as a real value to every eligibility comparison. A `REGULAR` student submits a 12th record and studies semesters 1–8; a `DIPLOMA` (lateral-entry) student submits a diploma instead, is admitted into the second year, and has no semester 1 or 2 marks. The branch that does not apply is stored as `NULL`, never zero-filled — a 0% score would read as a real value and silently fail every eligibility comparison. `features/students/utils/entry-type.ts` owns the semester range and the "which percentage counts" resolution.
- **File Storage (Vercel Blob)**: binary/large content only — student profile photos and drive job-description PDFs, both persistent. Uploaded Excel/CSV files for bulk student import are also written to Blob, but only *transiently*: on a successful import the source file is deleted immediately after the rows are committed; on a failed/partial import it is retained so the admin (or a developer) can inspect what went wrong, and is cleaned up once the admin re-attempts or explicitly dismisses the failed batch.
- The database stores a URL/reference to any blob it needs to reference (profile photo, JD PDF, a failed import file pending review) — never the file itself.
- **Clerk**: authentication credentials and session state. The app's `User` table stores a `clerkId` foreign key and the app-specific role — it does not duplicate credentials.

## Auth and Access Model

- Every user authenticates via Clerk. Department admin accounts are created by the super admin through an internal "add admin" flow and never through public sign-up.
- Students reach the platform two ways, and both converge on the same `Student` record:
  1. **Bulk import.** A department admin imports their roster. Those rows sit in `Student` with `isPending = true` and `userId = null` — known to the college, no account yet.
  2. **Self sign-up.** Anyone can sign up through Clerk, but signing up does not grant student access. After submitting the registration card their Clerk-verified email is matched against the imported roster. A match links the account to that row (`isPending → false`) and admits them immediately, because the admin already vouched for them. No match creates a `StudentAccessRequest` and shows a "waiting for confirmation" screen until a department admin approves.
- The match key is the Clerk-verified email, never a self-typed field: it is unique on `Student`, it is what the admin entered in the sheet, and it is the one value the applicant cannot forge. A roster row already linked to another account is refused outright rather than re-linked, which would hand one student another student's record.
- The Super Admin role has no sign-up path at all — the first (and only, for V1) Super Admin is created once per environment by running `scripts/seed-super-admin.ts`, which creates the user in Clerk via its backend API and mirrors the record into Postgres with `role = SUPER_ADMIN`. This script is run manually by whoever sets up the environment (local, staging, production) — it is not exposed as an app route, and running it twice must be a safe no-op (upsert on a fixed, env-configured email).
- Role (`STUDENT`, `DEPT_ADMIN`, `SUPER_ADMIN`) is stored in Clerk's user metadata and mirrored on the app's `User` record at creation time. Role is read from the authenticated session server-side — it is never trusted from client input.
- A `Student` record belongs to exactly one `Department`. A `DEPT_ADMIN` account is scoped to exactly one `Department` via an `adminOf` relation — but a `Department` can have many `DEPT_ADMIN`s pointing at it (one-to-many from Department, many-to-one from each admin). All admins on the same department have identical permissions; the relation carries no primary/backup distinction.
- Access control is enforced in three layers: (1) Next.js middleware blocks unauthenticated access to any `(student)`, `(admin)`, or `(super-admin)` route group; (2) each server action/route handler re-checks the caller's role and department scope before reading or writing; (3) all list/read queries for a `DEPT_ADMIN` are automatically scoped with a `departmentId` filter — there is no code path that returns cross-department data to a department admin.
- Drive eligibility is computed and filtered server-side. The API/server action that lists drives for a student runs the eligibility comparison (CGPA, backlogs, department) against that student's own record before returning results — the client never receives ineligible drives to hide.

## Read Path and Query Cost

Every hosted Postgres query is a network round trip, and a page that issues
twenty of them is slow no matter how well indexed it is. Two rules keep the
read path cheap, and both are load-bearing rather than stylistic:

- **Auth helpers are request-memoised.** Every DB-reading helper in
  `lib/auth.ts` is wrapped in React's `cache()`. Pages, layouts and the query
  functions they call all re-invoke these helpers — that is the intended
  design, and it is only affordable because the first call per request is the
  only one that reaches Postgres. A new helper that reads the database on an
  authorization path belongs in that file, wrapped the same way. Do not
  "optimise" by threading the user object through every signature.
- **Multi-relation reads use `relationLoadStrategy: "join"`.** Prisma's
  default emits one query per `include`d relation, so a nine-relation read is
  ten round trips. The `relationJoins` preview feature is enabled in
  `schema.prisma` for this. Any read with more than two relations should set
  it.
- **Independent queries go out together.** A `count` and its `findMany` for
  the same screen do not depend on each other and belong in one
  `Promise.all`. The same goes for unrelated sections of a page.
- **Filter in SQL, not in JavaScript.** Where a filter cannot be expressed
  exactly — eligibility depends on `eligibleDepartments`, a JSON array stored
  as text — push a *narrowing* prefilter to the database and keep the exact
  check in JS afterwards. A prefilter may over-match; it must never
  under-match, or it silently hides rows a user is entitled to.

## Navigation and Perceived Speed

Every dashboard route is `force-dynamic`, and Next prefetches a dynamic route
only **as far as its nearest `loading.tsx`**. A segment without one has nothing
to prefetch, so the click blocks on the full server render before anything
paints. Each data-backed segment therefore has a `loading.tsx`, built from the
shared shapes in `components/shared/skeletons.tsx`. A new data-backed route
should get one too, and its skeleton should echo the real layout's blocks — a
skeleton that does not match causes a visible jump when the data arrives.

Sidebar links are left at Next's **default** prefetch, deliberately. The
default prefetches the shell only, once the link scrolls into view, and only
in production builds — `next dev` disables prefetching entirely, which is why
local navigation always feels slower than the deployed app. Setting
`prefetch={true}` on the nav would instead run a full server render, with its
queries, for all 23 destinations on every dashboard load. That is a
self-inflicted load test at 500 users, and it is the wrong trade: the shell is
what removes the perceived wait, not the data.

The app server must be deployed in the same region as the database. Latency
between the two multiplies by the query count on every single request; latency
between the user and the app server costs one round trip. Co-locating the two
is worth more than any query-level optimisation in this file.

## Invariants

1. Role and department scope are re-verified on the server for every mutation and every list query — the client's UI state is never treated as an access-control decision.
2. A department admin can only read or write students, drives, and uploads belonging to their own department. There is no query path that omits the `departmentId` filter for a `DEPT_ADMIN` caller.
3. Drive eligibility filtering happens entirely server-side. No endpoint returns the full unfiltered drive list to a student and relies on the client to hide ineligible ones.
4. Excel bulk import is all-or-nothing **per row**: a valid row is inserted, an invalid one is rejected and reported, and a partial/malformed student record is never written. One bad row does not block the rest of the file. `features/excel-import/validator/partition-rows.ts` performs the split, and is shared by the preview and the commit so the list an admin approves is computed by the same code that decides what is written.
5. Session and identity always come from Clerk. The app does not implement its own password storage, session cookies, or OTP logic. The one exception is the one-time seed script, which creates the Super Admin directly via Clerk's backend API — it does not bypass Clerk.
6. Large or binary content (photos, JD PDFs) never gets written into the Postgres database — it goes to Vercel Blob, with only the reference URL stored in Postgres.
7. A drive's open/closed status is never stored — it is always derived from `applicationDeadline` via the shared `getDriveStatus()` helper. No code path is allowed to introduce a stored status field or compute the comparison inline elsewhere.
8. A `DriveApplication`'s `stage` and `status` are written by exactly one server action (`updateApplicationStage`), callable only by a department admin, scoped both to a drive they run and to an applicant from their own department. No student-facing path writes either column. Every other column on the row is immutable after creation. The student's only mutation is withdrawal, which deletes the row rather than editing it.
10. No column stores whether a student is placed. Placement is always computed from `DriveApplication.status = SELECTED` via `features/students/utils/placement-status.ts`. Introducing a stored placement column, or comparing the status string inline somewhere else, is not allowed.
11. When a student's entry type makes a field meaningless — a diploma student's 12th percentage, a regular student's diploma percentage — that column is `NULL`. No code path substitutes `0` for a record the student does not have.
12. Self-asserted registration details are never written into `Student` before a department admin approves them. They live in `StudentAccessRequest` until then, so an unapproved sign-up can never appear in a department roster, in `totalStudents`, or in the placement-rate denominator. Approving is what creates the `Student` row, and it takes the department from the reviewing admin, not from the applicant.
13. `Student.rollNumber` is nullable but not optional: a lateral-entry student may register before one is issued, and `applyToDrive` refuses any application without one. It is registrar-owned once set — the student's profile can fill a blank, never overwrite an existing value.
14. Anything that can be computed is computed, not stored. `getDriveStatus()` derives open/closed from a deadline, `placement-status.ts` derives placement from applications, and `notification-priority.ts` derives urgency from a notification's type and title. A stored equivalent has to be set correctly at every write site, and the first caller that forgets produces a silently wrong value — which is exactly how `placementStatus` came to read zero everywhere.
9. A successfully-imported Excel/CSV file does not persist in Blob storage after its rows are committed — cleanup happens in the same transaction/flow as the successful import, not as a separate best-effort job. 