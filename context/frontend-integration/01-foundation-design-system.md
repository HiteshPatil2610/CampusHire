You are implementing Feature 1 of the CampusHire frontend integration.

## Context

This project has:

* A Vite/React frontend containing the completed UI.
* A Next.js 15 backend/application using TypeScript.
* Prisma + PostgreSQL for the database.
* Clerk for authentication.

The goal is to migrate the Vite frontend into the existing Next.js application.

Read these files FIRST:

1. `context/frontend-integration/00-overview.md`
2. `context/frontend-integration/01-foundation-design-system.md`
3. `context/frontend-integration/component-mapping.md`

Also inspect the actual source code and existing project structure before making any changes.

## Your Task

Implement ONLY Feature 1 — Foundation & Design System.

Complete every task in:

`context/frontend-integration/01-foundation-design-system.md`

This includes:

1. Database schema enhancement
2. Clerk authentication utilities
3. Design-token unification
4. Core UI component migration
5. Toast notification system

## Important Rules

* Do NOT blindly copy the example code from the context file.
* Inspect the existing Prisma schema before modifying it.
* Preserve all existing backend functionality.
* Do not delete existing functionality unless the context explicitly requires it.
* Do not rewrite the backend architecture.
* Use the existing project conventions wherever possible.
* Use TypeScript.
* Use Tailwind.
* Use Clerk's existing integration.
* Use the existing Prisma setup.
* Avoid duplicate utilities/components if equivalent implementations already exist.
* If a required dependency is missing, install it only if genuinely necessary.
* Do not implement Feature 2 or any later feature.
* Do not migrate the entire frontend yet.

## Database Safety

Before changing `schema.prisma`:

1. Inspect the existing Student-related models.
2. Check whether the requested fields already exist under different names.
3. Check existing relations and constraints.
4. Add only fields actually required by the current frontend integration.
5. Do not remove existing columns or relations.
6. Create a proper Prisma migration.

## Authentication

Implement the authentication helpers using the existing Clerk configuration.

The helper layer must:

* Obtain the authenticated Clerk user.
* Resolve the corresponding Student using `userId`.
* Reject unauthenticated users.
* Reject authenticated users without a Student record.
* Preserve existing authorization behavior.

## UI Migration

Inspect the actual Vite components before migrating:

* Button
* Badge
* Modal

Preserve their existing behavior and visual intent while converting them to TypeScript/Tailwind.

Do not simplify functionality just to make migration easier.

## Toast

Inspect the existing ToastContext and migrate its behavior into the Next.js architecture.

Ensure success, error, warning, and info notifications continue to work.

## Validation

After implementation:

1. Run TypeScript checks.
2. Run linting if configured.
3. Run the relevant tests.
4. Run Prisma validation/generation.
5. Verify the Next.js application builds.
6. Verify the migrated UI components render.
7. Verify Clerk helper compilation.
8. Verify no existing functionality was broken.

Fix issues you discover.

## Completion

Only when Feature 1 is actually working:

* Update the Feature 1 status/checklist in the context file.
* Clearly report:

  * Files created
  * Files modified
  * Database changes
  * Dependencies added
  * Tests/checks executed
  * Any issues remaining

STOP after Feature 1.

Do not start Feature 2.
