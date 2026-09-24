# CampusHire — Things to do outside the code

Everything here is something only you (the project owner) can do: settings
in Clerk, Vercel or Neon, data to load, checks with a real account, or a
decision. The code for each is already written and pushed; these are what
make it work for real people.

Tick an item by changing `[ ]` to `[x]`. When a new phase adds one, it is
added here.

_Last updated: 2026-09-24 (after Phase 7)._

---

## 1. Must do before real users use it

- [ ] **Apply the Phase 7 migration**, from the repo folder:

  ```bash
  npx prisma migrate deploy
  ```
  *Helps with:* the master skill list (Item 3) — adds the `Skill` table and
  the reference from `StudentSkill`. Rehearsed on production in a forced
  rollback; nothing else is touched. A backup branch is recommended first,
  as with earlier phases (ask if you want one taken).

- [ ] **Run the production build once and fix anything it reports.**
  `npx next build` from the repo folder, or let the test deployment build the
  `test` branch and read its build log.
  *Helps with:* everything since Phase 4 — the code passes type checks,
  lint and 1308 tests, but no full build has been run since Phase 3.

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
  | `CLERK_WEBHOOK_SECRET` | from Clerk → Webhooks → your endpoint → Signing Secret | Clerk tells the app about new sign-ups straight away. Optional (the app also catches up on the person's first visit) but recommended. It is commented out in your local `.env`. |

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
- [ ] **Skill review** (Phase 7, Item 3): as a student, type a skill name
  that doesn't exist yet — it should appear on your profile tagged
  "pending" right away. As Super Admin, open **Skill Review**, approve it —
  it should now suggest itself to other students typing the same name.
  Try rejecting one on a second student's profile too, and confirm it
  disappears from their skills list.
- [ ] **Student sees a drive** (Phase 5): as a final-year student with a
  batch and semesters 1–6 uploaded, the drive appears on Drives and a "New
  Drive Available" notification arrives once; saving the profile again does
  not send another.
- [ ] **Drop and undo** (Phase 2): on the admin Students page, Drop a
  final-year student → they move to the next batch and stop seeing
  final-year drives → Undo within 48 hours brings them back.

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

- [ ] **Item 13 — drive-posting card redesign:** the new layout and logic.
  Needed before the "Department Logistics & Additional Drive Information"
  card can be changed.
- [ ] **Item 4 — calendar bug:** which field the calendar belongs to, and a
  screenshot of the problem.
- [ ] **Item 17 — batch filter:** the Students page has All / 3rd Year /
  4th Year. The tracker also asks for **Graduated** and for picking several
  at once — say if you still want those.

---

### Already done (for reference)

- Database changes for Phases 1, 2 and 3 are applied on production (you ran
  `npx prisma migrate deploy` each time). Phases 4, 5 and 6 needed none.
- Decisions recorded: batch = expected passout year; year level derived,
  changing on July 1; 48-hour undo; one drop per student per year; semester 8
  needs semesters 1–6 marks only; uploaded marks count without verification;
  eligibility notifications also on July 1 and on undo.
