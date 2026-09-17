# Neon Setup — Building CampusHire's Database From Zero

Everything needed to stand up a fresh Neon project for CampusHire: account,
project settings, schema, first admin, verification, and the rules that keep it
from being destroyed again.

The schema is not re-derived here — it is generated from `prisma/schema.prisma`,
which is the single source of truth. Nothing in this guide asks you to write a
`CREATE TABLE` by hand.

---

## Why start over

The old project's migration history could not build a database. Six tables —
`Drive`, `DriveApplication`, `DriveDepartmentConfig`, `AuditLog`,
`Notification`, `SemesterMark` — were created by hand rather than by a
migration, so `prisma migrate status` reported "up to date" while
`prisma migrate deploy` against an empty database failed at the first
`ALTER TABLE` on a table that did not exist.

That is a deployment blocker, not a cosmetic one: the first real deploy would
have hit it. Starting clean fixes it permanently, and the schema itself is
sound — it is only the *history* that was broken.

---

## Step 1 — Create the account and project

1. Go to <https://console.neon.tech> and sign up (GitHub login is simplest).
2. **Create project**:
   - **Name**: `CampusHire`
   - **Postgres version**: 17 or 18
   - **Region**: see the table below.

### Choosing a region

This is the single highest-impact decision in this guide. Measured on the old
project: **221 ms per query** from a laptop in India to `aws-us-east-2` (Ohio).
A page issuing a dozen queries spends seconds on network alone.

What matters in production is the distance between your **app server** and the
database — not between the user and the database. So:

| Where you will deploy | Pick this region |
|---|---|
| Vercel default (Washington, `iad1`) | **AWS US East 1 (N. Virginia)** |
| Vercel Singapore (`sin1`) | **AWS Asia Pacific 1 (Singapore)** |
| Unsure | **AWS US East 1** — matches Vercel's default |

Neon has **no India region**. Singapore is the closest, and it is the right
pick *only if you also deploy the app to Singapore*. An app server in one
region with a database in another is the worst combination and is what made
local development feel so slow.

Measured from this machine, laptop to database, after the move from Ohio to
Singapore:

| | Ohio (`us-east-2`) | Singapore (`ap-southeast-1`) |
|---|---|---|
| steady-state round trip | 221 ms | **~81 ms** |
| 10 serial queries | ~2,210 ms | **812 ms** |

A first sample or two runs slower while the connection warms — a median taken
over nine cold-ish samples read 137 ms, while ten back-to-back queries
averaged 81 ms. The second figure is the one that matters, since a real page
issues its queries back to back.

Note this is still laptop-to-Singapore. Once the app server sits *in*
Singapore, the same queries cost single-digit milliseconds.

> Local `npm run dev` will still feel slow whichever you pick, because your
> laptop is the app server. That is expected and is not what production pays.

---

## Step 2 — Project settings before you load anything

In **Project settings**:

- **History retention** — default is 6 hours. Raise it to **7 days**. This is
  what makes point-in-time restore possible, and 6 hours is thin. It is the
  reason the previous wipe was recoverable at all.
- **Autosuspend** — leaving it at 0 (never suspend) avoids a ~2 s cold start on
  the first query after idle. On the free tier this burns compute hours; 5
  minutes is a reasonable compromise while developing.

---

## Step 3 — Get the connection string

**Dashboard → Connect → Connection string**, with **Pooled connection**
selected. It looks like:

```
postgresql://USER:PASSWORD@ep-HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require
```

Use the **pooled** (`-pooler`) host. Serverless functions open many short-lived
connections and the pooler is what keeps that from exhausting Postgres.

---

## Step 4 — Wire up `DATABASE_URL`

### If you used the Neon CLI (`neon link`)

The CLI writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` into
**`.env`** for you, and re-pulls them on every `neon deploy`. Nothing to type.

**But `DATABASE_URL` must then not exist in `.env.local`.** Next.js loads
`.env.local` at *higher* precedence than `.env`, so a leftover line there
silently wins and your app talks to the old database while the Prisma CLI talks
to the new one. That split is very hard to diagnose from the symptoms. Delete
the `DATABASE_URL` line from `.env.local` and let `.env` own it.

### If you are setting it by hand

Put it in `.env.local`, and make sure `.env` does not also define it:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require
```

### Precedence, highest first

1. A variable exported in your **shell** — beats every file
2. `.env.local`
3. `.env`

The shell one is worth knowing about: a terminal that exported `DATABASE_URL`
earlier in its life keeps overriding both files, and `prisma migrate status`
will cheerfully report on a database you did not mean. Check with
`echo $DATABASE_URL` when something looks impossible.

### Other notes

- Quotes are optional; if you use them, use double quotes.
- `lib/prisma.ts` appends `connection_limit=5` and `pool_timeout=20`
  automatically — do not add them yourself.
- **Do not set `NODE_ENV` in any env file.** An inherited `NODE_ENV=development`
  makes `next build` fail while prerendering the error pages, with a misleading
  `<Html> should not be imported outside of pages/_document` error. Next sets it
  itself.
- `.env` and `.env.local` are both gitignored. Keep it that way — they hold a
  database password.

---

## Step 5 — Create the schema

The repo contains a verified baseline migration at
`prisma/migrations/20260101000000_baseline/` that creates all 17 tables, 37
indexes, 23 foreign keys and 7 enums in one step.

```bash
npx prisma migrate deploy
```

Then generate the client:

```bash
npx prisma generate
```

> If `prisma generate` fails with `EPERM ... query_engine-windows.dll.node`,
> a dev server is holding the file. Stop it and re-run.

**Verify the schema landed:**

```bash
npx prisma migrate status
```

Expect one applied migration and "Database schema is up to date!".

---

## Step 6 — Create your first Super Admin

There is no sign-up path for Super Admin by design. Finish
[CLERK_SETUP.md](CLERK_SETUP.md) first, sign up through the app once with the
email you want to own the account, then:

```bash
npx tsx scripts/make-super-admin.ts your-email@example.com
```

This promotes the `User` row, syncs the role into Clerk's `publicMetadata`, and
retires any leftover `Student` row so the admin does not appear in the roster.

---

## Step 7 — Departments

Departments are the backbone: every `Student` and most `Drive` rows point at
one, and `Department.code` must be unique. Create them as Super Admin at
**/super-admin-dashboard/departments**.

The previous project used: `COMP`, `IT`, `EXTC`, `MECH`, `CHEM`, `CIVIL`,
`INST`, `CS`. Create only the ones you actually run placements for — a
department with no students still appears in every report.

---

## Step 8 — Verify

```bash
npx tsx scripts/verify-db.ts
```

Prints the host it connected to and the row counts, so you can confirm you are
pointed at the new project and not the old one.

Optional — load realistic volume to test performance at scale:

```bash
npx tsx scripts/seed-perf-data.ts          # 500 students, 30 drives, ~1,500 applications
npx tsx scripts/seed-perf-data.ts --clear  # remove it again
```

Everything it writes is namespaced (`SD*` department codes, `@seed.test`
emails, `[seed]` company names), so `--clear` never touches your real data.

---

## Entity relationships

```mermaid
erDiagram
    User ||--o| Student : "has profile"
    User ||--o| DepartmentAdmin : "may administer"
    User ||--o{ Notification : receives
    User ||--o{ AuditLog : performs
    User ||--o| StudentAccessRequest : requests

    Department ||--o{ Student : enrolls
    Department ||--o{ DepartmentAdmin : "administered by"
    Department ||--o{ Drive : owns
    Department ||--o{ DriveDepartmentConfig : configures

    Student ||--o| StudentAcademic : has
    Student ||--o| StudentPreferences : has
    Student ||--o{ SemesterMark : has
    Student ||--o{ StudentSkill : has
    Student ||--o{ StudentProject : has
    Student ||--o{ StudentExperience : has
    Student ||--o{ StudentCertification : has
    Student ||--o{ DriveApplication : submits

    Drive ||--o{ DriveApplication : receives
    Drive ||--o{ DriveDepartmentConfig : "varies by dept"
```

### The three relationships that carry the design

1. **`User` ↔ `Student` is optional on both sides.** A bulk-imported student
   exists as a `Student` row with `userId = null` and `isPending = true` — known
   to the college, no account yet. Signing up links the two by matching the
   Clerk-verified email. A `User` with no `Student` is an admin.

2. **Placement is derived, never stored.** There is no `placementStatus`
   column. A student is placed when they hold a `DriveApplication` with
   `status = SELECTED`. Every screen resolves this through
   `features/students/utils/placement-status.ts`. An earlier stored column was
   written by nothing and read with three different casings, which made every
   "Placed" count silently zero.

3. **`DriveApplication` is unique on `(studentId, driveId)`.** That constraint
   is what makes "apply once" a guarantee rather than a convention.

### Delete behaviour — the part that bites

| Relationship | On delete | Meaning |
|---|---|---|
| `Student` → `User` | Cascade | Deleting a user deletes their student profile |
| All `Student*` detail tables → `Student` | Cascade | Profile sections die with the student |
| `DriveApplication` → `Student` | Cascade | **Deleting a student destroys their application history** |
| `DriveApplication` → `Drive` | Restrict | A drive with applications cannot be deleted |
| `Student` → `Department` | Restrict | A department with students cannot be deleted |
| `Drive` → `Department` | Restrict | A department with drives cannot be deleted |
| `AuditLog` → `User` | Restrict | A user with audit history cannot be deleted |
| `Drive.createdByUserId` → `User` | SetNull | Drive survives its creator's deletion |
| `DriveApplication.stageUpdatedById` → `User` | SetNull | Stage history survives |
| `Notification` → `User` | Cascade | Notifications die with the user |

The Restrict rules are deliberate: they stop you deleting a department out from
under live data. The Cascade on `DriveApplication → Student` is the dangerous
one — this is why `scripts/` refuses to retire a student who holds
applications.

---

## Tables

**17 tables, 7 enums.** Full field definitions live in `prisma/schema.prisma`;
this is the map.

### Identity and structure

| Table | Purpose | Key fields |
|---|---|---|
| `User` | Mirror of a Clerk account | `clerkId` (unique), `email` (unique), `role` |
| `Department` | A branch running placements | `code` (unique), `name`, `isActive` |
| `DepartmentAdmin` | Links an admin to one department | `userId` (unique), `departmentId` |

`Role`: `STUDENT` · `DEPT_ADMIN` · `SUPER_ADMIN`

### Student and profile

| Table | Purpose | Notes |
|---|---|---|
| `Student` | Core student record | `userId` nullable (imported, not yet registered), `rollNumber` nullable+unique, `email` unique, `isPending`, `optedIn`, `optedInLocked`, `entryType` |
| `StudentAcademic` | Marks and CGPA (1:1) | `currentCGPA`, `activeBacklogs`, `tenthPercentage`; 12th **or** diploma branch, the unused one `NULL` |
| `SemesterMark` | Per-semester marks | unique `(studentId, semester)` |
| `StudentSkill` | Skills | unique `(studentId, skillName)`, `SkillType` |
| `StudentProject` / `StudentExperience` / `StudentCertification` | Profile sections | plain 1:N |
| `StudentPreferences` | Job preferences (1:1) | `workModes` is a JSON array in text |
| `StudentAccessRequest` | Self sign-up with no roster match | `userId` unique, `AccessRequestStatus`, reviewed by an admin |

`EntryType`: `REGULAR` (12th, semesters 1–8) · `DIPLOMA` (lateral entry, no 12th,
no semester 1–2). The unused branch is `NULL`, never zero-filled — a 0% score
reads as real and silently fails every eligibility comparison.

### Drives and applications

| Table | Purpose | Notes |
|---|---|---|
| `Drive` | A recruitment drive | `minCGPA`, `maxActiveBacklogs`, `applicationDeadline`, `isCentralDrive`, `departmentId` null for central drives |
| `DriveDepartmentConfig` | Per-department overrides on a central drive | unique `(driveId, departmentId)` — venue, coordinator, required fields |
| `DriveApplication` | One student's application | unique `(studentId, driveId)`, `ApplicationStage`, `ApplicationStatus` |

`ApplyMethod`: `IN_APP` · `EXTERNAL`
`ApplicationStage`: `APPLIED` → `APTITUDE` → `INTERVIEW` → `OFFER`
`ApplicationStatus`: `IN_PROGRESS` · `SELECTED` · `REJECTED` · `WITHDRAWN`

### Supporting

| Table | Purpose |
|---|---|
| `Notification` | In-app notifications, `@@index([userId, isRead])` |
| `AuditLog` | Who did what; `onDelete: Restrict` on the actor |

### Known schema debts

Carried over deliberately — neither is a performance problem today, both are
worth knowing:

- **`Drive.eligibleDepartments` is a JSON array stored as text.** It cannot be
  indexed for membership, so eligibility filters with a substring prefilter and
  re-checks exactly in JavaScript. At 31 drives this costs 0.07 ms. It becomes
  worth normalising into a `DriveEligibleDepartment` join table when the drive
  table gets large — or sooner, for referential integrity, since nothing stops
  a deleted department's ID lingering in that JSON.
- **`Drive.packageOffered` is a `Float`.** Money in a binary float cannot
  represent every decimal exactly. `Decimal` is the correct type. Worth fixing
  while the table is empty — it is far more painful later.

Other JSON-in-text columns: `Drive.selectionRounds`,
`Drive.applicationFields`, `StudentPreferences.workModes`.

---

## Rules that keep this database alive

Learned the hard way — the previous database was wiped by breaking the first one.

1. **Never pass your real `DATABASE_URL` as `--shadow-database-url`.** A shadow
   database is *defined* as disposable: Prisma drops and recreates it on every
   use. Pointing it at a live database destroys that database. If a Prisma
   command asks for a shadow database URL, it must be a throwaway.

2. **Never run schema commands against production to "check" something.**
   Verify on a Neon branch. Branches are instant and free:
   *Branches → New branch* from `production`, test there, delete it.

3. **Raise history retention to 7 days** (Step 2). It is the difference between
   a scare and a disaster.

4. **Take a snapshot before anything structural.** *Branches → production →
   Create snapshot*. Note the free-tier snapshot limit — you may hold only one.

5. **Never edit the database by hand.** Every schema change goes through
   `prisma migrate dev`, gets committed, and is replayable. Hand-applied SQL is
   exactly how the old history became unbuildable.

6. **Keep `next dev` and `next build` apart.** They share `.next` and corrupt
   each other. Two dev servers on one directory do the same — the symptoms are
   misleading (`__webpack_modules__[moduleId] is not a function`, 500s taking
   20 s). Stop the server, confirm the process is gone, then clear `.next`.

---

## Prompts to hand me

Paste these one at a time. Each is self-contained.

### Once the project exists and `.env.local` is updated

```
I've created a new Neon project and updated DATABASE_URL in .env.local.
Apply the baseline migration, regenerate the Prisma client, and verify the
schema landed — confirm all 17 tables, and report the row counts. Don't seed
anything yet.
```

### Verify the history is actually replayable this time

```
Verify the migration history can build a database from empty. Create a
temporary Neon branch, run `prisma migrate deploy` against THAT branch's
connection string, confirm all 17 tables appear, then ask me before deleting
the branch. Do not point any shadow-database or migration command at my
production branch.
```

### After Clerk is wired up and you've signed up once

```
I signed up through the app as <email>. Promote that account to SUPER_ADMIN,
confirm the role synced to Clerk publicMetadata, and verify I can reach
/super-admin-dashboard.
```

### Load test data

```
Seed the database with realistic volume using scripts/seed-perf-data.ts, then
measure the student dashboard, admin roster and global reports query paths
and report before/after timings with query counts.
```

### Measure whether the new region helped

```
Measure the round-trip latency to the new Neon project and compare it against
the 221 ms the old us-east-2 project had. Then re-run the dashboard query
sequence and tell me what changed.
```

### The two schema debts, if you want them fixed

```
Normalise Drive.eligibleDepartments into a DriveEligibleDepartment join table
with real foreign keys. Write the migration with a backfill, update every read
and write path, keep the old column until the code is switched, then drop it.
Verify old and new produce identical eligibility results before removing
anything.
```

```
Change Drive.packageOffered from Float to Decimal(10,2) and update every place
that reads or writes it. Do this while the table is small.
```

### If something goes wrong

```
Something is wrong with the database. Investigate read-only first — do not run
any migration, reset, or schema command until you've shown me what you found
and I've approved the fix.
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `P1001: Can't reach database server` | Neon compute suspended, or wrong host | Retry once (cold start ~2 s); check the host in `.env.local` |
| `EPERM ... query_engine-windows.dll.node` | Dev server holds the file | Stop the dev server, re-run `prisma generate` |
| `<Html> should not be imported outside of pages/_document` | `NODE_ENV=development` inherited during `next build` | `NODE_ENV=production npm run build` |
| `migrate status` says up to date but tables are missing | History was hand-applied | Baseline it — this whole guide |
| `relation "_prisma_migrations" does not exist` | Database was reset | `npx prisma migrate deploy` |
| Slow pages locally | `next dev` compiles per route; prefetch is disabled in dev | Judge with `npm run build && npm start` |

---

## Checklist

- [ ] Neon account created, project `CampusHire`
- [ ] Region matches where the app will deploy
- [ ] History retention raised to 7 days
- [ ] Pooled connection string copied
- [ ] `DATABASE_URL` set in `.env.local`, no `NODE_ENV` set anywhere
- [ ] `npx prisma migrate deploy` run, 17 tables confirmed
- [ ] `npx prisma generate` run
- [ ] Clerk configured — see [CLERK_SETUP.md](CLERK_SETUP.md)
- [ ] Signed up once, promoted to Super Admin
- [ ] Departments created
- [ ] `npx tsx scripts/verify-db.ts` passes
- [ ] Migration history verified replayable on a throwaway branch
