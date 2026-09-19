You are continuing implementation of the existing CampusHire codebase.

IMPORTANT PROJECT STATE:

The project has already completed ARCH-FIX1 phases P1 through P8.

Those completed phases established the current:
- authentication and authorization
- department isolation
- unified drive architecture
- Master Drive / Department Drive structure
- department assignment
- drive lifecycle
- publish/lock behavior
- department overrides
- eligibility foundation
- application field configuration
- existing student registration/access-request workflow
- existing Excel import
- existing dashboards
- existing notifications/audit infrastructure where applicable

DO NOT rebuild these systems from scratch.

Before changing anything:

1. Inspect the current codebase.
2. Inspect the current Prisma schema and migrations.
3. Inspect the existing implementation of the relevant domain.
4. Identify what is already implemented.
5. Reuse existing models, actions, queries, schemas, utilities, components, authorization helpers and UI patterns.
6. Extend existing systems instead of creating duplicate systems.
7. Check all callers before changing shared contracts.
8. Do not rename/restructure working architecture unless required by a verified defect.
9. Do not implement unrelated future phases.
10. Do not assume the old architecture still exists; the current code is the source of truth.

DATABASE SAFETY:

- Never run `prisma migrate dev` against the connected Neon database.
- Never run database reset commands.
- Never use destructive reset flags.
- Never drop tables/columns/data automatically.
- Never delete production data automatically.
- Inspect migration history before changing schema.
- Check live-schema compatibility before risky migrations.
- For destructive or irreversible changes:
  1. inspect dependencies,
  2. produce an impact/dry-run report,
  3. explain exactly what would change,
  4. stop for confirmation before executing it.
- Prefer additive migrations.
- Use the project's established migration/deployment process.
- Preserve existing data.

AUTHORIZATION:

Every server-side mutation must enforce authorization independently of the UI.

Never trust:
- IDs from the client
- department IDs from the client
- role claims alone
- editable/read-only flags from the client
- eligibility results from the client
- application field values from the client

After implementation:

- run relevant tests
- run TypeScript checks
- run lint where appropriate
- verify affected Server Actions/routes
- verify authorization
- verify database integrity
- inspect for duplicate architecture
- report exactly what changed
- report migrations
- report tests performed
- report unresolved issues

Do not claim something was verified unless you actually verified it.


Implement/refine the Department Admin recruitment and placement management experience using the recruitment and placement architecture already implemented.

Do not create new backend architecture unless a verified missing capability requires it.

==================================================
1. DRIVE DETAIL
==================================================

Department Admin drive detail should provide a useful operational view:

- Overview
- Eligibility
- Eligible Students
- Registered Students
- Applications
- Recruitment Pipeline
- Placement
- Activity

Use existing queries/actions.

Respect department authorization.

==================================================
2. ELIGIBLE STUDENTS
==================================================

Provide:

- search
- batch filter
- eligibility status
- placement status
- application status

Use the central eligibility engine.

Do not recalculate eligibility differently in the UI.

==================================================
3. APPLICATIONS
==================================================

Provide:

- student
- batch
- application status
- current recruitment stage
- applied date
- relevant snapshot information where authorized

Support useful filtering.

Do not expose data that the actor is not authorized to view.

==================================================
4. DYNAMIC RECRUITMENT PIPELINE
==================================================

Never hard-code:

Aptitude
Technical
HR
Offer

as the universal pipeline.

Render the configured pipeline dynamically.

Example:

Application
→ Coding
→ Technical
→ HR
→ Offer

The UI must work with arbitrary configured stages.

==================================================
5. STAGE MANAGEMENT
==================================================

Allow authorized Department Admins to move applications between valid stages.

Use server-side transition validation.

Provide confirmation where the operation affects multiple students.

Display stage history where supported.

==================================================
6. BULK STAGE ACTIONS
==================================================

Allow selecting multiple applications.

Example:

20 students
→ Move to Technical Interview

Before applying:

- validate authorization
- validate target stage
- validate each application
- identify failures

After applying:

- show successful updates
- show failed updates
- explain partial failures
- audit the bulk operation

Do not silently ignore failures.

==================================================
7. PLACEMENT MANAGEMENT
==================================================

Department Admin can mark a student as placed.

Provide a clear workflow for:

- company
- role
- package
- placement date
- drive/application reference
- optional notes if supported

Require confirmation before permanent placement status is applied.

Once placed:

- student becomes permanently excluded from future placement drives
- historical applications remain
- historical recruitment records remain
- placement is auditable

==================================================
8. STUDENT PLACEMENT VIEW
==================================================

Student can see:

PLACED

and relevant placement information.

Student cannot edit placement.

==================================================
9. SUPER ADMIN VIEW
==================================================

Super Admin should have an appropriate global placement view according to existing dashboard architecture.

Support:

- department
- company
- batch
- placement date
- student
- drive

where existing backend supports these filters.

==================================================
10. ACTIVITY
==================================================

Show useful activity/history:

- application submitted
- stage changes
- placement changes
- relevant drive events

Reuse AuditLog/history.

==================================================
11. UX
==================================================

Include:

- loading
- empty
- error
- confirmation
- success
- permission denied
- bulk operation result
- placement confirmation

Do not redesign unrelated areas.

FINAL REPORT:

Report:

- recruitment UI changes
- placement UI changes
- bulk actions
- filters
- routes/components
- tests/typecheck
- unresolved issues