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

## The Master Drive → Department Drive workflow

```
SUPER ADMIN   Master details → Admin edit permissions → Recruitment stages
              → Review → Department assignment        (post-central-drive-modal)
DEPT ADMIN    Drive details → Student auto-fill fields → Eligibility criteria
              → Eligible batches → Recruitment stage review → Student preview
              → Publish                                (department-drive-config-panel)
STUDENT       Published + eligible department drive → details → application
              → snapshot → recruitment pipeline
```

- **The master is the company-level truth.** Company, logo, package, role, JD,
  dates, the master recruitment pipeline (`Drive.masterPipeline`, a validated
  JSON template — see `features/recruitment/domain/master-pipeline.ts`) and
  which details departments may edit. The Super Admin does **not** configure
  student application fields; each department does, in the existing
  `DriveApplicationField` system.
- **Admin edit permissions are data, enforced on the server.**
  `Drive.departmentEditableFields` lists the content fields a department may
  override (`DEPARTMENT_EDITABLE_FIELDS`: role, JD, requirements, skills, drive
  date, deadline); anything else is LOCKED to the master's value.
  `saveDriveDepartmentConfig` refuses an override of a locked field
  (`findLockedOverrideAttempts`) whatever the form sent; clearing an override
  back to the master is always allowed. Only the Super Admin changes the list
  (`setDepartmentEditPermissions`, audited); locking a field clears existing
  overrides of it on unpublished department drives only. A CHECK keeps the
  column to known keys. Existing central drives were migrated with all six
  open — what departments could already do.
- **Only selected departments get the drive.** Creation assigns exactly the
  departments picked in the last step (none are preselected); a department
  admin's list is its assignments only.
- **Recruitment stages start from the master.** A department drive's first
  pipeline version is copied from the master's stages
  (`initialDepartmentPipeline`) when it first needs one — a proposal, or
  publishing. For a Super Admin drive the department admin only *reviews*
  stages and proposes changes, before and after publishing; the Super Admin
  approves (unit-3's request flow). A department's own drive is still edited
  directly until published. When the Super Admin changes the master pipeline,
  unpublished department drives still running the previous master stages
  unchanged follow; the others keep their own.
- **Draft, save, continue.** Every step saves as a draft (venue and reporting
  time are no longer required to save). `departmentDriveReadiness` computes,
  from the stored, resolved configuration, which steps are complete — the
  wizard opens at the first incomplete one — and whether it may be published.
- **Publish validation is that same function, on the server.**
  `publishDepartmentDrive` refuses unless `readiness.ready`: role and JD, valid
  dates, deadline in the future and before the drive date, venue and reporting
  time, a valid form with at least one field, a valid rule set, batch
  targeting, a valid pipeline, the assignment, the lifecycle state, and a
  master that is not cancelled or archived. Every issue is listed at once.
- **The preview is the student's view.** `buildStudentDriveView`
  (`domain/student-drive-view.ts`) builds what a department's students
  receive; `getDriveDetail` (the student page) and
  `getDepartmentDrivePreview` (the admin's final step) both call it, from the
  same rows loaded with the same include. There is no preview model.

## The department drive workspace

A department admin runs a drive from one screen, `/admin-dashboard/drives/[id]`,
with a tab per concern in the URL (`?tab=`): Overview, Eligibility, Eligible
Students, Registered Students, Applications, Recruitment Pipeline, Placement,
Activity. Only the open tab's data is loaded, so the eligibility evaluation over
a department runs only where it is needed. The old `/applications` route
redirects to the Applications tab.

- **Eligibility is never recomputed in the UI.** `getDriveStudents` judges every
  student of the department with the central evaluator (standing first, then
  department, then every rule); the Eligible and Registered tabs only filter
  what it returns (search, batch, eligibility, placement, application status).
- **Applications** filter by search, batch, stage and status through
  `getDriveApplications`, always inside the department scope; a filter value
  that is not valid is dropped, never passed on. Stages come from the drive's
  active pipeline — the UI names none of them.
- **One move implementation.** `moveApplication`
  (`features/applications/domain/move-application.ts`) holds every rule for
  moving an application; `updateApplicationStage` and the bulk action are thin
  callers. It has a `dryRun` that judges exactly like a real move and writes
  nothing.
- **Bulk moves** (`bulk-update-application-stage.ts`) are two server steps:
  `validateBulkStageMove` (dry run: which would move, which would not, and why)
  then `bulkUpdateApplicationStage` (each application in its own transaction,
  every success and failure returned, one audit entry for the operation, at most
  100). Ids are looked up inside the caller's department and the named drive, so
  an id that is not theirs is "not found". SELECTED is refused in bulk: it
  creates a permanent placement, so it is made one student at a time.
- **Placing is confirmed.** Selecting an application creates the placement, and
  the UI always asks first (`PlacementConfirmDialog`): what is recorded, that it
  permanently excludes the student from future drives, that history is kept, and
  an acknowledgement. The Placement tab lists applicants waiting at the Offer
  stage and the drive's placements (revoked ones included), with revoke.
- **Stage history** (`getApplicationStageHistory`) and **activity**
  (`getDriveOperationsActivity`) are read-only and department-scoped; activity
  is built from the audit log through this department's own applications and
  placements, so another department's activity on the same master drive never
  appears.
- **Super Admin** has `/super-admin-dashboard/placements`
  (`getGlobalPlacements`): every placement, read-only, filtered by department,
  company, batch, placement date, drive and student. Its filters arrive in the
  URL and are validated before they reach the query. The master-drive detail
  has a real Activity tab (`getDriveActivity`, from the audit log) and an
  applications drill-down that matches departments by code.

## Assignment and the drive lifecycle

```
MASTER DRIVE      DRAFT → PUBLISHED → ARCHIVED           (Super Admin)
DEPARTMENT DRIVE  ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED
                                                          (that department's admin)
and from any live state → CANCELLED → ARCHIVED
```

**Cancellation is a transition, never a deletion.** A department admin cancels
their own department drive; the Super Admin cancels one department's, or the
master (which cancels every live department drive of it). A reason is
required; `cancelledAt`, `cancelledById` and `cancellationReason` are
recorded (CHECKs require them on a cancelled row and forbid them elsewhere).
Cancelled drives take no applications, vanish from students' lists, and their
applications no longer move; applications, snapshots and stage history are
kept, and a student who applied still sees the drive, marked cancelled.
Applicants — and department admins, when the Super Admin cancelled — are
notified; the cancellation is audited.

**Deadline extension is controlled.** Only the Super Admin extends a published
department drive's deadline (`extendDepartmentDriveDeadline`): later only,
into the future, before the drive date. It writes that department's deadline
override, audits old and new with a reason, notifies its applicants and
eligible students, and never touches application snapshots — each records the
deadline that applied when it was submitted.

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

- **Instance, frozen after publish:** the application form
  (`DriveApplicationField` rows, snapshotted at publish). A submitted
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
- **Published = read-only for the department** (content, eligibility,
  batches, application form). The Super Admin keeps audited controls: the
  pipeline (`setPipelineAsSuperAdmin`), the deadline extension and
  cancellation. There is no unlock.
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

## Department-specific drive configuration

The master holds the institution/company-level defaults. Each department
instance may override, for its own students only: role title, job
description, requirements, skills, drive date, application deadline, selection
rounds, min CGPA, max backlogs, the application form, and logistics.

```
Master  ABC · Software Engineer · 8 LPA · CGPA 7.0
CSE     (role inherited)             · CSE JD · CGPA 7.5
IT      Backend Developer            · IT JD  · CGPA 7.0
ECE     Embedded Software Engineer   · ECE JD · CGPA 6.5
```

- **NULL on the instance means "inherit".** Overrides are nullable columns on
  `DriveDepartmentConfig`; the master row is never copied per department, and a
  value is stored only where a department deliberately differs. Company and
  package are not overridable.
- **`OVERRIDABLE_FIELDS`** in `domain/resolve-department-drive.ts` is the single
  map of master field → instance column. The resolver, the lock list and the
  admin UI all read it, so they cannot disagree about what is overridable.
  Resolution is `override ?? master` — `??`, so a 0-backlog or 0-CGPA override
  is honoured rather than falling back.
- **Every department-facing read decides on the resolved drive**: the student
  list and detail page, `applyToDrive`, the notification fan-out, the student's
  own applications list, stage-change notifications, the admin's drive list and
  the admin's live preview (which runs the same resolver client-side on the
  unsaved form). A path that reads the master instead silently applies the
  wrong department's bar.
- **The listing no longer prefilters CGPA, backlogs, deadline or role in SQL.**
  Those are overridable, so a master-based prefilter would under-match — a
  department lowering the bar to 6.5 on a 7.0 master would lose its 6.8
  students before the resolver saw the drive. SQL narrows on exact membership
  only (assigned to the department, its instance PUBLISHED, master not
  ARCHIVED); the rest is decided in JS on resolved values, over one
  department's published drives.
- **Isolation.** `saveDriveDepartmentConfig` writes one row keyed by
  `(driveId, <session department>)` and has no path to the master `Drive` row.
  Override input is three-state: absent leaves the stored value untouched,
  `null` clears back to inheriting, a value sets it. Dates are validated on
  resolved values, so an override on one date must agree with the inherited
  other.
- **Locking** (from the lifecycle) now freezes every content override, not just
  the application form. The form comparison uses what students of that
  department actually see (see "The application form is per department"), so a
  logistics-only save on a published drive whose form was never customised is
  not mistaken for a form change.
- **Historical data is preserved.** The migration is additive; every existing
  instance has every override NULL and resolves to exactly its previous values.

## Eligibility is a rule engine

Eligibility is a set of relational rules per department instance, evaluated by
**one** pure function. The drive list, the detail page and its checklist,
`applyToDrive` and the notification fan-out all decide through it, via the
facade in `features/drives/queries/drive-eligibility.ts`; there is no second
implementation anywhere, so a student can never be shown a drive the apply
action refuses, or notified about one the list hides.

```
DriveEligibilityRule { driveId? | driveDepartmentConfigId?, ruleType, operator,
                       numberValue? | listValue[] }
```

- **The catalogue is the grammar** (`domain/eligibility-rules.ts`). Every rule
  type maps to a column the Student model actually has: CGPA, active and past
  backlogs, 10th / 12th / diploma / "12th or diploma" percentage, current
  semester, batch year, entry type, and skills. Each type has fixed operators
  and exactly one value kind, so "CGPA ≤ 7" cannot be expressed. Gender and
  per-semester SGPA are deliberately absent. Department is not a rule — it
  decides *whose* rule set applies.
- **Ownership and shape are enforced in the database** by two CHECK constraints
  (in the migration SQL, since Prisma cannot express them): exactly one owner,
  exactly one value column. Per-type validity is enforced at the write
  boundary by `domain/eligibility-rule-schema.ts` — operator allowed for the
  type, bounds, integers, decimals, real years and entry types, no duplicate
  `(type, operator)`, coherent semester ranges.
- **Master defaults, per-type department override.** A department rule of a
  type replaces the master's rules of that type for that department only; every
  other master rule is inherited (`resolveEligibilityRules`). A department
  cannot *delete* a master rule of another type, only override it.
- **Missing is never zero.** A diploma student has no 12th record; a 12th rule
  fails with "no 12th record", never with "0% < 60%" (invariant 11).
- **Subjects come from records only.** `toEligibilitySubject` builds from
  server-loaded rows; nothing in a request is ever evaluated. The facade types
  *require* the student's skills and the drive's resolved rule set, so a caller
  that forgot to load either does not compile.
- **SQL narrows on membership and lifecycle only** — assigned to the student's
  department, instance PUBLISHED, master not ARCHIVED — and loads both rule
  sets in the same query. Every rule is decided in JS on the resolved set.
- **Locked with the instance.** A published instance's rule set cannot change
  (compared as a set, order and list-case insensitive); the master's extra
  default rules freeze once any department has published.
- **Legacy compatibility.** `Drive.minCGPA` / `maxActiveBacklogs` and their
  instance overrides are kept and dual-written as mirrors of the CGPA and
  ACTIVE_BACKLOGS rules, in the same transaction. If a drive somehow has no
  stored rule of those two types, `withLegacyRules` derives it from the column;
  a stored rule always wins. Remove both when the columns are dropped.

## The application form is per department

Before publishing, a department admin decides exactly which fields its students
see on the application, which are required, and which they may edit. The form
is relational:

```
DriveApplicationField { driveId? | driveDepartmentConfigId?, fieldKey, label,
                        source, category, description?, isRequired, isEnabled,
                        sortOrder, permission (READ_ONLY | EDITABLE) }
```

- **Whole-form resolution, rows first** (`resolveApplicationForm` in
  `domain/application-form.ts`): the department's rows → its legacy JSON →
  the master's rows → the master's legacy JSON → the catalog default form. A
  department that configured its form owns all of it, as the legacy
  `config.applicationFields ?? drive.applicationFields` did. Every reader —
  the student list and detail page, `applyToDrive`, the admin panel and its
  preview — goes through `resolveDepartmentApplicationForm`, which *requires*
  both `formFields` relations so a caller that forgot to load them does not
  compile.
- **A closed vocabulary.** A key is a catalog key or `custom_<a-z0-9_>`;
  nothing else is ever stored. Catalog labels, sources and categories come from
  the catalog, never the client. A catalog field may only take a permission
  it allows — the registrar records (CGPA, roll number, department, backlogs…)
  are read-only only; `EDITABLE_CAPABLE_KEYS` in the catalog lists the rest. A
  custom question is always student input and always editable. Enforced by
  `applicationFormSchema` at every write and by five CHECK constraints in the
  migration (one owner, safe key pattern, custom ⇒ student input + editable,
  label present, non-negative order).
- **The browser is never trusted.** `applyToDrive` rebuilds the form from the
  database and the student's own profile and judges the submission with
  `validateApplicationSubmission`: a read-only value always comes from the
  profile (anything submitted for it is ignored), a required read-only value
  missing from the profile refuses the application ("add it to your profile
  first"), a required editable field must be non-empty, what the student typed
  must be well-formed (links, emails, phone), and unknown or disabled keys are
  dropped. `submittedDetails` stores the effective value of every enabled
  editable field.
- **Locking.** A department's form freezes when its instance is published
  (`lockedAt`). `publishDepartmentDrive` snapshots an inherited form into the
  department's own rows in the same transaction, so a later change to the
  master's default can never reach students who applied. A central drive's
  default form freezes once any department has published. A department-owned
  drive is published the moment it is posted, so its form freezes on the first
  application instead. Compared with `applicationFormKey` — the enabled fields
  in order with label, requirement, permission and source — so resubmitting an
  unchanged form with a logistics edit goes through.
- **The admin preview is the student card.** `buildPreviewReviewRows` and
  `buildApplicationReviewData` group by the same rule (configured permission;
  registrar keys shown as institutional records), and the preview runs on the
  unsaved form.
- **Legacy compatibility.** `Drive.applicationFields` /
  `DriveDepartmentConfig.applicationFields` are kept and dual-written by
  `writeMasterForm` / `writeDepartmentForm` in the owning transaction (the JSON
  now carries `permission`). `parseLegacyApplicationFields` reads them
  defensively: unknown, unsafe or duplicate keys are dropped and reported, a
  stored permission is honoured only if the key allows it. Remove both with
  the columns.

## Placement is permanent exclusion

```
StudentPlacement { studentId, source: APPLICATION | MANUAL, applicationId?,
                   driveId?, companyName, roleName, packageOffered?,
                   packageDisplay?, placedAt, recordedById?,
                   revokedAt?, revokedById?, revokeReason? }
```

- **Created two ways, both by a department admin.** Marking an application
  SELECTED (`updateApplicationStage`) creates an APPLICATION placement in the
  same transaction, with the company, package and the role *as that
  department ran it*. `recordManualPlacement` records an off-campus offer
  (MANUAL). Both are scoped to the admin's own students and audited.
- **Placed stops the evaluator.** `evaluateEligibility` checks standing first,
  in order — approved, **placed**, opted in, department — and the first
  failure ends evaluation with `blockedBy` set and no rule evaluated. A
  placed student is ineligible *because they are placed*; their CGPA, batch
  and every other rule are never read or reported. `toEligibilitySubject`
  requires the student's placements, so a caller that forgot to load them
  does not compile — which is how every path (list, detail, dashboard, apply,
  notifications, the admin's eligible list) was found and fixed.
- **Existing applications are untouched.** A student placed while other
  applications are in progress keeps them, with their snapshots and audit
  history; the admin applications table marks them "Placed elsewhere". Only
  new applications are blocked.
- **History, not state.** A trigger refuses any change to a placement except
  its one-time revocation (when, by whom, and a reason of at least five
  characters — a CHECK). A SELECTED application is final (the application
  trigger refuses moving it), so the only correction is revoking the
  placement, by the student's department admin or the Super Admin. Nothing
  deletes a placement; retiring a promoted student's record is refused while
  it holds any placement history.
- **Reads.** Department admin: history, record and revoke in the student
  dialog. Super Admin: placement state and companies across the institution,
  and revoke. Student: a read-only card on the dashboard. Every count and
  roster uses `placement-status.ts`, including the raw-SQL reports via
  `placedStudentSql`.
- **Migration.** Every SELECTED application was backfilled into a placement in
  the migration itself, so the placed set was identical before and after
  (verified: 235 placements, the same 193 students).

## Batch targeting

Which batches a drive is open to is the drive's `BATCH_YEAR IN (…)` eligibility
rule on `Student.batchYear` — not a second store — evaluated like every other
rule (`domain/batch-targeting.ts` only reads and writes that rule). The
picker offers the batch years the department's students actually have, with
counts (`getDepartmentBatchYears`); nothing is hard-coded.

- **Required before publishing.** `publishDepartmentDrive` refuses a drive
  whose effective rule set (the department's, else the master's) targets no
  batch. A department-owned drive is published when posted, so its create and
  edit forms require at least one batch (`driveSchema.batchYears`).
  Instances published before this rule keep publishing to every batch.
- A student whose batch is not on record fails a batch rule — it never passes
  by default.
- The department admin's **eligible-student list**
  (`getDepartmentDriveEligibleStudents`) evaluates every student of the
  department on the saved configuration through the same evaluator, with the
  reasons the rest are not eligible and how many are excluded as placed.

## Recruitment pipelines are configured and versioned

```
DriveDepartmentConfig ── RecruitmentPipelineVersion (v1, v2 …; one ACTIVE)
                              └── RecruitmentStage (name, stageType, order,
                                  description, instructions, visibility,
                                  scheduledAt, location, isEnabled)
DriveApplication.currentStageId ──► RecruitmentStage
ApplicationStageEvent (from/to stage, from/to status, version, actor, note)
PipelineChangeRequest (base version, proposed stages, reason, PENDING →
                       APPROVED | REJECTED, requester, reviewer)
```

- **Per department drive, nothing hard-coded.** Each department drive's
  pipeline is Application → any typed rounds → Offer
  (`features/recruitment/domain/pipeline.ts`, `validatePipelineStages`).
  Stage types: APPLICATION, APTITUDE, CODING, GROUP_DISCUSSION,
  TECHNICAL/HR/MANAGERIAL_INTERVIEW, PRESENTATION, ASSESSMENT, OFFER, CUSTOM.
  Counts (`getDriveRecruitment`) are grouped by configured stage; no stage
  name appears in code.
- **Versions, not edits.** A version and its stages never change (triggers);
  a change is the next version, the previous one SUPERSEDED, exactly one
  ACTIVE (partial unique index). `createPipelineVersion` is the only writer,
  and mirrors stage names into the legacy `selectionRounds`.
- **Applications keep their history.** An application points at the stage it
  is in, in whatever version. It may take an outcome where it stands; the next
  move goes to a stage of the **active** version, and it joins that version.
  Every move writes an `ApplicationStageEvent` with the version.
- **Moves are checked on the server** (`updateApplicationStage`,
  `validatePipelineTransition`): the stage id must belong to this
  department's instance of this drive, to the active version (or be the
  current stage), be enabled; SELECTED only at an Offer stage; a selection is
  final; nothing moves into WITHDRAWN. The legacy `stage` enum is
  dual-written (`legacyStageFor`).
- **Who changes a pipeline.** Before publishing: the department admin, directly
  (`saveDraftPipeline`). After publishing: the department admin can only
  propose (`proposePipelineChange`, reason required, one PENDING per drive);
  the Super Admin approves or rejects (`reviewPipelineChange`) — never their
  own request (also a CHECK), and approval is refused if the pipeline moved on
  since the proposal. Rejection leaves the pipeline untouched. The Super Admin
  may also set a pipeline directly (`setPipelineAsSuperAdmin`, audited;
  no UI yet). Selection rounds cannot be changed around this: the drive forms
  refuse a rounds change once a pipeline exists.
- **Creation.** Version 1 is built from the drive's selection rounds
  (`pipelineFromRounds`) when a department drive is published, when a
  department posts its own drive, or — as a fallback — when the first
  application arrives. Existing data was backfilled
  (`scripts/backfill-recruitment-pipelines.ts`).
- **Students only read**: the stage name if the stage is visible to students,
  otherwise "In progress"; the drive page lists the visible stages.

## An application is server-decided, final, and reproducible

`applyToDrive` is the only student write path to `DriveApplication`, and it
decides everything from the database — nothing in the request but the drive
id, the editable answers and the consent is read, and those only as input to
be validated:

1. The input shape (drive id, string answers, boolean consent).
2. An authenticated student with a profile.
3. **Standing**, from the evaluator itself (`evaluateStanding`), before the
   drive is even loaded: registration approved, then **not placed** — a
   placed student stops here — then opted in. See "Placement is permanent
   exclusion".
4. The student's department has an instance of the drive, it is PUBLISHED,
   and the master is not ARCHIVED.
5. Eligibility on the department's resolved rule set — department membership,
   batch (`BATCH_YEAR` rules), CGPA, backlogs, skills — and its own deadline.
6. No existing application (and the `(studentId, driveId)` unique constraint).
7. Consent is `true`, and — when the client says which declaration it showed
   — it is the current `APPLICATION_DECLARATION.version`.
8. The department's application form, rebuilt from the database
   (`validateApplicationSubmission`).

**One transaction** then writes the application, its
`DriveApplicationSnapshot` (nested create) and two audit rows (APPLY, and the
snapshot's CREATE, via `createAuditLogInTransaction` as the student). Any
failure rolls all of it back; the notification is sent only after commit.

**The snapshot** (`features/applications/utils/application-snapshot.ts`) is a
versioned JSON document, one per application:
- the student facts eligibility read: CGPA, backlogs, percentages, semester,
  batch, entry type, department, skill names;
- placement at submission;
- the effective rule set with its source, and each rule's result;
- the form (fields, permissions, origin) with the value of every field as
  recorded, the submitted answers, and the declaration version and time;
- the drive content as this department ran it, plus the master id, the
  department-drive id, its status, publish/lock times and `updatedAt`s.

Three hashes — form (`applicationFormKey`), eligibility (`ruleSetKey`) and
drive content — sit in columns so snapshots can be compared without parsing.
Nothing the form did not ask for is stored (no date of birth, address or
contact details unless the department put them on the form).

**Revisions without a revision table.** The snapshot carries the resolved
content, not a pointer to it, so it stays reproducible whatever later happens
to the drive, its rules, its batch targeting, its form or the student's
profile. The publish lock and the snapshotted department form (earlier
phases) already stop most of that from changing; the snapshot covers the rest.

**Immutable in the database, not only in code.** A trigger refuses any UPDATE
of a submitted application's `studentId`, `driveId`, `appliedAt`,
`snapshotCgpa`, `snapshotBacklogs`, `submittedDetails`,
`consentAcceptedAt` or `createdAt` — from Prisma or raw SQL. `stage`,
`status`, `stageUpdatedAt` and `stageUpdatedById` stay writable for
`updateApplicationStage`. A second trigger refuses any UPDATE of a snapshot.
DELETE is not blocked: an application still goes with its student's cascade.
CHECKs: payload is a JSON object, `schemaVersion ≥ 1`, and a SUBMISSION
snapshot must carry all three hashes.

**History before snapshots.** Every application that predates the table has a
BACKFILL snapshot built from only the inline columns recorded at submission,
with `notCaptured` listing what was not (rules, form, drive content,
placement, batch). It never reconstructs those from today's data.
`getApplicationRecord` reads the snapshot and falls back to the inline
columns (`origin: LEGACY_COLUMNS`), and is scoped: the student's own, a
department admin's own applicant on a drive they run, or a Super Admin.

## Action-required dashboards, exports and reminders

- **Action items are computed, never stored.** `features/dashboard` builds each
  role's "Action required" panel from current state on every render, so an item
  vanishes the moment the thing it asks for is done — a profile completed, an
  application submitted, a request decided — and cannot be stale. The pure
  builders (`action-items.ts`) hold the rules: urgent leads, a long list is
  grouped, a closed deadline or a submitted application is never listed. The
  department admin's and Super Admin's queries take no id from a request and
  are scoped by their authority; the student's eligible drives arrive already
  judged by the evaluator, so nothing is re-derived. "Ready to publish" asks
  `evaluateDepartmentDriveReadiness`, the same check the Publish button and the
  ready-to-publish notification use.
- **One CSV formatter.** `lib/csv-format.ts` (`csvCell`, `rowsToCsv`) is the
  only place a value becomes a CSV cell and the only place a spreadsheet
  formula is defused. The browser download (`lib/csv-export.ts`) and the
  server export both use it; there is no second export library.
- **An export is a dataset name, never a query.** `exportDriveDataset` takes
  one of eight datasets (eligible, applicants, shortlisted, test, interview,
  selected, rejected, placed) and decides everything else: who is asking (live
  authorization), that the drive is theirs (a drive they do not run reads as
  not found), which rows (a department admin's are always their own
  department's, whatever the request says), and which columns (an allowlist per
  dataset and role — no ids, credentials or document links). "Eligible" comes
  from the central evaluator and is a department admin's export, because
  eligibility is decided per department. Oversized exports are refused, not
  truncated, and every export is audited (who, dataset, scope, row count).
- **Bulk stage moves** are unit 6's validate-then-apply (`moveApplication`
  underneath, per-application results, SELECTED refused); the one audit entry
  now names the operation, drive, department, target/moved/failed counts.
- **Reminders are the existing notification machinery.** "Remind eligible
  students" is a keyed fan-out (`sendDeadlineReminder`): the same audience as
  the publish announcement (evaluator, department, batch, placement
  exclusion), the same per-student key as the automatic closing-soon reminder —
  so nobody is reminded twice — and at most one per drive per department per
  day. Applicants are left out; a closed, unpublished or cancelled drive
  cannot be reminded about. It is recorded, retried and audited like any other
  fan-out.

## A submitted application can be read back exactly as it was

The snapshot is not an archive nobody opens. `getApplicationRecord` is the one
authorized read — the student's own, an applicant from the admin's own
department on a drive they run, or any for the Super Admin, with not-found and
not-yours saying the same thing — and `domain/submission-record.ts` turns it
into what a person sees: the answers under the labels the student was shown,
which of them came from the profile rather than being typed, and **the
eligibility criteria as they stood at submission**, never as the drive's rules
stand today. A drive republished under a different rule set therefore cannot
rewrite the history of who was eligible under the old one. The document is read
defensively — it was written by an older version of this code — so a missing
piece reads as "not recorded" rather than throwing inside a table row, and
`origin` always says whether it was recorded at submission, reconstructed
later, or predates snapshots entirely.

## The Clerk webhook is the one unauthenticated entry point

`/api/webhooks/clerk` is the only route a stranger can POST to, so it refuses
before it reads: no Svix headers, a signature that does not verify, or no
configured `CLERK_WEBHOOK_SECRET` each return without touching the database.
Past that it is deliberately dull — it upserts on `clerkId`, so Clerk's retries
cannot create a second account, and it writes `STUDENT`. **A webhook promotes
nobody.** The public metadata on the event is passed to
`applyAdminInvitation` as evidence, never applied as fact; only an open
invitation for that address and department can make an admin. The role is then
mirrored into Clerk's metadata for the middleware, best-effort: the database is
the authority, so a failed mirror never loses the account. A failed write
returns 200 rather than inviting an endless retry, and is logged for review.

## Authorization is a property of the function, not of the page

- **A function that reads the database carries its own authorization.** Being
  rendered beside a guarded page is not a guard: a server action is callable
  directly, and a query a client component can reach is a server action
  whether or not it says so. Every exported action and every query a client
  component imports asks `lib/auth` for the caller before it reads anything,
  and the department, the student and the drive scope all come from that
  answer rather than from the request.
- **A refusal says no more than a permitted answer would.** Not found and not
  yours read the same wherever an id can be guessed — applications, drives,
  placements, students — so no path can be used to discover which ids exist in
  another department.
- **A refusal is recognised by its type.** `AuthenticationError` and
  `AuthorizationError` are what an action catches; nothing tests the words in
  an error message, because a message that is reworded then silently turns a
  refusal into an unexplained failure.
- **Query filters are typed.** Every `where` is a `Prisma.<Model>WhereInput`,
  never `any`, and the clause that carries the department scope is written so
  no optional filter can overwrite it. An untyped filter is how a misspelled
  key becomes a clause Postgres ignores — and a scoped query becomes an
  unscoped one — without anything failing.
- **The middleware is a redirect, not a gate.** It reads Clerk metadata for
  speed and sends the wrong role home; it is never the thing that decides.
  Disabling a department admin does not change their Clerk metadata, so the
  only reason a disabled admin gets nothing is that every department-scoped
  path goes through `requireDepartmentAdmin`.

## Department admins are invited, not created

CampusHire issues no credential. A Super Admin invites an email address; the
invitation goes out through Clerk, which owns the sign-up and the password.
No password is generated, emailed or stored, and there is no second identity
system — the previous flow, which created a Clerk account with a placeholder
password and told the admin to use "forgot password", is gone.

- **The invitation is a record.** `AdminInvitation` holds who was invited, by
  whom, to which department, when, how often it was resent, and what became of
  it (INVITED → ACCEPTED or REVOKED). Resending revokes the old Clerk
  invitation first, so only one link is ever live, and a partial unique index
  allows one INVITED row per address.
- **Acceptance is trusted on the invitation, not the email.** The role and
  department travel in the Clerk invitation's public metadata; on sign-up
  (`applyAdminInvitation`, called by the webhook and by `getOrCreateUser`,
  whichever arrives first) they are matched against an open invitation *for
  that address and that department*. Metadata alone promotes nobody. The
  status change is a compare-and-set, so both callers can run and only one
  applies.
- **Conflicts are named, never overwritten.** Every way an address can already
  be known — a waiting invitation, an active or disabled admin, a Super Admin,
  a student, any existing user, a Clerk account CampusHire has never seen —
  has one answer in `invitation-conflicts.ts`, and each says which action
  would be right instead (resend, reactivate, or assign the existing account).
- **Disabling replaces deletion.** `DepartmentAdmin.status` is the
  authorization. Disabling keeps the row, the drives they published, the
  applications they moved and every audit entry naming them; what stops is
  access. `getActiveDepartmentAdmin` and `requireDepartmentAdmin` are the two
  places that answer "does this person run a department", so a disabled admin
  is refused everywhere at once — and they stop being a recipient of that
  department's notifications too. Reactivation restores the role if it was
  changed while they were out. Moving an admin to another department leaves
  what they did in the old one exactly where it is.
- **Audited:** invited, resent, revoked, accepted, disabled, reactivated,
  department changed.

## Settings are only what the app honours

A stored setting nothing reads is worse than no setting: it tells an
administrator something is in force when it is not. Every field in
`InstitutionSettings` and `DepartmentSettings` names its reader.

- **Institution (Super Admin):** the institution's name; the placement season,
  which — when `enforceSeasonWindow` is on — refuses a drive *date* outside it
  as the drive is created (never retroactively, so drives and applications
  that exist are untouched); the default CGPA and backlog bar and the default
  recruitment stages, which prefill a new drive and are judged by the same
  validators a real drive's are. One row, enforced by a CHECK.
- **Department (its own admins):** venue, reporting time, coordinator, contact
  and instructions, prefilled into a drive that is not yet published, and a
  default batch year for adding students. The department comes from the
  session — the action's input has no department field at all — so there is no
  request that writes another department's settings, and defaults never
  override a field the Super Admin locked, never touch a published drive and
  never bypass the lifecycle.
- **Identity and passwords are Clerk's.** Every settings screen says so and
  links there. CampusHire has no password setting of its own.
- Sensitive changes are audited; display preferences are not.

## Notifications and announcements

One `Notification` table serves all three roles; what differs is the event,
the wording and where "open" goes. Nothing about a notification is chosen at
the call site.

- **One writer.** `deliverNotification` (`lib/notifications.ts`) is the only
  code that writes a notification row. A producer names an **event** and hands
  over recipients it resolved from the database; the **event registry**
  (`features/notifications/domain/events.ts`) supplies the category, the
  default priority, the legacy `type` and which roles may receive it.
- **Recipient authorization.** Delivery re-reads its recipients by id *and*
  role, so a student event can never land in an admin's centre, and an id that
  is not a user of that role is dropped. An event delivered to a role it is not
  defined for throws — that is a producer bug, not a runtime condition.
- **Idempotency is in the database.** Every row carries a `dedupeKey`, unique
  per `(userId, dedupeKey)`. A repeated publish, a retried action, a refreshed
  page or a re-run fan-out writes nothing the second time. A daily digest
  (`collapse`) refreshes its one row instead of adding another.
- **Fan-outs are recorded.** An event that notifies many people runs through
  `runNotificationDispatch`, which keys the fan-out in `NotificationDispatch`
  (claim by compare-and-set on status and `updatedAt`), records PENDING →
  SENT/FAILED with the error and the attempt count, audits it, and alerts the
  Super Admins when it fails. That row is also the delivery record and the
  retry handle: `retryNotificationDispatch` re-resolves everything from the
  stored ids, and the per-recipient keys mean a retry only fills gaps.
  In-app notification is the only channel — SENT means rows were written;
  nothing is emailed, and no screen claims otherwise.
- **Preferences.** `NotificationPreference.mutedEvents` silences only events
  the registry marks optional for that role. Outcomes, cancellations, access
  decisions, stage-change reviews and system alerts are never optional, and an
  URGENT announcement is delivered regardless.
- **Links.** `actionUrl` is built server-side for the recipient's role and must
  be an in-app path — checked in code and by a CHECK constraint, so a
  notification can never carry an off-site link.
- **Expiry.** A notification can expire (a drive whose deadline passed, an
  archived announcement). Expired rows are excluded from the list, the counts
  and "mark all read".
- **Time-based events.** CampusHire has no scheduler, so a closing deadline, a
  scheduled announcement and a new admin's first sign-in are materialised on
  the next visit (`materializeDueNotifications`, called by the bell and the
  notification centre). Every write is keyed, so however many people load a
  page, each notification happens once. A cron could call the same functions.

### Drive notifications follow the workflow, not the drive

Creating a master drive, or assigning it, notifies **no student** — only the
departments' admins, who have work to do. A student hears about a drive when
their department publishes it, and only if
`resolveDriveAudience` — which runs the same evaluator as the drive list, the
drive page and `applyToDrive`, against that department's resolved drive —
finds them eligible. So the notification audience and the listing can never
disagree: department scope, batch rules, placement exclusion, approval and
opt-out are all decided by the one evaluator, and a caller can narrow the
departments but never widen them.

### An announcement is a record, not a notification

`Announcement` is a first-class entity (title, content, author, department,
audience, batches, priority, publishAt, expiresAt, status, attachment).
Publishing it *generates* notifications that point at it; they never carry the
announcement's truth, and editing it does not rewrite what was delivered.

- **Targeting** lives in `announcement-audience.ts` as a pure predicate and the
  equivalent Prisma filter, kept in step by tests — so a notification is never
  sent to someone who cannot open the announcement.
- **Scope is from the session.** A department admin writes for their own
  department's students; the departmentId and audience in the request are
  ignored. Institution-wide announcements, other departments, admin audiences
  and the URGENT priority belong to the Super Admin alone.
- **A draft notifies nobody.** Publishing is a separate act; a future
  `publishAt` schedules it, and the release happens on the next visit.
  Archiving keeps the record and expires the notifications pointing at it.

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
8. A `DriveApplication`'s recruitment stage (`currentStageId`, with the legacy `stage` dual-written) and `status` are written by exactly one server action (`updateApplicationStage`), only to a stage of that department drive's active pipeline, with every move recorded in `ApplicationStageEvent`, callable only by a department admin, scoped both to a drive they run and to an applicant from their own department. No student-facing path writes either column. Every other column on the row is immutable after creation — enforced by a database trigger, not only by the absence of a write path — and the student has no mutation at all; an application is final once submitted. Each application has exactly one `DriveApplicationSnapshot`, written in the same transaction, and never updated. The `(studentId, driveId)` unique constraint is what enforces that: re-applying is the only vector a student has, and it is refused both in `applyToDrive` and at the database.
10. No flag stores whether a student is placed. A student is placed while they hold a `StudentPlacement` with `revokedAt IS NULL` — an explicit record (company, role, package, date, who) created when an application is marked SELECTED (same transaction) or recorded by a department admin for an off-campus offer. Every reader resolves it through `features/students/utils/placement-status.ts` (`PLACED_STUDENT_FILTER`, `ACTIVE_PLACEMENTS_SELECT`, `placedStudentSql`); a `placed` boolean column, or testing `status = 'SELECTED'` to mean placed anywhere else, is not allowed. Placement is permanent exclusion from new drives, and a placement is never edited or deleted — a mistake is corrected by revoking it with a reason.
11. When a student's entry type makes a field meaningless — a diploma student's 12th percentage, a regular student's diploma percentage — that column is `NULL`. No code path substitutes `0` for a record the student does not have.
12. Self-asserted registration details are never written into `Student` before a department admin approves them. They live in `StudentAccessRequest` until then, so an unapproved sign-up can never appear in a department roster, in `totalStudents`, or in the placement-rate denominator. Approving is what creates the `Student` row, and it takes the department from the reviewing admin, not from the applicant.
15. Being promoted to an admin role ends an account's student-ness in the same transaction as the promotion: its `Student` row is retired and any *pending* `StudentAccessRequest` is deleted, so a promoted account leaves the waiting list and gets its new role's access immediately (`retireStudentAccess`). The pending request is deleted rather than given a terminal status — `REJECTED` would permanently block re-registration if the account is later demoted back to `STUDENT`, and `APPROVED` would claim a `Student` row was created when none was. Approval is independently refused for any applicant who is no longer a `STUDENT`, so a stale queue open in another tab cannot put an admin back in the roster. A student record carrying `DriveApplication` history is never silently deleted: it refuses, and the refusal aborts the promotion.
13. `Student.rollNumber` is nullable but not optional: a lateral-entry student may register before one is issued, and `applyToDrive` refuses any application without one. It is registrar-owned once set — the student's profile can fill a blank, never overwrite an existing value.
14. Anything that can be computed is computed, not stored. `getDriveStatus()` derives open/closed from a deadline and `placement-status.ts` derives placement from active placement records. A stored equivalent has to be set correctly at every write site, and the first caller that forgets produces a silently wrong value — which is exactly how `placementStatus` came to read zero everywhere. A notification's category and priority *are* stored, but no caller chooses them: one writer sets them from the event registry, which is the same "one place decides" guarantee by another route.
22. Authorization belongs to the function: an exported action or a query a client component can reach checks the caller itself, typed `where` clauses keep the scope from being lost to a typo, refusals are recognised by error type, and not-found and not-yours read alike.
21. An export is a dataset name the server resolves, never a query the client shapes: the actor, the drive, the department and the columns are all decided server-side, an allowlist bounds every column, and every export is audited. Action-required items are computed from current state and never stored.
19. Department admin authorization is a live `DepartmentAdmin` row with status ACTIVE in an active department, asked through `requireDepartmentAdmin` or `getActiveDepartmentAdmin` and nowhere else. Disabling an admin takes access away and keeps everything they did. Admins are invited through Clerk — CampusHire never creates, emails or stores a password — and an invitation is accepted only when one was actually issued for that address and department.
20. A setting exists only if something reads it, and it applies to what happens next: enforcing a placement season refuses new drive dates, it never re-judges drives or applications that already exist. A department's settings are written for the department in the caller's session; the action takes no department from the request.
18. A notification is written by exactly one function, for a recipient whose role the event is defined for, under a dedupe key that makes the same event a no-op the second time. Students are told about a drive only where it is published and only if the shared evaluator finds them eligible; a department admin's announcement reaches their own department's students and nobody else, with the scope taken from their session. An announcement is the record and its notifications only point at it.
17. Eligibility is decided in one place (the evaluator). Screens that list students for a drive show what `getDriveStudents` returns and never re-derive it. An application moves only through `moveApplication`, and a placement is confirmed by a person before it is created; a bulk move never selects.
16. A department admin may override a master content field only if the Super Admin opened it (`Drive.departmentEditableFields`), checked in `saveDriveDepartmentConfig` against the stored list — never against what the form shows. A department drive is published only when `departmentDriveReadiness` says it is ready, computed on the server from the stored configuration. A drive is never deleted to stop it: it is CANCELLED, with who, when and why recorded, and its applications and snapshots are kept.
9. A successfully-imported Excel/CSV file does not persist in Blob storage after its rows are committed — cleanup happens in the same transaction/flow as the successful import, not as a separate best-effort job. 