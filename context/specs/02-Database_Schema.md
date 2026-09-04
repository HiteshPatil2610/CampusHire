# CampusHire — Unit 02A: Core Database Schema

We are continuing development of CampusHire.

The project setup Unit 01 has already been completed.

Before making changes, read and follow:

* `context/project-overview.md`
* `context/architecture.md`
* `context/ui-context.md`
* `context/code-standards.md`
* `context/progress-tracker.md`
* `context/specs/01-project-setup.md`

## Objective

Implement only the **core identity and organization database foundation**.

This is **Unit 02A**.

The only database models to work on in this unit are:

* `User`
* `Department`
* `AdminAccount`

Do not implement any other feature's database model.

## Required Relationships

Follow the existing architecture exactly:

* A `User` has one application role:

  * `STUDENT`
  * `DEPT_ADMIN`
  * `SUPER_ADMIN`
* A `Student` will eventually belong to exactly one `Department`, but the Student model itself is NOT part of this unit.
* A department admin account belongs to exactly one `Department`.
* A `Department` can have multiple department admins.
* Department admins have identical permissions; there is no primary/backup permission distinction in the database.
* The Super Admin is a single application-level account for V1.

Do not invent additional roles or permission levels.

## Important Scope Restriction

Do NOT create:

* `Student`
* student profile tables
* `Drive`
* `DriveEligibility`
* `DriveApplication`
* `AuditLog`
* Excel-upload models
* notification models
* readiness-score models
* resume models
* AI-related models

Those belong to later units.

## Step 1 — Create the Spec

Before modifying the Prisma schema, create:

`context/specs/02a-core-database-schema.md`

The spec must define:

* Purpose
* Scope
* Models being introduced
* Relationships
* Required invariants
* Out-of-scope models
* Verification criteria

Do not add requirements that are not supported by the existing context.

If an exact field is not defined by the context and is genuinely necessary, do not silently invent product behavior. Record the ambiguity in:

`context/progress-tracker.md`

## Step 2 — Inspect Existing Prisma Setup

Inspect:

* `prisma/schema.prisma`
* existing Prisma configuration
* database configuration
* `lib/env.ts`

Preserve existing working setup from Unit 01.

Do not rewrite unrelated configuration.

## Step 3 — Update Prisma Schema

Add only the schema required for:

* User
* Department
* AdminAccount
* application roles

Use Prisma-generated types as the source of truth.

Follow the naming and relationship conventions already established in the project.

Ensure the department-admin relationship supports:

> One department → many department admins

and:

> Each department admin → exactly one department

Do not add primary/backup admin fields because the architecture explicitly says there is no such permission distinction.

## Step 4 — Migration

Create a Prisma migration using Prisma's normal migration workflow.

Do NOT manually edit generated migration files.

The migration must contain only the changes required for Unit 02A.

## Step 5 — Prisma Validation

Run the appropriate Prisma validation/generation commands.

Verify:

* schema is valid
* Prisma Client generates successfully
* relationships are valid
* no unintended models were added

## Step 6 — Build Verification

Run:

```bash
npm run build
```

Also run any existing type-check/lint/test commands appropriate to the project.

Do not bypass errors using:

* `any`
* `@ts-ignore`
* unsafe casts

Fix root causes.

## Step 7 — Update Progress Tracker

Update:

`context/progress-tracker.md`

Record:

* Unit 02A completion
* schema changes
* migration created
* verification results
* any open questions
* next unit: Unit 02B — Student data model

Do not start Unit 02B.

## Strict Rules

1. Work only on Unit 02A.
2. Do not implement application logic.
3. Do not implement authentication flows yet.
4. Do not implement student profiles.
5. Do not implement drives.
6. Do not implement eligibility.
7. Do not implement applications.
8. Do not implement Excel upload.
9. Do not implement audit logging.
10. Do not invent unspecified product behavior.
11. Do not manually edit Prisma migrations.
12. Preserve all existing working code.
13. If requirements are ambiguous, document the ambiguity instead of guessing.
14. Do not proceed to the next unit automatically.

## Final Report

When finished, report:

1. Files created/modified
2. Prisma models added
3. Relationships added
4. Migration status
5. Prisma validation status
6. Build/type/lint/test results
7. Open questions
8. Confirmation that no out-of-scope models were implemented
9. Recommended next unit
