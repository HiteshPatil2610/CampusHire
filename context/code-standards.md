# Code Standards

## General

- Keep modules small and single-purpose — a file that handles both data access and UI rendering should be split.
- Fix root causes, do not layer workarounds. If a type doesn't fit, fix the schema or the type — don't cast around it.
- Do not mix unrelated concerns in one component, route, or server action. A drive-eligibility check does not live inside a profile-update action, even if it's convenient.
- Prefer explicit, boring code over clever abstractions. This is a permissions-sensitive system — readability matters more than brevity.

## TypeScript

- Strict mode is required throughout the project.
- Avoid `any` — use explicit interfaces or narrowly scoped types. Prisma-generated types are the source of truth for database shapes; don't hand-roll parallel types for the same entity.
- Validate unknown external input (form submissions, Excel rows, API request bodies) at system boundaries using Zod before trusting it anywhere downstream.
- Derive types from Zod schemas (`z.infer`) where a schema exists, instead of maintaining the schema and the type separately.
- Naming: files and folders are `kebab-case` (`student-profile-form.tsx`, `excel-upload/`); components, types, and interfaces are `PascalCase` (`StudentProfileForm`, `DriveEligibilityRule`); functions and variables are `camelCase` (`getDriveStatus`, `isEligible`). A file exporting a single component is named after that component in kebab-case.

## Next.js (App Router)

- Default to server components. Add `"use client"` only when browser interactivity (state, event handlers, effects) is actually required.
- Prefer server actions for mutations over hand-written API routes, except where a route handler is required (e.g. webhook receivers, file upload endpoints).
- Route handlers and server actions are re-entry points for access control — every one re-checks role and department scope, even if a parent layout already gated the route.
- Keep route segment files (`page.tsx`, `layout.tsx`) focused on composition. Data fetching and mutations are called from `features/`, not written inline in the route file.

## Styling

- Use the CSS custom property tokens defined in `ui-context.md` — no hardcoded hex values anywhere in components.
- Follow the border radius scale defined in `ui-context.md` (`--radius: 8px` base, `12px` for cards/modals).
- Use Tailwind utility classes bound to the theme tokens (via `tailwind.config` extending the CSS variables), not arbitrary values, for anything that already has a token.

## API Routes / Server Actions

- Validate and parse request input with Zod before any logic runs.
- Enforce auth, role, and department-scope checks before any read or mutation — this is not optional per the invariants in `architecture.md`.
- Return consistent, predictable response shapes: `{ success: true, data }` or `{ success: false, error }` for server actions; standard HTTP status + JSON body for route handlers.
- Wrap multi-row writes (e.g. Excel import) in a single Prisma transaction so partial imports can never occur.
- Any list endpoint that can return more than a screenful of rows (student rosters, drive lists, the audit log) uses offset pagination — `page` and `pageSize` query params or server-action args, `pageSize` defaulting to 25. Response shape includes `{ data, page, pageSize, totalCount }` so the UI can render page controls without a second query. Do not build an unpaginated list "for now" — paginate from the first implementation.

## Derived State

- If a value can be computed from data already stored, compute it — do not add a column for it. A stored equivalent has to be set correctly at every write site, and the first caller that forgets produces a silently wrong value that nothing catches.
- This is not theoretical: `Student.placementStatus` was written by exactly one code path with a casing no reader used, so every "Placed" KPI in the product read zero from the day it shipped.
- Established examples: `getDriveStatus()` (open/closed from a deadline), `features/students/utils/placement-status.ts` (placement from applications). A notification's category and priority are the exception that proves the rule: they are stored, but one writer sets them from `features/notifications/domain/events.ts`, so there is still exactly one place that decides.
- Put the derivation in one exported function and route every screen through it, so two panels cannot disagree about what the same word means.
- Where a decision is genuinely a rule rather than a lookup — whether a stage transition is legal, whether a student record can be retired, whether a sign-up matches the roster — write it as a pure function taking plain arguments, and unit test it. The server action stays thin around it.

## Domain Logic, Single Writers and the Database

- The rules of a workflow are pure functions in `features/<x>/domain/`: eligibility (`eligibility-evaluator.ts`), lifecycle transitions and locking (`drive-lifecycle.ts`), pipeline validation (`recruitment/domain/pipeline.ts`), step completion and publish readiness (`department-drive-readiness.ts`), the student's view of a drive (`student-drive-view.ts`). Actions are thin wiring around them, and the UI calls the same functions for guidance. Never re-implement a rule in a component or a second action.
- **One place decides, and everyone calls it.** The preview a department admin sees is built by the code the student page uses; the publish action runs the function the wizard's step bar uses. If two screens must agree, they share the function, not a copy.
- **One writer per protected column.** A column with a rule (application stage and status, placement, pipeline versions, a drive's editable-field list) is written by exactly one action or domain function. Where the rule is an invariant, back it with a database trigger or CHECK as well — the code path and the constraint agree, and a bug in one does not corrupt data.
- **Never trust the client.** IDs, department ids, role claims, editable/read-only flags, eligibility results and field values from the client are inputs to validate, not facts. The department always comes from the session; permissions are read from stored data, not from what a form displayed.
- **History is kept, not edited.** Applications, snapshots, pipeline versions, stage events, placements and audit rows are append-only or versioned. Stopping something (cancelling a drive, revoking a placement, closing a pipeline version) is a recorded transition with who, when and why — never a delete.
- Every mutation that changes protected state writes an audit row in the same transaction (`createAuditLogInTransaction`); `lib/audit.ts` holds the action and entity vocabulary.
- Notifications are resolved on the server from the database, never from a recipient the caller supplies, and never fail the change that triggered them.

### Migrations

- The schema is the source of truth. Generate DDL with `prisma migrate diff --from-schema-datamodel <previous> --to-schema-datamodel prisma/schema.prisma --script` (no shadow database), then add CHECK constraints, triggers and partial indexes by hand.
- **Never run `prisma migrate dev`, a reset, or a destructive flag against the connected Neon database.** Prefer additive migrations; never drop tables, columns or data automatically.
- Process: rehearse on a fresh Neon branch from production (probes that always roll back, plus a drift check) → get the user's confirmation → create a `pre-<name>-backup-YYYYMMDD` branch → `prisma migrate deploy` → backfill script if needed (`--dry-run`, then run) → read-only verification on production. A new enum value cannot be used in the migration that adds it — put constraints that mention it in the next migration.
- A destructive or irreversible change needs an impact report and explicit confirmation first.
- `next build` needs `NODE_ENV=production`; a shell that exports `NODE_ENV=development` breaks prerendering of `/404`.

## Route Rendering

- A route segment whose data is scoped to the signed-in user (anything calling `requireStudent`, `requireDepartmentAdmin`, or `requireSuperAdmin`) declares `export const dynamic = 'force-dynamic'`. Without it Next tries to prerender the page at build time, where there is no session, and the build fails. These pages have no meaning without a session, so there is nothing to cache.

## Data and Storage

- Metadata and all structured/queryable data belongs in Postgres via Prisma.
- Large or binary content (profile photos, JD PDFs) belongs in Vercel Blob — store only the returned URL in Postgres.
- Every table that scopes to a department includes a `departmentId` foreign key; every query for a `DEPT_ADMIN`-scoped resource filters on it explicitly — never rely on implicit scoping.
- Soft-delete is not used unless a feature explicitly requires history (e.g. audit log entries are append-only and never deleted).
- Money is `Decimal @db.Decimal(10, 2)`, never `Float` — a binary float cannot hold most decimal fractions exactly and drifts under `SUM`. Prisma returns it as a `Decimal`, which is not a number and which React serialises to a plain `string` on its way into a client component, so route every read through a formatter (`features/drives/utils/format-package.ts`) and never do arithmetic on it outside the database. Reject more than two decimal places at the write boundary rather than letting Postgres round silently.
- A set of references — which departments a drive is open to — is rows with foreign keys, not a JSON array in a text column. Text cannot be indexed for membership, forces a prefilter that over-matches, and lets a deleted row's ID linger with nothing to catch it. Give the set exactly one write path that replaces it wholesale inside the same transaction as the parent row (`setEligibleDepartments`), so the two halves can never be written apart.

## Environment Variables

- All environment variables are declared and validated in a single `lib/env.ts` using a Zod schema, parsed once at module load. If a required variable is missing or malformed, the app fails to start rather than failing later at the point of use — this applies to both local dev (`.env.local`) and Vercel-deployed environments (Vercel project env vars).
- Code never reads `process.env` directly outside `lib/env.ts` — everywhere else imports the validated, typed `env` object from there.
- Secrets (Clerk keys, Neon connection string, Vercel Blob token) are never committed; `.env.local` is git-ignored and `.env.example` documents every required key with a placeholder value.

## Testing

- Unit test core business logic with Vitest — specifically drive-eligibility matching, Excel-row validation, and profile-completion calculation.
- Business logic that needs testing is written as small, pure functions with no direct database or Clerk calls (e.g. `isStudentEligibleForDrive(student, drive)`, `validateStudentRow(row)`, `calculateProfileCompletion(profile)`), then called from the server action. The server action itself handles auth/DB wiring and stays thin enough not to need its own test — the pure function underneath it is what's tested.
- Tests live alongside the code they test inside the relevant `features/` folder (`*.test.ts`), not in a separate mirrored tree.
- A feature that changes eligibility rules or validation logic is not done until its tests are updated and passing.
- Guard tests prove a rule can fail: after adding a guard, break it on purpose (mutation check) and confirm a test catches it. Fixtures mirror the real Prisma row shape — when a column is added, update every fixture rather than casting around the type.
- Some suites have pre-existing failures unrelated to current work (admin-assignment, admin-security, department-crud, excel-import, notification-authorization, auth). Compare against that baseline instead of assuming a red run is new; the count must not grow.
- End-to-end testing (Playwright or similar) is explicitly out of scope for V1 — do not install or configure it without an explicit instruction to do so.

## File Organization (feature-based)

- `app/` — Route segments only: `(auth)/`, `(student)/`, `(admin)/`, `(super-admin)/`, `api/`. No business logic.
- `middleware.ts` (root) — Clerk session/route protection only, per `architecture.md`.
- `features/auth/` — Sign-up/sign-in flows, role assignment, Clerk webhook handling.
- `features/students/` — Student profile CRUD, profile-completion calculation, department-scoped student queries.
- `features/excel-upload/` — Template generation, row parsing/validation, bulk-import transaction logic.
- `features/drives/` — Master and department drive actions, lifecycle, overrides, eligibility engine, application-form configuration, batch targeting, readiness, preview.
- `features/applications/` — Applying (server-decided), snapshots, stage moves, a student's application history.
- `features/recruitment/` — Pipeline domain, versions, change requests and approval, master pipeline, recruitment counts and panels.
- `features/admin-accounts/` — Department admin invitations (issued through Clerk, never a password), the invitation record, and enabling, disabling and moving an authorization. Resolve a department admin anywhere else through `getActiveDepartmentAdmin` or `requireDepartmentAdmin`, never by reading the row.
- `features/notifications/` — In-app notifications: the event registry, the single writer (`lib/notifications.ts`), keyed fan-outs with their delivery record and retry, producers per event, and the role-specific centres. Add a notification by adding an event to the registry and a producer — never by writing a `Notification` row directly.
**Authorization is written into the function, never inferred from where it is
called.** An exported server action, and any query a client component imports,
asks `lib/auth` for the caller before it reads anything. Scope — department,
student, drive — comes from that answer, never from the request. Where an id
can be guessed, "not found" and "not yours" return the same message. Catch
`AuthenticationError`/`AuthorizationError` by type; never match words in an
error message. Every `where` is a `Prisma.<Model>WhereInput`, and the clause
carrying the scope is written so no optional filter can overwrite it.

**The test suite is green, and stays green.** A failing test is either a
defect to fix or a test that has outlived its subject and must be rewritten
against what the code now does — never a number carried forward in a report.
Two traps this repo has already paid for: `vi.clearAllMocks()` leaves
`mockResolvedValueOnce` queues in place, so a value one test never consumed is
handed to the next (use `vi.resetAllMocks()`); and a mocked module factory's
implementations are wiped by `clearAllMocks` too, so defaults belong in
`beforeEach`. Tests never reach the real database — `@/lib/prisma` is mocked.
`vitest.setup.ts` supplies React's `cache`, which lives in React's server
build.

- `features/dashboard/` — The role-specific "action required" items: pure builders plus queries scoped to the viewer's authority. Items are computed on render, never stored.
- `features/exports/` — Dataset exports resolved server-side (actor, drive, department, columns). Format values only through `lib/csv-format.ts`; never add a second CSV writer.
- `features/settings/` — The institution's and each department's settings. Add a setting only with the code that reads it; a stored value nothing honours is a lie to whoever sets it.
- `features/announcements/` — The `Announcement` entity: targeting (one pure rule plus its query form), authoring scoped to the author's own department, publish/schedule/archive, and the notifications publishing generates.
- `features/departments/` — Department CRUD (super admin).
- `features/admin-accounts/` — Department-admin account CRUD (super admin), audit log writes.
- `components/ui/` — shadcn/ui components, generated via CLI, not hand-edited beyond that.
- `components/shared/` — Sidebar, topbar, app shell, badges, cards used across features.
- `lib/` — Prisma client singleton, Clerk helpers, permission/role-check utilities, Vercel Blob helpers, `env.ts` (validated environment variables), `pagination.ts` (shared offset-pagination helpers).
- `prisma/` — `schema.prisma` and migrations.
- `scripts/` — One-off operational scripts (`seed-super-admin.ts`), per `architecture.md`. Not part of the app runtime.

Frontend Performance Patterns

Perceived speed matters more than raw speed at this scale. These patterns are mandatory wherever they apply — a route without a loading.tsx, or a list without a skeleton state, is not considered done.

Route-level loading states
Every route segment under (student)/, (admin)/, (super-admin)/ that fetches data has a sibling loading.tsx. Next.js wraps the segment in Suspense automatically — this is not optional scaffolding, it is the primary defense against blank-screen navigation.
Skeletons should mirror the real layout (card count, table row count, roughly correct heights) rather than a generic spinner — this avoids layout shift when real content arrives.
Every route segment with a loading.tsx also gets an error.tsx alongside it, so a slow or failed query resolves to a retry UI instead of a stuck skeleton.
Data fetching
Fetch in server components. Client-side useEffect fetching after mount is not used for initial page data — it produces a waterfall (page → JS → fetch → data) that a server component avoids entirely.
When a route needs more than one independent piece of data (e.g. a dashboard needing profile completion, active drives, and application status), fetch them in parallel — either Promise.all inside the server component or parallel Suspense boundaries. Sequential awaits for independent data are a bug, not a style choice.
"use client" components that need data (e.g. a filter dropdown) receive it as props from the server component or fetch through a server action — they do not own their own initial fetch.
Neon cold starts
Neon's serverless compute scales to zero after ~5 minutes idle; the first query after a cold period has extra latency. This is expected, not a bug to chase.
Do not attempt to work around this with keep-alive pings or always-on compute — it costs money for a problem the UI can absorb.
Handle it entirely in the UI: the route's loading.tsx skeleton covers the wake-up delay. No cold-start-specific logic is written in application code.
Long-running operations (Excel import, bulk eligibility runs)
Any operation that runs for more than ~1 second (Excel bulk upload, eligibility matching against a large drive) reports progress rather than blocking on a spinner with no feedback — e.g. "Validating row 340/500."
A server action that triggers a slow operation returns immediately with an accepted/pending state where possible; the UI polls or re-fetches for completion rather than holding the request open.
Pairs with the existing Excel-import invariant (transactional import, file retained only on failure) — failure states must be visible mid-progress, not just as a final error.
Paginated lists
Every paginated list (student roster, drive list, audit log) shows a lightweight row-shimmer or skeleton table during page transitions, not a blank table or full-page loader — pagination is a partial update, and it should feel like one.
Search and filter inputs on these lists are debounced (300ms) — no query fires on every keystroke.
Optimistic UI
Fast, low-risk mutations (applying to a drive, marking a task) use useOptimistic to update the UI immediately and reconcile with the server response. Reserve this for actions with a clear, predictable success path — do not use it for actions with real validation risk (e.g. Excel import, drive creation), where an incorrect optimistic state would be misleading.
Images
All images (student avatars, department logos, company logos on drive cards) use next/image, not a raw <img> tag — this prevents layout shift and gets automatic sizing/format optimization for free.
Non-negotiables
A PR that adds a data-fetching route without a loading.tsx is not complete per the six-point unit completion checklist in ai-workflow-rules.md — treat "add loading state" as part of building the route, not a follow-up task.
These patterns cost nothing at CampusHire's scale (no paid infra required) — they are implementation discipline, not a budget decision.