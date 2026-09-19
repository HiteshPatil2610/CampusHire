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



Implement the CampusHire application-integrity layer.

IMPORTANT:

ARCH-FIX1 P1–P8 are already implemented.

Do not rebuild the drive architecture, lifecycle, eligibility foundation, or application-field configuration.

First inspect the existing application implementation and extend it.

GOAL:

Make the student application process secure, server-authoritative, immutable after submission, and historically reproducible.

==================================================
1. INSPECT EXISTING IMPLEMENTATION
==================================================

Inspect:

- Application model
- existing application actions
- applyToDrive
- application queries
- existing ApplicationSnapshot if present
- submittedDetails
- snapshotCgpa
- snapshotBacklogs
- consent handling
- application field configuration
- eligibility evaluator
- drive/dept-drive resolver
- duplicate application constraint
- existing stage/status handling
- existing audit logging

Do not create duplicate application systems.

==================================================
2. APPLICATION SUBMISSION
==================================================

The server must independently validate:

- authenticated user
- student exists
- student is approved/active
- student belongs to the Department Drive's department
- Department Drive exists
- Department Drive is published
- drive/application deadline is still open
- student is eligible
- student is not permanently placed
- selected batch is eligible
- application does not already exist
- all mandatory application fields are present
- read-only fields have not been forged
- editable field values are valid
- acknowledgement/consent is valid
- application configuration is still valid

Never trust client-side eligibility or field metadata.

The server must derive the authoritative configuration from the database.

==================================================
3. IMMUTABLE APPLICATION
==================================================

Once submitted:

The student must NOT be able to:

- edit the application
- modify submitted answers
- modify read-only fields
- modify eligibility information
- change acknowledgement
- withdraw the application

Do not merely hide buttons in the UI.

Enforce this in server-side actions and authorization.

Only legitimate recruitment-stage/status operations may mutate the allowed application state.

Do not accidentally make stage/status immutable if the existing recruitment architecture requires them to change.

==================================================
4. APPLICATION SNAPSHOT
==================================================

Inspect whether the current ApplicationSnapshot implementation is sufficient.

If it already exists, extend it instead of creating another snapshot system.

The snapshot must preserve enough information to reconstruct what the student submitted and why the student was eligible at that moment.

At minimum capture the equivalent of:

- submitted student/application payload
- eligibility basis
- CGPA/backlog values used
- placement state at submission
- batch used for eligibility
- applicable eligibility rules
- application field configuration/version/hash
- drive/department-drive configuration reference or revision reference
- capture timestamp

Do not store sensitive data unnecessarily.

If JSON/JSONB is already the established project approach, preserve that approach where appropriate.

==================================================
5. REVISION AWARENESS
==================================================

Because a published drive may later be modified by SUPER_ADMIN, inspect whether the current architecture has a drive/dept-drive revision/version concept.

Do NOT blindly introduce a huge revision framework.

Instead determine the lightest safe approach that allows an existing application to retain the historical configuration it was submitted against.

The snapshot must remain historically reproducible even if:

- eligibility changes later
- batch targeting changes later
- application fields change later
- drive content changes later
- recruitment configuration changes later

==================================================
6. TRANSACTION
==================================================

Application creation and snapshot creation must be atomic.

Use one transaction so this cannot happen:

Application created
+
Snapshot creation fails

or:

Snapshot created
+
Application creation fails

Also ensure duplicate application protection is enforced at the database level where possible.

==================================================
7. AUDIT
==================================================

Audit important application events:

- submitted
- snapshot created
- stage/status changes if already supported
- administrative changes

Reuse the existing AuditLog system.

Do not create a second audit system.

==================================================
8. TESTS
==================================================

Add/update tests for:

- duplicate application
- unpublished drive
- closed drive
- expired deadline
- placed student
- wrong department
- wrong batch
- ineligible student
- forged read-only field
- forged eligibility
- missing required field
- invalid acknowledgement
- application modification attempt
- withdrawal attempt
- transactional snapshot failure
- authorization bypass

Also test that valid existing applications continue to work.

==================================================
9. COMPATIBILITY
==================================================

Do not immediately delete existing inline snapshot columns if they are still used.

If migration is required:

- use additive migration
- backfill safely
- migrate readers first
- keep fallback until verified
- report legacy fields that can later be removed

Do not perform destructive cleanup in this phase.

FINAL REPORT:

Report:

1. Existing application architecture discovered
2. Changes made
3. Snapshot structure
4. Transaction behavior
5. Authorization protections
6. Tests run
7. Migration changes
8. Remaining legacy fields
9. Any unresolved issue