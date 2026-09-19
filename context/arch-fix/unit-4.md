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


Redesign/complete the CampusHire drive workflow architecture around the already-implemented Master Drive → Department Drive system.

IMPORTANT:

Do not rebuild P1–P8.

Do not replace the existing lifecycle or drive architecture unless inspection identifies a verified defect.

This phase focuses on completing the NEW business workflow.

==================================================
1. TARGET WORKFLOW
==================================================

SUPER ADMIN:

Create Master Drive
→ Master Details
→ Admin Edit Permissions
→ Recruitment Stage Configuration
→ Review
→ Department Assignment

DEPARTMENT ADMIN:

Assigned Drive
→ Drive Details
→ Student Auto-Fill Fields
→ Eligibility Criteria
→ Eligible Batches
→ Recruitment Stage Review
→ Final Student Preview
→ Publish

STUDENT:

Published + Eligible Department Drive
→ Drive Details
→ Application
→ Snapshot
→ Recruitment Pipeline

==================================================
2. SUPER ADMIN MASTER DRIVE
==================================================

Master Drive should represent institution/company-level truth.

Super Admin configures:

- company
- logo
- package
- role
- job description
- dates
- other master-level details
- recruitment pipeline
- which fields Department Admin may edit

Do not configure student auto-fill fields here.

==================================================
3. ADMIN EDIT PERMISSIONS
==================================================

Super Admin must be able to explicitly define which drive details Department Admin may edit.

Conceptually:

FIELD
→ LOCKED
or
→ EDITABLE

Do not rely only on UI disabling.

Server-side authorization must enforce the same rule.

Do not allow a client to mark a locked field as editable.

==================================================
4. DEPARTMENT ASSIGNMENT
==================================================

Super Admin selects departments.

Only selected departments receive a Department Drive work item.

Do not expose the Master Drive to every department simply because it exists.

Assignment must create/use the existing Department Drive structure.

Preserve department isolation.

==================================================
5. DEPARTMENT CONFIGURATION
==================================================

Department Admin configuration must support:

SCREEN 1:
Drive Details

SCREEN 2:
Student Auto-Fill Fields

SCREEN 3:
Eligibility Criteria

SCREEN 4:
Eligible Batches

SCREEN 5:
Recruitment Stage Review

SCREEN 6:
Final Student Preview

SCREEN 7:
Publish

==================================================
6. STUDENT AUTO-FILL FIELDS
==================================================

Super Admin no longer configures these fields.

Department Admin configures which student information should:

- appear
- auto-fill
- be editable
- be mandatory

The configuration must be stored using the existing application-field configuration architecture.

Do not create another application-field system.

Server-side application validation must use the stored configuration.

==================================================
7. ELIGIBILITY
==================================================

Department Admin configures the Department Drive eligibility.

Reuse M2's eligibility engine.

Do not implement eligibility again.

Include:

- department
- placement exclusion
- batch
- configured academic rules
- other supported rules

==================================================
8. RECRUITMENT STAGE REVIEW
==================================================

The Department Admin can review the Master Drive's recruitment pipeline.

If they want to propose stage changes:

→ create change request
→ Super Admin approval required

Normal permitted drive configuration changes do not require approval.

Reuse M3.

==================================================
9. DRAFT / SAVE / CONTINUE
==================================================

Department Admin must be able to:

- save incomplete configuration
- leave workflow
- return later
- see completion status
- continue from incomplete step

Do not publish incomplete configuration.

==================================================
10. FINAL STUDENT PREVIEW
==================================================

Before publishing, render a preview based on the same resolved data/configuration that the student will actually receive.

Preview should include:

- company
- role
- package
- JD
- requirements
- skills
- dates
- deadline
- logistics
- eligibility summary
- recruitment process
- application fields

Do not build a separate fake preview data model.

Use the same resolver/configuration used by the student experience.

==================================================
11. PUBLISH VALIDATION
==================================================

Publishing must perform server-side validation.

Check:

- required configuration complete
- valid dates
- valid deadline
- required application fields configured
- eligibility valid
- batch configuration valid
- recruitment pipeline valid
- required editable fields completed
- department assignment valid
- admin authorized
- drive not already published/locked

Do not rely on the frontend checklist.

==================================================
12. PUBLISHED DRIVE
==================================================

Once Department Drive is published:

DEPT_ADMIN:
- configuration becomes read-only
- eligibility becomes read-only
- batch targeting becomes read-only
- application fields become read-only
- locked drive content cannot be changed

SUPER_ADMIN:
- may modify according to authorization

Every Super Admin modification must be audited.

Do not create an Admin unlock workflow.

==================================================
13. CANCELLATION
==================================================

Support drive cancellation using the existing lifecycle architecture if not already implemented.

Cancellation must:

- prevent new applications
- prevent future eligibility visibility where appropriate
- preserve historical applications
- preserve snapshots
- generate appropriate notifications
- create audit entry

Do not delete the drive.

==================================================
14. CONTROLLED DEADLINE EXTENSION
==================================================

If the current lifecycle supports deadline extension:

- only authorized actor
- explicit validation
- audit the old/new deadline
- do not silently modify historical application snapshots
- trigger appropriate notification behavior

Do not create a generic approval flow unless required.

==================================================
15. ARCHITECTURAL CONSISTENCY
==================================================

Inspect for duplicate:

- drive configuration schemas
- drive actions
- central-drive actions
- application field systems
- eligibility systems
- recruitment systems

Reuse existing architecture.

FINAL REPORT:

Report:

- workflow implemented
- database changes
- authorization rules
- lifecycle interactions
- preview behavior
- publish validation
- cancellation
- deadline extension
- tests
- unresolved issues