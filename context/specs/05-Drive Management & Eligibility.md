# CampusHire — Unit 05: Drive Management & Eligibility

You are continuing development of the CampusHire project.

## Current Status

Completed:

- Unit 01 — Project Setup ✅
- Unit 02 — Database & Student Foundation ✅
- Unit 03 — Authentication & Role Synchronization ✅
- Unit 04 — Student Registration & Profile Management ✅

Now implement the complete:

# Unit 05 — Drive Management & Eligibility

Implement this as **ONE complete module**.

Do NOT split this into sub-units.

Do NOT proceed to applications or Excel/CSV bulk import.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making changes, thoroughly inspect:

- all files inside `context/`
- `context/progress-tracker.md`
- all existing `context/specs/`
- `prisma/schema.prisma`
- Units 01–04 implementations
- authentication/authorization utilities
- Student models/profile logic
- existing `features/`
- existing `lib/`
- existing UI components
- existing route groups
- existing tests
- `package.json`

Treat the existing project context as the source of truth.

Do not invent requirements.

Preserve all completed functionality.

---

# 2. CREATE THE SPECIFICATION

Create:

`context/specs/05-drive-management-eligibility.md`

Document:

1. Purpose
2. Scope
3. Drive model
4. Drive fields
5. Drive lifecycle
6. Eligibility rules
7. Drive eligibility data model
8. Department scope
9. Admin permissions
10. Student drive visibility
11. Drive status calculation
12. Validation
13. Authorization
14. Pagination
15. Error handling
16. Out of scope
17. Open questions
18. Verification plan

---

# 3. DRIVE MODEL

Implement the `Drive` model according to the existing CampusHire requirements.

Use only fields explicitly supported by the project context.

Do not invent additional business fields.

The model must support the information required for a placement drive, including its application deadline and eligibility requirements where defined.

---

# 4. DRIVE STATUS

A Drive must **NOT store a status field**.

Status must be calculated dynamically using the shared:

`getDriveStatus(applicationDeadline)`

utility.

Use this utility consistently wherever drive status is displayed or evaluated.

Do not duplicate date/status logic.

---

# 5. DRIVE LIFECYCLE

Implement the defined drive lifecycle using the project requirements.

Drive status must be derived from the application deadline rather than stored permanently.

Ensure date handling is consistent and timezone-safe.

Do not invent additional statuses unless the existing context explicitly defines them.

---

# 6. DRIVE ELIGIBILITY

Implement server-side drive eligibility.

Eligibility must be determined using the requirements defined in the project context.

Do not rely on the client to decide whether a student is eligible.

A student must only see/apply to drives for which the server determines they are eligible.

Keep eligibility logic reusable and testable.

---

# 7. ELIGIBILITY DATA MODEL

If the project context requires a `DriveEligibility` model, implement it.

Use appropriate relations to:

- Drive
- Department and/or other explicitly defined eligibility dimensions

Do not create speculative eligibility tables.

Do not introduce eligibility criteria that are not defined in the project requirements.

---

# 8. STUDENT DRIVE LIST

Implement the student-facing drive listing.

The server must return **only eligible drives**.

Do not:

1. fetch every drive
2. send all drives to the browser
3. filter eligibility in React

Eligibility filtering must happen server-side as part of the data query/business logic.

---

# 9. STUDENT SECURITY

A student must not be able to access an ineligible drive by manually changing:

- drive ID
- URL
- query parameters
- request body
- client-side state

Any student drive detail/access operation that requires eligibility must re-check eligibility server-side.

---

# 10. DEPARTMENT ADMIN DRIVE MANAGEMENT

Department admins can manage drives according to the existing requirements.

Every department-admin drive operation must verify:

- authenticated user
- `DEPT_ADMIN` role
- valid department scope
- ownership/scope of the drive

A department admin must never be able to modify another department's drive by changing an ID.

Do not trust a client-provided department ID.

Determine department scope server-side using Unit 03 authorization utilities.

---

# 11. SUPER ADMIN

Respect the existing super-admin authorization model.

Only implement super-admin drive access if the existing project requirements explicitly require it for this feature.

Do not build unrelated super-admin management functionality.

---

# 12. DRIVE CREATION / EDITING

Implement the required drive management operations supported by the project context.

At minimum, where defined:

- create drive
- retrieve drive
- update drive

Validate all external input server-side.

Do not implement deletion unless explicitly required by the existing requirements.

Do not invent lifecycle operations.

---

# 13. VALIDATION

Use Zod and the existing validation architecture.

Validate:

- required fields
- dates
- application deadline
- eligibility inputs
- URLs where applicable
- numeric values where applicable
- uploaded job-description files where applicable

Do not invent unsupported validation rules.

---

# 14. JOB DESCRIPTION PDF

If the Drive requirements include a job-description PDF:

Use Vercel Blob according to the existing architecture.

Requirements:

- validate the file
- upload binary content to Blob
- store only the Blob URL/reference in PostgreSQL
- never store PDF binary data in PostgreSQL

Use existing Blob helpers where available.

Do not implement a new storage system.

If Blob configuration is unavailable, document the setup requirement rather than faking successful storage.

---

# 15. PAGINATION

Drive lists that can exceed a screenful must use the project's pagination standard:

- offset pagination
- default `pageSize = 25`
- return:

`{ data, page, pageSize, totalCount }`

Apply this consistently to drive listing operations.

---

# 16. SERVER-SIDE AUTHORIZATION

Every mutation and protected drive query must verify authorization server-side.

For department admins:

- role
- department scope
- drive ownership/scope

For students:

- authentication
- Student ownership where applicable
- eligibility where required

Never rely only on middleware or frontend restrictions.

---

# 17. SERVER ACTIONS / DATA ACCESS

Follow the established architecture.

Prefer server actions for mutations unless a route handler is genuinely required.

Keep:

- route files composition-only
- business logic in feature/lib layers
- validation server-side
- authorization server-side

Do not place drive business logic inside React components.

---

# 18. UI

Implement the required drive UI according to the existing CampusHire design system.

Follow:

- light-only theme
- existing CampusHire tokens
- shadcn/ui
- Tabler Icons
- established typography
- existing spacing/radius
- existing table/card patterns

Implement only the UI required for:

- student eligible-drive browsing
- drive detail
- department-admin drive management

Do not build application UI yet.

---

# 19. TESTING

Add focused Vitest tests.

Test at minimum:

### Drive

- valid drive creation
- invalid drive data rejected
- deadline validation
- status calculation uses `getDriveStatus()`

### Eligibility

- eligible student receives drive
- ineligible student does not receive drive
- eligibility is enforced server-side
- changing client-side IDs cannot bypass eligibility

### Department Admin

- admin can manage own department drives
- admin cannot access another department's drive
- missing/invalid department scope is rejected

### Authorization

- unauthenticated access rejected
- wrong role rejected
- student cannot perform admin operations

### Pagination

Verify drive list pagination follows:

`{ data, page, pageSize, totalCount }`

Mock external services such as Blob where appropriate.

---

# 20. DATABASE

Update Prisma only with models/relations required for this unit.

Potentially required:

- `Drive`
- `DriveEligibility`

Do NOT implement:

- `DriveApplication`
- `AuditLog`
- Excel upload models
- notifications
- resume models
- AI models

Create proper Prisma migrations if the database is available.

Do not fabricate migration success if PostgreSQL/Neon is unavailable.

---

# 21. ENVIRONMENT

Follow the centralized environment configuration in:

`lib/env.ts`

Do not access `process.env` directly throughout application code.

Do not hardcode:

- Clerk secrets
- database credentials
- Blob credentials
- other secrets

---

# 22. VERIFICATION

Run:

- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run lint`
- Vitest
- `npm run build`

Also manually verify the major drive flows where possible.

Fix issues introduced by Unit 05.

Do not hide unrelated existing failures.

---

# 23. UPDATE PROGRESS TRACKER

Update:

`context/progress-tracker.md`

Record:

- Unit 05 completion
- Drive model
- eligibility model/logic
- drive status handling
- admin functionality
- student drive listing
- PDF/Blob handling
- authorization
- pagination
- tests
- verification
- migration status
- open questions
- deferred functionality

Set the next module according to the existing roadmap.

Do NOT implement the next module.

---

# 24. STRICT OUT-OF-SCOPE

Do NOT implement:

- student applications
- apply button/business flow
- duplicate application prevention
- application status
- application history
- Excel/CSV bulk import
- admin student management
- department management
- admin account management
- audit logging
- notifications
- resume builder
- AI features
- readiness scoring
- payments
- multi-college support
- native mobile app

This unit is ONLY:

**Drive Management + Drive Eligibility + Eligible Drive Listing**

---

# 25. IMPORTANT EXECUTION ORDER

Execute this module in this order:

1. Read all context
2. Inspect Units 01–04
3. Create Unit 05 specification
4. Implement Drive database model
5. Implement eligibility structure
6. Implement drive status calculation/integration
7. Implement server-side eligibility logic
8. Implement admin drive operations
9. Implement student eligible-drive listing/detail
10. Implement PDF storage if required
11. Add UI
12. Add tests
13. Run Prisma/type/lint/test/build verification
14. Update progress tracker
15. STOP

Do NOT implement applications.

---

# FINAL REPORT

When finished, provide:

## Drive

- model
- fields
- lifecycle/status
- CRUD operations implemented

## Eligibility

- eligibility structure
- eligibility rules
- server-side enforcement

## Student

- eligible-drive listing
- drive detail/access enforcement

## Admin

- drive management
- department isolation

## Storage

- JD PDF handling
- Blob status

## UI

- pages/components created

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

**Student applications and all later modules were NOT implemented.**