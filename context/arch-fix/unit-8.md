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


Implement secure Department Admin invitation and complete role-specific settings.

==================================================
PART A — ADMIN INVITATION
==================================================

First inspect the existing:

- Clerk integration
- User model
- DepartmentAdmin model
- Super Admin admin-management actions
- webhook/lazy user creation
- existing admin creation flow

Do not create a duplicate authentication system.

==================================================
1. INVITATION FLOW
==================================================

Super Admin:

Add Department Admin
→ email
→ name
→ department
→ create/admin invitation record
→ Clerk invitation
→ invitation email
→ admin accepts
→ Clerk identity
→ CampusHire User
→ DepartmentAdmin association
→ ACTIVE

==================================================
2. SECURITY
==================================================

DO NOT:

- generate plaintext passwords
- email passwords
- store plaintext passwords
- create a second password system

Use Clerk for authentication.

==================================================
3. ADMIN STATUS
==================================================

Support appropriate states such as:

INVITED
PENDING
ACTIVE
DISABLED

Use existing schema if possible.

Track:

- invitedAt
- acceptedAt
- disabledAt
- department
- email
- userId
- invitation metadata as appropriate

==================================================
4. EXISTING EMAIL CONFLICTS
==================================================

Handle:

- existing Clerk user
- existing CampusHire User
- existing Student record
- existing DepartmentAdmin
- pending invitation

Do not duplicate accounts.

If the existing account is incompatible, report the exact conflict rather than silently overwriting it.

==================================================
5. DISABLE / REACTIVATE
==================================================

Super Admin should be able to:

- disable admin
- reactivate where business rules allow
- resend invitation where appropriate
- change department where authorized

Disabled admins must lose Department Admin authorization.

Historical drives/applications/audit records must remain.

==================================================
6. AUTHORIZATION
==================================================

Access to Department Admin functionality requires the appropriate combination of:

- authenticated Clerk identity
- CampusHire User
- correct role
- active DepartmentAdmin authorization
- department scope

Do not trust email alone.

==================================================
7. AUDIT
==================================================

Audit:

- invitation created
- resent
- accepted
- activated
- disabled
- reactivated
- department changed

Reuse AuditLog.

==================================================
PART B — SETTINGS
==================================================

Implement role-specific settings pages.

STUDENT:

- Profile
- Account
- Notifications
- Privacy
- Security
- Preferences

DEPARTMENT ADMIN:

- Profile
- Department
- Notifications
- Security
- Drive Defaults
- Student Management Preferences

SUPER ADMIN:

- Profile
- Institution
- Departments
- Admin Management
- Notifications
- Drive Defaults
- Eligibility Configuration
- Recruitment Configuration
- Security
- System Configuration
- Audit/System Settings

==================================================
8. SETTINGS RULES
==================================================

Clearly distinguish:

- editable
- read-only
- role-restricted

Institution/security fields must not be editable by lower roles.

Use Clerk for authentication/security settings.

Do not create password settings in CampusHire.

==================================================
9. DEPARTMENT DRIVE DEFAULTS
==================================================

Department Admin defaults may include:

- venue
- reporting time
- coordinator
- contact
- instructions

These are DEFAULTS ONLY.

They must not:

- bypass drive field permissions
- modify published drives
- bypass lifecycle
- change another department's configuration

==================================================
10. AUDIT SENSITIVE SETTINGS
==================================================

Audit sensitive configuration changes.

Do not audit harmless UI preferences unnecessarily if the project convention doesn't require it.

==================================================
11. UI
==================================================

Use the existing settings/dashboard design language.

Provide:

- navigation
- sections
- forms
- validation
- save states
- error states
- read-only indicators
- permission states

Do not redesign the entire application.

FINAL REPORT:

Separate:

A. Admin invitation/security
B. Settings backend
C. Settings UI
D. Tests
E. Migration
F. Remaining issues