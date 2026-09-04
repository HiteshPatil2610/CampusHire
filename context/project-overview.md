# CampusHire

## Overview

CampusHire is a campus placement management platform for a single college with multiple departments. It gives students one place to build a placement profile and view/apply to eligible recruitment drives, gives department admins tools to manage their department's students and post drives, and gives a super admin oversight across all departments and admin accounts. The platform replaces spreadsheet-and-email placement coordination with a structured, role-based system where eligibility, student data, and drive postings live in one source of truth.

## Goals

1. A student can register with their college email, complete their placement profile, and see only the drives they are eligible for — with zero manual filtering by staff.
2. A department admin can onboard an entire batch of students in one bulk Excel upload, with clear row-level validation before anything is committed.
3. A department admin can post a drive with explicit eligibility rules (CGPA, backlogs, departments) and have the system auto-filter which students can see and apply to it.
4. A super admin can manage departments and department-admin accounts, and see a system-wide audit trail of key actions.
5. Every role-restricted action is enforced server-side — no role, department scope, or eligibility check ever depends on client-side logic.

## Core User Flow

**Student**
1. Student registers with college email, name, roll number, and department (self-serve).
2. Student verifies their college email via a one-time code sent by Clerk during sign-up.
3. Student logs in and lands on their dashboard (profile completion %, quick actions, notifications).
4. Student fills out their profile across tabs: personal info, academic info, skills & links, projects, experience, certifications, placement preferences.
5. Student views the list of drives they are eligible for (auto-filtered by the system) and applies in-app or via an external link. An application is final once submitted — no editing or withdrawing.
6. Once a drive's application deadline passes, it auto-closes and moves out of the student's active list into their application history — it does not disappear from the system, it's simply no longer actionable.

**Department Admin** (account created by super admin — no public sign-up)
1. Department admin logs in and lands on their department dashboard (student count, avg profile completion, avg readiness, upcoming drives).
2. Department admin bulk-adds students via Excel upload: download template → upload file → review row-level validation (valid / duplicate / missing field) → import only valid rows.
3. Department admin posts a new drive: company, role, job description, eligibility criteria (min CGPA, max backlogs, eligible departments), package, rounds, drive date, application deadline, apply method.
4. Eligible students are notified in-app; the drive appears only in the eligible students' drive list. Once the deadline passes, the drive auto-closes for everyone.
5. Department admin can search/filter their student roster and view/edit individual student records.

A department can have more than one department admin (e.g. a primary and a backup) — all admins assigned to a department have identical access to that department's data; there is no sub-role hierarchy among department admins.

**Super Admin** (single account, provisioned outside the app)
1. Super admin logs in and lands on a system-wide dashboard (total students, department count, admin count, overall placement %).
2. Super admin adds/manages departments (name, code, active/inactive status).
3. Super admin adds/manages department-admin accounts, assigning each admin to exactly one department — a department itself may have several admins assigned to it.
4. Super admin reviews the audit log of key actions taken across the system (imports, drive postings, department/admin changes).

## Features

### Authentication & Roles
- College-email self-registration for students, with email verification
- Department admin and super admin accounts created by the super admin — no public sign-up for those roles
- Three roles: `STUDENT`, `DEPT_ADMIN`, `SUPER_ADMIN`, enforced at every route and mutation

### Student Profile
- Personal info, academic info (10th/12th marks, current CGPA, semester, active backlogs), skills & links (technical/soft skill tags, LinkedIn/GitHub/portfolio), projects, internships/experience, certifications, placement preferences (roles, locations, company type, expected package)
- **Profile completion %**: all seven sections (Personal, Academic, Skills & Links, Projects, Experience, Certifications, Preferences) are required. Completion is a simple ratio — `(required fields filled across all sections) / (total required fields)` — not weighted by section. This is a deliberate choice: reaching 100% is meant to be a real achievement, not a formality, so a student with no internship or certification yet will not show 100% until they add one. The exact required-field list per section is defined when that feature is spec'd (see `context/specs/`), not here — this file fixes the *rule* (all sections count, simple ratio), not the field-by-field checklist.

### Department Admin — Student Management
- Searchable, filterable student roster scoped to the admin's own department
- Bulk student onboarding via Excel/CSV upload with a downloadable template, row-level validation (valid / duplicate roll number / missing email), and an error report for rejected rows
- View and edit individual student records

### Drives & Eligibility Matching
- Post a drive with company, role, job description (upload or paste), eligibility rules (min CGPA, max backlogs, eligible departments), package, selection rounds, drive date, application deadline, and apply method (in-app or external link)
- Server-side eligibility filtering — a student only ever sees drives they qualify for
- A student can apply to an eligible drive exactly once. Applications are final — no edit, no withdrawal, no reapplying. This keeps applicant counts and admin reporting trustworthy without needing an amendment workflow in V1.
- A drive auto-closes the moment its application deadline passes: it's removed from every eligible student's *active* drive list and moves to their application history (if they applied) or simply stops appearing (if they didn't). It remains visible to admins in the "active & past drives" table with a "Closed" status — nothing is deleted.
- Active/past drives list with applicant counts and status

### Super Admin — Institution Oversight
- Manage departments (add, view student counts, activate/deactivate)
- Manage department-admin accounts (add, assign to exactly one department, edit). A department may have multiple admins assigned to it (e.g. primary + backup); all admins on a department share identical, undifferentiated access to that department's data — there is no primary/backup permission distinction in the system itself, it's purely an organizational label the college uses.
- System-wide audit log of imports, drive postings, and admin/department changes

## Scope

### In Scope (V1)
- Student self-registration with college-email verification
- Role-based access for Student, Department Admin, Super Admin
- Full student profile management (all tabs from the prototype)
- Excel/CSV bulk student upload with validation
- Drive posting with eligibility criteria and server-side eligibility matching
- Department and department-admin management for the super admin
- Audit logging of key admin actions
- Profile photo upload and job description PDF upload (file storage)
- Email-based OTP/verification during sign-up

### Out of Scope (V1 — deferred to a later phase)
- Resume builder
- AI resume analyzer / resume scoring
- Self-assessment tools and the numeric readiness score
- Multi-college / multi-tenant support — the system assumes a single college
- Resume PDF storage and management
- Transactional email beyond sign-up verification (drive-alert emails, bulk-upload credential emails) — these surface as in-app notifications only in V1
- Payments or billing of any kind
- Native mobile apps

## Success Criteria

1. A student can register with a college email, verify it, log in, and reach a profile that is at least 70% complete without any developer intervention.
2. Profile completion % is computed as a simple ratio across all seven required sections and updates immediately after any profile save — verified by filling one section at a time and confirming the percentage moves accordingly.
3. A department admin can upload a 50-row Excel file and see accurate valid/duplicate/missing-field results before importing.
4. When a department admin posts a drive with eligibility criteria, only students who meet those criteria see it in their dashboard — verified by testing with students above and below the CGPA/backlog thresholds.
5. A student can submit exactly one application to an eligible drive; a second attempt (via UI or direct request) is rejected, and there is no path to edit or withdraw an existing application.
6. A drive automatically disappears from students' active drive lists the moment its deadline passes, while remaining visible to admins as "Closed" — verified by testing with a deadline in the past.
7. A department admin cannot view or edit a student outside their own department, verified by attempting cross-department access and confirming it is rejected.
8. Two admins assigned to the same department have identical read/write access to that department's students and drives — verified by testing actions from both accounts.
9. The super admin can add a department and a department admin, and that admin can immediately log in and see only their assigned department's data.
10. `npm run build` passes and there are no TypeScript or console errors across all three role dashboards.