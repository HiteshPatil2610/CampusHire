# CampusHire — Unit 02: Database & Student Foundation

## 1. Purpose

Establish the complete database foundation for CampusHire, including:
- Core identity and organization models (User, Department, DepartmentAdmin)
- Student core data model linking students to users and departments
- Student profile structure supporting all seven profile sections

This unit provides the data layer required for student registration, profile management, and department-scoped student queries in subsequent units.

## 2. Scope

This unit encompasses three sub-units:

### 02A — Core Database Schema (Already Complete)
- `Role` enum: `STUDENT`, `DEPT_ADMIN`, `SUPER_ADMIN`
- `User` model: Clerk identity, email, role
- `Department` model: department name, code, active status
- `DepartmentAdmin` model: links DEPT_ADMIN users to departments

### 02B — Student Core Data Model (To Implement)
- `Student` model: core student information
- Relationship: Student → User (one-to-one)
- Relationship: Student → Department (many-to-one)

### 02C — Student Profile Structure (To Implement)
- Academic information (10th/12th marks, CGPA, semester, backlogs)
- Skills and links (technical/soft skills, LinkedIn, GitHub, portfolio)
- Projects (repeatable entries)
- Experience/Internships (repeatable entries)
- Certifications (repeatable entries)
- Placement preferences (roles, locations, company types, package expectations)

### Out of Scope for Unit 02
- Authentication flows and Clerk synchronization (Unit 03)
- Profile UI components (later unit)
- Profile server actions and API routes (later unit)
- Profile completion calculation logic (later unit)
- Drive models (later unit)
- Drive eligibility models (later unit)
- Drive application models (later unit)
- Excel/CSV upload models (later unit)
- Audit log models (later unit)
- File storage integration (later unit)
- Email/notification functionality (later unit)

## 3. Core Database Models (02A) — Already Complete

### Role Enum
```prisma
enum Role {
  STUDENT
  DEPT_ADMIN
  SUPER_ADMIN
}
```

### User Model
- **Purpose**: Application identity linked to Clerk
- **Fields**:
  - `id`: CUID primary key
  - `clerkId`: Unique Clerk user identifier
  - `email`: Unique email address
  - `role`: Application role (STUDENT, DEPT_ADMIN, SUPER_ADMIN)
  - `createdAt`, `updatedAt`: Timestamps
- **Relations**: One-to-one with DepartmentAdmin (optional)
- **Indexes**: `clerkId`, `email`
- **Constraints**: Unique on `clerkId`, unique on `email`

### Department Model
- **Purpose**: Academic department entity
- **Fields**:
  - `id`: CUID primary key
  - `name`: Department name (e.g., "Computer Science")
  - `code`: Short department code (e.g., "CS")
  - `isActive`: Boolean flag for active/inactive departments
  - `createdAt`, `updatedAt`: Timestamps
- **Relations**: One-to-many with DepartmentAdmin
- **Indexes**: `code`
- **Constraints**: Unique on `code`

### DepartmentAdmin Model
- **Purpose**: Links DEPT_ADMIN users to departments
- **Fields**:
  - `id`: CUID primary key
  - `userId`: Foreign key to User (unique - one admin account per user)
  - `departmentId`: Foreign key to Department
  - `createdAt`, `updatedAt`: Timestamps
- **Relations**:
  - Many-to-one with User (cascade delete)
  - Many-to-one with Department (cascade delete)
- **Indexes**: `departmentId`
- **Constraints**: Unique on `userId`
- **Business Rules**:
  - One User can be admin of only one Department
  - One Department can have multiple admins (no primary/backup distinction)

## 4. Student Core Data Model (02B) — To Implement

### Student Model

**Purpose**: Represents a student in the placement system

**Fields**:
- `id`: CUID primary key
- `userId`: Foreign key to User (unique - one student profile per user)
- `departmentId`: Foreign key to Department
- `rollNumber`: Student roll number (unique per institution)
- `name`: Full name (sourced from Clerk during registration)
- `phoneNumber`: Contact number (optional initially, can be added during profile completion)
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- One-to-one with User (cascade delete)
- Many-to-one with Department (restrict delete - prevent department deletion if students exist)
- One-to-one with StudentAcademic (cascade delete)
- One-to-one with StudentPreferences (cascade delete)
- One-to-many with StudentSkill (cascade delete)
- One-to-many with StudentProject (cascade delete)
- One-to-many with StudentExperience (cascade delete)
- One-to-many with StudentCertification (cascade delete)

**Indexes**:
- `userId`
- `departmentId`
- `rollNumber`

**Constraints**:
- Unique on `userId`
- Unique on `rollNumber`

**Business Rules**:
- Every Student must belong to exactly one Department
- Every Student must be linked to exactly one User with role=STUDENT
- Student records are scoped by Department for DEPT_ADMIN access control
- Roll number uniqueness is institution-wide (not per-department)

## 5. Student Profile Structure (02C) — To Implement

The student profile is divided into seven sections. Based on the project context, the following structure is established:

### 5.1 Personal Information

Stored in the `Student` model directly:
- `name`: Full name
- `phoneNumber`: Contact number (optional)
- Profile photo URL (to be added when file storage is integrated - deferred)

### 5.2 Academic Information

**StudentAcademic Model** (one-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student (unique)
- `tenthPercentage`: 10th standard percentage (decimal, e.g., 85.5)
- `twelfthPercentage`: 12th standard percentage (decimal)
- `currentCGPA`: Current CGPA (decimal, e.g., 8.5)
- `currentSemester`: Current semester (integer, e.g., 6)
- `activeBacklogs`: Number of active backlogs (integer, default 0)
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- One-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Constraints**: Unique on `studentId`

**Validation Notes** (to be enforced in server actions, not database):
- Percentages: 0-100 range
- CGPA: 0-10 range (or institution-specific scale)
- Semester: positive integer
- Active backlogs: non-negative integer

### 5.3 Skills & Links

**StudentSkill Model** (many-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student
- `skillName`: Skill name (e.g., "React", "Communication")
- `skillType`: Enum (TECHNICAL, SOFT)
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- Many-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Constraints**: Unique on `(studentId, skillName)` to prevent duplicate skills

**SkillType Enum**:
```prisma
enum SkillType {
  TECHNICAL
  SOFT
}
```

**Links** (stored directly in Student model to be added):
- `linkedinUrl`: LinkedIn profile URL (optional)
- `githubUrl`: GitHub profile URL (optional)
- `portfolioUrl`: Portfolio website URL (optional)

### 5.4 Projects

**StudentProject Model** (many-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student
- `title`: Project title
- `description`: Project description (text)
- `technologiesUsed`: Technologies used (text, comma-separated or JSON array)
- `projectUrl`: Optional URL (GitHub repo, live demo, etc.)
- `startDate`: Start date (DateTime, optional)
- `endDate`: End date (DateTime, optional - null means ongoing)
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- Many-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Business Rules**:
- No limit on number of projects per student
- Projects are displayed in reverse chronological order (newest first)

### 5.5 Experience / Internships

**StudentExperience Model** (many-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student
- `companyName`: Company/organization name
- `role`: Job title/role
- `description`: Work description (text)
- `startDate`: Start date (DateTime)
- `endDate`: End date (DateTime, optional - null means currently working)
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- Many-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Business Rules**:
- No limit on number of experience entries per student
- Experience entries are displayed in reverse chronological order (most recent first)

### 5.6 Certifications

**StudentCertification Model** (many-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student
- `certificationName`: Certificate name
- `issuingOrganization`: Issuing organization
- `issueDate`: Issue date (DateTime)
- `expiryDate`: Expiry date (DateTime, optional - null means no expiry)
- `credentialUrl`: Optional URL to verify certification
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- Many-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Business Rules**:
- No limit on number of certifications per student
- Certifications are displayed in reverse chronological order by issue date

### 5.7 Placement Preferences

**StudentPreferences Model** (one-to-one with Student):

**Fields**:
- `id`: CUID primary key
- `studentId`: Foreign key to Student (unique)
- `preferredRoles`: Array/JSON of preferred job roles (e.g., ["Software Engineer", "Data Analyst"])
- `preferredLocations`: Array/JSON of preferred work locations (e.g., ["Bangalore", "Remote"])
- `preferredCompanyTypes`: Array/JSON of company type preferences (e.g., ["Startup", "MNC", "Product"])
- `expectedPackageMin`: Minimum expected package (decimal, in lakhs per annum, optional)
- `expectedPackageMax`: Maximum expected package (decimal, in lakhs per annum, optional)
- `willingToRelocate`: Boolean flag
- `createdAt`, `updatedAt`: Timestamps

**Relations**:
- One-to-one with Student (cascade delete)

**Indexes**: `studentId`

**Constraints**: Unique on `studentId`

**Implementation Note**:
- Array fields can be stored as JSON in PostgreSQL or as TEXT with delimiter-separated values
- Prefer JSON for flexibility and queryability

## 6. Complete Database Relationships

```
User (1) ──────────── (0..1) DepartmentAdmin (M) ──────────── (1) Department
  │                                                                    │
  │                                                                    │
  │ (1)                                                              (1)
  │                                                                    │
  │                                                                    │
  ↓                                                                    ↓
Student (M) ─────────────────────────────────────────────────────────┘
  │
  ├── (1:1) StudentAcademic
  ├── (1:1) StudentPreferences
  ├── (1:M) StudentSkill
  ├── (1:M) StudentProject
  ├── (1:M) StudentExperience
  └── (1:M) StudentCertification
```

## 7. Constraints and Indexes

### Uniqueness Constraints
- ✅ User.clerkId (unique)
- ✅ User.email (unique)
- ✅ Department.code (unique)
- ✅ DepartmentAdmin.userId (unique - one admin account per user)
- Student.userId (unique - one student profile per user)
- Student.rollNumber (unique - institution-wide)
- StudentAcademic.studentId (unique - one academic record per student)
- StudentPreferences.studentId (unique - one preferences record per student)
- StudentSkill.(studentId, skillName) (composite unique - no duplicate skills)

### Foreign Key Constraints
- ✅ DepartmentAdmin.userId → User.id (cascade delete)
- ✅ DepartmentAdmin.departmentId → Department.id (cascade delete)
- Student.userId → User.id (cascade delete)
- Student.departmentId → Department.id (restrict delete)
- StudentAcademic.studentId → Student.id (cascade delete)
- StudentPreferences.studentId → Student.id (cascade delete)
- StudentSkill.studentId → Student.id (cascade delete)
- StudentProject.studentId → Student.id (cascade delete)
- StudentExperience.studentId → Student.id (cascade delete)
- StudentCertification.studentId → Student.id (cascade delete)

### Indexes for Query Performance
- ✅ User: clerkId, email
- ✅ Department: code
- ✅ DepartmentAdmin: departmentId
- Student: userId, departmentId, rollNumber
- StudentAcademic: studentId
- StudentPreferences: studentId
- StudentSkill: studentId
- StudentProject: studentId
- StudentExperience: studentId
- StudentCertification: studentId

## 8. Data Integrity Invariants

1. **Role-Entity Consistency**: A User with role=STUDENT must have exactly one Student record; a User with role=DEPT_ADMIN must have exactly one DepartmentAdmin record
2. **Department Scoping**: Every Student belongs to exactly one Department
3. **Profile Ownership**: All profile data (Academic, Preferences, Skills, Projects, Experience, Certifications) must belong to a valid Student
4. **Cascade Deletion**: Deleting a User cascades to Student and DepartmentAdmin; deleting a Student cascades to all profile data
5. **Department Protection**: A Department with existing Students cannot be deleted (restrict constraint)
6. **One-to-One Relationships**: StudentAcademic and StudentPreferences have unique studentId constraints
7. **Duplicate Prevention**: A student cannot have duplicate skills (enforced by composite unique constraint)

## 9. Profile Sections Summary

Based on project-overview.md, the seven required profile sections are:

1. **Personal**: Name, phone number, photo (deferred to file storage unit)
2. **Academic**: 10th/12th marks, CGPA, semester, backlogs
3. **Skills & Links**: Technical/soft skills, LinkedIn, GitHub, portfolio
4. **Projects**: Title, description, technologies, URL, dates
5. **Experience**: Company, role, description, dates
6. **Certifications**: Name, issuer, dates, credential URL
7. **Preferences**: Roles, locations, company types, package range, relocation

## 10. Profile Completion Requirements

From project-overview.md:

> Profile completion % is computed as a simple ratio across all seven required sections and updates immediately after any profile save — verified by filling one section at a time and confirming the percentage moves accordingly.

**Key Points**:
- Simple ratio: `(required fields filled) / (total required fields)`
- **NOT** weighted by section
- All seven sections are required for 100% completion
- A student with no internship or certification yet will not show 100% until they add one

**Open Question** (documented below):
- The exact required-field checklist per section is not yet defined
- Profile completion calculation is deferred to a later unit
- No completion percentage field is stored in the database (computed on-demand)

## 11. Open Questions

### Unresolved Requirements

1. **Required Fields Checklist**: Which specific fields within each profile section are mandatory vs optional?
   - Example: Is `phoneNumber` required in Personal, or can a student reach 100% without it?
   - Example: How many skills/projects minimum to consider that section "complete"?
   - **Decision deferred**: Profile completion calculation unit will define this

2. **Roll Number Format**: Is there a specific format/pattern for roll numbers (e.g., "CS2021001")?
   - **Decision deferred**: To be validated in Excel upload unit or student registration flow

3. **Skill List**: Is there a predefined list of skills (autocomplete), or free-form text entry?
   - **Decision deferred**: UI implementation unit

4. **Date Validations**: Should start dates be before end dates? Should dates be in the past?
   - **Decision**: Enforce in server actions/Zod schemas, not database constraints

5. **Array Field Storage**: Should preference arrays (roles, locations, company types) be stored as JSON or delimited text?
   - **Decision**: Use JSON for flexibility and PostgreSQL native support

6. **CGPA Scale**: Is CGPA out of 10, or does it vary by institution?
   - **Assumption**: 0-10 scale (most common in Indian institutions)
   - To be validated in UI/server actions

## 12. Verification Plan

### Prisma Validation
- [x] Run `npx prisma validate` to ensure schema syntax is correct
- [x] Run `npx prisma generate` to generate TypeScript types
- [ ] Run `npx prisma migrate dev` if database connection available

### TypeScript Type Checking
- [ ] Run `npx tsc --noEmit` to verify no type errors
- [ ] Verify Prisma-generated types are imported correctly

### ESLint
- [ ] Run `npm run lint` to ensure code style compliance

### Unit Tests (Vitest)
- [ ] Install Vitest and testing dependencies
- [ ] Create tests for database invariants:
  - User-Student relationship (one-to-one)
  - Student-Department relationship (many-to-one)
  - Unique constraints (rollNumber, userId)
  - Cascade deletion behavior
  - Foreign key constraints

### Build Verification
- [ ] Run `npm run build` to ensure Next.js builds successfully
- [ ] Verify no build-time errors related to new models

## 13. Implementation Checklist

### 02A — Core Database Schema
- [x] Role enum (STUDENT, DEPT_ADMIN, SUPER_ADMIN)
- [x] User model with Clerk integration
- [x] Department model
- [x] DepartmentAdmin model
- [x] Relationships and constraints
- [x] Indexes

### 02B — Student Core Data Model
- [ ] Add Student model to schema.prisma
- [ ] Add Student → User relationship (one-to-one)
- [ ] Add Student → Department relationship (many-to-one)
- [ ] Add rollNumber field with unique constraint
- [ ] Add linkedinUrl, githubUrl, portfolioUrl fields to Student
- [ ] Add indexes for userId, departmentId, rollNumber

### 02C — Student Profile Structure
- [ ] Add SkillType enum
- [ ] Add StudentAcademic model (one-to-one)
- [ ] Add StudentPreferences model (one-to-one)
- [ ] Add StudentSkill model (many-to-one)
- [ ] Add StudentProject model (many-to-one)
- [ ] Add StudentExperience model (many-to-one)
- [ ] Add StudentCertification model (many-to-one)
- [ ] Add all relationships and constraints
- [ ] Add all indexes

### Testing & Verification
- [ ] Install Vitest
- [ ] Create database invariant tests
- [ ] Run all verification steps

### Documentation
- [ ] Update progress-tracker.md
- [ ] Document any deferred decisions

## 14. Migration Strategy

### If Database Connection Available (Neon PostgreSQL)
1. Run `npx prisma migrate dev --name student_profile_foundation`
2. Verify migration creates all new tables
3. Test relationships with sample data in Prisma Studio

### If Database Connection NOT Available
1. Run `npx prisma validate` to verify schema
2. Run `npx prisma generate` to create TypeScript types
3. Document that migration is pending database connection
4. Provide migration instructions in DATABASE_SETUP.md

## 15. Next Steps After Unit 02

**Unit 03 — Authentication & Role Synchronization**
- Student registration flow with Clerk
- Email verification (OTP)
- Role assignment and synchronization
- User-Student record creation
- Super admin seed script

**Do NOT implement Unit 03 in this unit.**

---

## Summary

Unit 02 establishes the complete database foundation for student profiles:
- **02A** (Complete): Core identity/organization models
- **02B** (To Implement): Student core model linking to User and Department
- **02C** (To Implement): Seven profile sections with appropriate relational structure

This provides the data layer for all student-facing features and department-scoped queries in subsequent units.
