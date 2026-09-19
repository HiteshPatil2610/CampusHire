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



Implement the complete CampusHire notification and announcement architecture.

This phase must unify the existing notification behavior instead of creating a second notification system.

==================================================
1. INSPECT EXISTING SYSTEM
==================================================

Inspect:

- Notification model
- notification actions
- notification queries
- existing notification UI
- drive publication notification logic
- eligibility notification logic
- audit logging
- email integration if present
- existing announcements

Reuse existing infrastructure where possible.

==================================================
2. THREE ROLE-SPECIFIC CENTERS
==================================================

Provide separate notification experiences for:

STUDENT
ADMIN
SUPER ADMIN

All may use the same underlying Notification infrastructure.

Do not create three unrelated Notification tables.

==================================================
3. NOTIFICATION DATA
==================================================

Support the equivalent of:

- recipient
- type
- category
- title
- message
- priority
- read/unread
- createdAt
- resource reference
- action URL
- expiry
- delivery state/status
- retry information where appropriate

Use the existing project naming conventions.

==================================================
4. PRIORITY
==================================================

Support:

INFO
SUCCESS
ACTION_REQUIRED
WARNING
URGENT

Do not use arbitrary strings everywhere if a controlled enum is appropriate.

==================================================
5. STUDENT EVENTS
==================================================

Support notifications for:

- New Drive
- Drive Update
- Deadline
- Drive Cancelled
- Application Submitted
- Shortlisted
- Test
- Interview
- Selected
- Rejected
- Placement
- Announcement
- Account

==================================================
6. ADMIN EVENTS
==================================================

Support:

- Drive Assigned
- Configuration Reminder
- Ready to Publish
- Stage Change Approval Result
- New Applications
- Access Requests
- Student Updates
- Deadline
- Master Drive Update
- System Notification

==================================================
7. SUPER ADMIN EVENTS
==================================================

Support:

- Admin Invitation
- Admin Accepted Invitation
- Drive Assignment
- Department Configuration
- Drive Publication
- Stage Change Request
- Application Milestones
- Access Requests
- System Alerts
- Announcements

==================================================
8. DRIVE NOTIFICATION FLOW
==================================================

Critical rule:

Do NOT notify students when a Master Drive is merely created.

Correct flow:

Master Drive
→ Department Assignment
→ Department Configuration
→ Department Published
→ Eligibility Engine
→ Eligible Students
→ Student Notification

Notification targeting MUST use the same eligibility engine as:

- drive listing
- drive detail
- application submission

Do not implement another eligibility calculation.

==================================================
9. TARGETING
==================================================

Verify:

- department scope
- batch scope
- placement exclusion
- eligibility
- recipient authorization

A Department Admin must never trigger a notification to another department.

==================================================
10. IDEMPOTENCY
==================================================

Prevent duplicate notifications caused by:

- repeated publish
- retries
- duplicate events
- page refresh
- repeated action execution

Use a suitable idempotency strategy based on the current schema.

Do not rely only on frontend state.

==================================================
11. DELIVERY / RETRY
==================================================

If email or external delivery exists:

track appropriate delivery state:

- pending
- sent
- failed
- retrying

Do not claim an email was sent if delivery was not confirmed.

==================================================
12. NOTIFICATION PREFERENCES
==================================================

Where supported by the existing settings architecture, allow users to control appropriate notification preferences.

Do not allow preferences to suppress mandatory security/system events unless the existing business rules explicitly allow it.

==================================================
13. NOTIFICATION UI
==================================================

Provide:

- notification bell
- unread count
- notification page
- All
- Unread
- Drive
- Application
- Recruitment
- Announcement
- System

Actions:

- mark read
- mark unread
- mark all read
- open related resource

Use priority-specific visual treatment without changing the project's overall design language.

==================================================
14. ANNOUNCEMENT ENTITY
==================================================

Announcements are NOT the same thing as notifications.

Create/use a first-class Announcement entity.

Support:

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
- attachment where existing storage supports it

==================================================
15. ANNOUNCEMENT AUTHORIZATION
==================================================

SUPER_ADMIN:
- global announcements

DEPT_ADMIN:
- department-scoped announcements

STUDENT:
- read targeted announcements

Prevent cross-department access.

==================================================
16. ANNOUNCEMENT → NOTIFICATION
==================================================

Publishing an announcement may generate notifications for its target audience.

Prevent duplicate notification generation.

Do not make notifications the source of truth for the announcement itself.

==================================================
17. AUDIT
==================================================

Audit important events:

- announcement created
- published
- edited
- expired/archived
- notification generated
- notification delivery failure/retry where relevant

Reuse AuditLog.

==================================================
18. TESTS
==================================================

Test:

- unpublished drive does not notify students
- published drive notifies eligible students
- placed student not notified
- wrong department not notified
- wrong batch not notified
- duplicate publish doesn't duplicate notification
- Admin cannot notify another department
- announcement targeting
- notification recipient isolation
- read/unread
- retry/idempotency

FINAL REPORT:

Report:

- notification architecture
- event sources
- targeting
- idempotency
- announcement model
- UI
- tests
- migrations
- unresolved issues