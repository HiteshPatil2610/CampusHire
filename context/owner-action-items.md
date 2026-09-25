# CampusHire — Things to do outside the code

Everything here is something only you (the project owner) can do: settings
in Clerk, Vercel or Neon, data to load, checks with a real account, or a
decision. The code for each is already written and pushed; these are what
make it work for real people.

Tick an item by changing `[ ]` to `[x]`. When a new phase adds one, it is
added here.

_Last updated: 2026-09-25 (after Item 13 and the webhook fix)._

---

## 1. Must do before real users use it

- [x] **Apply the Item 13 migration to production** — done; confirmed live
  (`Drive.coordinatorEmail`, `seatingAllocation`, `specialInstructions`;
  `prisma migrate status` up to date, 21 migrations).

- [x] **Apply the Phase 7 migration** — done; confirmed live on production
  (`Skill` table, `StudentSkill.skillId`, `SKILL_PENDING_REVIEW` all present).

- [x] **Apply the Phase 8 migration** — done; confirmed live on production
  (`Announcement.editedAt` exists, `prisma migrate status` reports up to
  date). Along the way, fixed `prisma migrate deploy` timing out on
  `pg_advisory_lock` — it was using the pooled `DATABASE_URL`, which
  PgBouncer's transaction-mode pooling can't hold a session lock on.
  `prisma/schema.prisma` now points migrations at `DATABASE_URL_UNPOOLED`
  (already in your `.env`) via `directUrl`; the app's own queries are
  untouched and still use the pooled connection.

- [x] **Run the production build once and fix anything it reports.** Done
  in Phase 10 — `next build` passes. (Build with `NODE_ENV` unset; a shell
  that sets it to `development` breaks the build.)
  `npx next build` from the repo folder, or let the test deployment build the
  `test` branch and read its build log.
  *Helps with:* everything since Phase 4 — the code passes type checks,
  lint and 1360 tests, but no full build has been run since Phase 3.

- [ ] **Import students with MIS, PRN and BATCH filled in** (Students → Bulk
  Import, per department).
  *Helps with:* almost everything students see. With no batch a student has
  no year level, cannot be dropped, and sees **no drives** (Phases 1, 2, 5).
  Today's 3 students have no batch.

- [ ] **Ask final-year students to upload marks for semesters 1–6**
  (3–6 for lateral entry) in their profile — e.g. with an Announcement.
  *Helps with:* drive visibility. A final-year student without those marks
  sees no final-year drives (Phase 5, Item 8). You decided admins remind
  students; there is no automatic reminder.

- [ ] **Set these environment variables on every deployment** (Vercel →
  Project → Settings → Environment Variables), then redeploy:

  | Variable | Value | Helps with |
  |---|---|---|
  | `NEXT_PUBLIC_APP_URL` | the site's address, e.g. `https://campushire.vercel.app` | Admin invitation links open your site's "set your password" page (Phase 6, Item 23). Without it the link uses the address the Super Admin was on. |
  | `SUPPORT_CONTACT_EMAIL` | e.g. `placement@your-college.edu` | The appeal contact on the **Access Revoked** page a removed admin sees (Phase 6, Item 22). Without it the page says "contact the placement office". |
  | `CLERK_WEBHOOK_SECRET` | Clerk → Webhooks → Add Endpoint `https://<your-domain>/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted` → copy the Signing Secret (`whsec_…`). Then use the endpoint's Testing tab: expect 200. | Clerk tells the app about new sign-ups straight away. Optional (the app also catches up on the person's first visit) but recommended. Only works from 2026-09-25: before that the middleware redirected Clerk's calls to /sign-in. |

## 2. Clerk (dashboard.clerk.com)

- [ ] **Reword the invitation email** — Customization → Emails →
  **Invitation**. Say something like: "Click the button below to set your
  password and activate your CampusHire department admin account. The link
  works once and expires in 7 days."
  *Helps with:* Item 23 ("the email has no login details"). The link *is*
  the set-password step; the default wording just does not say so. The code
  cannot change this email — it is Clerk's template.

- [ ] **Production instance: allow your domain as a redirect URL**
  (Configure → Paths / Domains, or Allowed redirect origins).
  *Helps with:* invitation links landing on `/accept-invitation` on your
  site (Phase 6).

- [ ] **Keep "Password" enabled for sign-up** (User & Authentication →
  Email, Phone, Username → Password). It is on in the development instance
  today; check the production one.
  *Helps with:* invited admins setting a password (Item 23).

- [ ] **If you create a production Clerk instance, copy the settings over**
  (password on, email verification, Google if wanted) and put its keys in the
  deployment's variables.

## 3. Check once with real accounts

These cannot be tested in code — they need a real inbox and browser.

- [ ] **Invitation, end to end** (Phase 6): as Super Admin, invite an email
  you can read → open the email → set a password → you land signed in as that
  department's admin → the Admins page shows them active.
- [ ] **Removing an admin** (Phase 6): stay signed in as that admin in one
  browser; remove them as Super Admin in another → the first browser is
  signed out within about a minute → signing in again shows **Access
  revoked**.
- [ ] **Posting drives** (Phase 4): post a drive as Super Admin (All
  departments, and one department) and as a department admin; confirm the
  Super Admin's drive reaches each department to configure, and the dates
  save as the days you picked.
- [ ] **Skill review** (Phase 7, Item 3 — moved to the admin panel after):
  as a student, type a skill name that doesn't exist yet — it should appear
  on your profile tagged "pending" right away, and your department's admin
  should get a notification. As a department admin, open **Skill Review**
  (now on the admin dashboard, not Super Admin's), approve it — it should
  now suggest itself to other students typing the same name. Try rejecting
  one on a second student's profile too, and confirm it disappears from
  their skills list.
- [ ] **Off-campus placement, one Package field** (Phase 8, Items 14/15): on
  a student's profile, record an off-campus placement with just "6 LPA" in
  the one Package box — confirm it shows correctly everywhere it did before
  (student roster, drive placements tab, Super Admin's placements page/CSV).
- [ ] **Batch filter, multi-select** (Phase 8, Item 17): on the admin
  Students page, select 4th Year and Graduated together and confirm both
  show at once; confirm "All" clears back to everyone.
- [ ] **Announcements** (Phase 8, Item 19): write one with **bold**, a
  bullet list and a `[link](https://...)` using the new toolbar buttons —
  confirm it renders correctly (not as raw `**`/`[]()` text) on the
  student/admin feed. Edit a published one and confirm "edited" appears.
  As Super Admin, try the new department filter and the newest/oldest sort
  on the manager list.
- [ ] **Student sees a drive** (Phase 5): as a final-year student with a
  batch and semesters 1–6 uploaded, the drive appears on Drives and a "New
  Drive Available" notification arrives once; saving the profile again does
  not send another.
- [ ] **Drop and undo** (Phase 2): on the admin Students page, Drop a
  final-year student → they move to the next batch and stop seeing
  final-year drives → Undo within 48 hours brings them back.
- [ ] **Department Insights** (Phase 9, Item 20): on the admin dashboard's
  Reports tab, check the Eligible/Applied/Placed numbers against what you'd
  count by hand for one department, then try the Batch and Semester filters
  and confirm every number on the page moves together.
- [ ] **All Students filters** (Phase 9, Item 21): on the Super Admin's
  Institution Student Directory, combine Department + Batch + "Not Placed"
  and confirm only matching students show; add **Has backlogs** and confirm
  it narrows further; click a row to open the read-only detail view; export
  the CSV and check it matches what's on screen.
- [ ] **Placement Rate matches everywhere** (Phase 10): for one department,
  the rate on the admin Overview card, the admin Reports tab, the Super
  Admin home table and Global Reports should be the same number.
- [ ] **Drive Day Logistics** (Item 13): post a department drive with the
  instructions box and seating filled in, then open it as an eligible
  student — they should see venue, time, seating, contact (with email) and
  instructions. Do the same on a central drive via Central Drive Processing,
  and confirm it now publishes even with no venue.
- [ ] **Global Reports comparison** (Phase 10, Item 20): as Super Admin, open
  Global Reports and check the per-department Eligible / Applied / Placed
  bars and the Active Drives by Department chart.

## 4. Once a year

- [ ] **On or soon after July 1, open the Super Admin dashboard** — or
  schedule the script below to run on July 1.
  *Helps with:* recording the new academic year and sending "New Drive
  Available" to the batch that just became final year (Phases 2 and 5). Year
  levels change on their own; the notifications wait for this.

  ```bash
  npx tsx scripts/record-academic-cutover.ts <super-admin-email>
  ```
  Safe to run more than once.

## 5. Housekeeping

- [ ] **Know the `integration-tests` Neon branch exists.** It is a copy of
  production that `npm run test:integration` writes test data into (and
  cleans up). Leave it in place — the tests need it. It counts toward the 10
  branches on the free plan (4 used now). If it ever drifts from production's
  schema after a new migration, reset it from its parent in Neon (Branches →
  integration-tests → Reset from parent). The tests refuse to run against
  production.

- [ ] **Delete the Neon backup branches once the site has run fine for a
  while** (Neon → Branches): `pre-drop-lifecycle-backup-20260929` (taken
  before Phase 2) and `pre-drive-window-backup-20260930` (before Phase 3).
  They are the undo for those database changes; keep them until you are
  confident. The free plan allows 10 branches.
- [ ] **Merge `test` into `main`** when the test deployment is checked
  (GitHub → Pull request `test` → `main`).
- [ ] **Decide what to do with `context/Oxford Design System-handoff.zip`** —
  it is kept out of every commit. Delete it, or say if it should be committed.

## 6. Decisions or information I need from you

- [x] **Item 13 — drive-posting card redesign:** done — one "Drive Day
  Logistics" card (all 8 fields, all optional, three grouped sections) used
  by both a department's own drives and Central Drive Processing.
- [ ] **Item 4 — calendar bug:** which field the calendar belongs to, and a
  screenshot of the problem.
- [x] **Item 17 — batch filter:** done in Phase 8 — Graduated added, and any
  combination of 3rd/4th/Graduated can be selected at once.
- [x] **One definition of "Placement Rate"** — decided: placed ÷ eligible
  (registered, and opted in or already placed). Every dashboard now uses it.
- [x] **Item 20 — department comparison** — decided: it lives on the Super
  Admin's Global Reports (Eligible/Applied/Placed per department, and active
  drives per department). Department admins still see only their own.
- [x] **Super Admin directory filters** — decided: a separate **Has backlogs**
  toggle, combinable with the three statuses. Pending and Opted Out stay
  folded into Not yet eligible.

---

### Already done (for reference)

- Database changes for Phases 1, 2 and 3 are applied on production (you ran
  `npx prisma migrate deploy` each time). Phases 4, 5 and 6 needed none.
- Decisions recorded: batch = expected passout year; year level derived,
  changing on July 1; 48-hour undo; one drop per student per year; semester 8
  needs semesters 1–6 marks only; uploaded marks count without verification;
  eligibility notifications also on July 1 and on undo.
