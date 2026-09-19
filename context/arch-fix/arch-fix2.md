Absolutely. With your latest decisions, I would **replace the earlier 18-prompt hierarchy with a new expanded implementation plan**.

The new plan should cover the original C1–C10 issues plus:

* your redesigned Super Admin → Department Admin → Student drive workflow
* custom recruitment stages
* Super Admin approval for Admin stage changes
* permanent placement exclusion
* student/admin/super-admin notification centers
* announcements
* secure Admin invitation
* settings for all three roles
* draft/save/continue
* final previews
* drive cancellation/revision handling
* batch targeting
* application exports/bulk management
* audit/history
* action-required areas

The original review already established that the current system has the drive lifecycle, department differentiation, eligibility, application configuration, and application snapshot gaps, so the new hierarchy should build those foundations rather than bolt the new features onto the old system. 

---

# PART 1 — YOUR NEW CAMPUSHIRE SYSTEM

## Final high-level architecture

```text
                         SUPER ADMIN
                              │
                              ▼
                    CREATE MASTER DRIVE
                              │
                              ▼
                    ┌──────────────────┐
                    │ MASTER DETAILS   │
                    │                  │
                    │ Company          │
                    │ Package          │
                    │ Default Role     │
                    │ Default JD       │
                    │ Drive Date       │
                    │ Deadline         │
                    │ Recruitment      │
                    │ Stages           │
                    └────────┬─────────┘
                             │
                             ▼
                    SET ADMIN PERMISSIONS
                             │
                  ┌──────────┴──────────┐
                  │                     │
              LOCKED                 EDITABLE
                  │                     │
                  └──────────┬──────────┘
                             ▼
                         CONFIRM
                             │
                             ▼
                   SELECT DEPARTMENTS
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
            CSE              IT              ECE
             │               │               │
         ASSIGNED        ASSIGNED        ASSIGNED
             │               │               │
             ▼               ▼               ▼
        DEPT ADMIN       DEPT ADMIN       DEPT ADMIN
             │
             ▼
     DEPARTMENT CONFIGURATION
             │
     ┌───────┼────────┬────────────┐
     ▼       ▼        ▼            ▼
  Screen 1 Screen 2 Screen 3    Screen 4
  Details  Fields   Eligibility  Batches
     │       │        │            │
     └───────┴────────┴────────────┘
                     │
                     ▼
                FINAL PREVIEW
                     │
                     ▼
                  PUBLISH
                     │
                     ▼
            ELIGIBILITY ENGINE
                     │
             ┌───────┴────────┐
             ▼                ▼
          PLACED           NOT PLACED
             │                │
             ▼                ▼
        EXCLUDE           CHECK BATCH
                              │
                              ▼
                        CHECK DEPARTMENT
                              │
                              ▼
                       CHECK ELIGIBILITY
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
                  ELIGIBLE          INELIGIBLE
                     │
                     ▼
                STUDENT SEES DRIVE
                     │
                     ▼
                 APPLY
                     │
                     ▼
             IMMUTABLE SNAPSHOT
                     │
                     ▼
              RECRUITMENT PIPELINE
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       SHORTLIST   TEST      INTERVIEW
                              │
                              ▼
                    SELECTED / REJECTED
                              │
                              ▼
                       ADMIN UPDATES
                    STUDENT PLACEMENT
                              │
                              ▼
                    PLACED = PERMANENT
                       DRIVE EXCLUSION
```

---

# PART 2 — FINAL IMPLEMENTATION HIERARCHY

I recommend **21 prompts**, executed sequentially.

```text
PHASE 0 — Safety
P0  Baseline Audit

PHASE 1 — Security & Business Rules
P1  Authorization Fix
P2  Placement Model
P3  Application Finality

PHASE 2 — Drive Architecture
P4  Unified Drive Model
P5  Master → Department Assignment
P6  Drive Lifecycle

PHASE 3 — Drive Configuration
P7  Department Overrides
P8  Recruitment Stage System
P9  Eligibility Engine
P10 Batch Targeting
P11 Application Form Builder

PHASE 4 — Application
P12 Student Application Flow
P13 Application Snapshot

PHASE 5 — Recruitment
P14 Recruitment Pipeline
P15 Placement Management

PHASE 6 — Notifications
P16 Notification Infrastructure
P17 Announcement System

PHASE 7 — Admin Management
P18 Admin Invitation & Management
P19 Settings System

PHASE 8 — UI
P20 Complete Dashboard / Drive UI

PHASE 9 — Reliability
P21 Audit / History / Search / Export / Testing / Cleanup
```

---

# PHASE 0

## P0 — Complete Baseline Audit

```text
You are working directly on my existing CampusHire project.

You have access to:
- the source code
- Neon PostgreSQL
- Clerk
- Prisma schema
- migration history
- existing project documentation

Before modifying anything, perform a complete audit of the ACTUAL implementation.

Do not assume documentation is correct.

Inspect:

- architecture
- Prisma schema
- live Neon schema
- migrations
- Clerk
- roles
- authorization
- students
- departments
- drives
- central drives
- department drive configuration
- applications
- eligibility
- recruitment stages
- notifications
- announcements if they exist
- audit logs
- Excel import
- all affected frontend pages
- tests

Also inspect the known C1-C10 issues from the existing architectural review.

Now compare the current implementation against this NEW target architecture:

MASTER DRIVE
→ DEPARTMENT DRIVE
→ DEPARTMENT CONFIGURATION
→ ELIGIBILITY
→ BATCH TARGETING
→ APPLICATION
→ RECRUITMENT PIPELINE
→ STUDENT PLACEMENT

Additional requirements:

1. Student placement is an explicit student-level state.
2. DEPT_ADMIN updates placement status.
3. Once placed, the student is permanently excluded from future drives.
4. Placement must be checked before any other eligibility criteria.
5. Recruitment stages are configurable per drive.
6. SUPER_ADMIN creates the initial stages.
7. DEPT_ADMIN can propose stage changes.
8. Any DEPT_ADMIN stage change requires SUPER_ADMIN approval.
9. Published drives can only be modified by SUPER_ADMIN.
10. Department admins configure assigned drives.
11. Student/admin/super-admin have separate notification centers.
12. There is a first-class announcement system.
13. Admin invitation must use secure Clerk authentication and must NOT email plaintext passwords.
14. All three dashboards need role-specific settings.
15. Drives support drafts, configuration, preview and publication.
16. Drive cancellation and controlled deadline changes must be supported.
17. Important actions require audit history.

DO NOT modify anything.

Do not run destructive database commands.

Do not run prisma migrate dev.

Do not reset Neon.

Produce:

A. Actual current architecture
B. Current database structure
C. Live database/schema differences
D. Existing functionality
E. Confirmed problems
F. New requirements
G. Dependency graph
H. Recommended migration order
I. Files likely affected
J. Data migration risks

End with:

BASELINE AUDIT COMPLETE — NO CHANGES MADE.
```

---

# PHASE 1 — SECURITY & CORE BUSINESS RULES

## P1 — Authorization Hardening

```text
Implement the complete authorization hardening identified during the baseline audit.

Primary goal:

A DEPT_ADMIN must NEVER be able to access or modify another department's data by manipulating client payloads, URLs, IDs, Server Actions, or direct requests.

Audit and protect:

- drives
- department drives
- students
- applications
- access requests
- announcements
- notifications
- reports
- exports
- eligibility configuration
- application fields
- recruitment stages
- placement records

For every DEPT_ADMIN operation:

derive department from authenticated server-side identity.

Never trust:
- departmentId from client
- eligibleDepartments from client
- student department from client
- drive ownership from client

SUPER_ADMIN retains global permissions.

STUDENT can only access:
- own profile
- own applications
- drives available to their department
- their notifications
- their own placement/application status

Add authorization regression tests.

Do not redesign the database yet.

Do not modify unrelated behavior.

Run tests and type checks.
```

---

## P2 — Student Placement System

```text
Implement the explicit student-level placement system.

Business rule:

A student becomes PLACED when a Department Admin explicitly updates their placement status.

PLACED is permanent exclusion from future placement drives.

Do not derive current placement eligibility solely from DriveApplication.status.

Create the appropriate placement data model based on the existing schema.

The system should preserve:

- company
- role
- package
- drive/application reference where available
- placement date
- updated by
- audit history

Department Admin:
- can mark a student placed
- can record placement information
- can view placement information for their department

Super Admin:
- can manage/view placement globally according to authorization

Student:
- can view their placement state
- cannot modify it

Once placed:

Student must NOT receive future drives.

Eligibility evaluation must begin with:

IF student.isPlaced == true:
    return INELIGIBLE
    reason = PLACED
    STOP

Do not evaluate:
- CGPA
- backlog
- batch
- skills
- other criteria

after placement exclusion.

Protect historical placement data.

Add tests.

Do not modify drive architecture yet.
```

---

## P3 — Application Finality

```text
Enforce the final application policy.

After submission:

- application cannot be edited by student
- application cannot be withdrawn by student
- submitted details are immutable
- eligibility basis is immutable
- acknowledgement is immutable
- application remains historically associated with the drive

Only authorized admins can modify:
- recruitment stage
- recruitment status

Student cannot modify:
- stage
- status
- placement state

Inspect existing withdrawApplication and remove/disable the behavior according to the safest migration approach.

Preserve historical withdrawn records if they already exist.

Update:
- Server Actions
- validation
- UI
- authorization
- tests
- documentation

Do not implement ApplicationSnapshot yet unless necessary.
```

---

# PHASE 2 — DRIVE ARCHITECTURE

## P4 — Unified Drive Architecture

```text
Refactor the drive domain into one coherent architecture.

Target:

MASTER DRIVE
    ↓
DEPARTMENT DRIVE

Use the existing Drive and DriveDepartmentConfig structures where possible.

Do NOT rename database tables merely for naming.

Unify:
- schemas
- validation
- queries
- creation logic
- update logic
- drive resolution

Create one canonical resolver:

resolveDepartmentDrive()

It must resolve:

Master defaults
+
Department overrides

Return a stable flat representation so existing student UI continues working.

Preserve:
- auth
- Decimal package handling
- audit
- notifications
- existing URLs
- existing data

Do not yet remove legacy columns.

Do not introduce destructive migrations.
```

---

## P5 — Master Drive → Department Assignment

```text
Implement the new Master Drive assignment workflow.

SUPER_ADMIN:

Create Master Drive
→ save draft
→ configure admin permissions
→ confirm
→ select departments
→ assign

For each selected department:

Create/ensure:
- department-drive instance
- assignment relationship
- department configuration
- status = ASSIGNED

Only selected department admins should receive the assigned drive.

A DEPT_ADMIN must never see another department's assigned drive.

Assignment must be transactional and idempotent.

SUPER_ADMIN can:
- add department
- remove department where safe
- view assignment status

Do not delete historical drive/application data.

If applications exist, prevent destructive unassignment.

Audit all assignment changes.

Do not implement publication yet.
```

---

# PHASE 3 — DRIVE LIFECYCLE

## P6 — Drive Lifecycle / Locking

```text
Implement the drive lifecycle.

MASTER:

DRAFT
→ PUBLISHED
→ ARCHIVED

DEPARTMENT:

ASSIGNED
→ CONFIGURING
→ CONFIGURED
→ PUBLISHED
→ CLOSED
→ CANCELLED
→ ARCHIVED

Application deadline remains a derived open/closed condition.

When Department Drive is PUBLISHED:

- set publishedAt
- set publishedBy
- set lockedAt
- make all department-controlled drive content read-only

CRITICAL RULE:

After a drive is published, ONLY SUPER_ADMIN can modify the drive.

DEPT_ADMIN cannot:
- edit
- unlock
- change eligibility
- change batch targeting
- change application fields
- change recruitment stages
- change content

SUPER_ADMIN can modify published drives.

All such changes must be audited.

Do not allow UI-only protection.
Enforce everything server-side.

Implement:
- publish
- close
- cancel
- archive
- lifecycle validation

Students only see PUBLISHED + currently open drives.

Do not remove legacy fields.
```

---

# PHASE 4 — DEPARTMENT CONFIGURATION

## P7 — Department-Specific Overrides

```text
Implement department-specific drive configuration.

Department Drive may override:

- role
- job title
- JD
- requirements
- skills
- drive date
- deadline
- logistics
- recruitment configuration where permitted

NULL means inherit from Master Drive.

Changing CSE configuration must never change IT/ECE.

Create/update the resolver accordingly.

Admin UI must clearly display:

INHERITED FROM MASTER

or

OVERRIDDEN FOR THIS DEPARTMENT

Respect drive locking.

Add tests proving complete department isolation.
```

---

# P8 — Custom Recruitment Stage System

This is one of your most important new prompts.

```text
Replace the hard-coded recruitment stages with a configurable drive-specific recruitment pipeline.

Current hard-coded concept:

Apply
→ Aptitude/Online Test
→ Interview
→ Offer

Replace this with configurable stages.

SUPER_ADMIN defines the initial pipeline for each Master Drive.

Examples:

Drive A:
Application
→ Aptitude Test
→ Technical Interview
→ HR Interview
→ Offer

Drive B:
Application
→ Group Discussion
→ Technical Interview
→ Offer

Drive C:
Application
→ Coding Test
→ Technical Interview
→ HR Interview
→ Offer

Drive D:
Application
→ Direct Interview
→ Offer

Each stage should support, where appropriate:

- stage name
- stage type
- description
- order
- required
- student visibility
- instructions
- scheduling information if supported

Provide predefined stage types such as:

APPLICATION
APTITUDE_TEST
CODING_TEST
GROUP_DISCUSSION
TECHNICAL_INTERVIEW
HR_INTERVIEW
MANAGERIAL_INTERVIEW
PRESENTATION
ASSESSMENT
OFFER
CUSTOM

Do not hard-code the sequence.

SUPER_ADMIN:
- create
- edit
- delete
- reorder
- rename stages

DEPT_ADMIN:
- can propose changes

IMPORTANT:
If DEPT_ADMIN changes recruitment stages:

DO NOT immediately activate the changes.

Create:

PENDING_STAGE_CHANGE

containing:
- current pipeline
- proposed pipeline
- changed by
- reason
- timestamp
- status

SUPER_ADMIN can:

APPROVE
or
REJECT

Only after approval does the new stage pipeline become active.

Normal permitted department configuration changes do NOT require Super Admin approval.

Stage changes must have history/versioning.

Add audit logs.

Do not allow students to manipulate stages.
```

---

# P9 — Rule-Based Eligibility Engine

```text
Implement the new rule-based eligibility engine.

Eligibility must evaluate in this order:

1. Student exists/approved
2. Student is NOT placed
3. Department matches
4. Batch matches
5. Drive eligibility rules
6. Other configured criteria

If placed:

STOP IMMEDIATELY.

Support rules based only on actual available student data.

Potential rules:

- CGPA
- active backlogs
- 10th percentage
- 12th percentage
- diploma percentage
- semester
- batch
- skills
- other supported fields

Use typed relational rules.

Each Department Drive has its own eligibility configuration.

The same evaluator must be used by:

- getEligibleDrives
- drive details
- applyToDrive
- notifications

Produce human-readable ineligibility reasons.

Do not trust client-side eligibility.

Prevent rule changes after publication by DEPT_ADMIN.

Backfill existing minCGPA/maxActiveBacklogs.

Preserve backward compatibility during migration.

Add comprehensive tests.
```

---

# P10 — Batch Targeting

```text
Implement explicit batch targeting for every Department Drive.

During drive configuration, DEPT_ADMIN must select which student batches are eligible.

Example:

Eligible Batches:

☑ 2025–2029
☑ 2026–2030
☐ 2027–2031

The batch selection must be stored as structured data.

Eligibility becomes:

NOT PLACED
+
CORRECT DEPARTMENT
+
TARGETED BATCH
+
ELIGIBILITY RULES

Provide:

- batch selection UI
- batch validation
- preview of affected student population
- human-readable eligibility reason

If a student is outside the selected batch:
return INELIGIBLE.

After publication:
DEPT_ADMIN cannot change batch targeting.

SUPER_ADMIN can modify published drive targeting according to the lifecycle rules.

Audit all changes.

Do not hard-code batch values.
Derive them from actual student data/academic configuration.
```

---

# P11 — Application Form Builder

```text
Implement the department-specific application form builder.

Admin configures:

- field
- label
- source
- enabled
- required
- read-only/editable
- order

Examples:

Name → Read Only
Email → Read Only
Roll Number → Read Only
CGPA → Read Only
Resume → Editable
Phone → Editable

Student sees exactly the configured form.

The server must reconstruct the expected configuration and validate submissions.

Never trust the browser for:
- required fields
- read-only fields
- field names
- field values
- eligibility

Once the Department Drive is published:
DEPT_ADMIN cannot modify the application form.

SUPER_ADMIN may modify a published drive.

Keep legacy JSON during migration.

Add relational-first reads and safe fallback.
```

---

# PHASE 5 — APPLICATION

## P12 — New Student Application Flow

```text
Implement the final student application workflow.

Student:

Login
→ approved student
→ Drives
→ eligible drive
→ drive details
→ application form
→ review
→ acknowledgement
→ submit

Before submission display:

"I have checked all the information provided and understand that after submission my application cannot be edited or withdrawn."

Require explicit acknowledgement.

Server validates:

- authenticated student
- approved student
- not placed
- correct department
- correct batch
- published drive
- deadline
- eligibility
- application fields
- required fields
- duplicate application
- acknowledgement

Reject:
- duplicate application
- unpublished drive
- closed drive
- expired drive
- placed student
- ineligible student
- forged read-only fields

Create application transactionally.

Show confirmation.

Application appears in:
- Student Applications
- Department Admin Applications
- Super Admin Applications
```

---

## P13 — Application Snapshot

```text
Implement immutable ApplicationSnapshot.

At submission create:

Application
+
ApplicationSnapshot

in ONE transaction.

Snapshot must preserve:

- submitted student/application payload
- eligibility basis
- batch
- placement state
- rules used
- field configuration/version/hash
- captured timestamp

Once created:

ApplicationSnapshot cannot be modified.

Student profile changes must not alter it.

Drive changes must not alter it.

Recruitment stage changes must not alter it.

Backfill existing applications where information is recoverable.

Never fabricate historical data.

Keep legacy columns until all readers have migrated.
```

---

# PHASE 6 — RECRUITMENT + PLACEMENT

## P14 — Recruitment Management

```text
Implement recruitment management using the drive-specific stage pipeline.

Admin should see:

Drive
→ Applications
→ Current Stage
→ Status

For each application:

Student
Company
Role
Current Stage
Status
Updated At

Admin can move applications through the configured pipeline.

Use the actual stages defined for that drive.

Do not assume Aptitude/Interview are always present.

Examples:

Application
→ GD
→ Interview
→ Offer

or:

Application
→ Coding
→ Technical
→ HR
→ Offer

or:

Application
→ Interview
→ Offer

Stage transitions must:
- be authorized
- be audited
- record actor
- record timestamp
- preserve history

Student can see their current stage/status but cannot change it.
```

---

## P15 — Placement Management

```text
Integrate the student placement system with recruitment management.

When a student is selected:

DO NOT automatically mark the student permanently placed unless the existing business workflow explicitly requires that behavior.

Instead, Department Admin must update the student's placement status.

Provide:

Mark as Placed

Fields:
- company
- role
- package
- drive
- application
- placement date
- notes where appropriate

Once placed:

Student = PERMANENTLY EXCLUDED from future drives.

Existing applications/history remain intact.

Student dashboard should clearly show:

PLACED

and explain that the student is no longer eligible for future placement drives.

Admin should be able to see placement status in student lists.

Super Admin should have global placement visibility.

Audit all placement changes.

Do not allow students to modify placement status.
```

---

# PHASE 7 — NOTIFICATIONS

## P16 — Notification Infrastructure

```text
Build a dedicated notification system for all three roles.

Separate notification centers:

STUDENT
DEPARTMENT ADMIN
SUPER ADMIN

Every notification should have:

- id
- recipient
- type
- category
- title
- message
- priority
- read/unread
- createdAt
- optional resource reference
- optional action URL
- optional expiry
- delivery status if email is used

Categories:

STUDENT:
Drive
Application
Recruitment
Announcement
Account
Deadline

ADMIN:
Drive Assignment
Drive Configuration
Application
Student
Announcement
System

SUPER ADMIN:
Drive
Department
Admin
Application
Student
System
Announcement

Priorities:

INFO
SUCCESS
ACTION_REQUIRED
WARNING
URGENT

Implement:

- notification badge
- unread count
- notification page
- all/unread filters
- category filters
- mark as read
- mark all as read

Important notifications should link directly to the relevant resource.

Examples:

New Drive:

"New Drive Available
ABC Technologies — Software Engineer is now available for your department.

Deadline: 24 Sep 2026

[View Drive]"

Application:

"Application Submitted
Your application for ABC Technologies has been submitted successfully.

[View Application]"

Shortlist:

"Application Update
You have been shortlisted for the next stage.

Next Stage: Technical Interview

[View Details]"

Deadline:

"Drive Deadline Approaching
ABC Technologies closes applications tomorrow.

[Apply Now]"

Do not duplicate notifications.

Implement idempotency.
```

---

# P17 — Announcement System

```text
Implement announcements as a separate first-class feature.

Announcement is NOT the same entity as Notification.

Announcement fields should support:

- title
- content
- author
- target role
- target department
- target batch
- priority
- publishAt
- expiryAt
- status
- attachment if supported

Examples:

All Students
CSE Students
2026 Batch
CSE + IT
Department Admins
All Admins

Publishing an announcement may generate notifications for its target audience.

Provide:

Super Admin:
- create
- edit
- publish
- archive

Department Admin:
- create announcements only for authorized department audience
- publish according to permissions

Students:
- read announcements

Announcements should have their own page/section and appear in notification center when applicable.

Audit publishing/editing.
```

---

# PHASE 8 — ADMIN MANAGEMENT

## P18 — Secure Department Admin Invitation

Important: this changes your original password-email idea.

```text
Redesign Department Admin creation using Clerk securely.

SUPER_ADMIN:

Enter:
- admin email
- name
- department

System:

Create/prepare DepartmentAdmin record
→ assign department
→ create/invite Clerk identity
→ send secure invitation
→ admin accepts invitation
→ sets/authenticates their own credentials
→ Clerk identity is linked to CampusHire
→ access becomes active

DO NOT email plaintext passwords.

DO NOT store plaintext passwords in Neon.

Do not build a second password authentication system.

Admin record should track:

- userId
- email
- department
- status
- invitedAt
- acceptedAt
- disabledAt
- last relevant access information if available

Statuses:

INVITED
PENDING
ACTIVE
DISABLED

Support:

- resend invitation
- disable admin
- reactivate admin where appropriate
- department assignment
- audit history

Handle cases where email already belongs to:
- student
- admin
- super admin
- existing Clerk user

Do not create duplicate identities.

Historical drives, applications and audit logs must remain when an admin is disabled.
```

---

# P19 — Settings System

```text
Implement role-specific settings pages.

STUDENT SETTINGS:

Profile
Account
Notifications
Privacy
Security
Preferences

DEPARTMENT ADMIN SETTINGS:

Profile
Department
Notifications
Security
Drive Defaults
Student Management Preferences

SUPER ADMIN SETTINGS:

Profile
Institution
Departments
Admin Management
Notifications
Drive Defaults
Eligibility Configuration
Recruitment Configuration
Security
Audit/System Settings

Important institutional/security fields must be read-only for lower roles.

Use Clerk for authentication/security-related functionality where applicable.

Do not create a duplicate password system.

Drive Defaults for Department Admin may include:

- default venue
- reporting time
- coordinator
- contact
- instructions

These are defaults only and must not bypass drive locking or publication rules.

Provide sensible validation and audit sensitive configuration changes.
```

---

# PHASE 9 — COMPLETE UI REDESIGN

## P20 — Redesign Drive Areas + Dashboards

```text
Redesign the CampusHire drive management UI around the new workflow.

SUPER ADMIN:

Drives
→ Master Drives

Master Drive list should show:

Company
Role
Status
Departments
Published departments
Pending departments
Applications
Created date

Master Drive detail:

Overview
Departments
Recruitment Stages
Applications
Analytics
Activity

Create Drive wizard:

SCREEN 1:
Master Details

SCREEN 2:
Admin Edit Permissions

SCREEN 3:
Recruitment Stages

SCREEN 4:
Review

SCREEN 5:
Department Assignment

DEPARTMENT ADMIN:

Drives

Tabs:

Assigned
Configuring
Ready to Publish
Active
Closed
Completed

Configuration wizard:

SCREEN 1:
Drive Details

SCREEN 2:
Auto-Fill Student Fields

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

IMPORTANT:
Stage modifications create Super Admin approval requests.

Other allowed configuration changes do not require approval.

STUDENT:

Drives
→ Eligible Drives

Drive card must display:

Company
Role
Package
Deadline
Drive Date
Status
Applied state

Drive details:

Overview
Eligibility
Job Details
Recruitment Process
Application Form

Application:

Review
Acknowledgement
Submit
Confirmation

After submission:
No edit
No withdrawal

Add polished empty/loading/error states.

Do not break existing routes unnecessarily.
```

---

# PHASE 10 — FINAL QUALITY / OPERATIONS

## P21 — Final Audit, Search, Export, History & Cleanup

```text
Perform the final production-readiness pass.

Implement/verify:

1. Drive search and filtering
2. Application filtering
3. Batch filtering
4. Department filtering
5. Application export
6. Eligible student export
7. Shortlisted export
8. Selected/rejected export
9. Bulk application stage updates
10. Drive activity timeline
11. Stage change history
12. Placement history
13. Admin invitation history
14. Audit logs
15. Action-required dashboard sections
16. Deadline reminders
17. Drive cancellation
18. Controlled deadline extension
19. Notification retry/idempotency
20. Error states
21. Empty states
22. Permission edge cases

Verify all important mutations are audited.

Verify:
- no cross-department access
- no student access to unpublished drives
- no placed student receives a drive
- no duplicate applications
- no modification of submitted applications
- no unauthorized stage changes
- no unauthorized published-drive changes
- no unauthorized placement changes

Run:

- unit tests
- integration tests
- authorization tests
- database tests
- type checking
- lint
- production build

Then inspect legacy fields.

Only remove legacy JSON/columns after confirming:

- zero readers
- zero writers
- migration completed
- data backfilled
- fallback unused

Never run destructive database commands automatically.

Do not use prisma migrate dev against production.

Do not reset Neon.

Produce a final implementation report.
```

---

# PART 3 — NEW DRIVE FLOW CHART

This is the **main workflow you've changed**.

```text
                    ┌───────────────────┐
                    │   SUPER ADMIN     │
                    └─────────┬─────────┘
                              │
                              ▼
                    Create Master Drive
                              │
                              ▼
                    ┌───────────────────┐
                    │ Master Details    │
                    │                   │
                    │ Company           │
                    │ Package           │
                    │ Role              │
                    │ JD                │
                    │ Dates             │
                    │ Other defaults    │
                    └─────────┬─────────┘
                              │
                              ▼
                  Define Admin Permissions
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                  LOCKED             EDITABLE
                    │                   │
                    └─────────┬─────────┘
                              ▼
                           CONFIRM
                              │
                              ▼
                    Select Departments
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
           CSE                IT                ECE
            │                 │                 │
            ▼                 ▼                 ▼
        Assigned          Assigned          Assigned
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                       DEPARTMENT ADMIN
                              │
                              ▼
                       SCREEN 1
                    Drive Configuration
                              │
                              ▼
                       SCREEN 2
                    Student Auto-Fill
                              │
                              ▼
                       SCREEN 3
                   Eligibility Criteria
                              │
                              ▼
                       SCREEN 4
                     Batch Selection
                              │
                              ▼
                       SCREEN 5
                  Recruitment Stages
                              │
                              ▼
                       FINAL PREVIEW
                              │
                              ▼
                         PUBLISH
                              │
                              ▼
                     STUDENT ELIGIBILITY
```

---

# PART 4 — NEW ELIGIBILITY FLOW

This is particularly important because of your permanent placement rule.

```text
                    STUDENT
                       │
                       ▼
               Approved Student?
                   /        \
                 NO          YES
                 │            │
                 ▼            ▼
              EXCLUDE      Is Placed?
                              /    \
                            YES      NO
                             │        │
                             ▼        ▼
                          EXCLUDE   Department
                             │        │
                             │        ▼
                             │       Batch
                             │        │
                             │        ▼
                             │    Eligibility Rules
                             │        │
                             │        ▼
                             │     Eligible?
                             │       /   \
                             │     NO     YES
                             │     │       │
                             ▼     ▼       ▼
                          EXCLUDE EXCLUDE SHOW DRIVE
```

### Important:

**PLACED → STOP**

The system does not waste time evaluating:

* CGPA
* backlog
* batch
* skills
* percentages
* other criteria

for a permanently placed student.

---

# PART 5 — RECRUITMENT STAGE FLOW

```text
                 SUPER ADMIN
                      │
                      ▼
              Create Master Drive
                      │
                      ▼
              Define Stage Pipeline
                      │
                      ▼
              ┌──────────────────┐
              │ Application      │
              │ Aptitude         │
              │ Technical        │
              │ HR               │
              │ Offer            │
              └────────┬─────────┘
                       │
                       ▼
                Assign Department
                       │
                       ▼
                 DEPT ADMIN
                       │
                       ▼
              Wants stage changes?
                   /          \
                 NO            YES
                 │              │
                 ▼              ▼
              Continue     Submit Change
                                │
                                ▼
                        Pending Approval
                                │
                                ▼
                         SUPER ADMIN
                           /       \
                       REJECT      APPROVE
                         │           │
                         ▼           ▼
                     Keep Old    New Pipeline
                                  Active
```

---

# PART 6 — PUBLISHED DRIVE MODIFICATION

Your confirmed rule:

> **Published Drive → Only Super Admin can modify**

So:

```text
                  PUBLISHED DRIVE
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
    DEPT ADMIN                    SUPER ADMIN
          │                           │
          ▼                           ▼
       READ ONLY                  CAN MODIFY
          │                           │
          ▼                           ▼
      NO EDIT                    AUDIT CHANGE
                                      │
                                      ▼
                              Updated Published Drive
```

For Admin:

```text
Published
   ↓
View
   ↓
Applications
   ↓
Recruitment management
```

They should **not** be able to modify the locked drive configuration.

---

# PART 7 — APPLICATION FLOW

```text
                    STUDENT
                       │
                       ▼
                  Open Drive
                       │
                       ▼
                  Eligible?
                   /     \
                 NO       YES
                 │         │
                 ▼         ▼
             No Apply   Application Form
                           │
                           ▼
                     Auto-fill Fields
                           │
                           ▼
                  Read-only / Editable
                           │
                           ▼
                      Review Details
                           │
                           ▼
                    Acknowledgement
                           │
                           ▼
                        SUBMIT
                           │
                           ▼
                 Server-side Validation
                           │
                           ▼
                Application + Snapshot
                      Transaction
                           │
                           ▼
                    Confirmation
                           │
                           ▼
                  Application Locked
                           │
                           ▼
             ┌─────────────┴────────────┐
             ▼                          ▼
        Admin Area                 Student Area
             │                          │
             ▼                          ▼
     Recruitment Pipeline          Status View
```

---

# PART 8 — NOTIFICATION ARCHITECTURE

```text
                         SYSTEM EVENT
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
            STUDENT          ADMIN       SUPER ADMIN
               │              │              │
               ▼              ▼              ▼
        Notification Center Notification Center Notification Center
               │              │              │
        ┌──────┼──────┐   ┌───┼────┐    ┌───┼────┐
        ▼      ▼      ▼   ▼   ▼    ▼    ▼   ▼    ▼
      Drives  Apps  Ann. Drives Apps  Sys Drives Admin System
        │
        ▼
   Email where required
```

---

# PART 9 — ADMIN INVITATION FLOW

I recommend this over the password-email flow you originally proposed.

```text
                  SUPER ADMIN
                       │
                       ▼
                Add Department Admin
                       │
                       ▼
             Email + Department + Name
                       │
                       ▼
                 Create Admin Record
                       │
                       ▼
                Create Clerk Invite
                       │
                       ▼
                 Email Invitation
                       │
                       ▼
                ADMIN RECEIVES EMAIL
                       │
                       ▼
                 Accept Invitation
                       │
                       ▼
              Set/Authenticate Account
                       │
                       ▼
                 Clerk Identity
                       │
                       ▼
               CampusHire User Match
                       │
                       ▼
             DepartmentAdmin Match
                       │
                       ▼
                    ACTIVE
                       │
                       ▼
                 ADMIN DASHBOARD
```

**No plaintext password should be sent or stored.**

---

# PART 10 — WHAT YOU ARE CHANGING

Here's the consolidated change list.

## 🔐 Authentication & Authorization

* [ ] Harden department isolation
* [ ] Prevent cross-department access
* [ ] Secure Admin invitations through Clerk
* [ ] Admin invitation statuses
* [ ] Admin disable/reactivate
* [ ] No plaintext passwords
* [ ] Better authorization around published drives

---

# 🚗 Drive Architecture

* [ ] Unified drive architecture
* [ ] Master Drive
* [ ] Department Drive
* [ ] Department assignment
* [ ] Department-specific configuration
* [ ] Master defaults
* [ ] Department overrides
* [ ] Admin editable/locked fields
* [ ] Drive lifecycle
* [ ] Draft
* [ ] Assigned
* [ ] Configuring
* [ ] Configured
* [ ] Published
* [ ] Closed
* [ ] Cancelled
* [ ] Archived
* [ ] Published-drive locking
* [ ] Super Admin-only modification after publication
* [ ] Final preview
* [ ] Save draft / continue
* [ ] Drive cancellation
* [ ] Controlled deadline modification

---

# 🎯 Eligibility

* [ ] Rule-based eligibility
* [ ] Department eligibility
* [ ] Batch eligibility
* [ ] CGPA
* [ ] Backlog
* [ ] Other supported academic criteria
* [ ] Skills where applicable
* [ ] Human-readable ineligibility reasons
* [ ] Placement check first
* [ ] Permanently exclude placed students
* [ ] Eligibility snapshot
* [ ] Eligibility consistency between:

  * Drive listing
  * Drive details
  * Application
  * Notifications

---

# 🎓 Student Placement

* [ ] Explicit placement status
* [ ] Admin-managed placement
* [ ] Company
* [ ] Role
* [ ] Package
* [ ] Drive/application reference
* [ ] Placement date
* [ ] Placement history
* [ ] Permanent drive exclusion
* [ ] Student placement status
* [ ] Super Admin global placement view

---

# 📝 Application

* [ ] New application flow
* [ ] Configurable application fields
* [ ] Auto-fill
* [ ] Required
* [ ] Editable
* [ ] Read-only
* [ ] Final acknowledgement
* [ ] No editing after submission
* [ ] No withdrawal
* [ ] Server-side validation
* [ ] Immutable Application Snapshot
* [ ] Eligibility snapshot
* [ ] Application configuration snapshot

---

# 🏆 Recruitment

* [ ] Drive-specific recruitment stages
* [ ] Super Admin stage creation
* [ ] Add/remove/reorder stages
* [ ] Stage types
* [ ] Custom stages
* [ ] Stage descriptions
* [ ] Admin stage change requests
* [ ] Super Admin approval
* [ ] Stage rejection
* [ ] Stage history/version
* [ ] Stage audit
* [ ] Student stage visibility
* [ ] Admin stage management
* [ ] Bulk stage management

---

# 🔔 Notifications

### Student

* [ ] New drive
* [ ] Drive update
* [ ] Deadline reminder
* [ ] Drive cancellation
* [ ] Application submitted
* [ ] Shortlisted
* [ ] Test
* [ ] Interview
* [ ] Selected
* [ ] Rejected
* [ ] Placement status
* [ ] Announcements
* [ ] Account notifications

### Admin

* [ ] New drive assigned
* [ ] Configuration reminder
* [ ] Drive ready to publish
* [ ] Stage change approval result
* [ ] New applications
* [ ] Access requests
* [ ] Student updates
* [ ] Deadline reminders
* [ ] Master drive updates
* [ ] System notifications

### Super Admin

* [ ] New admin
* [ ] Admin accepted invitation
* [ ] Drive assignment
* [ ] Department configuration
* [ ] Drive publication
* [ ] Stage change request
* [ ] Application milestones
* [ ] Access requests
* [ ] System alerts
* [ ] Announcements

### Notification infrastructure

* [ ] Read/unread
* [ ] Mark as read
* [ ] Mark all as read
* [ ] Categories
* [ ] Priority
* [ ] Action buttons
* [ ] Resource links
* [ ] Email notifications
* [ ] Notification preferences
* [ ] Duplicate prevention
* [ ] Retry handling

---

# 📢 Announcements

* [ ] Announcement entity
* [ ] Target audience
* [ ] Department targeting
* [ ] Batch targeting
* [ ] Priority
* [ ] Publish date
* [ ] Expiry date
* [ ] Attachments
* [ ] Archive
* [ ] Notification integration
* [ ] Announcement history

---

# ⚙️ Settings

### Student

* [ ] Profile
* [ ] Account
* [ ] Notifications
* [ ] Privacy
* [ ] Security
* [ ] Preferences

### Admin

* [ ] Profile
* [ ] Department
* [ ] Notifications
* [ ] Security
* [ ] Drive defaults
* [ ] Student management preferences

### Super Admin

* [ ] Profile
* [ ] Institution
* [ ] Departments
* [ ] Admin management
* [ ] Notifications
* [ ] Drive defaults
* [ ] Eligibility configuration
* [ ] Recruitment configuration
* [ ] Security
* [ ] System configuration
* [ ] Audit settings

---

# 📊 Admin / Super Admin Operations

* [ ] Action-required dashboard
* [ ] Drive search
* [ ] Drive filters
* [ ] Application filters
* [ ] Batch filters
* [ ] Department filters
* [ ] Eligible student list
* [ ] Registered student list
* [ ] Shortlisted list
* [ ] Test list
* [ ] Interview list
* [ ] Selected list
* [ ] Rejected list
* [ ] Excel/CSV export
* [ ] Bulk stage update
* [ ] Placement management
* [ ] Drive activity timeline
* [ ] Stage history
* [ ] Audit history

---

# 🛡️ Data Integrity

* [ ] Application uniqueness
* [ ] Application snapshot
* [ ] Placement history
* [ ] Drive history
* [ ] Stage history
* [ ] Department isolation
* [ ] Audit logging
* [ ] Migration safety
* [ ] No destructive production migrations
* [ ] Legacy JSON migration
* [ ] Schema drift verification

---

# The final user journey

Once all of this is implemented, your CampusHire experience should look roughly like this:

```text
                         CAMPUSHIRE
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
           STUDENT          ADMIN       SUPER ADMIN
              │              │              │
              │              │              │
         Login/Register    Login          Login
              │              │              │
              ▼              ▼              ▼
         Verification    Dashboard      Dashboard
              │              │              │
              ▼              │              │
          Dashboard          │              │
              │              │              │
              │         Assigned Drives     │
              │              │              │
              │              ▼              ▼
              │         Configure       Master Drive
              │              │              │
              │       ┌──────┼──────┐       │
              │       ▼      ▼      ▼       ▼
              │    Fields Eligibility Batch Assign
              │       │      │      │       │
              │       └──────┼──────┘       │
              │              ▼              │
              │          Preview            │
              │              │              │
              │              ▼              │
              │           Publish           │
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                     ELIGIBILITY ENGINE
                             │
                         NOT PLACED?
                        /          \
                      NO            YES
                      │              │
                    EXCLUDE        CONTINUE
                                     │
                                  BATCH
                                     │
                                ELIGIBILITY
                                     │
                                ELIGIBLE?
                                /       \
                              NO         YES
                              │           │
                           EXCLUDE      DRIVE
                                          │
                                          ▼
                                       APPLY
                                          │
                                          ▼
                                    APPLICATION
                                      SNAPSHOT
                                          │
                                          ▼
                                  RECRUITMENT STAGES
                                          │
                           ┌──────────────┼──────────────┐
                           ▼              ▼              ▼
                       SHORTLIST       TEST          INTERVIEW
                                                          │
                                                          ▼
                                                    SELECTED
                                                          │
                                                          ▼
                                                  ADMIN MARKS
                                                   PLACED
                                                          │
                                                          ▼
                                             PERMANENT EXCLUSION
```

## One final recommendation

I would treat **P0 → P21 as the new master sequence**, rather than running the previous 18 prompts and then these new prompts. There is substantial overlap between the two plans, and implementing both independently would cause the coding agent to repeatedly touch the same drive/database architecture.

In particular, the **custom stage approval system, explicit placement model, batch targeting, notification infrastructure, and secure Clerk admin invitation** should be designed into the core architecture rather than added after the old drive system is already rebuilt.

The existing review's proposed migration strategy of **expand → backfill → dual-read → cut over → contract** should remain the migration discipline, especially because of the noted live Neon/schema-drift risk. 

**Recommended execution:** run **one prompt at a time**, starting with P0. After each prompt, let the AI agent finish its verification before giving it the next prompt. For any prompt involving a potentially destructive Neon migration, have it inspect and report first rather than giving it permission to reset or wipe anything.
