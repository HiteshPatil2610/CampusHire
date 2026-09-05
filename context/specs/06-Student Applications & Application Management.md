You are continuing development of the CampusHire project.

IMPORTANT:
- Read ALL files inside `context/` before making changes.
- Read the existing project structure and all previously completed implementation/spec files.
- Unit 01, Unit 02, Unit 03, Unit 04, and Unit 05 are already completed/in progress as documented by the project.
- Do NOT redo completed work.
- Do NOT split this task into sub-units.
- Implement this entire Unit 06 as one cohesive module.
- Follow the existing CampusHire architecture, conventions, design system, and database decisions.
- Do not invent requirements that are not supported by the project context.
- If something is genuinely unspecified, choose the smallest safe implementation and document the assumption/open question rather than expanding scope.

==================================================
UNIT 06 — STUDENT APPLICATIONS & APPLICATION MANAGEMENT
==================================================

PRIMARY OBJECTIVE

Implement the complete CampusHire student application workflow.

A student must be able to:
1. View drives for which they are eligible.
2. Open a drive and review its details.
3. Apply to an eligible drive.
4. Apply only once to the same drive.
5. See their application history/status.
6. Never bypass eligibility, deadline, role, or ownership checks through direct requests.

The application workflow must be enforced server-side.

==================================================
1. CREATE THE UNIT SPECIFICATION
==================================================

Create:

`context/specs/06-student-applications.md`

Document:
- purpose
- scope
- application lifecycle
- database model
- business rules
- authorization rules
- duplicate prevention
- eligibility enforcement
- deadline enforcement
- pagination
- server actions/data-access responsibilities
- UI responsibilities
- validation
- error handling
- tests
- assumptions/open questions

Keep the specification aligned with the existing project context.

==================================================
2. DATABASE — DRIVE APPLICATION
==================================================

Implement the `DriveApplication` database model if it has not already been implemented.

Use ONLY fields supported by the existing CampusHire context.

At minimum, the relationship must represent:

Student
    ↓
DriveApplication
    ↓
Drive

Required invariant:

A student can apply to a particular drive only once.

Therefore enforce at DATABASE LEVEL:

UNIQUE(studentId, driveId)

The database must be the final protection against duplicate applications.

Relationships must be correctly connected to:
- Student
- Drive

Use the project's existing Prisma conventions.

DO NOT introduce unnecessary application fields.

DO NOT add resume storage.
DO NOT add application documents.
DO NOT add AI scoring.
DO NOT add interview scheduling.
DO NOT add offer management.
DO NOT add placement outcome tracking.

==================================================
3. APPLICATION BUSINESS RULES
==================================================

Implement these rules server-side.

RULE 1 — AUTHENTICATED STUDENT

Only authenticated students can create applications.

A:
- DEPT_ADMIN
- SUPER_ADMIN
- unauthenticated user

must not be able to create a student application through the student application mutation.

Never trust a client-provided role.

Resolve the authenticated Clerk user and CampusHire User server-side.

==================================================

RULE 2 — STUDENT OWNERSHIP

The student can create an application ONLY for themselves.

Never accept an arbitrary `studentId` from the client and trust it.

Resolve the current student from the authenticated user.

If an action receives a student identifier for routing/query purposes, verify that it belongs to the authenticated user.

Prevent IDOR-style access.

==================================================

RULE 3 — DRIVE EXISTENCE

Before applying:
- verify that the drive exists
- verify that it is accessible according to the existing drive rules

If the drive does not exist, return a safe not-found error.

Do not expose unnecessary database details.

==================================================

RULE 4 — ELIGIBILITY RE-CHECK

Eligibility MUST be checked again when the student submits the application.

Do NOT rely on:
- the drive list
- UI state
- a previously loaded page
- hidden fields
- query parameters
- client-side checks

The application mutation must independently execute the existing server-side eligibility logic from Unit 05.

If the student is not eligible:

DO NOT create the application.

Return a clear, user-safe error.

This protects against a student manipulating:
- drive IDs
- URLs
- request payloads
- browser state
- direct server requests

==================================================
RULE 5 — APPLICATION DEADLINE
==================================================

Before creating an application, verify the current drive status using the existing shared:

`getDriveStatus(applicationDeadline)`

Do NOT introduce a stored Drive status field.

The application mutation must reject applications after the application deadline according to the project's existing drive-status semantics.

Do not duplicate deadline/status logic in multiple places.

Reuse the existing shared helper.

==================================================
RULE 6 — APPLY ONCE
==================================================

A student must not be able to apply to the same drive more than once.

Check for an existing application before insertion for a good user experience.

However, this application-level check is NOT sufficient by itself.

The database unique constraint:

`studentId + driveId`

must remain the authoritative duplicate protection.

Handle Prisma unique-constraint errors gracefully in case of:
- concurrent requests
- double-clicks
- multiple browser tabs
- repeated submissions
- race conditions

The user should receive a safe "already applied" style error rather than a raw database error.

==================================================
RULE 7 — NO UPDATE / DELETE
==================================================

DriveApplication records must NOT expose update or delete functionality.

Do not implement:
- edit application
- withdraw application
- delete application
- change application details

Once successfully created, the application remains immutable.

==================================================
4. SERVER-SIDE APPLICATION SERVICE / DATA ACCESS
==================================================

Follow the project's architecture.

Business logic must NOT live inside route/page components.

Create appropriate application feature files under:

`features/`

Use the existing project naming conventions.

Keep responsibilities separated appropriately, for example:
- application mutations
- application queries
- validation
- authorization
- UI

Do not create unnecessary abstraction layers.

Use server actions where appropriate.

Only create API route handlers if there is a genuine architectural requirement.

==================================================
5. APPLICATION MUTATION
==================================================

Implement a server-side mutation such as:

`applyToDrive(driveId)`

or an equivalent project-consistent function.

The exact naming can follow existing conventions.

Flow:

1. Authenticate through Clerk.
2. Resolve CampusHire User.
3. Verify role = STUDENT.
4. Resolve Student record.
5. Verify drive exists.
6. Re-run server-side eligibility.
7. Calculate current drive status using `getDriveStatus()`.
8. Reject if applications are closed.
9. Check whether application already exists.
10. Create DriveApplication.
11. Handle database unique constraint safely.
12. Return a safe success result.

Never trust client-provided:
- student ID
- department
- eligibility result
- role
- application status
- timestamps
- authorization information

==================================================
6. APPLICATION HISTORY
==================================================

Implement a student-facing application history/list.

A student must only see THEIR OWN applications.

Never return another student's applications.

Each application should include the minimum useful information supported by the existing context, such as:
- associated drive information
- relevant application information
- current drive status where appropriate

Do not invent additional application states if the context does not define them.

Remember:

Drive status is computed using:

`getDriveStatus(applicationDeadline)`

Do not create a persistent `status` field on DriveApplication unless the existing context explicitly requires one.

==================================================
7. PAGINATION
==================================================

Any application list that can exceed one screenful must use offset pagination.

Use the project's standard:

- default `pageSize = 25`
- page
- pageSize
- totalCount
- data

Return:

{
  data,
  page,
  pageSize,
  totalCount
}

Validate pagination inputs server-side.

Prevent unreasonable page sizes.

Follow the project's existing pagination utilities if already implemented.

==================================================
8. AUTHORIZATION
==================================================

Every application query and mutation must perform server-side authorization.

Student:

- can create their own application
- can view their own applications
- cannot view another student's applications
- cannot modify applications
- cannot delete applications

Department admin:

Do NOT automatically give department admins application-management capabilities unless those capabilities are explicitly defined by the existing CampusHire context.

If the context supports department-admin application visibility, implement it strictly within the admin's own department.

The query must enforce department scope server-side.

Never:
1. fetch all applications
2. filter by department in React
3. trust a department ID from the browser

Instead, scope the database query itself.

Super admin behavior should only be implemented where explicitly supported by the project context.

Do not invent an admin application dashboard simply because the role exists.

==================================================
9. VALIDATION
==================================================

Use Zod for external input.

Validate:
- driveId
- pagination
- any query parameters
- action inputs

Reject:
- malformed IDs
- empty IDs
- invalid pagination
- unreasonable page sizes
- unexpected input

Do not use `any`.

Do not use unsafe casts to bypass TypeScript.

==================================================
10. ERROR HANDLING
==================================================

Provide safe application errors for cases such as:

- unauthenticated
- not a student
- student profile missing
- drive not found
- student not eligible
- application deadline passed
- already applied
- database constraint conflict
- unexpected server error

Do not expose:
- Prisma internals
- SQL
- stack traces
- sensitive database information

Use the project's existing error-handling conventions.

==================================================
11. STUDENT UI
==================================================

Implement the student application experience using the existing CampusHire design system.

Do not redesign the application.

Use:
- existing theme tokens
- existing typography
- existing shadcn/ui components
- existing Tabler icons
- existing layouts
- existing spacing conventions

Student drive detail should clearly communicate:
- drive information
- eligibility state
- application availability
- application action

For eligible students with an open application window:

Show an obvious:

`Apply`

action.

For already-applied students:

Show an appropriate non-action state such as:

`Applied`

Do not allow another submission.

For ineligible students:

Clearly communicate that the student is not eligible.

For closed drives:

Clearly communicate that applications are closed.

Important:

The UI is only a convenience layer.

All of these states MUST also be enforced server-side.

==================================================
12. APPLY ACTION UX
==================================================

The Apply action should:

- prevent accidental repeated submissions
- show pending/loading state
- handle success
- handle already-applied response
- handle eligibility failure
- handle deadline closure
- refresh relevant application/drive state after success

Do not rely solely on disabling the button.

A malicious or direct request must still be rejected server-side.

Avoid unnecessary confirmation modals unless the existing design system/context calls for one.

==================================================
13. APPLICATION HISTORY UI
==================================================

Create the student application history page/section consistent with the existing student UI.

Display applications in a clean list/table/card format based on the existing design language.

Include useful information supported by context.

Provide:
- pagination
- empty state
- loading state
- error state

Do not add unsupported application workflow states.

==================================================
14. ROUTING
==================================================

Use the existing route-group architecture.

Do not create unrelated route structures.

Application pages should live in the appropriate student route group.

Route files must remain composition-only.

Do not put:
- Prisma queries
- authorization logic
- business rules
- eligibility calculations

directly inside page components.

==================================================
15. SECURITY TESTING
==================================================

Explicitly test authorization boundaries.

Tests must prove that:

1. Student can apply to an eligible drive.
2. Student cannot apply to an ineligible drive.
3. Student cannot apply after the deadline.
4. Student cannot apply twice.
5. Duplicate applications are rejected even under database constraint conditions.
6. Student can only create applications for themselves.
7. Student cannot access another student's application history.
8. Department admin cannot access another department's applications if admin application visibility exists.
9. Unauthenticated users cannot create applications.
10. Non-student roles cannot create student applications.
11. Manipulating the drive ID cannot bypass eligibility.
12. Client-side state cannot bypass the deadline.
13. Application records cannot be updated.
14. Application records cannot be deleted.

Use Vitest following existing project testing conventions.

Focus on business logic and authorization.

Do NOT create E2E tests unless explicitly requested.

==================================================
16. DATABASE VERIFICATION
==================================================

Update Prisma schema only for application-related structures required by this module.

Run:

- Prisma validation
- Prisma generation
- migration if a real PostgreSQL/Neon database is available
- TypeScript checks
- lint
- tests
- production build

If database connectivity is unavailable:

DO NOT fake migration success.

Clearly report:

- schema implementation completed
- Prisma validation/generation result
- database migration status
- reason migration could not be executed

==================================================
17. ENVIRONMENT
==================================================

Continue using:

`lib/env.ts`

for environment validation.

Do not access environment variables directly throughout application code.

Do not add unnecessary environment variables.

==================================================
18. ARCHITECTURAL RULES
==================================================

Maintain all existing CampusHire rules:

- Clerk owns authentication.
- Database is authoritative for application authorization.
- Role is reverified server-side.
- Department scope is reverified server-side.
- Student ownership is reverified server-side.
- Eligibility is calculated/enforced server-side.
- Drive status is computed using `getDriveStatus()`.
- No stored drive status.
- DriveApplication is immutable.
- One application per student per drive.
- Database unique constraint is mandatory.
- Large/binary content remains outside PostgreSQL.
- No business logic in route files.
- No business logic in client components.
- No `any`.
- No unsafe casts.
- Zod validates external input.

==================================================
19. STRICT OUT OF SCOPE
==================================================

DO NOT implement:

- Excel/CSV bulk import
- department management
- admin account management
- audit logging
- notification/email system
- resume builder
- resume PDF storage
- AI resume analysis
- AI candidate scoring
- interview scheduling
- placement outcome management
- offer management
- payments
- multi-college tenancy
- mobile application
- application withdrawal
- application editing
- application deletion
- unsupported application status workflow

Do not expand scope.

==================================================
20. DOCUMENTATION
==================================================

Update:

`context/progress-tracker.md`

Record:

- Unit 06 status
- implementation completed
- important decisions
- tests completed
- build/type/lint results
- migration status
- known assumptions/open questions

Also ensure:

`context/specs/06-student-applications.md`

accurately reflects the implementation.

==================================================
21. FINAL VERIFICATION
==================================================

Before declaring Unit 06 complete, verify:

[ ] DriveApplication model exists correctly.
[ ] Student ↔ DriveApplication relationship works.
[ ] Drive ↔ DriveApplication relationship works.
[ ] Unique(studentId, driveId) exists.
[ ] Student can apply to an eligible open drive.
[ ] Eligibility is rechecked during mutation.
[ ] Deadline is rechecked during mutation.
[ ] Duplicate application is prevented.
[ ] Concurrent duplicate application is safely handled.
[ ] Applications cannot be updated.
[ ] Applications cannot be deleted.
[ ] Student ownership is enforced.
[ ] Student application history is isolated.
[ ] Pagination follows project standard.
[ ] Department scope is enforced wherever admin access exists.
[ ] Zod validation is implemented.
[ ] No client-side authorization is trusted.
[ ] No business logic is inside route/page components.
[ ] Vitest tests pass.
[ ] TypeScript passes.
[ ] Lint passes.
[ ] Build passes.
[ ] Prisma validation/generation passes.
[ ] Migration status is accurately reported.
[ ] Progress tracker is updated.
[ ] Unit 06 specification is complete.

==================================================
22. IMPORTANT IMPLEMENTATION PRINCIPLE
==================================================

Do not merely make the Apply button work.

The goal is to make the entire application workflow secure against direct API/server-action manipulation.

A request like:

applyToDrive(anyDriveId)

must still independently verify:

authenticated user
        ↓
CampusHire User
        ↓
STUDENT role
        ↓
Student ownership
        ↓
Drive exists
        ↓
Eligibility
        ↓
Application deadline
        ↓
Existing application
        ↓
Database unique constraint
        ↓
Create immutable application

The browser must never be the authority for any of these decisions.

==================================================
EXECUTION ORDER
==================================================

Execute in this order:

1. Read all context and existing Unit 01–05 implementation.
2. Create/update Unit 06 specification.
3. Inspect existing Prisma schema.
4. Implement DriveApplication model and relations.
5. Implement application authorization/data-access logic.
6. Implement apply mutation.
7. Implement duplicate/deadline/eligibility enforcement.
8. Implement student application history.
9. Implement pagination.
10. Implement student UI.
11. Add focused Vitest tests.
12. Run Prisma validation/generation.
13. Run migration if DB is available.
14. Run TypeScript checks.
15. Run lint.
16. Run tests.
17. Run production build.
18. Update progress tracker.
19. Review the final diff for scope violations.

==================================================
FINAL RESPONSE REQUIREMENT
==================================================

When finished, report:

- Unit 06 completion status
- files created/modified
- DriveApplication schema details
- application workflow implemented
- authorization/security protections
- tests added and results
- Prisma/migration status
- TypeScript/lint/build status
- any assumptions/open questions
- exact next recommended module

Do NOT claim anything passed if it was not actually executed.
Do NOT claim a database migration succeeded if PostgreSQL/Neon was unavailable.