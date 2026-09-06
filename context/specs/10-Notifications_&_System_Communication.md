UNIT 10 — IN-APP NOTIFICATIONS & SYSTEM COMMUNICATION

You are continuing development of the CampusHire project.

IMPORTANT:
- Read ALL files inside `context/` before making changes.
- Read the completed specifications/implementation for Units 01–09.
- Do NOT redo completed work.
- Do NOT split this task into sub-units.
- Implement the entire Unit 10 as one cohesive module.
- Follow the existing CampusHire architecture, security model, database design, UI system, and coding conventions.
- Do not invent functionality that conflicts with the existing project scope.
- Transactional email beyond Clerk sign-up/email verification remains OUT OF SCOPE.
- This module is for secure, in-app system notifications.

==================================================
UNIT 10 — IN-APP NOTIFICATIONS & SYSTEM COMMUNICATION
==================================================

PRIMARY OBJECTIVE

Implement a centralized in-app notification system for CampusHire.

The system should allow authenticated users to receive important system-generated notifications relevant to their role and actions.

Examples may include:

- important drive/application events
- application-related updates
- administrative events
- profile/onboarding reminders where appropriate
- system-level messages where explicitly supported

Notifications must be:

- server-generated
- user-scoped
- authorization-safe
- persisted in PostgreSQL
- readable through the application UI
- markable as read
- protected against cross-user access

Do NOT implement email notifications.

==================================================
1. CREATE SPECIFICATION
==================================================

Create:

`context/specs/10-notifications.md`

Document:

- purpose
- notification model
- notification types
- recipient model
- creation rules
- read/unread behavior
- authorization
- retention assumptions
- pagination
- UI
- error handling
- security/privacy
- integration points
- testing
- assumptions/open questions

The specification must exactly reflect the final implementation.

==================================================
2. INSPECT EXISTING CODE FIRST
==================================================

Before modifying anything:

Read:

- `context/*`
- Unit 01–09 specifications
- current Prisma schema
- existing authentication helpers
- existing authorization helpers
- existing server-action/data-access patterns
- existing student UI
- existing admin UI
- existing audit system

Check whether any notification-related implementation already exists.

Do NOT create duplicate notification infrastructure.

==================================================
3. NOTIFICATION DATA MODEL
==================================================

Create a `Notification` model only if one does not already exist.

Use the minimum fields required by the existing CampusHire context.

The model should support, where appropriate:

- unique notification ID
- recipient User
- notification type/category
- title
- message/body
- read/unread state
- creation timestamp
- optional relevant resource reference if actually useful

Do NOT add unnecessary fields.

Do not store complete database records inside notifications.

==================================================
4. RECIPIENT
==================================================

Every notification must belong to a specific authenticated CampusHire User.

Never trust recipient IDs supplied by the browser.

The server must determine the recipient from trusted application state.

A student must never be able to create a notification for:

- another student
- an admin
- a super admin

through client input.

==================================================
5. CENTRALIZED NOTIFICATION SERVICE
==================================================

Create one reusable server-side notification helper/service.

Conceptually:

`createNotification(...)`

The helper should centralize:

- recipient validation
- notification type
- title/message
- optional resource reference
- database creation
- safe metadata handling if metadata is supported

Do NOT duplicate raw Prisma notification creation logic across features.

Future CampusHire modules should be able to reuse this service.

==================================================
6. SERVER-SIDE CREATION ONLY
==================================================

Notifications must NEVER be created directly by client-side code.

Forbidden pattern:

Client
  ↓
createNotification()

Required pattern:

User/system action
  ↓
Server authorization
  ↓
Business operation
  ↓
Server creates notification for the correct recipient

The client must never control:

- recipient
- sender/actor identity
- notification timestamp
- arbitrary notification type
- arbitrary notification content

==================================================
7. NOTIFICATION TYPES
==================================================

Define a small, consistent notification type system.

Use only types justified by actual CampusHire functionality.

Possible categories include:

- APPLICATION
- DRIVE
- PROFILE
- ADMIN
- SYSTEM

Do not create a large enum of speculative future events.

If the existing project already defines notification categories, reuse them.

==================================================
8. STUDENT NOTIFICATIONS
==================================================

Integrate notifications into existing student workflows where meaningful.

Consider existing functionality such as:

- successful application
- relevant application updates if such state exists
- important drive-related events
- profile/onboarding-related reminders only if explicitly supported

IMPORTANT:

Do not invent an application-status workflow that does not exist.

If CampusHire currently only records application creation and does not have employer/application status management, do not create fake status notifications.

==================================================
9. ADMIN NOTIFICATIONS
==================================================

Only implement admin notifications where there is an actual event worth communicating.

Potential examples:

- important system events
- bulk-import completion when Unit 07 is eventually implemented
- administrative workflow events supported by the existing application

Do not implement speculative notification behavior.

==================================================
10. SUPER ADMIN NOTIFICATIONS
==================================================

Do not automatically notify Super Admins for every action.

Only create system notifications where the existing CampusHire workflow has a meaningful reason.

Audit logs remain the source of historical administrative activity.

Notifications are for user attention, NOT audit history.

==================================================
11. UNIT 07 COMPATIBILITY
==================================================

Unit 07 production bulk import remains deferred.

Do NOT implement Unit 07.

Do NOT build the bulk import system as part of Unit 10.

The notification service may be designed so that Unit 07 can later emit a notification when implemented.

Do not create fake import notifications.

==================================================
12. READ / UNREAD
==================================================

Implement:

- unread state
- mark as read
- optionally mark all as read if appropriate

A user may only modify read state of their own notifications.

Example:

User A
  ↓
can read/mark-read
  ↓
User A's notifications only

User A must never be able to mark User B's notification as read.

==================================================
13. IMMUTABILITY
==================================================

Users should not be able to edit:

- title
- message
- type
- recipient
- creation timestamp

Normal user interaction should only change notification state such as:

- unread → read

Do not expose generic notification update functionality.

==================================================
14. NOTIFICATION LIST
==================================================

Implement a server-side notification list query.

Use offset pagination.

Default:

`pageSize = 25`

Return:

{
  data,
  page,
  pageSize,
  totalCount
}

Do not fetch all notifications into memory.

Order notifications newest first.

==================================================
15. UNREAD COUNT
==================================================

Implement an efficient server-side unread count.

The UI should be able to display something such as:

Notifications
3 unread

Do not fetch all notifications merely to calculate the unread count.

Use a database count query.

The unread count must only count notifications belonging to the authenticated user.

==================================================
16. NOTIFICATION UI
==================================================

Add a notification experience to the existing application shell.

Use the existing:

- shadcn/ui components
- Tabler icons
- theme tokens
- typography
- spacing
- layout

Do not create a separate design language.

A notification entry should clearly communicate:

- title
- message
- timestamp
- read/unread state

Keep the UI clean and compact.

==================================================
17. NOTIFICATION CENTER
==================================================

Implement an appropriate notification center/page/popover based on the existing application shell.

If the current shell supports a header notification icon, integrate there.

Do not create unnecessary modals.

The notification center should provide:

- notification list
- unread indication
- mark-as-read interaction
- pagination
- empty state

Example empty state:

"No notifications yet."

==================================================
18. NOTIFICATION NAVIGATION
==================================================

If a notification relates to an existing resource and the project has a valid route for that resource, allow the user to navigate to it.

Examples:

- drive notification → existing drive page
- application notification → existing application page

Do NOT create routes solely for notifications.

Do not trust a notification's destination from client input.

Only generate destinations from server-controlled known resource references.

==================================================
19. AUTHORIZATION
==================================================

All notification queries must use the authenticated user's identity.

Students:

- see only their notifications.

Department Admins:

- see only their own notifications unless the existing context explicitly requires shared departmental notifications.

Super Admin:

- sees only their own personal notifications unless a separate system-wide notification mechanism is explicitly required.

Do NOT expose every notification globally to administrators.

==================================================
20. SECURITY
==================================================

Protect against:

- cross-user notification access
- cross-user mark-as-read
- fabricated recipient IDs
- fabricated notification IDs
- arbitrary notification creation
- message injection
- unauthorized notification deletion
- unauthorized notification modification

Never use a client-provided `userId` as the authorization boundary.

==================================================
21. SERVER ACTIONS / DATA ACCESS
==================================================

Follow the existing architecture.

Use:

- server actions for mutations where appropriate
- server-side data-access functions for reads
- existing authentication helpers
- existing authorization helpers
- Zod for external input

Route/page components must remain composition-only.

Do not place Prisma queries inside React components.

==================================================
22. VALIDATION
==================================================

Use Zod for external inputs such as:

- pagination
- notification ID
- mark-as-read requests
- optional filters

Do not accept client-controlled:

- recipient
- timestamp
- actor
- arbitrary title/message/type

Those must come from trusted server-side code.

==================================================
23. DUPLICATE NOTIFICATIONS
==================================================

Avoid accidental duplicate notifications where the same business action can trigger multiple writes.

Do NOT introduce complicated deduplication infrastructure unless the existing workflow requires it.

If a specific event can safely create only one notification, ensure the business operation does not call the notification service multiple times unintentionally.

Document any deduplication assumption.

==================================================
24. TRANSACTIONAL CREATION
==================================================

Where a notification corresponds directly to a database mutation, consider creating the notification within the same transaction where appropriate.

Example:

BEGIN TRANSACTION
    perform business mutation
    create notification
COMMIT

Do not create a notification claiming that an action succeeded before the underlying operation succeeds.

==================================================
25. FAILURE HANDLING
==================================================

Determine the appropriate policy based on the existing architecture.

For non-critical informational notifications, a notification failure should not unnecessarily break the primary user operation unless the context requires transactional consistency.

For notifications that are logically part of a critical workflow, document whether they are transactional.

Never show raw Prisma/database errors to users.

==================================================
26. RETENTION
==================================================

Do not implement automatic deletion/archival unless explicitly required by the existing context.

Do not add cron jobs or scheduled cleanup as part of Unit 10.

Document the current retention assumption.

==================================================
27. PRIVACY
==================================================

Notifications must contain only information appropriate for the recipient.

Do not include:

- passwords
- OTPs
- access tokens
- refresh tokens
- Clerk secrets
- database credentials
- unnecessary personal information
- sensitive data belonging to another user

Never use notifications as a substitute for secure data access.

==================================================
28. PERFORMANCE
==================================================

Notification queries must remain efficient.

Use:

- database indexes where justified
- pagination
- server-side filtering
- database-level unread count
- database-level ordering

Potential useful index:

`(recipientId, createdAt)`

Add indexes only if justified by the actual schema/query pattern.

==================================================
29. TESTING
==================================================

Add focused Vitest tests.

At minimum test:

CREATION:

1. Authorized server operation creates a notification.
2. Notification belongs to the correct recipient.
3. Client cannot choose another recipient.
4. Client cannot fabricate notification type.
5. Client cannot fabricate timestamp.

READ ACCESS:

6. User can retrieve their own notifications.
7. User cannot retrieve another user's notifications.
8. Unauthenticated users cannot retrieve notifications.

READ STATE:

9. User can mark their own notification as read.
10. User cannot mark another user's notification as read.
11. Already-read notification remains read.
12. Unread count is correct.

PAGINATION:

13. Default page size is 25.
14. Pagination returns `{data,page,pageSize,totalCount}`.
15. Invalid pagination is rejected.
16. Results are newest first.

SECURITY:

17. No generic client notification creation endpoint exists.
18. Notification content cannot be arbitrarily injected by clients.
19. Notification resource references cannot bypass authorization.

REGRESSION:

20. Existing Unit 01–09 tests continue to pass.

==================================================
30. DATABASE
==================================================

Inspect the current Prisma schema.

If Notification already exists:

- reuse it
- extend only if genuinely required

If it does not exist:

- add the minimal Notification model
- add necessary relation to User
- add justified indexes

Run:

- Prisma validation
- Prisma generation
- migration if PostgreSQL/Neon is available

If the database is unavailable:

- do not fake migration success
- report migration as pending

==================================================
31. NO EMAIL SYSTEM
==================================================

Do NOT implement:

- SendGrid
- Resend
- Nodemailer
- SES
- SMTP
- transactional email
- notification email preferences
- email templates

Clerk remains responsible for authentication/email verification.

Unit 10 is strictly in-app notifications.

==================================================
32. NO PUSH/SMS
==================================================

Do NOT implement:

- browser push notifications
- mobile push notifications
- SMS
- WhatsApp
- external messaging services

Keep the system database-backed and in-app.

==================================================
33. AUDIT LOG INTEGRATION
==================================================

Unit 09 audit logging and Unit 10 notifications serve different purposes.

Audit Log:

- historical record
- security/admin accountability
- immutable
- privileged viewing

Notification:

- user attention
- actionable information
- user-specific
- read/unread state

Do not duplicate every audit event as a notification.

Only create notifications for events that genuinely require user attention.

==================================================
34. EXISTING MODULE COMPATIBILITY
==================================================

Do not rewrite completed modules.

Verify compatibility with:

- Clerk authentication
- role synchronization
- student profile
- drive management
- eligibility
- applications
- department management
- admin management
- audit logging

Use existing helpers rather than creating duplicate authorization logic.

==================================================
35. UI ACCESSIBILITY
==================================================

Ensure notification UI is usable with:

- keyboard navigation
- visible focus states
- semantic buttons/links
- accessible labels
- sufficient read/unread distinction

Do not rely only on color to communicate unread state.

==================================================
36. ERROR / EMPTY / LOADING STATES
==================================================

Implement:

- loading state
- empty state
- error state
- unauthorized state
- pagination state

Keep messages user-friendly.

Do not expose internal implementation details.

==================================================
37. STRICT OUT OF SCOPE
==================================================

DO NOT implement:

- transactional email
- SMS
- WhatsApp
- push notifications
- notification analytics
- notification campaigns
- broadcast marketing system
- external messaging providers
- advanced notification preferences
- scheduled notifications
- cron jobs
- AI-generated notifications
- bulk import implementation
- resume functionality
- interview management
- placement outcome management
- multi-college tenancy
- payments
- mobile app

==================================================
38. DOCUMENTATION
==================================================

Update:

`context/progress-tracker.md`

Record:

- Unit 10 status
- files created/modified
- Notification model
- notification service/helper
- notification types
- supported notification events
- read/unread behavior
- unread count
- authorization model
- pagination
- security/privacy decisions
- tests
- migration status
- TypeScript status
- lint status
- build status
- assumptions/open questions

Ensure:

`context/specs/10-notifications.md`

matches the actual implementation.

==================================================
39. FINAL SECURITY REVIEW
==================================================

Before declaring Unit 10 complete, verify:

[ ] Notifications are created server-side.
[ ] Recipient is determined server-side.
[ ] Client cannot fabricate recipient.
[ ] Client cannot fabricate timestamp.
[ ] Client cannot fabricate arbitrary notification content.
[ ] Users can only read their own notifications.
[ ] Users can only mark their own notifications as read.
[ ] Students cannot access another student's notifications.
[ ] Department Admins cannot access another user's notifications.
[ ] Super Admin does not automatically receive global notification access.
[ ] No generic client notification creation endpoint exists.
[ ] No sensitive secrets are stored in notifications.
[ ] Notification resource links cannot bypass authorization.
[ ] Unread count is user-scoped.
[ ] Pagination is implemented server-side.
[ ] Existing authorization helpers are reused.
[ ] Unit 09 audit logging remains separate.
[ ] Unit 07 remains deferred.
[ ] Existing Units 01–09 continue working.

==================================================
40. FINAL VERIFICATION
==================================================

Run:

- Prisma validation
- Prisma generation
- migration if database is available
- TypeScript
- ESLint
- complete Vitest suite
- production build

Do not claim success unless the commands actually pass.

==================================================
EXECUTION ORDER
==================================================

Execute in this order:

1. Read all context.
2. Read Units 01–09.
3. Inspect existing Prisma schema.
4. Inspect existing auth/authorization helpers.
5. Inspect existing application shell.
6. Inspect existing audit system.
7. Create `context/specs/10-notifications.md`.
8. Design minimal Notification model.
9. Implement centralized notification service.
10. Implement server-side notification creation.
11. Integrate only meaningful existing workflows.
12. Implement notification list.
13. Implement unread count.
14. Implement mark-as-read.
15. Implement notification UI.
16. Implement pagination.
17. Add security tests.
18. Add notification behavior tests.
19. Run complete regression suite.
20. Run Prisma validation/generation.
21. Run migration if database is available.
22. Run TypeScript.
23. Run ESLint.
24. Run production build.
25. Update progress tracker.
26. Perform final security/privacy review.
27. Review final diff for scope violations.

==================================================
FINAL RESPONSE
==================================================

When finished, report:

- Unit 10 completion status
- files created/modified
- Notification schema
- centralized notification service
- supported notification events
- read/unread implementation
- unread count
- pagination
- UI implementation
- authorization/security model
- privacy decisions
- tests added and results
- Prisma/migration status
- TypeScript/lint/build status
- assumptions/open questions
- exact next recommended module

IMPORTANT:
- Do not claim anything passed unless actually executed.
- Do not claim migration succeeded if PostgreSQL/Neon was unavailable.
- Do not implement email notifications.
- Do not implement Unit 07 bulk import.
- Do not expand Unit 10 beyond in-app notifications.