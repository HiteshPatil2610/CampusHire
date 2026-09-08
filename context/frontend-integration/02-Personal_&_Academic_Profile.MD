You are implementing Feature 2 of the CampusHire frontend integration.

## Read First

Read:

1. `context/frontend-integration/00-overview.md`
2. `context/frontend-integration/01-foundation-design-system.md`
3. `context/frontend-integration/02-profile-personal-academic.md`
4. `context/frontend-integration/component-mapping.md`

Then inspect the actual existing Next.js and Vite source code.

Feature 1 has already been implemented. Verify its actual state before proceeding.

## Your Task

Implement ONLY Feature 2:

`02-profile-personal-academic.md`

Implement the complete Personal & Academic profile functionality.

## Scope

Implement:

1. DatePicker migration
2. UrlField migration
3. Profile query/data layer
4. Zod schemas
5. Personal information Server Action
6. Academic information Server Action
7. Student profile Server Component
8. Profile Client Component
9. Profile header
10. Profile tab navigation
11. Personal Information tab
12. Academic Information tab

## Architecture

Follow this pattern:

Client Component
→ Server Action
→ Zod validation
→ Prisma
→ PostgreSQL
→ revalidatePath()
→ updated UI

Use Server Components for data fetching whenever possible.

Use Client Components only where interaction/state is required.

## Authentication

Every profile operation must identify the current student through the existing Clerk authentication utilities.

Never trust a client-provided student ID for authorization.

## Database

Before writing queries:

* Inspect the actual Prisma schema.
* Inspect existing Student, StudentAcademic and related models.
* Reuse existing relations.
* Do not duplicate models.
* Do not remove existing fields.
* Only modify the schema if required by the actual functionality.

## Frontend Migration

Inspect the original Vite components before converting them.

Preserve:

* Existing fields
* Existing labels
* Existing UI behavior
* Existing validation intent
* Existing layout
* Existing user experience

Convert the implementation to the Next.js/TypeScript architecture rather than creating a simplified replacement.

## Validation

Use Zod on the server.

Client-side validation may also be used for UX, but server-side validation is mandatory.

Validate appropriate ranges for:

* Phone
* Date
* Academic percentages
* CGPA
* Backlogs
* Other fields already defined by the existing frontend/backend specification

## Testing

Verify:

* Clerk authentication
* Profile retrieval
* Personal information update
* Academic information update
* Database persistence
* Validation failures
* Unauthorized access
* Loading state
* Error state
* Success toast
* Profile page rendering

Run TypeScript, lint, tests, Prisma validation and build checks.

Fix discovered problems.

## Completion

Update the Feature 2 checklist/status in the context files.

Report:

* Files created
* Files modified
* Database changes
* Server Actions
* Queries
* UI components
* Tests performed
* Remaining issues

STOP.

Do not implement Features 3–7.
