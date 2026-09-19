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


Complete the CampusHire eligibility system by integrating permanent placement exclusion and department-specific batch targeting.

ARCH-FIX1 P1–P8 already established the base eligibility architecture.

Do not create a second eligibility engine.

==================================================
1. INSPECT EXISTING ELIGIBILITY
==================================================

Inspect:

- current eligibility evaluator
- getEligibleDrives
- drive detail eligibility
- applyToDrive
- notification eligibility checks
- Department Drive configuration
- existing Student academic/batch fields
- existing placement-related fields/actions
- admin student management
- audit logging

Identify the existing source of truth.

Extend it.

==================================================
2. EXPLICIT PLACEMENT STATE
==================================================

Implement or complete an explicit student-level placement state.

Placement is managed by DEPT_ADMIN.

A placement should be able to record the equivalent of:

- student
- placed status
- company
- role
- package
- drive/application reference
- placement date
- updated by
- timestamps
- history where appropriate

Do not create duplicate placement representations if an appropriate existing model already exists.

SUPER_ADMIN must be able to view placement information globally according to authorization rules.

STUDENT may view their placement status but must not modify it.

==================================================
3. PERMANENT EXCLUSION
==================================================

This is a critical business rule:

ONCE A STUDENT IS PLACED, THEY ARE PERMANENTLY EXCLUDED FROM FUTURE PLACEMENT DRIVES.

Eligibility must evaluate placement FIRST.

Required flow:

Approved Student?
    ↓
Placed?
    ↓
YES → INELIGIBLE / PLACED → STOP

If placed:

DO NOT evaluate:

- CGPA
- backlog
- batch
- skills
- academic percentage
- other drive eligibility rules

The placement check must short-circuit the evaluator.

==================================================
4. BATCH TARGETING
==================================================

Implement/complete structured batch targeting per Department Drive.

Inspect the authoritative Student batch representation.

Do not create a duplicate batch field merely because the current UI uses another label.

A Department Admin should be able to select which batches are eligible for a Department Drive.

Examples may include:

- 2026
- 2027
- 2028

but do not hard-code these values.

Use the actual project data model.

Eligibility must require:

student department matches
AND
student batch is targeted
AND
remaining drive eligibility rules pass

==================================================
5. SINGLE ELIGIBILITY ENGINE
==================================================

The same evaluator must be used by:

- eligible drive listing
- drive detail
- application submission
- notification targeting
- admin eligible-student list
- any future eligibility count/export

Do not duplicate eligibility logic.

If existing SQL narrowing exists, preserve it.

Use:

SQL narrowing/filtering
+
authoritative exact evaluation

where appropriate.

==================================================
6. HUMAN-READABLE REASONS
==================================================

Where the existing architecture supports ineligibility reasons, extend them to clearly explain:

- placed
- wrong department
- batch not targeted
- CGPA below requirement
- backlog above requirement
- other configured criteria

Do not expose internal/private configuration that students should not see.

==================================================
7. PLACEMENT + EXISTING APPLICATIONS
==================================================

Determine behavior when an already-applied student becomes placed.

Do not silently delete historical applications.

The student may retain historical application/recruitment records, but must be excluded from future placement drives.

Preserve historical application snapshots and audit records.

==================================================
8. AUTHORIZATION
==================================================

DEPT_ADMIN:

- can update placement only for students within their authorized department
- cannot modify another department's placement
- cannot change another department's drive eligibility
- cannot bypass permanent exclusion

SUPER_ADMIN:

- global access according to role policy

STUDENT:

- read-only placement status

==================================================
9. TESTS
==================================================

Test:

- placed student excluded
- placement short-circuits eligibility
- unplaced student continues evaluation
- correct batch passes
- incorrect batch fails
- department isolation
- admin placement authorization
- student cannot modify placement
- application history remains
- notifications use same eligibility evaluator
- drive listing and application produce same eligibility result

FINAL REPORT:

Report:

- placement implementation
- batch implementation
- eligibility changes
- authorization
- tests
- migrations
- unresolved issues