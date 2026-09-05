# CampusHire — Unit 04: Student Registration & Profile Management

You are continuing development of the CampusHire project.

## Current Status

Completed:

- Unit 01 — Project Setup ✅
- Unit 02 — Database & Student Foundation ✅
- Unit 03 — Authentication & Role Synchronization ✅

Now implement the complete:

# Unit 04 — Student Registration & Profile Management

Implement this as **ONE complete module**.

Do NOT split this into sub-units.

Do NOT proceed to Unit 05 or any drive/application functionality.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly inspect:

- all files inside `context/`
- `context/progress-tracker.md`
- all existing files inside `context/specs/`
- `prisma/schema.prisma`
- existing Unit 01 implementation
- existing Unit 02 implementation
- existing Unit 03 implementation
- Clerk/authentication utilities
- authorization utilities
- existing route groups
- existing `features/`
- existing `components/`
- existing `lib/`
- `package.json`
- existing tests

Treat the project context and existing implementation as the source of truth.

Do not invent requirements.

Preserve all existing functionality.

---

# 2. CREATE THE SPECIFICATION FIRST

Create:

`context/specs/04-student-registration-profile-management.md`

The specification must document:

1. Purpose
2. Scope
3. Student registration flow
4. Profile structure
5. Seven profile sections
6. Required fields
7. Validation rules
8. Profile completion calculation
9. Profile editing behavior
10. Student ownership rules
11. Authorization rules
12. Profile photo handling
13. Data persistence
14. Error handling
15. Out of scope
16. Open questions
17. Verification plan

Before implementing any field or rule, verify that it is supported by the existing context.

---

# 3. STUDENT REGISTRATION

Implement the student registration/onboarding flow using the existing Clerk authentication foundation.

The flow should support:

1. Student authenticates through Clerk.
2. Clerk verifies the student's email according to the existing authentication requirements.
3. The corresponding CampusHire `User` is identified/created according to Unit 03.
4. The student completes the required student information.
5. A corresponding `Student` record is created or completed.
6. The student can proceed to their profile.

Do NOT create a custom authentication mechanism.

Do NOT create custom OTP/password/session logic.

---

# 4. REGISTRATION SAFETY

A student must not be able to:

- create a Student record for another user
- assign themselves another role
- assign themselves to another department
- modify another student's profile
- bypass email verification
- create duplicate Student records

All ownership and authorization checks must happen server-side.

Never trust:

- hidden form fields
- client-side role values
- client-side user IDs
- client-side department IDs
- browser state

---

# 5. STUDENT PROFILE

Implement the complete student profile management experience using the seven defined sections:

1. Personal
2. Academic
3. Skills & Links
4. Projects
5. Experience
6. Certifications
7. Preferences

Use the database structures established during Unit 02.

Do not redesign the database unnecessarily.

---

# 6. PROFILE FIELDS

Use the existing project context to determine the exact fields and validation rules.

Do NOT invent unsupported requirements.

If the context does not define an exact field:

- inspect existing specifications for clarification
- if still undefined, document it as an Open Question
- do not silently invent a business requirement

The implementation must remain consistent with the project's defined profile requirements.

---

# 7. PROFILE EDITING

Students must be able to view and edit their own profile.

Implement appropriate server-side operations for:

- retrieving the authenticated student's profile
- updating profile information
- creating missing profile sections/records where appropriate
- updating existing profile sections
- adding/editing/removing repeatable profile entries where supported

Students must only be able to modify their own profile.

Do not create admin profile-editing functionality in this unit.

---

# 8. VALIDATION

Validate external input using the project's existing validation conventions.

Use Zod where appropriate.

Validation must happen server-side.

Client-side validation may be used for usability, but it must never replace server-side validation.

Validate:

- required fields
- field formats
- lengths
- URLs where applicable
- numeric values where applicable
- dates where applicable
- repeatable profile records
- uploaded files where applicable

Do not invent validation rules that are not supported by the project requirements.

---

# 9. PROFILE COMPLETION

Implement the defined CampusHire profile completion logic.

The rule is:

`Profile completion = required fields filled / total required fields`

The calculation is:

- a simple ratio
- not weighted
- based only on required fields

Do NOT introduce weighted scoring.

Do NOT introduce readiness scoring.

Do NOT create an unrelated student score.

The exact required-field checklist must come from the defined profile specification.

If the project context still does not define a particular required field clearly, document the ambiguity rather than inventing it.

---

# 10. PROFILE COMPLETION DISPLAY

Display the student's profile completion state in the student-facing profile experience.

The UI should make it clear:

- how complete the profile is
- which required information is missing
- what the student should complete next

Do not turn this into a readiness score.

Do not implement drive eligibility based on profile completion yet.

---

# 11. PROFILE PHOTO

Implement profile photo handling according to the existing architecture.

The project uses Vercel Blob for profile photos.

Requirements:

- validate uploaded files
- upload binary content to Vercel Blob
- store only the resulting URL/reference in PostgreSQL
- do not store image binary data in PostgreSQL

Follow the existing Blob helper architecture.

Do not expose secrets.

Do not hardcode Blob credentials.

If Blob configuration is unavailable, document the setup requirement rather than creating a fake storage implementation.

---

# 12. SERVER ACTIONS / DATA ACCESS

Follow the project's architecture.

Prefer server actions for mutations unless a route handler is genuinely required.

Keep:

- route files focused on composition
- business logic in the appropriate feature/lib layer
- validation close to the domain operation
- authorization server-side

Do not put business logic directly into page components.

---

# 13. STUDENT PROFILE UI

Implement the student-facing profile experience according to the existing UI context.

Follow the established CampusHire design system:

- light-only interface
- warm paper-like neutral surfaces
- terracotta primary accent
- existing theme tokens
- shadcn/ui components
- Tabler icons
- existing typography
- existing spacing/radius conventions

Use the established profile layout.

The seven profile sections should be easy to navigate.

Prefer the existing vertical/sticky profile-tab pattern where supported by the project context.

Do not introduce a new visual system.

---

# 14. PROFILE UX

The student should be able to:

- see their profile status
- navigate between sections
- edit information
- save changes
- understand validation errors
- identify missing required information
- upload/update their profile photo
- manage repeatable profile information where supported

Avoid unnecessary modals.

Use inline forms/cards where appropriate.

Follow the existing UI architecture.

---

# 15. PAGINATION

If any profile section contains a potentially long list of records, follow the project's pagination convention.

For list endpoints that can exceed a screenful:

- use offset pagination
- default `pageSize = 25`
- return:

`{ data, page, pageSize, totalCount }`

Do not introduce cursor pagination unless explicitly required.

---

# 16. AUTHORIZATION

Every profile operation must verify server-side:

1. authenticated Clerk session
2. CampusHire User
3. `STUDENT` role where student functionality is required
4. Student ownership

A student cannot access another student's data by modifying an ID in the request.

Do not rely solely on middleware.

Use the Unit 03 authorization helpers.

---

# 17. DATABASE

Only modify the Prisma schema if required to correctly support the profile functionality.

Do not introduce unrelated models.

Do not modify or implement:

- Drive
- DriveEligibility
- DriveApplication
- AuditLog
- Excel upload models
- notification models
- resume models
- AI models

unless an existing Unit 04 requirement explicitly requires a change.

If schema changes are required:

- create a proper Prisma migration
- run Prisma validation
- generate Prisma Client
- do not fabricate migrations

If the PostgreSQL/Neon database is not connected, do not claim the migration succeeded.

---

# 18. TESTING

Add focused Vitest tests for the core student registration/profile business logic.

At minimum, cover applicable cases for:

### Registration

- authenticated student can complete registration
- duplicate Student creation is prevented
- unauthorized user cannot create a Student for another user

### Profile

- student can retrieve their own profile
- student can update their own profile
- student cannot update another student's profile
- invalid profile data is rejected
- required fields are handled correctly

### Completion

- completion calculation uses required fields
- completion is a simple ratio
- completion is not weighted
- missing required fields reduce completion appropriately
- fully completed required fields result in 100%

### Profile Photo

Test validation and business logic that can be tested without requiring real Vercel Blob infrastructure.

Mock external services where appropriate.

---

# 19. ENVIRONMENT VARIABLES

Follow the existing centralized environment validation in:

`lib/env.ts`

Do not access `process.env` directly throughout application code.

If new variables are required:

- add them to centralized validation
- document them
- do not hardcode secrets

---

# 20. ERROR HANDLING

Handle common cases cleanly:

### Unauthenticated

Reject or redirect according to the existing application architecture.

### Wrong role

Reject access.

### Missing Student record

Handle safely and direct the student through the appropriate onboarding state.

### Invalid input

Return/display useful validation errors.

### Unauthorized ownership

Reject the operation.

### Storage failure

Do not save an invalid profile-photo reference.

Do not expose sensitive implementation details.

Follow existing project conventions.

---

# 21. VERIFICATION

Run all appropriate checks:

- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run lint`
- Vitest
- `npm run build`

Also manually verify the main student registration/profile flow where possible.

Fix issues introduced by Unit 04.

Do not hide unrelated pre-existing failures.

---

# 22. UPDATE PROGRESS TRACKER

Update:

`context/progress-tracker.md`

Record:

- Unit 04 completion
- registration flow
- profile functionality
- seven profile sections
- validation
- profile completion logic
- profile photo/storage
- authorization
- server actions/data access
- UI
- tests
- verification
- migration status
- open questions
- deferred functionality

Set the next module according to the existing project roadmap/context.

Do NOT implement the next module.

---

# 23. STRICT OUT-OF-SCOPE

Do NOT implement:

- drive posting
- drive management
- drive eligibility
- student applications
- application tracking
- Excel/CSV bulk import
- department admin student management
- super-admin department management
- admin account management
- audit logging
- notifications
- resume builder
- resume PDF storage
- AI resume analyzer
- AI scoring
- readiness scoring
- payments
- multi-college support
- native mobile app

This unit is ONLY:

**Student Registration + Student Profile Management + Profile Completion + Profile Photo**

---

# 24. IMPORTANT EXECUTION ORDER

Execute this module in this order:

1. Read all context
2. Inspect Units 01–03
3. Create Unit 04 specification
4. Resolve requirements from existing context
5. Implement registration/onboarding
6. Implement profile data access
7. Implement profile validation
8. Implement profile editing
9. Implement profile completion
10. Implement profile photo handling
11. Implement student profile UI
12. Add tests
13. Run Prisma/type/lint/test/build verification
14. Update progress tracker
15. STOP

Do NOT proceed to the next module.

---

# FINAL REPORT

When finished, provide:

## Registration

- registration flow
- Clerk integration
- Student creation
- ownership/security

## Profile

- seven sections implemented
- fields implemented
- validation
- editing behavior

## Completion

- calculation method
- required-field handling
- UI display

## Profile Photo

- validation
- Blob upload
- database reference

## Authorization

- authentication checks
- student ownership checks

## Files

- created
- modified

## Database

- schema changes
- migration status

## Tests

- tests added
- results

## Verification

- Prisma
- TypeScript
- ESLint
- Vitest
- Build

## Open Questions

List only genuinely unresolved requirements.

## Scope Confirmation

Explicitly confirm:

**No drive, application, Excel import, admin-management, or later module was implemented.**