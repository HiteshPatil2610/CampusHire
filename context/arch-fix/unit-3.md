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



Implement the configurable recruitment pipeline architecture for CampusHire.

Do not replace the existing Application model unnecessarily.

Do not hard-code a fixed recruitment pipeline.

==================================================
1. CURRENT IMPLEMENTATION
==================================================

Inspect:

- Application stage/status model
- existing stage enums
- updateApplicationStage
- application queries
- existing selectionRounds
- drive/dept-drive recruitment configuration
- admin recruitment UI
- student recruitment status UI
- AuditLog

Determine what can be reused.

==================================================
2. DRIVE-SPECIFIC PIPELINE
==================================================

Each Department Drive must be able to use a configurable recruitment pipeline.

Example:

Application
→ Aptitude
→ Technical Interview
→ HR Interview
→ Offer

Another drive:

Application
→ Group Discussion
→ Technical Interview
→ Offer

Another:

Application
→ Coding Test
→ Technical
→ HR
→ Offer

Another:

Application
→ Direct Interview
→ Offer

Do not hard-code these pipelines.

==================================================
3. STAGE CONFIGURATION
==================================================

A stage definition should support the equivalent of:

- id
- pipeline/version reference
- stage name
- stage type
- order
- description
- instructions
- visibility
- scheduling information if supported
- active/enabled state

Supported stage types should include at least:

- APPLICATION
- APTITUDE
- CODING
- GROUP_DISCUSSION
- TECHNICAL_INTERVIEW
- HR_INTERVIEW
- MANAGERIAL_INTERVIEW
- PRESENTATION
- ASSESSMENT
- OFFER
- CUSTOM

Use the project's naming conventions.

Do not create redundant enums if an appropriate existing type exists.

==================================================
4. PIPELINE VERSIONING
==================================================

Do not let a pipeline change invalidate existing applications.

Implement an appropriate version/history mechanism.

Conceptually:

Pipeline
 ├── Version 1
 │    ├── Application
 │    ├── Technical
 │    ├── HR
 │    └── Offer
 │
 └── Version 2
      ├── Application
      ├── Coding
      └── Offer

Existing applications must remain historically consistent.

Use the lightest architecture that safely provides this behavior.

Do not introduce unnecessary complexity.

==================================================
5. APPLICATION STAGE
==================================================

Application should reference its current recruitment stage in the new architecture where appropriate.

Stage history must record:

- previous stage
- new stage
- previous status where relevant
- new status
- acting user
- timestamp
- reason/note if supported
- pipeline version

Student must never directly manipulate stage/status.

==================================================
6. DEPARTMENT ADMIN STAGE CHANGES
==================================================

DEPT_ADMIN may propose recruitment-stage/pipeline changes.

They must NOT become active immediately.

Flow:

DEPT_ADMIN
→ proposes change
→ PENDING APPROVAL
→ SUPER_ADMIN reviews
→ APPROVE or REJECT

A rejected proposal must leave the active pipeline unchanged.

An approved proposal becomes the new active pipeline version according to the implementation.

==================================================
7. APPROVAL MODEL
==================================================

Create a proper change-request/history representation if needed.

It should preserve:

- drive
- department
- current pipeline
- proposed pipeline
- requesting admin
- request reason
- createdAt
- reviewedBy
- reviewedAt
- approval status

Statuses:

- PENDING
- APPROVED
- REJECTED

Do not create a generic approval framework unless the existing project already has one suitable for this.

==================================================
8. PUBLISHED DRIVE RULE
==================================================

Published Department Drive:

DEPT_ADMIN:
- cannot directly modify the published drive configuration
- cannot bypass stage approval
- cannot directly activate a pipeline change

SUPER_ADMIN:
- can modify published drive according to authorization
- all meaningful changes must be audited

Normal permitted configuration changes do NOT require Super Admin approval.

Recruitment pipeline changes proposed by DEPT_ADMIN DO require approval.

==================================================
9. TRANSITION VALIDATION
==================================================

Validate stage transitions server-side.

Do not allow arbitrary client-submitted stage IDs.

The server must verify:

- application belongs to the drive
- actor is authorized
- target stage belongs to the active/appropriate pipeline
- transition is valid
- application is not in an immutable terminal state where rules prohibit changes

Do not invent transition restrictions that conflict with existing business rules.

==================================================
10. COUNTS
==================================================

Admin drive views should be able to calculate counts dynamically for:

- eligible
- applied
- shortlisted
- current recruitment stages
- selected
- rejected
- placed

Do not hard-code stage names into the counting system.

Counts should derive from configured pipeline/application state.

==================================================
11. AUDIT
==================================================

Audit:

- pipeline created
- stage added
- stage edited
- stage reordered
- stage removed/deactivated
- change requested
- approved
- rejected
- application stage transition

Reuse AuditLog.

==================================================
12. TESTS
==================================================

Test:

- custom pipeline
- multiple stage types
- stage ordering
- stage versioning
- existing applications after pipeline change
- Admin proposal
- Admin cannot self-approve
- Super Admin approval
- rejected proposal
- unauthorized stage change
- invalid stage ID
- cross-department stage manipulation
- published drive restrictions
- stage history
- student read-only stage

FINAL REPORT:

Include:

- data model
- pipeline/version behavior
- approval workflow
- authorization
- migration
- tests
- unresolved issues