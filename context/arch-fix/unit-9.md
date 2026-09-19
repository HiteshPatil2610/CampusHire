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


Implement the operational dashboards, action-required areas, filters, exports and safe bulk operations for CampusHire.

Do not create duplicate reporting/export infrastructure.

Inspect and reuse existing:

- Excel import/export utilities
- dashboard queries
- application queries
- student queries
- drive queries
- notification/action systems
- authorization helpers
- audit system

==================================================
1. ACTION-REQUIRED DASHBOARD
==================================================

STUDENT:

Show useful actionable sections for:

- incomplete profile
- eligible drives
- approaching deadlines
- pending application actions
- upcoming recruitment stages
- important announcements

DEPARTMENT ADMIN:

- pending access requests
- drives requiring configuration
- drives ready to publish
- stage approval results
- applications needing review
- upcoming deadlines

SUPER ADMIN:

- pending admin invitations
- department drives awaiting configuration
- recruitment stage change requests
- important application milestones
- system issues/events

Only show actions the current user can actually perform.

Do not show stale actions that are already completed.

==================================================
2. DRIVE FILTERING
==================================================

Support appropriate filtering by:

- company
- role
- status
- department
- date
- published/closed/cancelled state

Respect role scope.

==================================================
3. APPLICATION FILTERING
==================================================

Support:

- drive
- department
- batch
- recruitment stage
- application status
- placement status
- date
- search

Do not expose cross-department data to Department Admins.

==================================================
4. ELIGIBLE STUDENT FILTERING
==================================================

Use the central eligibility engine.

Do not calculate eligibility independently in the UI.

Support useful filtering such as:

- batch
- placement
- application status
- search

==================================================
5. EXPORTS
==================================================

Provide appropriate exports for:

- eligible students
- applicants
- shortlisted
- test
- interview
- selected
- rejected
- placed

Reuse the existing Excel/CSV infrastructure.

Do not create a second export library if an existing one works.

==================================================
6. EXPORT AUTHORIZATION
==================================================

Before exporting:

- validate actor
- validate department scope
- validate drive scope
- validate requested dataset
- prevent unauthorized columns/data

Do not assume that because a user can view one record they can export every record.

==================================================
7. BULK STAGE UPDATE
==================================================

Support selecting multiple applications and moving them to a recruitment stage.

Before mutation:

- validate actor
- validate all application IDs
- validate same authorized drive/scope
- validate target stage
- validate each transition
- reject invalid records safely

Use a transaction where appropriate.

Report:

- successful records
- failed records
- reasons for failures

Do not silently partially update.

==================================================
8. BULK STATUS OPERATIONS
==================================================

Only implement bulk status changes that are already supported by the business rules.

Do not introduce unsafe mass operations simply because they are convenient.

==================================================
9. AUDIT BULK OPERATIONS
==================================================

Record:

- actor
- operation
- target count
- successful count
- failed count
- drive
- department
- timestamp

Reuse AuditLog.

==================================================
10. DEADLINE REMINDERS
==================================================

Use the existing notification infrastructure.

Do not create a separate reminder system.

Respect:

- drive status
- deadline
- department
- batch
- eligibility
- placement exclusion

==================================================
11. UX
==================================================

Provide:

- useful filters
- saved state where existing UI supports it
- loading
- empty
- error
- export progress
- bulk action confirmation
- partial failure reporting

FINAL REPORT:

Report:

- dashboards
- filters
- exports
- bulk operations
- authorization
- audit
- tests
- unresolved issues