# CampusHire — Unit 01: Project Setup

You are working on the **CampusHire** project.

Before making any changes, thoroughly read and follow these context files:

* `context/project-overview.md`
* `context/architecture.md`
* `context/ui-context.md`
* `context/code-standards.md`
* `context/progress-tracker.md`

Also inspect the existing repository structure before creating or modifying files.

## Objective

Implement **Unit 01 — Project Setup only**.

The goal of this unit is to establish the CampusHire application foundation so that subsequent feature units can be implemented safely.

Do **not** implement student profiles, Excel upload, drives, eligibility matching, applications, departments, admin management, dashboards, or other feature functionality yet.

---

## Step 1 — Create the Unit Spec

First create:

`context/specs/01-project-setup.md`

The spec must define the exact scope of Unit 01.

It should cover:

* Project initialization
* Next.js App Router + TypeScript
* Tailwind CSS
* shadcn/ui setup
* CampusHire theme/token configuration
* Prisma setup
* PostgreSQL/Neon connection configuration
* Clerk installation/configuration foundation
* Initial route-group structure
* Middleware foundation for authentication/role route protection
* Environment-variable validation
* Basic shared project structure
* Build verification

Explicitly state what is **out of scope for Unit 01**.

Do not invent requirements that are not supported by the existing context files.

---

## Step 2 — Inspect Before Changing

Before implementing anything:

1. Inspect the repository.
2. Determine whether a Next.js project already exists.
3. Inspect the existing `package.json`.
4. Inspect existing configuration files.
5. Inspect the existing `app/`, `components/`, `lib/`, `prisma/`, and `context/` directories.
6. Do not overwrite existing work blindly.
7. Preserve existing files and functionality unless a change is required by Unit 01.

If something required by the setup is ambiguous, do not guess. Document the ambiguity in `progress-tracker.md`.

---

## Step 3 — Establish the Next.js Foundation

Set up the project according to the architecture:

* Next.js 14+ / App Router
* TypeScript
* Strict TypeScript mode
* Tailwind CSS
* shadcn/ui
* ESLint/configuration appropriate for the project

Use the existing repository if it is already a Next.js project rather than recreating it.

Do not introduce unnecessary dependencies.

---

## Step 4 — Configure CampusHire UI Tokens

Use the exact design system defined in:

`context/ui-context.md`

Configure the global theme so the CampusHire tokens are available through CSS variables/Tailwind.

The following must be represented:

* `--surface-0`
* `--surface-1`
* `--surface-2`
* `--text-primary`
* `--text-secondary`
* `--text-muted`
* `--border`
* `--border-strong`
* `--accent`
* `--accent-dark`
* `--accent-light`
* `--teal`
* `--teal-light`
* `--amber`
* `--amber-light`
* `--purple`
* `--purple-light`
* `--red`
* `--red-light`

Use the values specified in `ui-context.md`.

Do not introduce alternative colors.

Do not hardcode hex colors inside components.

Configure shadcn's theme variables to map to the CampusHire design tokens.

Use Inter as specified by the UI context.

Do not build the actual application screens yet.

---

## Step 5 — Prisma Foundation

Set up Prisma according to `architecture.md`.

Create/configure:

`prisma/schema.prisma`

At this stage, establish the Prisma/PostgreSQL foundation.

Do not invent database fields or relationships beyond what is explicitly required for the project setup.

If the complete schema is required before the next unit and the existing context provides enough information to define it safely, document that decision in the Unit 01 spec first.

Otherwise, leave feature-specific schema work for the appropriate future unit.

Configure the Neon/PostgreSQL connection correctly through the validated environment configuration.

Do not manually create or edit generated migration files.

---

## Step 6 — Environment Variable Validation

Create:

`lib/env.ts`

All environment variables must be validated through a Zod schema and parsed once at module load.

Follow `code-standards.md` exactly:

* No direct `process.env` access outside `lib/env.ts`.
* Required variables must fail fast if missing/malformed.
* `.env.local` must never be committed.
* `.env.example` must document every required environment variable with placeholders.

Do not commit real secrets.

Use the environment variables required by the currently implemented foundation, including the required Clerk and database configuration.

Only add Vercel Blob variables if the setup actually requires them at this stage.

---

## Step 7 — Clerk Foundation

Set up Clerk according to `architecture.md`.

The foundation must support:

* Clerk authentication
* Server-side identity
* Future role handling
* Future student email verification
* Future department-admin/super-admin provisioning

Do not implement the complete registration/profile/admin flows yet.

Do not implement custom passwords, sessions, cookies, or OTP logic.

Clerk remains the source of authentication/session identity.

---

## Step 8 — Route Groups

Establish the architectural route structure:

```text
app/
├── (auth)/
├── (student)/
├── (admin)/
├── (super-admin)/
└── api/
```

Keep route files focused on composition.

Do not build dashboard functionality yet.

Create only the minimum placeholder pages/layouts necessary to verify that the route groups work.

---

## Step 9 — Middleware Foundation

Create/configure root:

`middleware.ts`

Middleware must only handle:

* Clerk session protection
* Authentication checks
* Role-based route-group protection

Do not put department-scope checks in middleware.

Do not put database business logic in middleware.

Do not implement eligibility logic in middleware.

Department/resource-level authorization will later be implemented inside server actions/route handlers according to `architecture.md`.

Role information must ultimately come from the authenticated Clerk session/server-side metadata, not client input.

If role metadata handling cannot safely be completed in Unit 01 without requirements from a later spec, establish only the necessary foundation and document the remaining requirement in `progress-tracker.md`.

---

## Step 10 — Project Structure

Ensure the repository follows the feature-based architecture:

```text
app/
features/
components/
  ui/
  shared/
lib/
prisma/
scripts/
context/
```

Do not create feature implementations yet.

Do not create placeholder business logic just to populate directories.

Do not modify generated `components/ui/*` manually.

---

## Step 11 — Verification

Before declaring Unit 01 complete:

Run the relevant checks, including:

```bash
npm run build
```

Also run the available lint/type checks and verify that:

* TypeScript is strict.
* The project builds successfully.
* Prisma configuration is valid.
* Environment validation is wired correctly.
* Clerk integration does not introduce TypeScript/build errors.
* Route groups compile.
* Middleware compiles.
* No affected route has console errors caused by this unit.

Do not hide TypeScript errors with `any`, `@ts-ignore`, or unsafe casts.

Fix root causes.

---

## Step 12 — Update Progress Tracker

After implementation, update:

`context/progress-tracker.md`

Reflect:

* Unit 01 completed work
* Files/configuration added or changed
* Verification performed
* Any unresolved open questions
* The next development unit

Do not mark Unit 01 complete unless the project builds successfully.

---

## Strict Constraints

These rules are mandatory:

1. Work only on **Unit 01 — Project Setup**.
2. Do not implement feature functionality ahead of its spec.
3. Do not invent product behavior.
4. Do not invent eligibility rules.
5. Do not invent profile fields.
6. Do not invent role permissions.
7. Do not modify `components/ui/*` manually.
8. Do not manually edit committed Prisma migrations.
9. Do not access `process.env` outside `lib/env.ts`.
10. Do not use `any` to bypass TypeScript problems.
11. Do not move business logic into `app/`.
12. Do not implement department/resource authorization in middleware.
13. Do not implement client-side access control as a substitute for server-side authorization.
14. Preserve existing files and functionality unless the current unit explicitly requires a change.
15. If a requirement is missing or ambiguous, stop that portion and record it in `context/progress-tracker.md` instead of guessing.
16. Do not proceed to Unit 02 after finishing Unit 01.

## Final Response

When finished, report:

1. What was implemented.
2. Files created/modified.
3. Dependencies added.
4. Build/type/lint verification results.
5. Any open questions.
6. The proposed next unit.

Do not claim completion if `npm run build` fails.
