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


Implement the frontend/UI for the completed CampusHire Master Drive → Department Drive workflow.

IMPORTANT:

The backend/domain architecture is already established by previous phases.

Do not redesign backend architecture in this task.

Inspect existing routes, components, design system, forms, dialogs, tables and dashboard patterns before creating anything.

Reuse existing UI primitives.

==================================================
1. SUPER ADMIN
==================================================

Create/refine the Master Drive management experience.

Master Drive list should expose useful information such as:

- company
- role
- status
- assigned departments
- configured departments
- published departments
- applications
- created date

Master Drive detail should provide:

- Overview
- Departments
- Recruitment Stages
- Applications
- Analytics where already supported
- Activity

Clearly distinguish:

MASTER DRIVE

from:

DEPARTMENT DRIVE

Show department status hierarchy such as:

CSE — Assigned
IT — Configured
ECE — Published
Mechanical — Closed

==================================================
2. SUPER ADMIN CREATE WIZARD
==================================================

Implement:

SCREEN 1
Master Details

SCREEN 2
Admin Edit Permissions

SCREEN 3
Recruitment Stages

SCREEN 4
Review

SCREEN 5
Department Assignment

Include:

- progress indicator
- validation
- save draft
- continue later
- completed/incomplete state
- review before assignment

Do NOT add Student Auto-Fill configuration to this wizard.

==================================================
3. DEPARTMENT ADMIN
==================================================

Create/refine:

My Drives
Assigned
Configuring
Ready to Publish
Active
Closed
Completed

Use the existing routing architecture.

==================================================
4. DEPARTMENT CONFIGURATION WIZARD
==================================================

Implement:

1. Drive Details
2. Student Auto-Fill Fields
3. Eligibility Criteria
4. Eligible Batches
5. Recruitment Stage Review
6. Final Student Preview
7. Publish

Each step should clearly show:

- complete
- incomplete
- locked
- editable
- inherited
- overridden
- requires attention

==================================================
5. AUTO-FILL FIELD UI
==================================================

For each supported student field allow appropriate controls for:

- enabled
- disabled
- mandatory
- optional
- editable
- read-only
- ordering

Use the existing field configuration model.

Do not create another representation.

==================================================
6. ELIGIBILITY UI
==================================================

Build a clear rule configuration experience.

Support the existing eligibility rule types.

Show:

- current configuration
- validation
- human-readable meaning
- batch targeting separately

Do not implement eligibility calculations in the client.

The client should display server-provided results.

==================================================
7. BATCH UI
==================================================

Provide a clean batch selection interface.

Show:

- available batches
- selected batches
- student counts if the backend already provides them
- validation

Do not hard-code batch years.

==================================================
8. RECRUITMENT STAGE UI
==================================================

Display the active pipeline dynamically.

Support:

- stage ordering
- stage names
- stage types
- descriptions

If Department Admin proposes changes:

show:

PROPOSE CHANGE
→ PENDING APPROVAL

Do not imply the new pipeline is active until Super Admin approves it.

==================================================
9. FINAL PREVIEW
==================================================

The preview should closely match the student-facing drive.

Use resolved data from the existing backend.

Display:

- company
- role
- package
- JD
- requirements
- skills
- dates
- deadline
- logistics
- eligibility
- recruitment process
- application fields

Clearly identify missing required configuration.

==================================================
10. PUBLISH
==================================================

Publish screen must contain:

- configuration checklist
- warnings
- final preview
- confirmation
- publish action

After publication show:

LOCKED / PUBLISHED

and make configuration UI read-only for Department Admin.

Do not merely hide controls.

The backend remains authoritative.

==================================================
11. STUDENT DRIVE UI
==================================================

Update student drive screens to consume the Department Drive resolved data.

Student should see only:

- their department
- published drives
- currently available drives
- eligible drives

Drive detail:

- company
- logo
- role
- package
- JD
- requirements
- skills
- dates
- logistics
- recruitment process
- application form

Application UI:

Review
→ Acknowledgement
→ Submit
→ Confirmation

After submission:

- no edit controls
- no withdrawal controls

==================================================
12. UX QUALITY
==================================================

Provide:

- loading states
- skeletons
- empty states
- validation errors
- success feedback
- permission-denied states
- publish confirmation
- locked-state visuals
- mobile/responsive behavior where existing project supports it

Preserve existing CampusHire visual language.

Do not perform an unrelated visual redesign.

FINAL REPORT:

List:

- routes changed
- components changed
- new components
- reused components
- UI states
- tests/typecheck performed
- unresolved UX issues