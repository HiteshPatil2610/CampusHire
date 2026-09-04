# CampusHire — Unit 02: Database & Student Foundation

You are continuing development of the CampusHire project.

Unit 01 — Project Setup is already complete.

Now implement the complete **Unit 02 — Database & Student Foundation**, covering:

* 02A — Core Database Schema
* 02B — Student Core Data Model
* 02C — Student Profile Structure

Do NOT move beyond this unit.

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly inspect:

* all files inside `context/`
* `context/progress-tracker.md`
* existing files inside `context/specs/`
* `prisma/schema.prisma`
* existing project structure
* existing package scripts/configuration
* everything implemented during Unit 01

Treat the context files as the source of truth.

Do not invent requirements.

Preserve all existing working functionality.

---

# 2. CREATE THE UNIT SPECIFICATION

Create:

`context/specs/02-database-and-student-foundation.md`

The specification must document:

1. Purpose
2. Scope
3. Core database models
4. Student model
5. Student profile structure
6. Relationships
7. Constraints
8. Indexes
9. Data integrity invariants
10. Profile sections
11. Profile completion requirements
12. Out-of-scope functionality
13. Open questions
14. Verification plan

---

# 3. 02A — CORE DATABASE SCHEMA

Implement the core organization/identity database foundation.

## Role

Create/use the following role enum:

* `STUDENT`
* `DEPT_ADMIN`
* `SUPER_ADMIN`

## User

Create the `User` model for application identity linked to Clerk.

It must support:

* Clerk identity
* email
* application role
* timestamps

Use appropriate uniqueness constraints for identity fields that are explicitly required.

## Department

Create the `Department` model.

It must support:

* department name
* department code
* active/inactive state
* timestamps

Department code must be unique.

## DepartmentAdmin

Create the model connecting a department administrator to a department.

Requirements:

* one admin user belongs to exactly one department
* a department can have multiple admins
* a department admin is associated with one application User
* no primary/backup admin distinction unless explicitly required by context

Preserve referential integrity.

---

# 4. 02B — STUDENT CORE DATA MODEL

Create the `Student` model.

The Student must be connected to:

* the application `User`
* exactly one `Department`

Use the existing models from 02A.

The Student model should contain only core student information that is explicitly defined by the existing CampusHire context.

Do NOT invent fields just because they might be useful.

If the exact structure of a field is not defined:

* document the ambiguity
* add it to Open Questions
* do not make an unsupported business decision

Preserve department-level isolation through the Student → Department relationship.

---

# 5. 02C — STUDENT PROFILE STRUCTURE

Create the database structure for the seven student profile sections:

1. Personal
2. Academic
3. Skills & Links
4. Projects
5. Experience
6. Certifications
7. Preferences

Every profile structure must belong to the correct Student.

Use the existing architecture to determine whether related tables or JSON are appropriate.

Do not introduce unnecessary complexity.

For naturally repeated entities such as projects, experience, certifications, and skills, use an appropriate relational structure if supported by the existing requirements.

---

# 6. IMPORTANT — DO NOT INVENT PROFILE FIELDS

The project context establishes the seven profile sections, but the exact required-field checklist is not fully defined yet.

Therefore:

* implement only fields explicitly supported by the existing context
* do not invent a detailed profile questionnaire
* do not invent profile completion weights
* do not create arbitrary mandatory fields

Document unresolved field-level requirements under Open Questions.

---

# 7. PROFILE COMPLETION

The project requirement is:

`Profile completion = required fields filled / total required fields`

It is a simple ratio.

It is NOT weighted.

However, the exact required-field checklist is not yet defined.

Therefore:

* do not implement completion calculation in this unit
* do not store a completion percentage in the database
* do not invent required fields

Only establish the database structure needed for the future profile feature.

---

# 8. DATABASE RELATIONSHIPS

Establish the required relationships:

`User → DepartmentAdmin`

`Department → DepartmentAdmin`

`User → Student`

`Department → Student`

and:

`Student → Profile data`

Use proper Prisma relations and foreign keys.

Do not create relationships yet for:

* Drive
* DriveEligibility
* DriveApplication
* AuditLog
* Excel/CSV import
* notifications
* resume storage
* AI features

Those belong to later units.

---

# 9. CONSTRAINTS AND INDEXES

Add only constraints and indexes justified by the requirements.

Consider:

* unique Clerk identity
* unique email where required
* unique department code
* one DepartmentAdmin per User
* Student/User relationship
* Student/Department relationship
* profile ownership
* foreign-key integrity

Do not add speculative indexes.

---

# 10. PRISMA IMPLEMENTATION

Update:

`prisma/schema.prisma`

Implement all models required for:

* 02A
* 02B
* 02C

Do not include future models.

Run:

`npx prisma validate`

`npx prisma generate`

Create the appropriate Prisma migration using the normal Prisma workflow.

Do not manually fabricate migrations.

If Neon/PostgreSQL is not currently connected:

* do NOT claim that the migration succeeded
* clearly report that the schema is ready but migration is pending database connection

---

# 11. TESTING

Add focused tests for the database/business invariants introduced by this unit.

At minimum verify applicable rules around:

* User identity uniqueness
* Department code uniqueness
* DepartmentAdmin relationships
* Student relationships
* Student ownership of profile data
* important uniqueness/foreign-key constraints

Do not implement future business logic merely for testing purposes.

---

# 12. PROJECT STANDARDS

Follow the existing CampusHire architecture and coding standards:

* strict TypeScript
* no `any`
* no unsafe casts
* no unnecessary abstractions
* no business logic in route files
* preserve existing architecture
* preserve Unit 01
* use Prisma conventions already established
* do not modify unrelated files

---

# 13. VERIFICATION

Run all appropriate checks available in the repository:

* Prisma validation
* Prisma generation
* TypeScript type checking
* ESLint
* Vitest
* `npm run build`

Fix problems introduced by this unit.

Do not hide unrelated pre-existing problems.

---

# 14. UPDATE PROGRESS TRACKER

Update:

`context/progress-tracker.md`

Record:

### Completed

* Unit 02A — Core Database Schema
* Unit 02B — Student Core Data Model
* Unit 02C — Student Profile Structure

### Record

* models created
* relationships
* constraints
* indexes
* migration status
* tests
* verification results
* open questions
* deferred requirements

Set the next unit to:

**Unit 03 — Authentication & Role Synchronization**

Do NOT implement Unit 03.

---

# 15. STRICT OUT-OF-SCOPE

Do NOT implement:

* Clerk authentication synchronization
* OTP/email verification flow
* student registration flow
* profile UI
* student dashboard
* profile server actions
* profile API routes
* profile completion calculation
* drive posting
* drive eligibility
* applications
* Excel/CSV import
* audit logging
* notifications
* resume functionality
* AI functionality
* readiness scoring
* multi-college functionality
* payments/billing
* native mobile application

Only implement:

**Unit 02A + Unit 02B + Unit 02C**

---

# 16. IMPORTANT EXECUTION RULE

Work incrementally inside this single unit:

1. Inspect existing implementation
2. Write the specification
3. Implement 02A
4. Implement 02B
5. Implement 02C
6. Validate Prisma
7. Generate Prisma Client
8. Create migration if database is available
9. Run tests/checks
10. Run build
11. Update progress tracker

Do not proceed to Unit 03.

---

# FINAL REPORT

When finished, provide:

## 02A

* models created
* relationships
* constraints
* migration status

## 02B

* Student model
* relationships
* constraints
* migration status

## 02C

* profile structures
* relationships
* constraints
* migration status

## Files

* created
* modified

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

**Unit 03 was NOT implemented.**
