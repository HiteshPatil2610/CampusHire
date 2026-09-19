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


Perform a deep security, authorization, audit, performance and architecture-hardening pass over the CampusHire implementation completed so far.

DO NOT introduce new architecture unless required to fix a verified defect.

DO NOT perform speculative refactoring.

==================================================
1. AUTHORIZATION AUDIT
==================================================

Attempt to identify and fix verified vulnerabilities involving:

- Student
- Department Admin
- Super Admin

Test:

Dept A → Dept B student data
Dept A → Dept B drives
Dept A → Dept B applications
Dept A → Dept B placement
Dept A → Dept B notifications
Dept Admin → Master Drive modification
Dept Admin → published drive modification
Dept Admin → unauthorized stage approval
Student → unpublished drive
Student → another department's drive
Student → another student's application
Student → forged eligibility
Student → forged read-only field
Student → application modification
Student → withdrawal
Disabled Admin → protected resources

Check every relevant:

- Server Action
- route
- query
- mutation
- direct-ID access path

Do not rely on middleware alone.

==================================================
2. PUBLISHED DRIVE SECURITY
==================================================

Verify:

Published Department Drive
→ Department Admin cannot modify locked configuration

Super Admin
→ may modify according to the established rule

Check:

- role
- department
- drive ownership/scope
- lifecycle
- field permission
- request payload

Never trust UI disabled state.

==================================================
3. PLACEMENT SECURITY
==================================================

Verify:

- only authorized Admin can update placement
- Admin cannot place another department's student
- Student cannot modify placement
- placed state permanently affects future eligibility
- historical applications remain intact

==================================================
4. RECRUITMENT SECURITY
==================================================

Verify:

- Student cannot modify stage
- Admin can only manage authorized applications
- Admin cannot approve their own pipeline change
- Admin pipeline changes require Super Admin approval
- rejected requests do not activate
- invalid stage IDs are rejected
- stage IDs from another drive cannot be used

==================================================
5. APPLICATION INTEGRITY
==================================================

Verify:

- duplicate protection
- immutable submitted content
- immutable snapshot
- eligibility snapshot
- correct department
- correct batch
- placement exclusion
- deadline
- acknowledgement
- read-only fields

Try direct Server Action invocation, not just UI interaction.

==================================================
6. NOTIFICATION SECURITY
==================================================

Verify:

- recipient isolation
- department targeting
- batch targeting
- eligibility targeting
- no notification for unpublished drives
- no notification for placed students
- duplicate prevention
- retry safety

A user must never be able to retrieve another user's notifications by changing an ID.

==================================================
7. ADMIN INVITATION SECURITY
==================================================

Verify:

- no plaintext passwords
- Clerk remains authentication authority
- disabled Admin blocked
- invitation cannot be hijacked
- duplicate email handling
- department association is server-controlled
- accepting an invitation cannot assign arbitrary role/department

==================================================
8. AUDIT COVERAGE
==================================================

Review important mutations:

Drive:
- create
- assign
- configure
- publish
- modify
- close
- cancel
- archive

Configuration:
- permissions
- fields
- eligibility
- batches

Recruitment:
- pipeline
- approval
- rejection
- stage transition

Application:
- submit
- status/stage changes

Placement:
- create/update

Admin:
- invite
- accept
- disable
- reactivate
- department change

Notifications:
- generation
- failures/retries where appropriate

Reuse existing AuditLog.

==================================================
9. PERFORMANCE
==================================================

Inspect:

- Prisma `any`
- untyped where clauses
- in-memory pagination
- N+1 queries
- repeated eligibility queries
- repeated drive resolution
- repeated authorization lookups
- inefficient notification fan-out
- unnecessary client-side fetching
- missing indexes
- oversized queries

Pay particular attention to:

- drive listing
- eligible students
- applications
- recruitment stages
- notifications
- dashboard statistics
- exports

Do not optimize blindly.

Measure/inspect first.

==================================================
10. DATA MODEL / INDEXES
==================================================

Review indexes for common access patterns involving:

- department
- student
- drive
- Department Drive
- application
- placement
- recruitment stage
- eligibility
- batch
- notifications
- audit logs

Only add justified indexes.

==================================================
11. LEGACY ARCHITECTURE
==================================================

Search for:

- old central-drive actions
- duplicate drive schemas
- stale JSON parsing
- old eligibility logic
- obsolete stage assumptions
- old notification triggers
- duplicate authorization helpers
- unused legacy fields

Do not delete automatically.

Create a cleanup report.

==================================================
12. TYPE SAFETY
==================================================

Search for:

- `any`
- unsafe casts
- unchecked IDs
- weakly typed query filters
- duplicated schemas

Fix only verified issues relevant to the current architecture.

==================================================
13. TESTS
==================================================

Run/add:

- authorization tests
- integration tests
- application integrity tests
- eligibility tests
- placement tests
- recruitment tests
- notification tests
- invitation tests
- database tests
- typecheck
- lint
- build where practical

FINAL REPORT:

Provide:

1. Security findings
2. Fixed vulnerabilities
3. Authorization coverage
4. Audit coverage
5. Performance findings
6. Index changes
7. Type-safety findings
8. Legacy/dead-code findings
9. Tests
10. Remaining risks