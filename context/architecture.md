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
- A `DriveApplication` has a unique constraint on `(studentId, driveId)` at the database level — this is what makes "apply once" a guarantee rather than a convention. The row's *content* is never edited by the student; its `stage` and `status` are owned by the department admin running the drive and advanced through the single server action `updateApplicationStage`. A student has **no write path at all after submission**: `applyToDrive` only ever inserts, and there is no action that edits or deletes an application. Withdrawal was removed — it used to delete the row, which contradicted the "applications are final" rule in `project-overview.md` and let a student silently vacate a drive's applicant count. `ApplicationStatus.WITHDRAWN` is retained on the Prisma enum so historical rows still read, but nothing writes it: it is absent from `updateApplicationStageSchema` and refused by `validateStageTransition`.
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
- **`relationJoins` is enabled in `schema.prisma`, and that is what matters.**
  Without it Prisma emits one query per `include`d relation, so a
  nine-relation read is ten round trips. With it, `join` becomes the *default*
  for every relation read in the app — measured on this database, the student
  profile goes from 10 queries / ~3,400ms to 1 query / ~300ms. New code does
  not need to opt in; a few call sites pass `relationLoadStrategy: "join"`
  explicitly, which is documentation rather than a behaviour change. What you
  must not do is pass `relationLoadStrategy: "query"`, which opts back out.
- **Independent queries go out together.** A `count` and its `findMany` for
  the same screen do not depend on each other and belong in one
  `Promise.all`. The same goes for unrelated sections of a page.
- **Filter in SQL, not in JavaScript.** Drive eligibility by department is a
  real FK membership check — `eligibleDepartmentLinks: { some: { departmentId } } }`
  against the `DriveEligibleDepartment` join table — not a prefilter. (This
  used to be a JSON array stored as text, `Drive.eligibleDepartments`, which
  could only support a *narrowing* `contains` substring prefilter rechecked
  exactly in JS afterwards; that column was dropped once every read and write
  path moved to the join table.) The general rule still applies to any other
  filter that cannot be expressed exactly at the database: push a narrowing
  prefilter down and keep the exact check in JS. A prefilter may over-match;
  it must never under-match, or it silently hides rows a user is entitled to.

## The drive domain model

```
MASTER DRIVE          →  `Drive`
  ↓                      one row per opportunity, owned by whoever posted it
DEPARTMENT INSTANCE   →  `DriveDepartmentConfig`   unique (driveId, departmentId)
  ↓                      what a department owns and configures
APPLICATION           →  `DriveApplication`
```

`DriveEligibleDepartment` is the **assignment** edge — which departments a
master drive is open to. An instance row need not exist for an assigned
department; a missing instance means "inherit everything from the master",
which is the state every assigned department is in until its admin saves a
configuration. (Measured on production: 97 assignment rows, 0 instance rows.)

**No table was renamed to express this.** The schema already supported the
model; `features/drives/domain/` is the vocabulary laid over it, so reading the
code does not require remembering that "config" means "instance".

- **The discriminant is `DriveKind`** (`CENTRAL` | `DEPARTMENT`), derived from
  the existing `Drive.isCentralDrive` column via `driveKindOf()`. Branch on it
  rather than inferring intent from a null `departmentId` — that inference is
  what made `getDriveDetail` reject every central drive for a department admin.
  `driveKindColumns()` is the only place those two columns are set, so a
  central drive can never be given an owning department.
- **`resolveDepartmentDrive(master, instance)`** is the single abstraction for
  department-facing drives. It returns a flat object: the master row with the
  instance's values overlaid field by field (`??`, so an instance's deliberate
  empty string is kept rather than inherited), plus the three instance-only
  fields `seatingAllocation`, `specialInstructions`, `coordinatorEmail`. **That
  resolved shape is a contract** — six components read it directly, so fields
  may be added but not removed or renamed.
- **Validation is shared, not duplicated.** `schemas/drive-core.ts` holds every
  constraint both drive forms use; `drive.ts` and `central-drive.ts` compose it
  and declare only what genuinely differs (a department drive has a numeric
  package and selection rounds; a central drive has free-text CTC and derives
  its apply method from a portal URL).
- **Writes are shared too.** `domain/drive-write-data.ts` builds the column
  payload once per kind, and `domain/persist-drive.ts` owns the
  drive-plus-eligibility transaction and the audit entry. An edit never
  rewrites `isCentralDrive` or `departmentId`, so a drive cannot change kind or
  owner after creation.
- **Authorization boundaries are unchanged by the unification**: `SUPER_ADMIN`
  owns master/central drives, `DEPT_ADMIN` owns their own department's drive
  and their own instance of a central one, and a department drive reaches only
  the department that posted it.

## Assignment and the drive lifecycle

```
MASTER DRIVE      DRAFT → PUBLISHED → ARCHIVED           (Super Admin)
DEPARTMENT DRIVE  ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED
                                                          (that department's admin)
```

**Assignment is one operation, and it owns both rows.** `assignDriveToDepartments`
creates, per selected department and inside one transaction, the eligibility
edge (`DriveEligibleDepartment`) *and* the instance (`DriveDepartmentConfig`) at
`ASSIGNED`. They are the same fact recorded at two levels and must never exist
without each other, which is why `setEligibleDepartments` is no longer called
directly by any write path — its delete-and-recreate would have orphaned
instances. It is idempotent: an already-assigned department is reported back,
never duplicated, and its existing instance is left untouched.

**Unassignment is protected.** `unassignDriveDepartment` refuses when that
department's students hold applications to the drive, and reports the count. An
application is a record of something a student actually did; unassigning is
never a back door to deleting it — the same reason `DriveApplication.drive` is
`onDelete: Restrict`. The drive update paths reconcile rather than replace, and
`findBlockedRemovals` is checked *before* any write so a blocked removal refuses
the whole edit instead of committing half of it.

**Administrative CLOSED is not "the deadline passed".** Open/closed by deadline
stays derived at read time via `getDriveStatus()` and is still never stored
(invariant 7 is untouched). CLOSED is a department deciding to stop intake — it
can happen before the deadline or long after one expired. A drive can be
PUBLISHED with an expired deadline, or CLOSED with a future one; both mean "no
new applications", for different reasons.

**Publishing is per department**, and it is what students' visibility hangs on.
`publishDepartmentDrive` sets `status = PUBLISHED`, `publishedAt`,
`publishedByUserId` and `lockedAt` together, then notifies eligible students in
**that department only** — releasing a central drive in one department must not
announce it to the others still configuring theirs
(`notifyEligibleStudentsOfDrive` takes a `departmentIds` narrowing that can
never widen past the assigned set).

**Locking is read from `lockedAt`, not from `status`** — deliberately, so an
instance that is later CLOSED or ARCHIVED stays locked. Students applied against
that content and the record has to keep matching what they were shown. The
contract, all in `domain/drive-lifecycle.ts`:

- **Instance, frozen after publish:** `applicationFields`. A submitted
  application stores its answers by field key, so changing the form afterwards
  would silently re-interpret history.
- **Instance, still editable after publish:** venue, reporting time,
  coordinator name/phone/email, seating allocation, PPT link, special
  instructions. These are operational logistics, not the offer — a room changes,
  a coordinator swaps. Freezing them would force a department to un-publish for
  a room change, which is exactly what the lock exists to prevent.
- **Master, frozen once *any* department has published:** role, JD (text and
  URL), min CGPA, max backlogs, deadline, drive date, apply method, external
  URL, package, selection rounds. Changing one now would alter an experience
  students already acted on — an applicant could become retroactively
  ineligible. Compared value by value, so a Super Admin can still fix a logo.
- **Recruitment stages are never locked.** `updateApplicationStage` writes
  `DriveApplication`, not the instance, so a drive can be run to completion
  without unlocking any application content.

All of it is enforced in the server actions. A disabled input is not a lock.

**Student reads are gated on the instance.** `getEligibleDrives` requires
`departmentConfigs: { some: { departmentId: <their own>, status: PUBLISHED } }`,
and `getDriveDetail` refuses a drive whose instance for that student's
department is not PUBLISHED — with one exception: a student who already applied
keeps access to their own application's drive after it is administratively
closed. ASSIGNED and CONFIGURED instances are half-built, and showing them would
put partially configured data in front of students.

## Money is NUMERIC, and NUMERIC is not a number

`Drive.packageOffered` is `NUMERIC(10,2)`, not `Float`. Binary floating point
cannot represent most decimal fractions exactly, which shows up as drift under
`SUM` and as equality comparisons that should match and do not.

Prisma surfaces that column as a `Decimal`, and this has a consequence worth
knowing before reading it: decimal.js defines `toJSON`, and React's Flight
serializer calls `toJSON` before it inspects a value, so the field arrives in a
**client** component as a plain `string` while TypeScript still calls it
`Decimal` on both sides. The compiler cannot see the difference, and neither
can a template literal — which is why every display path goes through
`formatPackage` (`features/drives/utils/format-package.ts`), which accepts all
three runtime shapes.

The rule: **never do arithmetic on a money column outside the database.**
Format it for display, and let Postgres do the sums. A new money column gets
`@db.Decimal(10, 2)`, a zod `.refine` rejecting more than 2 decimal places at
the write boundary, and a formatter — not a `Float`.

## Index Policy

Postgres serves a lookup on a column from any btree index whose *leftmost*
column it is. An `@@index([x])` sitting alongside `x @unique`, or alongside an
`@@index([x, y])`, is therefore a second copy of the same btree that no query
can ever prefer — and that every insert and update still has to maintain.
Thirteen such duplicates were removed (68 indexes down to 55; `Student`'s
index storage 264 kB down to 176 kB). Before adding an index, check the column
is not already the leftmost of an existing one.

The more important point, measured rather than assumed: **the database is not
this app's bottleneck.** Against 500 students and ~1,500 applications, every
hot query plans and executes in well under a millisecond — the admin roster
page in 0.13 ms, the derived-placement count in 0.23 ms, the notifications
page in 0.05 ms, each on an index scan. A single network round trip to the
database is 221 ms. That is roughly a thousand to one, so schema-level work
(more indexes, denormalising for speed) cannot move the number that matters.
What moves it is issuing fewer queries per request, and putting the app server
in the same region as the database.

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
8. A `DriveApplication`'s `stage` and `status` are written by exactly one server action (`updateApplicationStage`), callable only by a department admin, scoped both to a drive they run and to an applicant from their own department. No student-facing path writes either column. Every other column on the row is immutable after creation, and the student has no mutation at all — an application is final once submitted. The `(studentId, driveId)` unique constraint is what enforces that: re-applying is the only vector a student has, and it is refused both in `applyToDrive` and at the database.
10. No column stores whether a student is placed. Placement is always computed from `DriveApplication.status = SELECTED` via `features/students/utils/placement-status.ts`. Introducing a stored placement column, or comparing the status string inline somewhere else, is not allowed.
11. When a student's entry type makes a field meaningless — a diploma student's 12th percentage, a regular student's diploma percentage — that column is `NULL`. No code path substitutes `0` for a record the student does not have.
12. Self-asserted registration details are never written into `Student` before a department admin approves them. They live in `StudentAccessRequest` until then, so an unapproved sign-up can never appear in a department roster, in `totalStudents`, or in the placement-rate denominator. Approving is what creates the `Student` row, and it takes the department from the reviewing admin, not from the applicant.
15. Being promoted to an admin role ends an account's student-ness in the same transaction as the promotion: its `Student` row is retired and any *pending* `StudentAccessRequest` is deleted, so a promoted account leaves the waiting list and gets its new role's access immediately (`retireStudentAccess`). The pending request is deleted rather than given a terminal status — `REJECTED` would permanently block re-registration if the account is later demoted back to `STUDENT`, and `APPROVED` would claim a `Student` row was created when none was. Approval is independently refused for any applicant who is no longer a `STUDENT`, so a stale queue open in another tab cannot put an admin back in the roster. A student record carrying `DriveApplication` history is never silently deleted: it refuses, and the refusal aborts the promotion.
13. `Student.rollNumber` is nullable but not optional: a lateral-entry student may register before one is issued, and `applyToDrive` refuses any application without one. It is registrar-owned once set — the student's profile can fill a blank, never overwrite an existing value.
14. Anything that can be computed is computed, not stored. `getDriveStatus()` derives open/closed from a deadline, `placement-status.ts` derives placement from applications, and `notification-priority.ts` derives urgency from a notification's type and title. A stored equivalent has to be set correctly at every write site, and the first caller that forgets produces a silently wrong value — which is exactly how `placementStatus` came to read zero everywhere.
9. A successfully-imported Excel/CSV file does not persist in Blob storage after its rows are committed — cleanup happens in the same transaction/flow as the successful import, not as a separate best-effort job. 