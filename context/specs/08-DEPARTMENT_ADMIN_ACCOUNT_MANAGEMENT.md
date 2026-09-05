UNIT 08 — DEPARTMENT & ADMIN ACCOUNT MANAGEMENT

You are continuing development of the CampusHire project.

IMPORTANT:
- Read ALL files inside `context/` before making changes.
- Read the existing implementation and completed Units 01–07.
- Unit 07 Excel/CSV production implementation is currently deferred, but its database/specification changes are intentional and must be preserved.
- Do NOT redo completed work.
- Do NOT split this task into sub-units.
- Implement the entire Unit 08 as one cohesive module.
- Follow the existing CampusHire architecture, security model, database design, UI system, and coding conventions.
- Do not invent unsupported requirements.
- If something is genuinely unspecified, implement the smallest safe behavior and document the assumption.

==================================================
UNIT 08 — DEPARTMENT & ADMIN ACCOUNT MANAGEMENT
==================================================

PRIMARY OBJECTIVE

Implement administrative management for:

1. Departments
2. Department Admin accounts
3. Department Admin ↔ Department assignment
4. Super Admin authorization
5. Strict department-level access control

The goal is to provide the administrative foundation required for CampusHire while preserving the project's security invariant:

ROLE + DEPARTMENT SCOPE MUST ALWAYS BE VERIFIED SERVER-SIDE.

==================================================
1. CREATE SPECIFICATION
==================================================

Create:

`context/specs/08-department-admin-management.md`

Document:

- department management
- department admin management
- role requirements
- department assignment rules
- authorization model
- lifecycle of departments
- admin account lifecycle
- active/inactive behavior
- student/drive/application scope implications
- validation
- error handling
- database behavior
- UI behavior
- tests
- assumptions/open questions

The specification must match the actual implementation.

==================================================
2. READ EXISTING DATABASE FIRST
==================================================

Before modifying Prisma:

Inspect the existing models from Units 02–07.

Important existing concepts include:

- Role
- User
- Department
- DepartmentAdmin
- Student
- Drive
- DriveApplication
- AuditLog
- pending student registration pattern from Unit 07

Do NOT recreate existing models.

Do NOT duplicate department relationships.

Do NOT remove the Unit 07 pending-student schema changes.

Preserve:

- Student.userId optional
- Student.email
- Student.isPending

unless the existing implementation has already evolved in a compatible way.

==================================================
3. DEPARTMENT MODEL
==================================================

Use the existing Department model.

A department should have the fields already established by the CampusHire schema, including its:

- name
- code
- active/inactive state
- timestamps

Do not invent additional department fields unless explicitly required by existing context.

Department code must remain unique.

==================================================
4. DEPARTMENT ADMIN MODEL
==================================================

Use the existing `DepartmentAdmin` relationship.

The intended relationship is:

Department
    ↓
DepartmentAdmin
    ↓
User

A Department Admin belongs to one department.

A department may have multiple Department Admins if supported by the existing schema.

Do not introduce unnecessary role duplication.

The user's global role remains:

`DEPT_ADMIN`

Department membership/scope comes from:

`DepartmentAdmin`

Do NOT use a department ID stored only in Clerk metadata as the authoritative authorization source.

The database relationship is authoritative.

==================================================
5. SUPER ADMIN AUTHORIZATION
==================================================

Department and Department Admin management is a privileged operation.

Only:

`SUPER_ADMIN`

may manage departments and Department Admin assignments unless the existing context explicitly states otherwise.

A:

- STUDENT
- DEPT_ADMIN
- unauthenticated user

must not be able to perform Super Admin management operations.

Authorization must be checked server-side.

Never trust:
- client role
- hidden form fields
- URL parameters
- request body role
- UI visibility

==================================================
6. DEPARTMENT CRUD
==================================================

Implement the department management operations supported by the existing context.

At minimum, provide safe operations for:

- create department
- list departments
- view department
- update department
- activate/deactivate department

Do NOT implement hard deletion unless the existing context explicitly requires it.

Prefer deactivation over destructive deletion because departments may be referenced by:

- students
- drives
- department admins
- applications
- historical records

A department with existing related records should not be destructively deleted.

==================================================
7. DEPARTMENT CREATION
==================================================

Create a department using validated server-side input.

Validate:

- department name
- department code
- active state where applicable

Use Zod.

Department code must be normalized consistently according to existing project conventions.

Duplicate department codes must be rejected safely.

Do not expose raw Prisma unique constraint errors.

==================================================
8. DEPARTMENT UPDATE
==================================================

Allow Super Admin to update supported department fields.

Do not allow arbitrary database fields to be modified.

Be careful when changing:

- department code
- active state

Do not break existing student/admin/drive relationships.

If code changes are allowed, ensure uniqueness.

If the existing context does not clearly define which fields are editable, implement the smallest safe set and document the decision.

==================================================
9. DEPARTMENT ACTIVE/INACTIVE
==================================================

Implement the existing active/inactive concept.

Deactivating a department must NOT silently delete:

- students
- drives
- applications
- admin accounts
- historical data

Do not cascade destructive deletion.

The effect of an inactive department on:
- student registration
- drive creation
- admin access

must follow existing project rules.

If the existing context does not define behavior for one of these cases, document the open question instead of inventing a broad workflow.

==================================================
10. DEPARTMENT ADMIN MANAGEMENT
==================================================

Implement Super Admin management of Department Admin assignments.

Supported operations should include the minimum required lifecycle:

- view department admins
- assign a User as Department Admin
- assign Department Admin to a department
- change department assignment where appropriate
- remove/deactivate department-admin assignment where appropriate

Do NOT create a second authentication system.

Clerk remains responsible for:
- authentication
- identity
- verification
- session

CampusHire remains responsible for:
- application role
- department scope

==================================================
11. ADMIN ASSIGNMENT RULES
==================================================

A Department Admin must:

- have a CampusHire User record
- have role `DEPT_ADMIN`
- have a valid DepartmentAdmin relationship
- belong to exactly one department

Do not allow:

`DEPT_ADMIN + no department scope`

to become a usable Department Admin.

A department admin's department must be resolved server-side.

==================================================
12. SUPER ADMIN ASSIGNMENT SAFETY
==================================================

Do not accidentally downgrade or overwrite a Super Admin through Department Admin management.

If a User has:

`SUPER_ADMIN`

they must not be assigned as a normal Department Admin unless the existing architecture explicitly supports multi-role users.

Follow the existing single-role model.

Do not invent multi-role authorization.

==================================================
13. ROLE CHANGES
==================================================

If the project context supports changing a user's role:

Implement only the explicitly supported role transitions.

At minimum, protect against invalid states such as:

- DEPT_ADMIN without DepartmentAdmin
- STUDENT with DepartmentAdmin
- SUPER_ADMIN unintentionally assigned to a department

When changing from:

`DEPT_ADMIN → STUDENT`

or another role that invalidates DepartmentAdmin membership, handle the associated relationship safely.

If role-changing is not explicitly defined in the existing context, do not create a generic role-management interface.

Instead, implement only the Department Admin assignment workflow needed by the existing system.

Document the decision.

==================================================
14. DEPARTMENT ADMIN DEACTIVATION
==================================================

If Department Admin removal/deactivation is supported:

Do not delete the underlying Clerk user.

Do not delete the CampusHire User merely because the admin assignment ended.

Instead, safely remove/deactivate the department-admin relationship according to the existing schema.

The authentication identity remains owned by Clerk.

==================================================
15. DEPARTMENT ADMIN SCOPE
==================================================

After this module, every Department Admin operation across CampusHire must continue to follow:

Authenticated User
        ↓
CampusHire User
        ↓
DEPT_ADMIN role
        ↓
DepartmentAdmin relationship
        ↓
Department
        ↓
Resource query scoped to that department

Never:

Authenticated User
        ↓
Client-provided departmentId
        ↓
Database query

The latter is forbidden.

==================================================
16. SECURITY — CROSS-DEPARTMENT PROTECTION
==================================================

Explicitly test and enforce:

Department Admin A cannot:

- view Department B's students
- modify Department B's students
- view Department B's drives
- modify Department B's drives
- access Department B's uploads
- access Department B's applications
- change their own scope to Department B

This module should establish reusable authorization helpers where appropriate.

Do not scatter duplicated department checks across the application.

Use the existing `lib/permissions.ts` or equivalent authorization infrastructure where appropriate.

==================================================
17. REUSABLE AUTHORIZATION HELPERS
==================================================

Create or extend reusable server-side authorization helpers where appropriate.

Examples of conceptual responsibilities:

- requireSuperAdmin()
- requireDepartmentAdmin()
- getCurrentDepartmentAdmin()
- requireDepartmentAccess(departmentId)
- requireDepartmentResourceAccess(resource)

Use project-consistent naming.

Do not create redundant helper systems.

Authorization helpers must:
- resolve current Clerk identity
- resolve CampusHire User
- verify role
- resolve department scope
- reject unauthorized access safely

==================================================
18. SERVER ACTIONS / DATA ACCESS
==================================================

Business logic must remain outside UI and route components.

Use appropriate feature structure under:

`features/departments/`

and:

`features/admin-accounts/`

Use:
- server actions
- data-access functions
- validation
- authorization helpers

according to the existing architecture.

Route/page files must remain composition-only.

Do NOT put Prisma queries directly inside React pages.

==================================================
19. DEPARTMENT LIST
==================================================

Implement a Super Admin department list.

If the list can exceed one screenful, use offset pagination.

Use the project's standard:

- default pageSize = 25
- page
- pageSize
- totalCount
- data

Return:

{
  data,
  page,
  pageSize,
  totalCount
}

Support useful filtering only where already supported by context.

Do not add unnecessary advanced search/filter systems.

==================================================
20. DEPARTMENT ADMIN LIST
==================================================

Implement a Super Admin view of Department Admin assignments.

Where appropriate show:

- admin/user identity information already supported by the model
- assigned department
- active state

Do not expose unnecessary Clerk/private information.

If pagination is required, use the standard pagination format.

==================================================
21. ADMIN UI
==================================================

Implement the Super Admin UI using the existing CampusHire design system.

Use:

- existing theme tokens
- existing shadcn/ui components
- Tabler icons
- existing typography
- existing spacing
- existing app shell

Do NOT introduce a new design language.

Provide appropriate:

- loading states
- empty states
- validation errors
- success feedback
- permission errors

Avoid unnecessary modal-heavy interfaces.

Use existing patterns where available.

==================================================
22. DEPARTMENT UI
==================================================

The Super Admin should have a clear department-management interface.

Include only supported actions:

- create
- view/list
- edit
- activate/deactivate

Do not add unsupported features.

Make destructive-looking actions explicit.

For deactivation, communicate the consequences without deleting historical data.

==================================================
23. ADMIN ASSIGNMENT UI
==================================================

Provide a clear workflow for assigning a Department Admin.

Conceptually:

Select existing CampusHire User
        ↓
Verify user eligibility for DEPT_ADMIN
        ↓
Select Department
        ↓
Server validates
        ↓
Create/update DepartmentAdmin

Do not allow the client to assign arbitrary Clerk IDs without verifying the corresponding CampusHire User.

Do not create a fake user.

==================================================
24. VALIDATION
==================================================

Use Zod for all external input.

Validate:

- department ID
- department name
- department code
- user ID
- pagination
- active state
- supported filters

Reject malformed identifiers.

Reject missing required values.

Reject duplicate department codes.

Reject invalid admin assignments.

Never trust client-supplied role/department scope.

==================================================
25. ERROR HANDLING
==================================================

Provide safe errors for:

- unauthenticated
- insufficient role
- invalid department
- invalid user
- department not found
- duplicate department code
- invalid admin assignment
- department admin already assigned
- unauthorized cross-department access
- inactive department where relevant
- database constraint conflicts

Never expose:
- SQL
- Prisma stack traces
- internal exception objects
- secrets
- Clerk credentials

==================================================
26. DATABASE INTEGRITY
==================================================

Respect existing database constraints.

Important invariants:

- Department.code unique.
- User role must represent the user's CampusHire role.
- DepartmentAdmin assignment must correspond to a valid User.
- A Department Admin must have one valid department.
- Avoid duplicate DepartmentAdmin assignments.
- Do not create orphaned relationships.

Use transactions when multiple related records must change together.

==================================================
27. CLERK INTEGRATION
==================================================

Do not replace Clerk authentication.

Do not implement:

- passwords
- custom sessions
- custom OTP
- authentication credentials
- fake Clerk identities

If Clerk metadata needs synchronization for role display/routing, follow the existing Unit 03 architecture.

Database authorization remains authoritative.

Do not use Clerk metadata as the sole department authorization source.

==================================================
28. UNIT 07 COMPATIBILITY
==================================================

Preserve the Unit 07 pending student pattern.

Do NOT break:

- Student.userId optional
- Student.email unique
- Student.isPending

Department management must remain compatible with bulk-imported pending students.

Do not force every pending student to have a Clerk User.

Do not create Clerk users as a side effect of department creation/admin management.

==================================================
29. STUDENT/DRIVE COMPATIBILITY
==================================================

Do not rewrite Student, Drive, or DriveApplication functionality.

This module should only provide the department/admin management foundation required by those features.

Verify that existing department-scoped queries continue to work.

Do not introduce cross-module regressions.

==================================================
30. AUDIT LOGGING
==================================================

Do NOT implement the complete audit logging system in Unit 08.

If an existing audit helper already exists and the architecture requires admin management actions to call it, integrate with it.

Otherwise leave full audit logging for Unit 09.

Do not create a second audit logging mechanism.

Document any audit integration decision.

==================================================
31. TESTING
==================================================

Add focused Vitest tests.

At minimum test:

DEPARTMENT:

1. Super Admin can create a department.
2. Non-Super Admin cannot create a department.
3. Duplicate department code is rejected.
4. Department update works.
5. Department activation/deactivation works.
6. Department deletion is not exposed unless explicitly required.
7. Invalid department input is rejected.
8. Department list pagination works.

ADMIN:

9. Super Admin can assign a valid User as Department Admin.
10. Student cannot be assigned as Department Admin if role rules forbid it.
11. Super Admin assignment remains protected.
12. Duplicate DepartmentAdmin assignment is rejected.
13. Department Admin has exactly one department scope.
14. Invalid user ID is rejected.
15. Invalid department ID is rejected.
16. Department Admin removal/deactivation works if supported.
17. Removing admin assignment does not delete the Clerk identity.

SECURITY:

18. Unauthenticated user cannot manage departments.
19. Student cannot manage departments.
20. Department Admin cannot create/update departments unless explicitly authorized.
21. Department Admin cannot change their own department scope.
22. Department Admin cannot access another department.
23. Client-supplied department ID cannot bypass server-side scope.
24. Invalid role/department combinations are rejected.

REGRESSION:

25. Existing student functionality still passes.
26. Existing drive functionality still passes.
27. Existing application functionality still passes.
28. Existing Unit 07 schema/test behavior still passes.

Use mocks/test doubles where external services are involved.

Do NOT create E2E tests unless explicitly requested.

==================================================
32. DATABASE MIGRATION
==================================================

Inspect the current migration state.

The Unit 07 report says:

Migration pending because PostgreSQL/Neon connection was unavailable.

Do NOT assume that migration has since happened.

Before making changes:

- inspect migration status
- inspect current schema
- determine whether the database is reachable

If database is available:
- create/apply required migration
- verify migration successfully

If database is unavailable:
- validate schema
- generate Prisma client
- clearly report migration pending

Never fake migration success.

==================================================
33. ENVIRONMENT
==================================================

Continue using:

`lib/env.ts`

for environment validation.

Do not access `process.env` directly throughout feature code.

Do not add unnecessary environment variables.

==================================================
34. PERFORMANCE
==================================================

Avoid unnecessary database queries.

For department/admin lists:
- use appropriate Prisma relations
- use pagination
- avoid loading entire datasets unnecessarily

Do not implement premature caching.

Correct authorization is more important than micro-optimizations.

==================================================
35. STRICT OUT OF SCOPE
==================================================

DO NOT implement:

- Excel/CSV production implementation
- audit logging system
- notifications
- email campaigns
- resume builder
- AI resume analysis
- interview scheduling
- placement outcome management
- payments
- multi-college tenancy
- mobile application
- application withdrawal
- application editing
- unrelated dashboards
- unrelated reporting/analytics

Unit 07 remains deferred as previously decided.

==================================================
36. DOCUMENTATION
==================================================

Update:

`context/progress-tracker.md`

Record:

- Unit 08 status
- files created/modified
- department management behavior
- DepartmentAdmin behavior
- authorization model
- security protections
- tests
- migration status
- TypeScript status
- lint status
- build status
- assumptions/open questions

Ensure:

`context/specs/08-department-admin-management.md`

matches the final implementation.

==================================================
37. FINAL SECURITY REVIEW
==================================================

Before declaring Unit 08 complete, explicitly review all Department Admin database queries.

Verify that a Department Admin's department comes from:

`DepartmentAdmin → Department`

and NOT from:

- URL
- query parameter
- request body
- local storage
- client state
- Clerk metadata alone

Check for IDOR vulnerabilities.

Test manipulated requests manually/unit-level where appropriate.

==================================================
38. FINAL VERIFICATION
==================================================

Before declaring Unit 08 complete:

[ ] Specification created.
[ ] Department management implemented.
[ ] DepartmentAdmin management implemented.
[ ] Super Admin authorization enforced.
[ ] Department Admin authorization enforced.
[ ] Department code uniqueness enforced.
[ ] Department activation/deactivation works.
[ ] Destructive department deletion is not exposed unless explicitly required.
[ ] Admin assignment is validated.
[ ] Admin has exactly one department scope.
[ ] Invalid role/department combinations rejected.
[ ] Cross-department access blocked.
[ ] Client department ID cannot override server scope.
[ ] Clerk remains authentication authority.
[ ] Database remains authorization authority.
[ ] Unit 07 pending-student pattern preserved.
[ ] Existing Units 01–06 behavior remains intact.
[ ] Vitest tests pass.
[ ] TypeScript passes.
[ ] ESLint passes.
[ ] Production build passes.
[ ] Prisma validation passes.
[ ] Prisma generation passes.
[ ] Migration status accurately reported.
[ ] Progress tracker updated.
[ ] No out-of-scope functionality added.

==================================================
EXECUTION ORDER
==================================================

Execute in this order:

1. Read all context.
2. Read completed Units 01–07.
3. Inspect current Prisma schema and migration state.
4. Create Unit 08 specification.
5. Inspect existing authorization helpers.
6. Implement/extend department management.
7. Implement/extend DepartmentAdmin management.
8. Implement Super Admin authorization.
9. Implement reusable department-scope authorization helpers.
10. Implement server actions/data-access.
11. Implement pagination.
12. Implement Super Admin UI.
13. Add validation.
14. Add security tests.
15. Run existing regression tests.
16. Run Prisma validation/generation.
17. Run migration if database is available.
18. Run TypeScript.
19. Run ESLint.
20. Run complete Vitest suite.
21. Run production build.
22. Update progress tracker.
23. Perform final cross-department security review.
24. Review final diff for scope violations.

==================================================
FINAL RESPONSE
==================================================

When finished, report:

- Unit 08 completion status
- files created/modified
- department management implemented
- DepartmentAdmin management implemented
- authorization/security model
- cross-department protection
- Unit 07 compatibility
- tests added and results
- Prisma/migration status
- TypeScript/lint/build status
- assumptions/open questions
- exact next recommended module

IMPORTANT:
Do not claim something passed unless it was actually executed.
Do not claim database migration succeeded if PostgreSQL/Neon was unavailable.
Do not silently expand the scope.