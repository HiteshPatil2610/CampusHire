# UNIT 12 — FINAL CAMPUSHIRE SYSTEM VERIFICATION & COMPLIANCE AUDIT

You are performing the FINAL verification pass of the existing CampusHire codebase.

This is NOT a new feature-development phase.

This is a **final implementation audit, integration verification, security verification, regression verification, and production-readiness check** for everything specified across ARCH-FIX1 P1–P8 and Units 1–11.

Your job is to determine whether the CURRENT CODEBASE actually satisfies the requirements.

Do NOT assume previous units were implemented correctly simply because they were previously executed.

The current codebase is the source of truth.

---

# 0. PRIMARY OBJECTIVE

Determine:

> "Are all requirements from Units 1–11 actually implemented, correctly integrated, secure, authorized, tested, and free from contradictory/duplicate architecture?"

You must verify this from the actual repository.

Do NOT simply search for filenames or function names.

Trace the real execution paths.

For important requirements, verify:

UI
→ Server Action / Route
→ Authorization
→ Validation
→ Business Logic
→ Database
→ Audit / Notification
→ Result

The goal is to identify:

1. Fully implemented requirements
2. Partially implemented requirements
3. Missing requirements
4. Incorrect implementations
5. Security vulnerabilities
6. Integration inconsistencies
7. Dead/duplicate/legacy architecture
8. Missing tests
9. Database/schema inconsistencies
10. Regressions introduced by later units

---

# 1. CRITICAL RULES

## DO NOT blindly modify the project

This unit is primarily an AUDIT.

Do not rewrite working architecture.

Do not introduce new architecture simply because you think another design would be cleaner.

Do not perform speculative refactoring.

Do not replace working implementations without evidence of a defect.

Only make code changes when:

* a requirement is clearly missing,
* an existing implementation is demonstrably incorrect,
* a security vulnerability exists,
* an integration defect exists,
* a regression exists,
* or a test exposes a real defect.

For every fix, explain:

* what requirement it satisfies,
* what was wrong,
* why the fix is necessary,
* what files were changed,
* whether database changes were required.

---

# 2. DATABASE SAFETY

ABSOLUTE RULES:

* Never run `prisma migrate dev` against the connected Neon database.
* Never run database reset.
* Never use destructive reset commands.
* Never drop tables.
* Never drop columns.
* Never delete production data.
* Never reset the database.
* Never use destructive Prisma flags.

Before any schema change:

1. Inspect existing Prisma schema.
2. Inspect migration history.
3. Check existing dependencies.
4. Determine whether the change is actually necessary.
5. Prefer additive changes.
6. Use the project's established migration/deployment process.

If a destructive or irreversible migration appears necessary:

STOP.

Do not execute it.

Produce:

* proposed change,
* affected tables,
* affected columns,
* affected relations,
* affected code,
* data-loss risk,
* migration strategy.

---

# 3. SOURCE REQUIREMENTS

Use the following completed units as the complete requirements baseline:

UNIT 1
Application Integrity

UNIT 2
Eligibility + Placement + Batch Targeting

UNIT 3
Configurable Recruitment Pipeline

UNIT 4
Master Drive → Department Drive Workflow

UNIT 5
Frontend/UI for the Drive Workflow

UNIT 6
Department Admin Recruitment + Placement Management

UNIT 7
Notifications + Announcements

UNIT 8
Admin Invitations + Role-Specific Settings

UNIT 9
Dashboards + Filters + Exports + Bulk Operations

UNIT 10
Security + Authorization + Audit + Performance Hardening

UNIT 11
Production Readiness + End-to-End Verification

Do not consider a requirement satisfied merely because a corresponding file or model exists.

Verify behavior.

---

# 4. FIRST: BUILD A REQUIREMENTS MATRIX

Before making changes, create a master compliance matrix.

Use this exact status vocabulary:

* PASS — verified as correctly implemented
* PARTIAL — some required behavior exists but something is incomplete
* FAIL — requirement exists but is incorrectly implemented
* MISSING — requirement is not implemented
* BLOCKED — cannot verify because required environment/dependency is unavailable
* NOT APPLICABLE — requirement genuinely does not apply

Do NOT use vague statuses such as:

* probably done
* seems okay
* looks implemented
* likely working

Every PASS must have evidence.

For each requirement record:

| ID | Requirement | Status | Evidence | Files/Functions | Tests | Issue |
| -- | ----------- | ------ | -------- | --------------- | ----- | ----- |

---

# 5. ARCHITECTURE VERIFICATION

Verify that the final architecture still follows the intended CampusHire architecture.

Check:

* Clerk authentication
* CampusHire User
* Student
* Department
* DepartmentAdmin
* Master Drive
* Department Drive
* Application
* ApplicationSnapshot
* Eligibility engine
* Placement representation
* Recruitment Pipeline
* Pipeline Version
* Recruitment Stage
* Notifications
* Announcements
* AuditLog
* Admin invitation system
* Dashboard/query architecture

Verify there are no accidental duplicate systems.

Search for:

* duplicate eligibility evaluators
* duplicate application systems
* duplicate notification tables/services
* duplicate placement representations
* duplicate recruitment pipeline models
* old Master Drive/Department Drive implementations
* obsolete application mutation paths
* obsolete stage handling
* duplicate export implementations
* duplicate authorization helpers
* dead legacy routes
* dead Server Actions

If legacy code remains, determine whether it is:

* intentionally retained for compatibility,
* still actively used,
* dead code,
* dangerous because it bypasses the new architecture.

---

# 6. UNIT 1 — APPLICATION INTEGRITY

Verify every requirement from Unit 1.

## Submission

Verify server-side validation of:

* authenticated user
* student existence
* approved/active student
* correct department
* valid Department Drive
* published drive
* open deadline
* eligibility
* permanent placement exclusion
* batch eligibility
* duplicate application prevention
* mandatory fields
* read-only fields
* editable field validation
* acknowledgement/consent
* authoritative application configuration

Verify that client-provided:

* eligibility
* field metadata
* read-only flags
* department IDs
* student IDs
* application configuration

cannot override server truth.

## Immutability

After submission verify students cannot:

* edit application
* modify answers
* modify read-only fields
* modify eligibility data
* modify acknowledgement
* withdraw application

Test direct Server Action invocation.

Do not only inspect the UI.

## Snapshot

Verify ApplicationSnapshot preserves enough information to reconstruct:

* submitted data
* eligibility basis
* CGPA
* backlogs
* placement state
* batch
* applicable eligibility rules
* application field configuration/version/hash where required

Verify snapshot cannot be modified through unauthorized application paths.

## Transactions

Verify application creation and snapshot creation cannot leave inconsistent partial state.

---

# 7. UNIT 2 — ELIGIBILITY + PLACEMENT + BATCH

Verify there is ONE authoritative eligibility engine.

It must be reused by:

* eligible-drive listing
* drive detail
* application submission
* notifications
* relevant admin views

Verify placement is evaluated FIRST.

Required behavior:

Approved Student
→ Placed?
→ YES = INELIGIBLE immediately

If placed:

Do not continue evaluating:

* CGPA
* backlog
* batch
* skills
* other eligibility rules

Verify Department Drive batch targeting.

Verify:

student department matches
AND
student batch is targeted
AND
other eligibility rules pass

Verify batch values are data-driven.

No hard-coded graduation years.

Verify human-readable eligibility reasons where required.

Verify placement updates immediately affect future eligibility.

Verify existing/historical applications remain intact.

---

# 8. UNIT 3 — RECRUITMENT PIPELINE

Verify recruitment pipelines are drive-specific and configurable.

No universal hard-coded:

Application → Aptitude → Technical → HR → Offer

pipeline.

Verify arbitrary configured stages work.

Verify supported stage types.

Verify pipeline versioning/history.

Critical requirement:

Changing a pipeline must NOT invalidate historical applications.

Verify Application references the appropriate pipeline/stage architecture.

Verify stage transitions:

* validate actor
* validate application
* validate drive
* validate pipeline
* validate stage
* validate stage ownership
* reject invalid stage IDs
* reject stage IDs belonging to another drive

Verify Department Admin stage changes follow the approval architecture.

Verify Department Admin cannot approve their own pipeline-change request.

Verify rejected requests never become active.

Verify published-drive rules.

Verify stage counts are calculated correctly.

Verify audit records exist.

---

# 9. UNIT 4 — MASTER DRIVE → DEPARTMENT DRIVE WORKFLOW

Verify the full workflow:

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

Verify Master Drive represents institution/company-level truth.

Verify Department Admin does NOT receive unauthorized editing access.

Verify edit permissions are enforced server-side.

Verify department assignment creates/uses correct Department Drives.

Verify unassigned departments cannot access the drive.

Verify Department Drive isolation.

Verify student auto-fill configuration is owned by the correct layer.

Verify eligibility configuration.

Verify recruitment stage review.

Verify draft/save/continue functionality.

Verify final preview.

Verify publish validation.

Verify published-drive locking.

Verify cancellation.

Verify controlled deadline extension.

---

# 10. UNIT 5 — FRONTEND/UI

Verify the frontend reflects the actual backend architecture.

SUPER ADMIN:

* Master Drive list
* Master Drive details
* departments
* recruitment stages
* applications
* analytics where supported
* activity
* create wizard
* edit permissions
* review
* assignment

DEPARTMENT ADMIN:

* My Drives
* Assigned
* Configuring
* Ready to Publish
* Active
* Closed
* Completed
* configuration wizard
* auto-fill configuration
* eligibility
* batches
* recruitment review
* preview
* publish

STUDENT:

* published eligible drives
* drive details
* application
* read-only fields
* editable fields
* acknowledgement
* submission
* application status
* recruitment status
* placement status

Verify UI state is not being used as the security boundary.

Check:

* hidden buttons
* disabled controls
* route protection
* direct URL access
* direct Server Action access

---

# 11. UNIT 6 — RECRUITMENT + PLACEMENT MANAGEMENT

Verify Department Admin drive detail contains:

* Overview
* Eligibility
* Eligible Students
* Registered Students
* Applications
* Recruitment Pipeline
* Placement
* Activity

Verify filters:

* search
* batch
* eligibility
* placement
* application status

Verify applications show:

* student
* batch
* application status
* current stage
* applied date
* authorized snapshot information

Verify dynamic recruitment pipeline rendering.

Verify stage transitions.

Verify bulk stage actions.

For bulk actions verify:

1. authorization
2. target stage
3. each application
4. failure handling
5. partial failure reporting
6. audit logging

Verify placement workflow:

* company
* role
* package
* placement date
* drive/application reference
* notes if supported

Verify placement is confirmation-protected.

Verify placed students become permanently excluded from future placement drives.

Verify historical applications remain intact.

Verify students can view placement status but cannot modify it.

Verify Super Admin global placement visibility follows authorization rules.

---

# 12. UNIT 7 — NOTIFICATIONS + ANNOUNCEMENTS

Verify there is one underlying notification system.

Verify role-specific experiences for:

* Student
* Department Admin
* Super Admin

Verify notification data supports required fields.

Verify priorities.

Verify student events.

Verify admin events.

Verify super-admin events.

CRITICAL:

A Master Drive being created must NOT notify students.

Notification should happen only at the appropriate Department Drive publication/eligibility stage.

Verify:

* recipient targeting
* department targeting
* drive targeting
* role targeting
* placement exclusion
* unpublished-drive exclusion
* idempotency
* duplicate prevention
* delivery/retry behavior where implemented
* notification preferences
* audit

Verify announcement entity and authorization.

Verify announcement → notification behavior.

---

# 13. UNIT 8 — ADMIN INVITATION + SETTINGS

Verify complete flow:

Super Admin
→ Add Department Admin
→ email/name/department
→ invitation record
→ Clerk invitation
→ invitation email
→ acceptance
→ Clerk identity
→ CampusHire User
→ DepartmentAdmin
→ ACTIVE

Verify:

* no plaintext passwords
* no second authentication system
* no password emails
* Clerk remains authentication authority

Verify statuses:

* INVITED
* PENDING
* ACTIVE
* DISABLED

Verify conflict handling:

* existing Clerk user
* existing CampusHire User
* existing Student
* existing DepartmentAdmin
* pending invitation

Verify no duplicate accounts.

Verify:

* disable
* reactivate
* resend invitation
* department change

Verify disabled admins lose authorization.

Verify historical data remains.

Verify invitation audit events.

Verify settings authorization and sensitive settings audit behavior.

---

# 14. UNIT 9 — DASHBOARDS + FILTERS + EXPORTS

Verify action-required dashboards for:

STUDENT:

* incomplete profile
* eligible drives
* approaching deadlines
* pending actions
* upcoming stages
* announcements

DEPARTMENT ADMIN:

* access requests
* drives requiring configuration
* ready-to-publish drives
* stage approvals
* applications needing review
* deadlines

SUPER ADMIN:

* admin invitations
* department drives awaiting configuration
* stage requests
* application milestones
* system issues

Verify actions shown are actually executable.

Verify stale actions are removed.

Verify filters:

Drives:

* company
* role
* status
* department
* date
* publication state

Applications:

* drive
* department
* batch
* stage
* status
* placement
* date
* search

Eligible students:

* batch
* placement
* application status
* search

Verify export authorization.

Verify Department Admin cannot export another department's data.

Verify exported columns do not expose unauthorized data.

Verify bulk operations are authorized and audited.

Verify deadline reminders.

---

# 15. UNIT 10 — SECURITY HARDENING

Perform an adversarial authorization audit.

Do NOT only read the normal UI flow.

Test direct server-side access.

Attempt:

Dept A
→ Dept B students

Dept A
→ Dept B drives

Dept A
→ Dept B applications

Dept A
→ Dept B placement

Dept A
→ Dept B notifications

Department Admin
→ Master Drive modification

Department Admin
→ published-drive modification

Department Admin
→ unauthorized stage approval

Student
→ unpublished drive

Student
→ another department drive

Student
→ another student's application

Student
→ forged eligibility

Student
→ forged read-only field

Student
→ application modification

Student
→ withdrawal

Disabled Admin
→ protected resources

Verify every relevant:

* Server Action
* route
* query
* mutation
* direct-ID access path

Verify middleware is NOT the only authorization boundary.

Verify authorization exists at the server/domain layer.

---

# 16. SECURITY — SPECIAL CASES

Verify placement security.

Verify recruitment security.

Verify application security.

Verify notification recipient isolation.

Verify admin invitation security.

Verify audit coverage.

Verify published-drive security.

Verify approval security.

Verify direct-ID attacks.

Verify IDOR-style vulnerabilities.

Verify cross-department access.

Verify role escalation.

Verify disabled-user access.

---

# 17. PERFORMANCE + DATABASE

Inspect:

* Prisma queries
* N+1 patterns
* repeated eligibility calculations
* unnecessary database calls
* dashboard queries
* notification queries
* application queries
* drive listing queries
* export queries
* bulk operations

Inspect indexes.

Verify indexes support:

* department filtering
* student lookup
* application lookup
* drive lookup
* batch filtering
* placement filtering
* notification recipient lookup
* stage lookup
* audit lookup

Do not add indexes blindly.

Only recommend/add indexes where justified by actual query patterns.

---

# 18. TYPE SAFETY

Run:

* TypeScript type checking
* lint
* relevant test suites
* build if practical

Investigate:

* `any`
* unsafe casts
* `as unknown as`
* ignored TypeScript errors
* `@ts-ignore`
* `@ts-expect-error`
* unsafe client-controlled values
* unchecked nullable values

Do not mechanically remove valid exceptions.

Determine whether each is justified.

---

# 19. DATABASE + MIGRATION VERIFICATION

Inspect:

* Prisma schema
* migration history
* relations
* foreign keys
* unique constraints
* indexes
* nullable fields
* enums
* defaults
* cascade behavior

Verify schema matches actual code usage.

Look for:

* fields no longer used
* duplicate fields
* obsolete models
* orphan relations
* conflicting representations
* missing constraints
* application uniqueness issues
* snapshot immutability gaps
* placement duplication
* pipeline versioning inconsistencies

Do NOT delete legacy fields automatically.

Instead classify:

ACTIVE
LEGACY-BUT-USED
LEGACY-DEAD
DANGEROUS
UNKNOWN

---

# 20. TEST THE ACTUAL APPLICATION

Run the strongest practical verification available.

At minimum:

* TypeScript
* lint
* unit tests
* integration tests
* relevant database tests
* authorization tests
* application tests
* eligibility tests
* recruitment tests
* notification tests

If browser/E2E testing is available, test the major workflows.

Do not claim E2E verification if you only performed static code inspection.

Clearly distinguish:

CODE VERIFIED

from:

ACTUALLY EXECUTED

---

# 21. END-TO-END STUDENT FLOW

Verify:

Clerk signup
→ CampusHire User
→ Student matching
→ direct access OR access request
→ Admin approval/rejection
→ Student dashboard
→ eligible drives
→ drive details
→ application
→ auto-filled fields
→ editable/read-only fields
→ acknowledgement
→ submission
→ ApplicationSnapshot
→ confirmation
→ My Applications
→ recruitment status
→ placement status

Verify both happy path and rejection/error paths.

---

# 22. END-TO-END DEPARTMENT ADMIN FLOW

Verify:

Login
→ own department
→ student roster
→ access requests
→ assigned drives
→ configure drive
→ auto-fill configuration
→ eligibility
→ batch selection
→ recruitment review
→ preview
→ publish
→ locked published drive
→ eligible students
→ applications
→ recruitment stages
→ stage transitions
→ placement
→ exports
→ audit/activity

Verify cross-department attempts fail.

---

# 23. END-TO-END SUPER ADMIN FLOW

Verify:

Login
→ departments
→ admin invitations
→ admin management
→ Master Drive
→ edit permissions
→ recruitment pipeline
→ department assignment
→ department monitoring
→ published-drive modification
→ applications
→ placement/global reports
→ stage approval
→ announcements
→ audit logs
→ settings

Verify authorization at every mutation.

---

# 24. CRITICAL BUSINESS RULE MATRIX

Explicitly verify each:

1. Placed student is permanently excluded from future placement drives.

2. Placement is evaluated before other eligibility rules.

3. Batch targeting works.

4. Department isolation works.

5. Unpublished drives are inaccessible to students.

6. Students cannot access another department's drives.

7. Duplicate applications are blocked.

8. Submitted applications cannot be edited.

9. Submitted applications cannot be withdrawn.

10. ApplicationSnapshot remains immutable.

11. Eligibility is consistent across listing/application/notification.

12. Department Admin cannot modify a published Department Drive.

13. Super Admin can modify published drives according to defined rules.

14. Normal permitted configuration changes do not unnecessarily require approval.

15. Department Admin recruitment pipeline changes require Super Admin approval.

16. Admin cannot approve their own stage-change request.

17. Rejected stage requests do not become active.

18. Dynamic recruitment stages work without hard-coded stage names.

19. Notifications are correctly scoped.

20. Unpublished drives do not notify students.

21. Placed students do not receive future placement-drive notifications.

22. Announcement targeting works.

23. Admin invitation never uses plaintext passwords.

24. Disabled Admins cannot access protected functionality.

25. Audit history is preserved.

---

# 25. REGRESSION CHECK

Search for regressions caused by Units 1–11.

Specifically verify that new architecture did not break:

* existing student registration
* access requests
* Excel import
* existing dashboards
* existing authentication
* existing notifications
* existing audit logs
* existing student records
* existing department records
* existing drives
* existing applications

Check all callers of changed shared functions.

Look for old callers using obsolete contracts.

---

# 26. REQUIREMENT TRACEABILITY

Create a final traceability matrix:

| Unit | Requirement Area | PASS | PARTIAL | FAIL | MISSING | BLOCKED |
| ---- | ---------------- | ---- | ------- | ---- | ------- | ------- |

Then list every failed/partial/missing item individually.

For every issue provide:

### Requirement

What was required.

### Current State

What the code currently does.

### Evidence

Exact file/function/model/route.

### Impact

What can go wrong.

### Severity

CRITICAL
HIGH
MEDIUM
LOW

### Required Fix

The smallest appropriate correction.

---

# 27. IMPORTANT — DO NOT HIDE FAILURES

If something is missing, say so.

If something is only partially implemented, say so.

If a previous unit claimed something was completed but the current code does not satisfy it, mark it as FAIL/PARTIAL.

Do NOT mark a requirement PASS because:

* a component exists,
* a model exists,
* a function exists,
* a TODO exists,
* the UI looks correct,
* a previous Claude session said it was done.

The behavior must actually satisfy the requirement.

---

# 28. FIX VERIFIED DEFECTS

After completing the audit:

If there are clearly verified defects that can be safely fixed without changing the architecture:

FIX THEM.

Prioritize:

1. Critical security vulnerabilities
2. Authorization vulnerabilities
3. Data-integrity problems
4. Broken core business rules
5. Incorrect workflow behavior
6. Broken integration
7. Test failures
8. Performance issues
9. UI inconsistencies
10. Cleanup

Do not perform speculative improvements.

After every fix, rerun relevant tests.

---

# 29. FINAL VALIDATION

After fixes, run the strongest practical validation again.

At minimum:

* TypeScript
* lint
* tests
* relevant integration tests
* build where practical

If something cannot be executed, clearly state why.

---

# 30. FINAL REPORT

Produce the final report using this structure:

# CAMPUSHIRE FINAL VERIFICATION REPORT

## 1. Overall Verification Status

Use ONLY:

* VERIFIED
* VERIFIED WITH REMAINING ISSUES
* NOT VERIFIED

Do not use percentage scores.

Do not say "100% complete" unless every requirement has actually been verified.

---

## 2. Executive Summary

Briefly explain:

* what was verified
* what was fixed
* what remains
* whether there are critical blockers

---

## 3. Unit-by-Unit Status

### Unit 1 — Application Integrity

Status:
Key findings:

### Unit 2 — Eligibility + Placement

Status:
Key findings:

### Unit 3 — Recruitment Pipeline

Status:
Key findings:

### Unit 4 — Drive Workflow

Status:
Key findings:

### Unit 5 — Frontend/UI

Status:
Key findings:

### Unit 6 — Recruitment + Placement Management

Status:
Key findings:

### Unit 7 — Notifications + Announcements

Status:
Key findings:

### Unit 8 — Admin Invitations + Settings

Status:
Key findings:

### Unit 9 — Dashboards + Exports

Status:
Key findings:

### Unit 10 — Security Hardening

Status:
Key findings:

### Unit 11 — Production Readiness

Status:
Key findings:

---

# 4. Critical Issues

List only actual blockers.

For each:

* Severity
* Requirement
* Problem
* Evidence
* Impact
* Fix status

---

# 5. Security Findings

List:

* vulnerabilities found
* vulnerabilities fixed
* remaining vulnerabilities
* authorization gaps
* IDOR/cross-department risks
* authentication issues
* data exposure risks

---

# 6. Database Findings

Include:

* schema changes
* migrations
* indexes
* constraints
* legacy fields
* duplicate models
* data-integrity concerns

---

# 7. Tests Executed

Provide exact commands and results.

Example:

```text
Command:
npm run typecheck

Result:
PASS / FAIL

Details:
...
```

Do NOT claim tests passed if they were not executed.

---

# 8. Files Changed During Final Audit

List:

* file
* reason
* requirement addressed

---

# 9. Remaining Issues

Separate into:

### Must Fix Before Production

### Should Fix

### Optional Cleanup

Do not mix these categories.

---

# 10. Architecture Status

Explicitly state whether the final codebase contains:

* duplicate systems
* obsolete architecture
* conflicting business logic
* inconsistent authorization
* inconsistent eligibility evaluation
* inconsistent recruitment stage handling
* inconsistent notification handling

---

# 11. Final Requirement Matrix

Provide the complete Unit 1–11 compliance matrix.

Every requirement must have a definitive status:

PASS
PARTIAL
FAIL
MISSING
BLOCKED
NOT APPLICABLE

No vague statuses.

---

# 12. FINAL DECISION

End with:

## FINAL RESULT

Then state exactly one:

### VERIFIED

All checked requirements are implemented and validated, with no known blocking issue.

### VERIFIED WITH REMAINING ISSUES

The major architecture and workflows are implemented, but specific non-blocking issues remain.

### NOT VERIFIED

One or more important requirements, security controls, workflows, or tests remain unresolved.

Do NOT use percentage completion.

Do NOT invent confidence levels.

Do NOT claim production readiness unless the evidence supports it.

---

# FINAL INSTRUCTION

Remember:

You are not being asked to make the project "look complete."

You are being asked to determine whether the CURRENT CampusHire implementation actually satisfies the complete specification accumulated across Units 1–11.

Inspect first.

Trace behavior.

Test where possible.

Fix only verified defects.

Then report the truth.
