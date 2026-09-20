# CampusHire — Master Implementation Prompt Hierarchy

## Phase 0 — Safety, Audit & Baseline

### P0.1 — Full Project + Database Baseline Audit

Run this first.

```text
You are working directly on my existing CampusHire project.

Before making ANY code, database, Clerk, or configuration changes, perform a complete baseline audit of the current system.

You have access to:
- the complete source code
- the connected Neon PostgreSQL database
- the connected Clerk account
- the existing project documentation
- the existing Prisma schema and migration history

Your first responsibility is to understand the ACTUAL current implementation rather than assuming anything from documentation.

Inspect:

1. Project architecture
2. Prisma schema
3. Existing migration history
4. Actual live Neon database schema
5. Clerk authentication configuration
6. User roles and authorization
7. Student registration/approval flow
8. Department-admin authorization
9. Super-admin authorization
10. Drive creation/update flows
11. Central-drive flows
12. Department-drive configuration
13. Eligibility logic
14. Application flow
15. Application withdrawal behavior
16. Application stage/status management
17. Notifications
18. Audit logging
19. Excel import
20. All affected frontend pages/components
21. Existing tests
22. Documentation/context files

Specifically investigate the known issues from the architectural review:

C1 — department admin authorization gap
C2 — no proper drive lifecycle
C3 — insufficient department-specific drive overrides
C4 — assignment/configuration separation
C5 — JSON-based configuration
C6 — application immutability
C7 — withdrawal behavior conflict
C8 — hard-coded eligibility
C9 — duplicate drive architecture
C10 — smaller type/query/schema issues

Also verify whether the live Neon schema actually matches Prisma schema/migrations.

IMPORTANT:
- DO NOT modify anything.
- DO NOT run destructive migrations.
- DO NOT run prisma migrate dev.
- DO NOT reset the database.
- DO NOT delete or overwrite production data.
- DO NOT modify Clerk users/metadata.

Produce a detailed implementation-impact report containing:

A. What currently exists
B. What is actually different from the architecture documentation
C. Confirmed bugs
D. Potential bugs requiring verification
E. Database drift, if any
F. Files/modules affected
G. Existing functionality that MUST NOT break
H. Dependency graph of the required changes
I. Recommended implementation order

Do not implement fixes yet.

At the end clearly state:
"BASELINE AUDIT COMPLETE — NO CHANGES MADE."
```

---

# Phase 1 — Security & Existing Workflow Protection

## P1 — Fix Department Authorization

This should be the first actual implementation.

```text
Implement the department authorization fixes identified during the baseline audit.

PRIMARY OBJECTIVE:
A DEPT_ADMIN must never be able to create, update, assign, publish, configure, or expose a drive to students belonging to another department unless the intended architecture explicitly allows that operation through a SUPER_ADMIN-controlled assignment flow.

Focus first on the existing vulnerability where createDrive/updateDrive trust client-provided eligibleDepartments.

Requirements:

1. Inspect the actual authorization helpers and department-admin identity resolution.
2. Never trust department IDs supplied by the client.
3. For DEPT_ADMIN:
   - derive the department exclusively from the authenticated database user/session.
   - reject attempts to submit another department ID.
4. Validate the rule server-side in every relevant mutation.
5. Do not rely on UI restrictions.
6. Check all existing drive-related Server Actions for similar authorization weaknesses.
7. Ensure central/master-drive operations remain SUPER_ADMIN controlled.
8. Preserve existing legitimate department-admin functionality.
9. Add regression tests proving:
   - admin of department A cannot target department B
   - admin of department A can operate on department A
   - SUPER_ADMIN retains appropriate global access
10. Inspect related queries and mutations for IDOR-style authorization gaps.

Do not redesign the drive architecture yet.

Do not implement lifecycle changes yet.

Only fix security/authorization problems that can be safely isolated at this stage.

Run the relevant tests/type checks.

Do not modify unrelated functionality.
```

---

# Phase 2 — Decide and Lock Existing Business Rules

## P2 — Resolve Application Withdrawal + Existing Business Rules

Your current architecture has a conflict here, so settle it before building the new application system.

```text
Review the current CampusHire application business rules and resolve the existing contradiction around application withdrawal.

Inspect:
- project documentation
- architecture documentation
- applyToDrive
- withdrawApplication
- application UI
- application status/stage logic
- student-facing application pages
- admin application views

The intended new workflow is:

Student opens an eligible drive
→ reviews all configured application fields
→ acknowledges that the details are checked
→ understands that the application cannot be edited or withdrawn after submission
→ submits
→ application becomes final.

Therefore implement the following rule:

AFTER APPLICATION SUBMISSION:
- student cannot edit the submitted application
- student cannot withdraw/delete the application
- application remains associated with the drive
- only authorized admins can change recruitment stage/status
- application content remains immutable

Before making this change, inspect whether any existing behavior depends on withdrawal.

If there are historical applications that were already withdrawn, preserve their records and do not rewrite history.

Update:
- server actions
- authorization
- UI
- validation
- documentation
- tests

Do not implement ApplicationSnapshot yet unless required as a minimal compatibility change.

The final application rule must be enforced server-side, not only through UI.

Test:
- submit application
- attempt edit
- attempt withdrawal
- verify both are rejected
- verify admins retain only their intended management permissions.

Do not change drive architecture in this prompt.
```

---

# Phase 3 — Unify Drive Architecture

Now deal with C9.

## P3 — Create One Unified Drive Domain

```text
Refactor the existing drive architecture so that department-owned drives and centrally-created drives use one coherent domain model and business logic.

IMPORTANT:
Do not blindly rename database tables.

First inspect the existing implementation and identify the safest backward-compatible approach.

The target conceptual model is:

MASTER DRIVE
    ↓
DEPARTMENT DRIVE / DEPARTMENT INSTANCE
    ↓
APPLICATION

The existing Drive + DriveDepartmentConfig tables may be retained if they already support this model.

Requirements:

1. Unify the duplicate drive schemas.
2. Unify duplicated validation logic.
3. Unify duplicated drive creation/update logic where practical.
4. Preserve existing authorization boundaries:
   - SUPER_ADMIN controls master/central drives
   - DEPT_ADMIN controls their own department instance
5. Introduce a clear discriminant/model concept for central/master versus department-owned drives.
6. Avoid unnecessary DB table renaming.
7. Preserve existing URLs/routes where possible.
8. Preserve existing student-facing resolved drive shape.
9. Remove duplicated logic only after confirming all callers.
10. Ensure Decimal/package handling remains unchanged.
11. Preserve audit logging.
12. Preserve notification behavior temporarily; lifecycle changes come later.
13. Add tests around the unified drive domain.

Create a single resolver abstraction for department-facing drives.

Introduce:

resolveDepartmentDrive(masterDrive, departmentInstance)

The resolver must produce a stable resolved representation containing the fields currently expected by student/admin components.

Do not implement the new lifecycle yet.

Do not remove legacy columns yet.

Do not perform destructive migrations.

Run tests and type checking.
```

---

# Phase 4 — Master Drive → Department Drive Assignment

This is the core of your **new flow**.

## P4 — Implement Master Drive and Department Assignment

```text
Implement the Master Drive → Department Drive assignment workflow.

Target workflow:

SUPER_ADMIN creates a Master Drive
        ↓
Master Drive remains in DRAFT
        ↓
SUPER_ADMIN selects relevant departments
        ↓
System creates one Department Drive instance for each selected department
        ↓
Each Department Drive starts as ASSIGNED
        ↓
The respective department admin reviews/configures it
        ↓
Department admin publishes it
        ↓
Only then can students see/apply to it.

Use the existing Drive + DriveEligibleDepartment + DriveDepartmentConfig architecture where possible instead of unnecessarily renaming tables.

Requirements:

1. Implement an explicit department assignment operation.
2. Assignment must be transactional.
3. For every selected department:
   - create/ensure DriveEligibleDepartment
   - create/ensure DriveDepartmentConfig
   - initialize department instance status as ASSIGNED
4. Assignment must be idempotent.
5. Removing a department assignment must be protected:
   - do not silently remove an instance with applications
   - preserve historical application data
6. Audit all assignment changes.
7. SUPER_ADMIN is the only role allowed to assign a master drive to departments.
8. DEPT_ADMIN cannot modify master drive data.
9. A department admin can only operate on their own Department Drive.
10. Existing department-drive records must be handled safely.
11. Create an explicit mapping between:
   Master Drive
   Department
   Department Drive
12. Add appropriate DB indexes/constraints if missing.

Implement tests for:
- assign one department
- assign multiple departments
- duplicate assignment
- remove unconfigured department
- attempt removal with applications
- unauthorized department admin access
- super-admin assignment

Do not yet implement student visibility based on PUBLISHED.
That comes in the lifecycle phase.
```

---

# Phase 5 — Drive Lifecycle

## P5 — Implement Drive Lifecycle / Publish / Lock

This is one of the most important prompts.

```text
Implement the complete drive lifecycle for CampusHire.

Target lifecycle:

MASTER DRIVE:
DRAFT → PUBLISHED → ARCHIVED

DEPARTMENT DRIVE:
ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED

Important distinction:

"application deadline passed" remains a DERIVED open/closed state.

Administrative CLOSED is separate from deadline expiration.

Requirements:

MASTER DRIVE:
- SUPER_ADMIN creates it as DRAFT.
- SUPER_ADMIN can publish/archive according to authorization rules.
- A master drive can be assigned to departments.
- Master content must not be changed in ways that silently alter an already-published department experience.

DEPARTMENT DRIVE:
ASSIGNED:
- waiting for department admin

CONFIGURED:
- department has supplied/confirmed required configuration

PUBLISHED:
- visible to eligible students
- publish timestamp stored
- publishing user stored
- content becomes locked

CLOSED:
- administratively closed
- no new applications

ARCHIVED:
- historical state

When a Department Drive becomes PUBLISHED:
- set publishedAt
- set publishedByUserId
- set lockedAt
- trigger department-scoped eligibility notifications

LOCKING:
After publication:
- role/content/JD/requirements/skills/eligibility/application form/deadline fields must be protected
- students must never see partially configured data
- server-side authorization must reject locked-field modifications

Clearly define which fields remain editable after publication, if any.
Recruitment-stage information must remain manageable without unlocking the application content.

Do not rely on UI disabled inputs for locking.

Update all affected Server Actions.

Update student drive queries so students only see:
- Department Drive belonging to their department
- status = PUBLISHED
- deadline still open

Preserve the existing derived deadline behavior.

Update tests extensively.

Do not remove legacy columns yet.
Do not perform destructive migrations.
```

---

# Phase 6 — Department-Specific Drive Configuration

This implements your main requirement that **CSE can have different details from ECE for the same company drive**.

## P6 — Department Content Overrides

```text
Implement department-specific drive configuration.

The target behavior is:

Master Drive contains the institution/company-level defaults.

Each Department Drive may override:

- role/job title
- job description
- requirements
- skills
- drive date
- application deadline
- recruitment/selection configuration where appropriate
- logistics
- application configuration
- eligibility criteria

Example:

Master:
Company = ABC
Role = Software Engineer
Package = 8 LPA

CSE Department:
Role = Software Engineer
JD = CSE-specific JD
Eligibility = 7.5 CGPA

IT Department:
Role = Backend Developer
JD = IT-specific JD
Eligibility = 7.0 CGPA

ECE Department:
Role = Embedded Software Engineer
JD = ECE-specific JD
Eligibility = 6.5 CGPA

Changing one department instance must NOT modify another department.

Implementation requirements:

1. Add nullable override fields to the existing department instance/config model where appropriate.
2. NULL means "inherit from master".
3. Create/update the resolver so:
   department override != null → use override
   otherwise → use master value
4. Ensure every department-facing read path uses the resolver.
5. Ensure student pages receive the resolved data.
6. Ensure admin preview uses the same resolved data.
7. Add visible inherited/overridden state to admin UI.
8. Prevent DEPT_ADMIN from modifying master values.
9. Respect lifecycle locking from the previous phase.
10. Preserve historical data.

Do not duplicate the master record for every department.

Do not copy values permanently into every department unless necessary for snapshot/history.

Add tests proving department isolation.
```

---

# Phase 7 — Eligibility Engine

## P7 — Replace Hard-Coded Eligibility with Rule-Based Eligibility

```text
Replace the current hard-coded eligibility system with a reusable, department-specific eligibility rule engine.

Current rules include:
- department
- minimum CGPA
- maximum active backlogs

The new system must support per-department rules.

Use a relational rule model rather than JSON text.

Conceptually:

DriveEligibilityRule
- id
- departmentDrive/config reference
- ruleType
- operator
- value
- createdAt
- updatedAt if necessary

Examples of rule types should be designed based on the actual project data model, including where supported:

- CGPA
- ACTIVE_BACKLOGS
- TENTH_PERCENTAGE
- TWELFTH_PERCENTAGE
- DIPLOMA_PERCENTAGE
- CURRENT_SEMESTER
- BATCH/YEAR
- SKILL
- OTHER supported student attributes

Do not invent rules that the existing Student schema cannot evaluate.

Requirements:

1. Inspect the existing Student and StudentAcademic models first.
2. Create a typed rule representation.
3. Keep validation strict.
4. Create one pure eligibility evaluator.
5. Create human-readable ineligibility reasons.
6. Ensure eligibility is evaluated against the student's department.
7. Ensure each Department Drive has its own rule set.
8. Support master defaults where appropriate.
9. SQL should narrow candidates where practical.
10. JS/application logic must perform the authoritative exact evaluation.
11. getEligibleDrives and applyToDrive MUST use the same evaluator.
12. Notifications MUST use the same evaluator.
13. Do not allow student/client-provided eligibility values.
14. Prevent rule modifications after Department Drive publication.

Test:
- eligible student
- CGPA failure
- backlog failure
- multiple rules
- department isolation
- missing academic data
- diploma branch
- rule configuration validation
- published-drive rule immutability

Do not remove old minCGPA/maxActiveBacklogs columns yet.
Backfill them into the new rule representation and maintain compatibility during migration.
```

---

# Phase 8 — Application Form Builder

## P8 — Relational Application Field Configuration

```text
Implement the new per-department application form configuration system.

Goal:

Before publishing a Department Drive, the department admin decides exactly which application fields students will see and which they can edit.

Application fields must support:

- fieldKey
- label
- source
- category
- required/optional
- enabled/disabled
- sortOrder
- permission/read-only vs editable

The source may represent existing student profile data or student-entered data.

First inspect the existing applicationFields JSON format and all code consuming it.

Create a relational model similar to:

DriveApplicationField
- id
- departmentDrive/config reference
- fieldKey
- label
- source
- category
- isRequired
- isEnabled
- sortOrder
- permission

Requirements:

1. Safely parse and backfill existing JSON configuration.
2. Do not lose existing field configurations.
3. Support relational-first reads with legacy fallback during migration.
4. Create validation for allowed fields.
5. Prevent arbitrary unsafe field names.
6. Respect department-drive lifecycle.
7. Once published/locked, application field configuration cannot change.
8. Build/update the department admin configuration UI.
9. Provide a preview of the student application form.
10. Clearly show:
   - required
   - optional
   - read-only
   - editable
11. Student application page must use the resolved Department Drive configuration.
12. Do not trust the browser to enforce required/read-only fields.
13. Server-side validation must reconstruct the expected form from DB configuration.

Do not delete old JSON fields yet.
```

---

# Phase 9 — Student Application Flow

This directly implements your new student workflow.

## P9 — Implement Final Student Drive Application Flow

```text
Implement the complete student application workflow for CampusHire.

TARGET FLOW:

Student logs in
        ↓
Student identity is verified through Clerk
        ↓
Student must be linked to approved/master student data
        ↓
Student enters Student Dashboard
        ↓
Student opens Drives
        ↓
System shows only Department Drives:
    - belonging to student's department
    - PUBLISHED
    - deadline still open
    - student is eligible
        ↓
Student opens drive
        ↓
Student sees complete resolved drive details
        ↓
Student sees all application fields configured by department admin
        ↓
Read-only profile fields are displayed but cannot be edited
        ↓
Editable fields can be entered
        ↓
Student reviews all information
        ↓
Student must explicitly acknowledge:
    "I have checked all the details and understand that after submission my application cannot be edited or withdrawn."
        ↓
Submit
        ↓
Server re-validates:
    - authentication
    - student approval/linking
    - department
    - drive status
    - deadline
    - eligibility
    - duplicate application
    - required fields
    - field permissions
    - acknowledgement
        ↓
Application + immutable snapshot created transactionally
        ↓
Student receives confirmation
        ↓
Application appears in:
    - Student My Applications
    - Department Admin Applications
    - Super Admin Drive/Application views

Important:
Never trust client-side eligibility, field permissions, or acknowledgement.

Server must reconstruct the expected application configuration from the database.

Prevent:
- duplicate application
- application after deadline
- application to unpublished drive
- application to another department
- application by ineligible student
- modification of submitted application
- withdrawal after submission
- submission with missing required fields
- submission with forged read-only values

Preserve existing application uniqueness.

Do not yet remove legacy snapshot columns.
```

---

# Phase 10 — Application Snapshot & Immutability

## P10 — Implement Immutable Application Snapshot

```text
Implement a first-class immutable ApplicationSnapshot for every submitted application.

The purpose is to preserve exactly what the student submitted and exactly what eligibility/configuration was used at submission time.

Create a one-to-one snapshot concept:

Application
    ↓ 1:1
ApplicationSnapshot

Snapshot should contain, based on the actual project data:

- submitted student/application payload
- eligibility basis
- application field configuration version/hash
- capturedAt
- any other necessary immutable submission context

At application submission:

BEGIN TRANSACTION

1. Validate student
2. Validate Department Drive
3. Validate eligibility
4. Validate configured application fields
5. Create Application
6. Create ApplicationSnapshot
7. Commit

If either fails, neither should remain.

Requirements:

- exactly one snapshot per application
- snapshot cannot be modified through application actions
- stage/status remain mutable
- application content remains immutable
- historical snapshot must not change when student profile changes
- historical snapshot must not change when drive configuration changes

Backfill existing applications from:
- submittedDetails
- snapshotCgpa
- snapshotBacklogs
- existing application configuration where recoverable

Do not fabricate missing historical information.

Keep legacy columns during transition.

Update readers to prefer ApplicationSnapshot.

Add transaction and immutability tests.
```

---

# Phase 11 — Recruitment Pipeline

Now build the **applied → shortlisted → test/interview → selected/rejected** system.

## P11 — Recruitment Pipeline

```text
Implement the recruitment pipeline for Department Drive applications.

The conceptual pipeline is:

APPLIED
   ↓
SHORTLISTED
   ↓
TEST / APTITUDE
   ↓
INTERVIEW
   ↓
SELECTED / REJECTED

Inspect the existing stage/status model before changing it.

Do not create unnecessary duplicate status systems.

Requirements:

1. Preserve the existing Application as the central record.
2. Stage/status changes are admin-controlled.
3. DEPT_ADMIN can manage applications belonging to their department.
4. SUPER_ADMIN can access global application information according to authorization rules.
5. Student cannot manipulate stage/status.
6. Every stage transition must record:
   - previous stage/status
   - new stage/status
   - timestamp
   - acting user
7. Preserve audit logging.
8. Prevent invalid transitions where the business rules disallow them.
9. Make the pipeline visible in the admin UI.
10. Provide counts for:
    - eligible
    - registered/applied
    - shortlisted
    - test
    - interview
    - selected
    - rejected
11. Student should see their current recruitment status.
12. Do not modify immutable application content.

If the existing stage/status enums are sufficient, extend them carefully rather than replacing them unnecessarily.

Add tests for authorization and transitions.
```

---

# Phase 12 — Admin Workflow UI

## P12 — Department Admin Drive Workflow

```text
Update the Department Admin drive experience to match the new workflow.

Department Admin navigation should clearly separate:

- My Drives
- Assigned Drives
- Upcoming
- Active
- Completed
- Applications

For an assigned Department Drive, provide a configuration workflow:

1. Overview
2. Content
3. Eligibility
4. Logistics
5. Application Fields
6. Recruitment Process
7. Preview
8. Review & Publish

CONTENT:
- role
- JD
- requirements
- skills
- dates
- inherited/overridden indicators

ELIGIBILITY:
- configurable rules
- live validation
- clear explanation

LOGISTICS:
- venue
- reporting time
- coordinator
- seating
- PPT
- special instructions

APPLICATION FIELDS:
- enabled/disabled
- required/optional
- read-only/editable
- ordering

PREVIEW:
Show exactly what a student will see.

REVIEW & PUBLISH:
Before publishing, show a checklist of required configuration.

After publication:
- show lock indicator
- content fields become read-only
- application form configuration becomes read-only
- eligibility becomes read-only
- deadline/content changes are blocked according to lifecycle rules

Make all authorization decisions server-side.
```

---

# Phase 13 — Super Admin Workflow UI

## P13 — Super Admin Master Drive Management

```text
Update the Super Admin drive management experience around the Master Drive → Department Drive architecture.

Super Admin should be able to:

1. Create Master Drive
2. Save as DRAFT
3. Edit draft
4. Assign departments
5. View department assignment status
6. View:
   - ASSIGNED
   - CONFIGURED
   - PUBLISHED
   - CLOSED
   - ARCHIVED
7. Open individual department instance details
8. View application statistics by department
9. Archive master drive where permitted
10. View audit history

The UI should clearly distinguish:

MASTER DRIVE
from
DEPARTMENT DRIVE

The Super Admin must not accidentally overwrite department-specific configuration when editing master defaults.

Show a hierarchy such as:

Company / Master Drive
 ├── CSE — Published
 ├── IT — Configured
 ├── ECE — Assigned
 └── Mechanical — Closed

Do not introduce duplicate data unnecessarily.

Do not allow unauthorized department admins to access this interface.
```

---

# Phase 14 — Student Drive Experience

## P14 — Student Drives + Drive Details

```text
Update the student drive experience to consume the new Department Drive architecture without breaking the existing UI.

Student should see:

DRIVES
- only their department's published drives
- only currently open drives
- only drives for which they are eligible

Each drive card should display resolved information from:

Master Drive
+
Department Drive overrides

Drive detail should show:

- company
- logo
- role
- package
- complete JD
- requirements
- skills
- drive date
- deadline
- location/logistics
- recruitment rounds
- application instructions
- configured application fields

If the student is ineligible:
- show clear rule-based reasons
- do not expose internal/private configuration

If already applied:
- show applied state
- do not show editable application controls

If drive is closed:
- show appropriate closed state

The student must never receive unpublished Department Drives through:
- listing
- direct URL
- dashboard
- API/action
- cached data

Keep the resolved data contract backward-compatible where possible.
```

---

# Phase 15 — Notifications

## P15 — Correct Eligibility Notification Flow

```text
Refactor drive notifications to match the new lifecycle.

CURRENT PROBLEM:
Drive creation can cause notifications before the department has reviewed and published its configuration.

TARGET:

Master Drive created
    ↓
Departments assigned
    ↓
Department configures
    ↓
Department publishes
    ↓
Eligibility evaluated for THAT department
    ↓
Eligible students receive notification

Requirements:

1. Do not notify students merely because a Master Drive was created.
2. Notification should occur when a Department Drive becomes PUBLISHED.
3. Scope notification to that department.
4. Reuse the exact same eligibility engine used by:
   - student drive listing
   - application submission
5. Prevent duplicate notifications.
6. Preserve existing notification records.
7. Audit important notification events.
8. Ensure a department cannot trigger notifications for another department.
9. Do not notify students who are not eligible.
10. Handle retry/idempotency safely.

Test duplicate publish/notification scenarios.
```

---

# Phase 16 — Performance & Type Safety

## P16 — Query / Type / Architecture Cleanup

```text
Perform a focused quality pass on the newly implemented drive/application architecture.

Inspect for:

- Prisma `any`
- untyped where clauses
- duplicated queries
- unnecessary in-memory pagination
- N+1 queries
- duplicated eligibility evaluation
- duplicated drive resolution
- duplicated authorization logic
- stale JSON parsing
- unused destructured variables
- inconsistent Decimal handling
- unnecessary client-side state
- missing indexes
- inefficient notification fan-out

Improve only where justified.

Requirements:

- preserve behavior
- preserve authorization
- preserve database data
- do not introduce speculative abstractions
- do not rewrite unrelated modules

Move pagination into SQL where appropriate.

Ensure all important Prisma queries remain type-safe.

Verify indexes for common paths such as:

department
drive/dept instance
application
student
eligibility rules
application fields
status

Run tests and type checks.
```

---

# Phase 17 — Legacy Migration / Cleanup

## P17 — Remove Legacy JSON and Duplicate Columns

**Do this only after all previous phases are working in production/staging and you have verified the data.**

```text
Perform the final contract/cleanup phase of the CampusHire drive architecture.

Before modifying the database:

1. Inspect actual live schema.
2. Verify migration history.
3. Verify all legacy readers have been removed.
4. Verify relational configuration is populated.
5. Verify ApplicationSnapshot coverage.
6. Verify no fallback code paths are being used.
7. Verify tests pass.
8. Produce a dry-run report.

Potential legacy fields include:

Drive.applicationFields
Drive.selectionRounds
DriveDepartmentConfig.applicationFields
DriveApplication.submittedDetails
DriveApplication.snapshotCgpa
DriveApplication.snapshotBacklogs

Do NOT automatically drop anything.

For each candidate field:

- search every read/write reference
- verify zero production dependencies
- verify backfill completeness
- verify relational replacement
- verify historical data preservation

Only then create the migration.

Use:
- hand-written SQL where appropriate
- Prisma migration
- prisma migrate deploy

NEVER:
- prisma migrate dev against production
- database reset
- destructive reset flags
- automatic data deletion

Provide a migration summary before execution.

If anything is uncertain, stop and report it rather than guessing.
```

---

# Phase 18 — Full Regression & Security Audit

## P18 — Final End-to-End Verification

```text
Perform a complete end-to-end audit of CampusHire after the implementation phases.

Do not make architectural changes unless required to fix a verified defect.

Verify the following workflows.

STUDENT:

Clerk signup
→ User creation
→ master student matching
→ direct access OR access request
→ admin approval/rejection
→ dashboard
→ drives
→ eligibility
→ drive details
→ configured application form
→ acknowledgement
→ application submission
→ confirmation
→ My Applications
→ recruitment status

DEPARTMENT ADMIN:

login
→ own department
→ students
→ access requests
→ assigned drives
→ configure drive
→ eligibility
→ application fields
→ preview
→ publish
→ lock
→ applicants
→ recruitment pipeline
→ reports

SUPER ADMIN:

login
→ departments
→ admins
→ master drive
→ assign departments
→ monitor department status
→ applications
→ global reporting
→ audit logs

SECURITY:

Attempt:
- department A accessing department B data
- department A modifying department B drive
- department admin modifying master drive
- student accessing unpublished drive
- student accessing another department's drive
- student submitting after deadline
- student submitting while ineligible
- duplicate application
- forged read-only field
- forged eligibility
- application modification
- withdrawal
- unauthorized stage transition

DATABASE:

- verify foreign keys
- unique constraints
- indexes
- migration state
- snapshot integrity
- no orphan Department Drives
- no orphan Application Snapshots
- no inconsistent assignments

CLERK:

- role synchronization
- authorization consistency
- webhook behavior

REGRESSION:

Ensure these remain functional:

- Excel import
- roster matching
- access requests
- profile completion
- notifications
- audit logs
- package Decimal formatting
- student dashboard
- admin dashboard
- super-admin dashboard

Run:
- unit tests
- integration tests
- type checks
- lint
- build

Produce a final report:

1. Implemented
2. Verified
3. Remaining issues
4. Database migrations
5. Security findings
6. Tests
7. Any manual verification still required

Do not claim something is verified if it was not actually tested.
```

---

# The Overall Hierarchy

I recommend you execute them exactly in this order:

```text
P0.1  Baseline Audit
  │
  ├── P1  Authorization / Security
  │
  └── P2  Business Rules / Withdrawal
          │
          ↓
       P3  Unified Drive Architecture
          │
          ↓
       P4  Master → Department Assignment
          │
          ↓
       P5  Drive Lifecycle / Publish / Lock
          │
          ↓
       P6  Department Content Overrides
          │
          ↓
       P7  Eligibility Engine
          │
          ↓
       P8  Application Form Configuration
          │
          ↓
       P9  Student Application Flow
          │
          ↓
       P10 Application Snapshot
          │
          ↓
       P11 Recruitment Pipeline
          │
          ├── P12 Department Admin UI
          │
          ├── P13 Super Admin UI
          │
          └── P14 Student UI
                  │
                  ↓
              P15 Notifications
                  │
                  ↓
              P16 Performance / Type Safety
                  │
                  ↓
              P17 Legacy Cleanup
                  │
                  ↓
              P18 Final Regression / Security Audit
```

### The resulting business flow

Your final CampusHire system will effectively work like this:

```text
                    SUPER ADMIN
                         │
                         ▼
                 Create Master Drive
                         │
                         ▼
                      DRAFT
                         │
                         ▼
                Assign Departments
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
            CSE          IT          ECE
             │           │           │
          ASSIGNED    ASSIGNED    ASSIGNED
             │           │           │
          Configure   Configure   Configure
             │           │           │
         CONFIGURED  CONFIGURED  CONFIGURED
             │           │           │
          Publish     Publish     Publish
             │           │           │
         PUBLISHED   PUBLISHED   PUBLISHED
             │           │           │
             ▼           ▼           ▼
       CSE students  IT students  ECE students
             │           │           │
          Eligibility  Eligibility  Eligibility
             │           │           │
             ▼           ▼           ▼
         Application  Application  Application
             │           │           │
             └───────────┼───────────┘
                         ▼
                  Immutable Snapshot
                         │
                         ▼
                     APPLIED
                         │
                         ▼
                    SHORTLISTED
                         │
                         ▼
                      TEST
                         │
                         ▼
                    INTERVIEW
                     /       \
                    ▼         ▼
               SELECTED    REJECTED
```

The key architectural property is that **one Master Drive can produce multiple independent Department Drives**, while still keeping one centralized Neon database. Each department gets its own configuration, eligibility, application form, lifecycle, and application population without modifying another department's instance.

### One important instruction for your AI agent

Because you've connected **Neon and Clerk**, I strongly recommend adding this rule to **every prompt that can touch the database**:

> **Never perform a destructive database operation or production migration automatically. Inspect first, produce a dry-run/impact report, and stop for confirmation before any destructive or irreversible database action.**

That is especially important for P0 baseline, P4 assignment/backfill, P7 eligibility migration, P8 application-field migration, P10 snapshot backfill, and P17 cleanup.

This hierarchy incorporates the C1–C10 issues identified in your architectural review while also turning your newer **Master Drive → Department Drive → Publish → Eligible Student → Immutable Application → Recruitment Pipeline** flow into the implementation sequence.  
