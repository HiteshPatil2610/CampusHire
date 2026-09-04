# CampusHire — Unit 03: Authentication & Role Synchronization

You are continuing development of the CampusHire project.

## Current Status

Completed:

* Unit 01 — Project Setup ✅
* Unit 02 — Database & Student Foundation ✅

Now implement the complete:

# Unit 03 — Authentication & Role Synchronization

Implement this as ONE complete module.

Do NOT split it into sub-units and do NOT proceed to Unit 04.

---

# 1. READ THE PROJECT CONTEXT

Before making any changes, thoroughly inspect:

* all files inside `context/`
* `context/progress-tracker.md`
* all existing specifications inside `context/specs/`
* `prisma/schema.prisma`
* `middleware.ts`
* existing Clerk configuration
* existing route groups
* existing `lib/` utilities
* existing authentication-related code
* `package.json`
* all work completed in Units 01 and 02

Treat the existing project context and implementation as the source of truth.

Do not invent requirements.

Preserve all existing working functionality.

---

# 2. CREATE THE SPECIFICATION

Create:

`context/specs/03-authentication-role-synchronization.md`

The specification must document:

1. Purpose
2. Scope
3. Authentication architecture
4. Clerk responsibilities
5. CampusHire responsibilities
6. College email verification
7. User synchronization
8. Role synchronization
9. Department scope
10. Middleware responsibilities
11. Server-side authorization
12. Authentication invariants
13. Error/unauthorized behavior
14. Out of scope
15. Open questions
16. Verification plan

---

# 3. AUTHENTICATION ARCHITECTURE

Use **Clerk** as the authentication provider.

Clerk is responsible for:

* authentication
* identity
* sessions
* email verification
* OTP/email verification flow
* sign-in/sign-up authentication state

CampusHire must NOT implement its own:

* password system
* session system
* OTP system
* password reset system
* authentication token system

Do not duplicate functionality already provided by Clerk.

---

# 4. COLLEGE EMAIL VERIFICATION

Implement the college-email requirement using Clerk's supported verification mechanisms and the existing project requirements.

The system must ensure that student registration uses a valid college email address.

Do not implement custom OTP logic.

Do not bypass Clerk email verification.

If the exact college email domain is not defined in the existing context:

* do not invent one
* document it as an Open Question
* implement the verification architecture without hardcoding an unsupported domain

---

# 5. CLERK USER ↔ CAMPUSHIRE USER

Implement the synchronization between Clerk identity and the application's `User` model.

The existing database contains the CampusHire `User` entity.

Ensure authenticated users can be correctly associated with their CampusHire application record.

The synchronization must be safe and idempotent.

Do not create duplicate CampusHire users for the same Clerk identity.

Use the existing unique Clerk identity constraint.

---

# 6. ROLE HANDLING

CampusHire has these roles:

* `STUDENT`
* `DEPT_ADMIN`
* `SUPER_ADMIN`

The application role must come from the CampusHire authorization model.

Do not trust a client-provided role.

Never authorize privileged actions using values supplied directly by the browser.

For protected operations, retrieve and verify the authenticated user's role server-side.

---

# 7. DEPARTMENT SCOPE

Department administrators are restricted to their own department.

The existing database relationship is:

`DepartmentAdmin → Department`

Implement the authentication/authorization helpers necessary to establish the authenticated admin's department scope.

A department admin must never be able to access another department's resources simply by changing:

* URL parameters
* query parameters
* request body values
* IDs
* client-side state

Department scope must be enforced server-side.

---

# 8. AUTHORIZATION HELPERS

Create appropriate reusable server-side authorization utilities inside the existing architecture.

Use the existing `lib/` structure.

Helpers should support the application's authorization requirements, such as:

* obtaining the authenticated CampusHire user
* requiring authentication
* requiring a specific role
* requiring one of multiple allowed roles
* obtaining department scope for a department admin
* rejecting unauthorized access

Keep these helpers small and composable.

Do not create unnecessary abstractions.

---

# 9. MIDDLEWARE

Review and implement `middleware.ts`.

Middleware should be responsible for:

* Clerk session handling
* protecting authentication-required route groups where appropriate
* allowing public routes where appropriate

Middleware must NOT become the primary location for:

* database authorization
* department/resource checks
* business rules
* eligibility checks
* ownership checks

Those checks must remain server-side within the relevant application logic.

Follow the architecture defined in the project context.

---

# 10. ROUTE PROTECTION

Use the existing route groups:

* `(auth)`
* `(student)`
* `(admin)`
* `(super-admin)`
* `api`

Ensure protected sections require an authenticated Clerk session.

Ensure role-restricted areas cannot be accessed by users with the wrong application role.

Do not implement dashboards or feature pages yet.

Only establish the authentication/authorization foundation required by this unit.

---

# 11. ROLE SYNCHRONIZATION

If the project context requires Clerk metadata to contain application role information, implement the synchronization using Clerk's supported metadata mechanisms.

However:

* database authorization remains authoritative
* never trust client-side metadata for privileged authorization
* never allow a user to self-promote their role
* never allow a student to modify their own role

If the exact Clerk metadata synchronization mechanism is not defined in the context, use the safest supported architecture and document the decision in the specification.

---

# 12. ADMIN ACCESS

Department admins and super admins must be handled according to the existing database model.

### Department Admin

Must:

* have role `DEPT_ADMIN`
* have an associated `DepartmentAdmin` record
* be scoped to exactly one department

If a `DEPT_ADMIN` user has no valid department association, privileged department access must be rejected.

### Super Admin

Must:

* have role `SUPER_ADMIN`
* not require department ownership

Do not implement super-admin management functionality yet.

---

# 13. STUDENT ACCESS

Students must:

* authenticate through Clerk
* have role `STUDENT`
* be associated with the correct CampusHire User
* be associated with their Student record when available

Do not implement the complete student registration/profile workflow yet.

Only establish the authentication foundation.

---

# 14. SERVER-SIDE SECURITY

All authorization decisions must be server-side.

Never rely on:

* hidden form fields
* disabled UI buttons
* frontend role checks
* URL structure alone
* client-side state
* Clerk client metadata alone

The UI may hide unavailable actions for usability, but the server must independently enforce access.

---

# 15. ERROR HANDLING

Implement consistent handling for:

### Unauthenticated user

Return/redirect according to the existing application architecture.

### Authenticated but wrong role

Reject access.

### Department admin without valid department scope

Reject privileged access.

### Missing CampusHire User

Handle the condition safely rather than assuming the database record exists.

Do not expose sensitive implementation details in user-facing errors.

Follow existing project conventions.

---

# 16. WEBHOOKS / SYNCHRONIZATION

Inspect the existing context to determine whether Clerk webhooks are required.

If required by the defined architecture, implement only the necessary synchronization.

If not required, do not introduce unnecessary webhook infrastructure.

Do not build unrelated user lifecycle features.

---

# 17. DATABASE CHANGES

Only modify Prisma/database structures if strictly required for the authentication synchronization defined in this unit.

Do not add unrelated models.

Do not modify:

* Drive
* DriveEligibility
* DriveApplication
* AuditLog
* Excel upload models
* notification models
* resume models
* AI models

unless explicitly required by the existing Unit 03 specification/context.

If a migration is required:

* use the normal Prisma migration workflow
* do not fabricate migration files
* do not claim migration success without a working database connection

---

# 18. TESTING

Add focused Vitest tests for authentication/authorization logic.

At minimum cover applicable cases such as:

* unauthenticated access is rejected
* authenticated student access
* wrong-role access is rejected
* department admin access
* department admin department scope
* department admin cannot cross department boundaries
* super-admin authorization
* missing CampusHire user handling
* invalid/missing DepartmentAdmin relationship handling

Tests must focus on business authorization logic rather than Clerk internals.

Mock external Clerk behavior where appropriate.

Do not make tests depend on a real production Clerk account.

---

# 19. ENVIRONMENT VARIABLES

Follow the existing `lib/env.ts` architecture.

Do not access `process.env` directly throughout application code.

If Unit 03 requires new environment variables:

* add them to the centralized environment validation
* document them
* update relevant setup documentation if required

Do not hardcode secrets.

Never commit credentials.

---

# 20. CODE STANDARDS

Follow all existing CampusHire standards:

* strict TypeScript
* no `any`
* no unsafe casts
* no unnecessary abstractions
* Zod for external input where validation is required
* server-side authorization
* route files remain composition-focused
* preserve existing architecture
* preserve Units 01 and 02
* use existing theme/components
* do not introduce unrelated dependencies

---

# 21. VERIFICATION

Run all appropriate checks available in the repository:

* Prisma validation
* Prisma generation if schema changed
* TypeScript
* ESLint
* Vitest
* `npm run build`

Also manually verify the authentication/authorization paths that can be tested locally.

Fix problems introduced by Unit 03.

Do not hide unrelated pre-existing failures.

---

# 22. UPDATE PROGRESS TRACKER

Update:

`context/progress-tracker.md`

Record:

* Unit 03 completion
* authentication architecture
* Clerk integration
* User synchronization
* role authorization
* department scope enforcement
* middleware changes
* authorization helpers
* tests
* verification results
* environment/config changes
* migration status if applicable
* open questions
* deferred functionality

Set the next unit to the next feature defined by the existing project roadmap/context.

Do NOT implement that next unit.

---

# 23. STRICT OUT-OF-SCOPE

Do NOT implement:

* student dashboard
* admin dashboard
* super-admin dashboard
* student registration UI beyond what is strictly required for authentication foundation
* complete student profile UI
* profile completion
* drive management
* drive eligibility
* applications
* Excel/CSV import
* audit logging
* notifications
* resume functionality
* AI functionality
* readiness scoring
* payments
* multi-college support
* native mobile application

This unit is ONLY:

**Authentication + User Synchronization + Role Authorization + Department Scope Foundation**

---

# 24. IMPORTANT EXECUTION ORDER

Execute this unit in this order:

1. Read all context
2. Inspect existing Unit 01 and Unit 02 implementation
3. Create Unit 03 specification
4. Implement Clerk authentication foundation
5. Implement CampusHire User synchronization
6. Implement role authorization
7. Implement department scope authorization
8. Update middleware
9. Implement reusable authorization helpers
10. Add focused tests
11. Run Prisma/type/lint/test/build verification
12. Update progress tracker
13. Stop

Do NOT proceed to the next unit.

---

# FINAL REPORT

When finished, provide:

## Authentication

* Clerk integration status
* verification flow status
* authentication protection

## User Synchronization

* Clerk ↔ CampusHire User behavior
* duplicate prevention
* missing-user handling

## Authorization

* roles
* role enforcement
* department scope enforcement
* super-admin behavior

## Middleware

* routes protected
* middleware responsibilities

## Files

* created
* modified

## Database

* schema changes
* migration status

## Tests

* tests added
* results

## Verification

* Prisma
* TypeScript
* ESLint
* Vitest
* Build

## Open Questions

List only genuinely unresolved requirements.

## Scope Confirmation

Explicitly confirm:

**No Unit 04 or later feature was implemented.**
