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

## Data and Storage

- Metadata and all structured/queryable data belongs in Postgres via Prisma.
- Large or binary content (profile photos, JD PDFs) belongs in Vercel Blob — store only the returned URL in Postgres.
- Every table that scopes to a department includes a `departmentId` foreign key; every query for a `DEPT_ADMIN`-scoped resource filters on it explicitly — never rely on implicit scoping.
- Soft-delete is not used unless a feature explicitly requires history (e.g. audit log entries are append-only and never deleted).

## Environment Variables

- All environment variables are declared and validated in a single `lib/env.ts` using a Zod schema, parsed once at module load. If a required variable is missing or malformed, the app fails to start rather than failing later at the point of use — this applies to both local dev (`.env.local`) and Vercel-deployed environments (Vercel project env vars).
- Code never reads `process.env` directly outside `lib/env.ts` — everywhere else imports the validated, typed `env` object from there.
- Secrets (Clerk keys, Neon connection string, Vercel Blob token) are never committed; `.env.local` is git-ignored and `.env.example` documents every required key with a placeholder value.

## Testing

- Unit test core business logic with Vitest — specifically drive-eligibility matching, Excel-row validation, and profile-completion calculation.
- Business logic that needs testing is written as small, pure functions with no direct database or Clerk calls (e.g. `isStudentEligibleForDrive(student, drive)`, `validateStudentRow(row)`, `calculateProfileCompletion(profile)`), then called from the server action. The server action itself handles auth/DB wiring and stays thin enough not to need its own test — the pure function underneath it is what's tested.
- Tests live alongside the code they test inside the relevant `features/` folder (`*.test.ts`), not in a separate mirrored tree.
- A feature that changes eligibility rules or validation logic is not done until its tests are updated and passing.
- End-to-end testing (Playwright or similar) is explicitly out of scope for V1 — do not install or configure it without an explicit instruction to do so.

## File Organization (feature-based)

- `app/` — Route segments only: `(auth)/`, `(student)/`, `(admin)/`, `(super-admin)/`, `api/`. No business logic.
- `middleware.ts` (root) — Clerk session/route protection only, per `architecture.md`.
- `features/auth/` — Sign-up/sign-in flows, role assignment, Clerk webhook handling.
- `features/students/` — Student profile CRUD, profile-completion calculation, department-scoped student queries.
- `features/excel-upload/` — Template generation, row parsing/validation, bulk-import transaction logic.
- `features/drives/` — Drive CRUD, eligibility-matching logic, applications.
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