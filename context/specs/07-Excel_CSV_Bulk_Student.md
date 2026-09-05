UNIT 07 — EXCEL/CSV BULK STUDENT IMPORT

You are continuing development of the CampusHire project.

IMPORTANT:
- Read ALL files inside `context/` before making changes.
- Read the existing project structure and completed Units 01–06.
- Do NOT redo completed work.
- Do NOT split this task into sub-units.
- Implement the entire Unit 07 as one cohesive module.
- Follow all existing CampusHire architecture, security, database, UI, and coding conventions.
- Do not invent unsupported fields or workflows.
- If something is unspecified, choose the smallest safe implementation and document the assumption.

==================================================
PRIMARY OBJECTIVE
==================================================

Implement the complete bulk student import workflow for Department Admins.

A Department Admin must be able to:

1. Upload an Excel/CSV source file.
2. Validate the file.
3. Parse and validate every row.
4. Preview validation results before committing data.
5. Import valid student records safely.
6. Ensure malformed/partial records are never inserted.
7. Ensure the entire import is atomic/all-or-nothing.
8. Restrict the import strictly to the admin's own department.
9. Store the uploaded source file temporarily in Vercel Blob when required.
10. Delete the successfully imported source file from Blob after successful import.
11. Never allow client-side manipulation to bypass department scope or validation.

==================================================
1. CREATE SPECIFICATION
==================================================

Create:

`context/specs/07-excel-csv-bulk-import.md`

Document:

- purpose
- supported file types
- upload flow
- parsing rules
- validation rules
- preview behavior
- import transaction behavior
- duplicate handling
- department scoping
- authorization
- Blob lifecycle
- error handling
- pagination if applicable
- tests
- assumptions/open questions

Keep this specification aligned with the existing CampusHire context.

==================================================
2. AUTHORIZATION
==================================================

Only authenticated `DEPT_ADMIN` users can perform department student imports.

Before every import-related server operation:

1. Authenticate through Clerk.
2. Resolve CampusHire User.
3. Verify role = `DEPT_ADMIN`.
4. Resolve the admin's `DepartmentAdmin` record.
5. Resolve the associated department.
6. Use that department as the authoritative import scope.

NEVER trust a client-provided department ID.

For example, do NOT allow:

`importStudents(file, departmentIdFromBrowser)`

to determine where students are imported.

The department must come from the authenticated admin's database relationship.

A Department Admin must never import students into another department.

`SUPER_ADMIN` behavior should only be implemented if explicitly supported by the existing project context.

Do not automatically grant super-admin import functionality just because the role exists.

==================================================
3. SUPPORTED FILE TYPES
==================================================

Support the file formats explicitly supported by the existing CampusHire context.

The project context requires Excel/CSV bulk upload.

Support appropriate formats such as:

- `.xlsx`
- `.csv`

Do not silently accept arbitrary binary formats.

Validate:
- file extension
- MIME type where available
- file size
- readable/parseable content

Reject unsupported or suspicious files safely.

Do not trust the filename alone.

==================================================
4. UPLOAD STORAGE
==================================================

Follow the existing Vercel Blob architecture.

Large/binary content must NOT be stored in PostgreSQL.

If the existing architecture uses Blob for transient Excel/CSV source files:

1. Upload source file to Vercel Blob.
2. Store/use only the Blob URL/reference as needed.
3. Process the file.
4. If import succeeds completely, delete the source file from Blob in the same successful workflow.

IMPORTANT:

A successfully imported source file must be deleted from Blob.

Do not leave successfully processed temporary upload files indefinitely.

If import fails validation:

- do not insert students
- retain or clean up the temporary file according to the safest existing project convention
- document the chosen lifecycle

Do not store raw Excel/CSV contents in PostgreSQL.

==================================================
5. FILE PARSING
==================================================

Implement robust Excel/CSV parsing.

Keep parsing logic separate from UI and route files.

Create appropriate feature files under:

`features/excel-upload/`

Use the existing architecture.

The parser must:

- read header row
- normalize supported headers according to the specification
- parse rows
- preserve row numbers for useful validation errors
- handle empty rows appropriately
- detect malformed rows
- avoid silent data loss

Do not silently guess what a column means.

Only map columns explicitly defined by the CampusHire student import specification/context.

If required columns are missing:

- reject the import
- report the missing columns
- insert nothing

==================================================
6. IMPORT TEMPLATE / COLUMN CONTRACT
==================================================

Determine the exact import columns from the existing CampusHire context and completed Student schema.

IMPORTANT:

DO NOT invent student fields merely because they are common in placement systems.

The import contract must correspond to actual fields supported by the current CampusHire Student/profile model.

Document:

- required columns
- optional columns
- accepted formats
- normalization rules
- uniqueness requirements
- department behavior

The department should NOT be supplied by the uploaded file as an authority.

The authenticated Department Admin's department is authoritative.

If a department column exists for informational/template reasons, never use it to override server-side department scope.

==================================================
7. VALIDATION
==================================================

Use Zod for external data validation.

Validate every row before database insertion.

Validation must include only fields actually supported by the CampusHire model.

Examples of validation categories where applicable:

- required values
- email format
- string length
- enum values
- numeric ranges
- date formats
- duplicate values
- relational references

Do not invent requirements.

Every validation error should contain enough information to identify the problematic row, for example:

- row number
- field/column
- reason

Example conceptual result:

Row 7:
Email → invalid email format

Row 12:
Required field missing

Do not expose database internals.

==================================================
8. ALL-OR-NOTHING IMPORT
==================================================

This is a critical invariant.

The import must be atomic.

If ANY row fails validation:

DO NOT insert any rows.

If database insertion fails partway through:

ROLL BACK the entire import.

Never leave a partially imported batch.

Conceptually:

Parse
  ↓
Validate ALL rows
  ↓
If any error → STOP
  ↓
Database transaction
  ↓
Create ALL records
  ↓
Commit
  ↓
Delete successful source file from Blob

Never:

row 1 → insert
row 2 → insert
row 3 → error
row 4 → insert

Partial imports are forbidden.

Use a Prisma transaction or equivalent database transaction mechanism appropriate to the existing architecture.

==================================================
9. DUPLICATE HANDLING
==================================================

Determine uniqueness using the actual existing CampusHire database constraints.

Before insertion, detect duplicate records within the uploaded file.

Example:

Row 5 → same unique identity as Row 17

This must be reported as an import validation error.

Also handle conflicts with existing database records.

Do not silently overwrite existing students.

Do not silently create duplicates.

Do not implement destructive "replace existing students" behavior.

If the existing schema defines unique fields, respect those constraints.

The import should fail safely rather than partially importing.

==================================================
10. STUDENT CREATION
==================================================

Create student records according to the existing CampusHire database design.

Do not bypass existing business rules.

A student created through bulk import must have:

- the correct department
- the correct relationship to the CampusHire User/Student model where applicable
- valid data according to the current schema

IMPORTANT:

Do not invent Clerk identities for students unless the existing architecture explicitly requires it.

The bulk-import workflow must respect the existing Clerk ownership model.

If imported student records represent pre-created student records awaiting Clerk registration, follow the existing architecture/specification rather than creating fake authentication identities.

Document this decision clearly.

==================================================
11. USER + STUDENT RELATIONSHIP
==================================================

Inspect the existing Unit 02–04 implementation before deciding how imported students relate to `User`.

Do not create duplicate users.

Do not create fake Clerk user IDs.

Do not create passwords.

Do not create custom authentication credentials.

If the current architecture requires a user record before a Student record can exist, implement the smallest valid mechanism consistent with the existing authentication model.

If the context does not define pre-registration behavior sufficiently, do NOT invent a complex invitation/authentication workflow.

Document the limitation/open question.

==================================================
12. PREVIEW WORKFLOW
==================================================

Implement a preview/validation stage where appropriate.

The intended flow should be:

Upload
  ↓
Parse
  ↓
Validate
  ↓
Show result
  ↓
Confirm import
  ↓
Atomic database transaction

The preview must NOT insert records.

If validation errors exist, clearly show:
- total rows
- valid rows
- invalid rows
- row-level errors

If the entire file is valid, allow the admin to proceed with import.

The server must revalidate during the final import.

Never trust a client-submitted "validated successfully" result.

==================================================
13. IMPORT CONFIRMATION
==================================================

The final import action must independently:

- authenticate admin
- resolve department scope
- verify uploaded file/reference
- parse/retrieve file
- validate all rows again
- perform duplicate checks
- execute transaction
- commit
- delete source Blob file after success

Do not trust preview results.

Do not trust:
- client row counts
- client validation flags
- client department IDs
- client role values

==================================================
14. DEPARTMENT ISOLATION
==================================================

This is a major security requirement.

Department Admin A must only import students into Department A.

A malicious request must not be able to change:

`departmentId = Department B`

and cause records to be created in Department B.

All database operations must derive department scope from authenticated admin authorization.

Test this explicitly.

==================================================
15. IMPORT RESULT
==================================================

After successful import, return a safe result containing useful information such as:

- number of records imported
- department scope
- successful completion

Do not expose unnecessary database details.

If import fails:

return structured, user-safe validation or operation errors.

Do not expose:
- SQL
- Prisma stack traces
- internal filesystem paths
- secrets
- Blob credentials
- raw exception objects

==================================================
16. UI
==================================================

Implement the Department Admin bulk-import UI using the existing CampusHire design system.

Use:
- existing theme tokens
- existing typography
- existing shadcn/ui
- Tabler icons
- existing app shell
- existing spacing/layout conventions

Do NOT introduce a new visual design.

The page should contain:

- upload/dropzone
- accepted file type information
- file size validation feedback
- validation/preview results
- row-level error display
- import confirmation action
- success state
- failure state
- empty state where appropriate

Use a clear workflow.

Avoid unnecessary modal-heavy UX.

==================================================
17. ACCESSIBLE ERROR DISPLAY
==================================================

Validation errors should be easy to understand.

For example:

Import failed

12 rows contain errors.

| Row | Field | Error |
|-----|-------|-------|
| 4 | Email | Invalid email |
| 8 | Name | Required |
| 13 | Email | Duplicate value |

Do not overwhelm the user with raw technical errors.

==================================================
18. SERVER ACTION / DATA ACCESS ARCHITECTURE
==================================================

Use the existing architecture.

Business logic must live in:

`features/excel-upload/`

and appropriate `lib/` helpers.

Route/page files remain composition-only.

Do not put:
- parsing
- Prisma queries
- authorization
- validation
- transaction logic

inside React components or route files.

Use server actions where appropriate.

Only use route handlers when genuinely required.

==================================================
19. PAGINATION
==================================================

The upload itself does not require pagination.

If validation errors or import history are rendered as potentially large lists, follow the project's standard pagination strategy where appropriate.

For any list that exceeds one screenful:

- default pageSize = 25
- offset pagination
- return:

{
  data,
  page,
  pageSize,
  totalCount
}

Do not load an unnecessarily huge dataset into the browser.

==================================================
20. SECURITY
==================================================

Explicitly defend against:

- cross-department imports
- unauthenticated uploads
- non-admin uploads
- arbitrary department IDs
- malformed files
- unsupported formats
- oversized files
- duplicate rows
- duplicate database records
- partial imports
- client-side validation bypass
- forged preview results
- direct server-action manipulation

Never trust the browser as the authority.

==================================================
21. TESTS
==================================================

Add focused Vitest tests.

At minimum test:

1. Valid CSV parses correctly.
2. Valid XLSX parses correctly.
3. Unsupported file type is rejected.
4. Missing required column is rejected.
5. Malformed row is rejected.
6. Invalid field value is rejected.
7. Duplicate rows in one file are rejected.
8. Existing database duplicate is handled safely.
9. If one row fails validation, NO rows are inserted.
10. Database transaction rolls back on failure.
11. Department Admin can import only into their own department.
12. Manipulated department ID cannot change import scope.
13. Unauthenticated user cannot import.
14. Student cannot import.
15. Wrong-role user cannot import.
16. Successful import deletes the source Blob file.
17. Failed validation does not create student records.
18. Client-side preview cannot bypass server revalidation.

Use mocks/test doubles for Blob where appropriate.

Do not require real production Blob credentials for unit tests.

Do NOT create E2E tests unless explicitly requested.

==================================================
22. DATABASE
==================================================

Inspect the existing Prisma schema before changing it.

Only make schema changes if required for this module.

Do not create unnecessary models.

Do not duplicate Student fields.

If database migration is required:

- run Prisma validation
- run Prisma generation
- run migration if PostgreSQL/Neon is available

If database connectivity is unavailable:

DO NOT fake migration success.

Report the actual migration state.

==================================================
23. ENVIRONMENT
==================================================

Continue using:

`lib/env.ts`

for environment validation.

Do not access `process.env` directly throughout feature code.

Use existing Blob configuration.

Do not add unnecessary environment variables.

==================================================
24. PERFORMANCE
==================================================

Design imports safely for realistic bulk-upload sizes.

Do not blindly load unlimited rows into memory.

Use the existing project constraints/context for maximum file size and row count.

If those limits are not yet defined, choose conservative implementation limits and document them rather than allowing unlimited uploads.

Do not perform one unnecessary database query per imported row if a batch approach is possible.

However, correctness and atomicity take priority over premature optimization.

==================================================
25. AUDIT LOGGING
==================================================

Do NOT implement the full audit logging system in Unit 07.

If the existing architecture already provides a reusable audit helper and the context explicitly requires import actions to call it, integrate with that existing mechanism.

Otherwise leave audit logging for the dedicated audit module.

Do not create a second audit implementation here.

==================================================
26. STRICT OUT OF SCOPE
==================================================

DO NOT implement:

- audit-log system
- department CRUD
- admin account management
- student drive applications
- drive creation
- drive eligibility redesign
- notifications
- email campaigns
- resume builder
- AI features
- interview management
- placement outcomes
- application withdrawal
- multi-college tenancy
- payments
- mobile application

Only implement Excel/CSV bulk student import and its required supporting infrastructure.

==================================================
27. DOCUMENTATION
==================================================

Update:

`context/progress-tracker.md`

Record:

- Unit 07 status
- files created/modified
- supported formats
- validation behavior
- atomic transaction behavior
- department authorization behavior
- Blob lifecycle
- tests
- build/type/lint results
- migration status
- assumptions/open questions

Ensure:

`context/specs/07-excel-csv-bulk-import.md`

matches the final implementation.

==================================================
28. FINAL VERIFICATION
==================================================

Before declaring Unit 07 complete, verify:

[ ] Unit 07 specification created.
[ ] Excel/CSV upload works.
[ ] File type validation works.
[ ] File size validation works.
[ ] Header validation works.
[ ] Row parsing works.
[ ] Row-level validation works.
[ ] Duplicate rows are detected.
[ ] Existing database duplicates are handled.
[ ] Preview does not insert records.
[ ] Final import revalidates everything server-side.
[ ] Import is atomic.
[ ] Partial imports cannot occur.
[ ] Department scope is server-enforced.
[ ] Client cannot override department.
[ ] Only authorized Department Admins can import.
[ ] Source files are stored according to Blob architecture.
[ ] Successfully imported source file is deleted from Blob.
[ ] No raw file contents are stored in PostgreSQL.
[ ] Student records use the existing schema correctly.
[ ] No fake Clerk credentials/users are created.
[ ] No custom authentication was introduced.
[ ] Vitest tests pass.
[ ] TypeScript passes.
[ ] Lint passes.
[ ] Build passes.
[ ] Prisma validation/generation passes.
[ ] Migration status is accurately reported.
[ ] Progress tracker updated.
[ ] No out-of-scope functionality was added.

==================================================
EXECUTION ORDER
==================================================

Execute in this exact order:

1. Read all existing context and Units 01–06.
2. Inspect the current Prisma schema and Student implementation.
3. Create Unit 07 specification.
4. Determine the exact supported import columns from the existing schema/context.
5. Implement file validation.
6. Implement CSV/XLSX parsing.
7. Implement row normalization/validation.
8. Implement duplicate detection.
9. Implement department-admin authorization.
10. Implement temporary Blob handling.
11. Implement preview/validation result.
12. Implement final server-side revalidation.
13. Implement atomic Prisma transaction.
14. Implement successful Blob cleanup.
15. Implement Department Admin UI.
16. Add Vitest coverage.
17. Run Prisma validation/generation.
18. Run migration if database is available.
19. Run TypeScript.
20. Run lint.
21. Run tests.
22. Run production build.
23. Update progress tracker.
24. Review final diff for scope/security violations.

==================================================
FINAL RESPONSE
==================================================

When finished, report:

- Unit 07 completion status
- files created/modified
- supported file formats
- exact import validation behavior
- database transaction behavior
- department authorization/security
- Blob upload/deletion behavior
- tests added and results
- Prisma/migration status
- TypeScript/lint/build status
- assumptions/open questions
- exact next recommended module

Do NOT claim anything passed unless it was actually executed.

Do NOT claim migration succeeded if PostgreSQL/Neon was unavailable.