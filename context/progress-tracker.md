# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- **Unit 01 — Project Setup: COMPLETE**
- **Unit 02 — Database & Student Foundation: COMPLETE**
  - Unit 02A — Core Database Schema: COMPLETE
  - Unit 02B — Student Core Data Model: COMPLETE
  - Unit 02C — Student Profile Structure: COMPLETE
- Ready to begin Unit 03 (Authentication & Role Synchronization).

## Current Goal

- Unit 02 complete. Next: Implement Unit 03 (Authentication flows, Clerk synchronization, and role assignment).

## Completed

- Clickable HTML/CSS prototype (9 screens: landing, login, register, student dashboard, student profile, admin dashboard, excel upload, post-drive, super-admin dashboard) — used as the source of truth for `ui-context.md` and the core user flows.
- Planning conversation completed: stack, scope, and access model decided (see Architecture Decisions below).
- All six context files + this progress tracker + `CLAUDE.md` drafted.
- **Unit 01 — Project Setup (COMPLETE):**
  - Initialized Next.js 15+ with TypeScript (strict mode), App Router, ESLint
  - Configured Tailwind CSS with PostCSS and autoprefixer
  - Installed and configured shadcn/ui with components.json
  - Established CampusHire design tokens in `app/globals.css` (all color variables, Inter font, border radii)
  - Created Prisma schema with `User`, `Department`, `DepartmentAdmin`, `Student`, `Drive`, `DriveApplication`, `AuditLog` models
  - Set up Prisma client singleton in `lib/prisma.ts`
  - Created environment variable validation in `lib/env.ts` with Zod (fail-fast on startup)
  - Installed Clerk authentication, wrapped root layout with `ClerkProvider`
  - Created `lib/clerk.ts` with role-checking helpers (`getCurrentUserRole`, `hasRole`, `hasAnyRole`)
  - Established route group structure: `(auth)/`, `(student)/`, `(admin)/`, `(super-admin)/`, `api/`
  - Created placeholder pages: `/sign-in`, `/sign-up`, `/student-dashboard`, `/admin-dashboard`, `/super-admin-dashboard`
  - Implemented `middleware.ts` with Clerk session protection and role-based route guarding
  - Created project folder structure: `lib/`, `components/ui/`, `components/shared/`, `features/`, `prisma/`, `scripts/`
  - **Build verification:** `npm run build` passes, TypeScript strict mode passes, ESLint passes
  - Created `.env.example` documenting all required environment variables

- **Unit 02A — Core Database Schema (COMPLETE):**
  - Created spec file `context/specs/02a-core-database-schema.md` defining scope and relationships
  - Updated Prisma schema to include ONLY core models: `User`, `Department`, `DepartmentAdmin`
  - Removed out-of-scope models: `Student`, `Drive`, `DriveApplication`, `AuditLog` (will be added in later units)
  - Defined `Role` enum with `STUDENT`, `DEPT_ADMIN`, `SUPER_ADMIN`
  - Established relationships:
    - User ↔ DepartmentAdmin (one-to-one)
    - Department ↔ DepartmentAdmin (one-to-many)
  - Schema validation: `npx prisma validate` ✅
  - Prisma Client generation: `npx prisma generate` ✅
  - Build verification: `npm run build` ✅, `tsc --noEmit` ✅, `npm run lint` ✅
  - Created `DATABASE_SETUP.md` documenting database connection requirements
  - **Note:** Actual database migration pending — requires Neon PostgreSQL connection (DATABASE_URL not yet configured with real database)

- **Unit 02 — Database & Student Foundation (COMPLETE):**
  - **Created comprehensive specification:** `context/specs/02-database-and-student-foundation.md`
    - Documented purpose, scope, all models, relationships, constraints, indexes
    - Defined 7 profile sections with structure
    - Identified open questions (required field checklist deferred to profile completion unit)
  
  - **Unit 02A — Core Database Schema:**
    - ✅ `Role` enum (STUDENT, DEPT_ADMIN, SUPER_ADMIN)
    - ✅ `User` model with Clerk integration (clerkId, email, role)
    - ✅ `Department` model (name, code, isActive)
    - ✅ `DepartmentAdmin` model (links users to departments)
    - ✅ Relationships: User ↔ DepartmentAdmin (1:1), Department ↔ DepartmentAdmin (1:M)
    - ✅ All indexes and unique constraints
  
  - **Unit 02B — Student Core Data Model:**
    - ✅ `Student` model with core fields (userId, departmentId, rollNumber, name, phoneNumber)
    - ✅ Profile links (linkedinUrl, githubUrl, portfolioUrl)
    - ✅ Relationships: Student ↔ User (1:1), Student ↔ Department (M:1)
    - ✅ Unique constraints on userId and rollNumber (institution-wide)
  
  - **Unit 02C — Student Profile Structure:**
    - ✅ `SkillType` enum (TECHNICAL, SOFT)
    - ✅ `StudentAcademic` model (10th/12th marks, CGPA, semester, backlogs) — one-to-one with Student
    - ✅ `StudentPreferences` model (roles, locations, company types, package, relocation) — one-to-one with Student
    - ✅ `StudentSkill` model (skillName, skillType) — many-to-one with Student, composite unique on (studentId, skillName)
    - ✅ `StudentProject` model (title, description, technologies, URL, dates) — many-to-one with Student
    - ✅ `StudentExperience` model (company, role, description, dates) — many-to-one with Student
    - ✅ `StudentCertification` model (name, issuer, dates, credential URL) — many-to-one with Student
    - ✅ All relationships, cascade delete rules, and foreign key constraints
  
  - **Testing & Verification:**
    - ✅ Installed Vitest testing framework
    - ✅ Created `lib/__tests__/schema-invariants.test.ts` with 38 tests
    - ✅ All tests passing (100% pass rate)
    - ✅ Tests cover: enums, all models (02A, 02B, 02C), relationships, constraints, data integrity invariants
    - ✅ Prisma validation: `npx prisma validate` ✅
    - ✅ Prisma Client generation: `npx prisma generate` ✅
    - ✅ TypeScript compilation: `npx tsc --noEmit` ✅
    - ✅ ESLint: `npm run lint` ✅ (no warnings/errors)
    - ✅ Build: `npm run build` ✅ (all 7 routes compiled successfully)
  
  - **Migration Status:**
    - ✅ Migration applied successfully to Neon PostgreSQL
    - Migration name: `20260904192335_student_profile_foundation`
    - Database schema is up to date
    - All 9 tables, 2 enums, 17 unique constraints, 13 indexes, and 10 foreign keys created

## In Progress

- None yet.

## Next Up

1. **Unit 03 — Authentication & Role Synchronization:**
   - Student registration flow with Clerk (college email verification)
   - Role assignment logic (store role in Clerk metadata, mirror User record in Postgres)
   - User-Student record creation on sign-up
   - Clerk webhook handling for user lifecycle events
   - Super admin seed script (`scripts/seed-super-admin.ts`)
   - Department admin account creation flow (super admin only)
2. **Unit 04 — Student Profile Management:**
   - Profile CRUD operations (server actions)
   - Profile completion calculation logic
   - Profile UI components
3. **Unit 05 — Excel Bulk Upload:**
   - Template generation
   - Row parsing and validation
   - Bulk import transaction logic

## Open Questions

- ✅ **Database connection:** RESOLVED — Neon PostgreSQL connected and migration applied successfully
- **Profile completion required fields:** Exact required-field checklist per profile section not yet defined (deferred to profile completion calculation unit)
- **Roll number format:** Is there a specific format/pattern for roll numbers (e.g., "CS2021001")? — to be validated in Excel upload or registration flow
- **CGPA scale:** Assuming 0-10 scale (most common in Indian institutions) — to be validated in UI/server actions
- Exact list of Excel template columns and their validation rules (roll number format, required vs optional fields) — needs to be finalized before building `features/excel-upload/`.
- Whether department admins can edit eligibility criteria on a drive after students have already applied — to be decided in the drives feature spec.

## Architecture Decisions

- **Stack**: Next.js (App Router, TypeScript) + PostgreSQL via Neon + Prisma + Clerk + Tailwind + shadcn/ui, deployed on Vercel. Chosen for tight Vercel/Next.js integration and because Clerk natively supports the email-OTP verification flow needed for student sign-up.
- **Single college, multi-department**: the system is not multi-tenant. All departments belong to one institution; no college-level entity exists above `Department`.
- **File storage**: Vercel Blob for profile photos and JD PDFs only. Resume file storage is explicitly deferred (resume builder is out of scope for V1).
- **Email**: Clerk handles sign-up/OTP verification email only in V1. Drive-alert and bulk-upload-credential emails are deferred — those surface as in-app notifications for now.
- **Eligibility matching**: computed and filtered server-side; a student's drive list query only ever returns drives they qualify for.
- **Folder structure**: feature-based (`features/students`, `features/drives`, etc.) rather than layer-based.
- **Testing**: Vitest unit tests required for eligibility matching, Excel-row validation, and profile-completion logic.

## Session Notes

- V1 scope is: Auth + roles, Student profile, Dept admin (student management + Excel bulk upload), Drive posting + eligibility matching, Super admin (departments + admin accounts). Resume builder, AI analyzer, and self-assessment/readiness score are explicitly out of scope for V1 — see `project-overview.md`.
- The prototype at hand (9 static HTML pages) is the visual and flow reference for every screen — `ui-context.md` tokens were extracted directly from its `styles.css`, not redesigned.
