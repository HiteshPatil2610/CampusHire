# CampusHire

## Overview

CampusHire is a campus placement management platform for a single college with multiple departments. It gives students one place to build a placement profile and view/apply to eligible recruitment drives, gives department admins tools to manage their department's students and post drives, and gives a super admin oversight across all departments and admin accounts. The platform replaces spreadsheet-and-email placement coordination with a structured, role-based system where eligibility, student data, and drive postings live in one source of truth.

## Goals

1. A student can register with their college email, complete their placement profile, and see only the drives they are eligible for — with zero manual filtering by staff.
2. A department admin can onboard an entire batch of students in one bulk Excel upload, with clear row-level validation before anything is committed.
3. Drives run as a **Master Drive → Department Drive** workflow: the Super Admin defines a company drive once and assigns it to chosen departments; each department admin configures and publishes their own department's version; the system auto-filters which students can see and apply to it through one eligibility rule engine.
4. A super admin can manage departments and department-admin accounts, and see a system-wide audit trail of key actions.
5. Every role-restricted action is enforced server-side — no role, department scope, or eligibility check ever depends on client-side logic.

## Core User Flow

**Student**
1. Student signs up with their college email, then verifies against the department's roster with MIS number, name, phone, roll number, department and batch (PRN optional).
2. Student verifies their college email via a one-time code sent by Clerk during sign-up.
3. Student logs in and lands on their dashboard (profile completion %, quick actions, notifications).
4. Student fills out their profile across tabs: personal info, academic info, skills & links, projects, experience, certifications, placement preferences.
5. Student views the list of drives they are eligible for (auto-filtered by the system) and applies in-app or via an external link. An application is final once submitted — no editing or withdrawing.
6. Once a drive's application deadline passes, it auto-closes and moves out of the student's active list into their application history — it does not disappear from the system, it's simply no longer actionable.

**Department Admin** (account created by super admin — no public sign-up)
1. Department admin logs in and lands on their department dashboard (student count, avg profile completion, avg readiness, upcoming drives).
2. Department admin bulk-adds students via Excel upload: download template → upload file → review row-level validation (valid / duplicate / missing field) → import only valid rows.
3. Department admin receives drives the Super Admin assigned to their department and configures each in seven steps: drive details, student auto-fill fields, eligibility criteria, eligible batches, recruitment stage review, a final student preview, and publish. Progress saves as a draft at any step and can be resumed. A department can still post a drive of its own.
4. Publishing is validated on the server. Eligible students of that department (and only those) are notified in-app; the drive appears only in their list. Once the deadline passes, the drive auto-closes. After publishing, the department's configuration is read-only.
5. Department admin runs the recruitment: moves applicants through the drive's configured stages, records outcomes, and can record an off-campus placement. A placed student is permanently excluded from new drives.
6. Department admin can search/filter their student roster and view/edit individual student records.

A department can have more than one department admin (e.g. a primary and a backup) — all admins assigned to a department have identical access to that department's data; there is no sub-role hierarchy among department admins.

**Super Admin** (single account, provisioned outside the app)
1. Super admin logs in and lands on a system-wide dashboard (total students, department count, admin count, overall placement %).
2. Super admin adds/manages departments (name, code, active/inactive status).
3. Super admin adds/manages department-admin accounts, assigning each admin to exactly one department — a department itself may have several admins assigned to it.
4. Super admin creates a Master Drive in five steps (master details, which details departments may edit, recruitment stages, review, department assignment), approves or rejects department requests to change recruitment stages, and can cancel a drive or extend a published drive's deadline.
5. Super admin reviews the audit log of key actions taken across the system (imports, drive postings, cancellations, deadline extensions, approvals, department/admin changes).

## Features

### Authentication & Roles
- Student accounts originate from the department admin's imported roster. A student who signs up and matches that roster — by MIS number, cross-checked on name, roll number, department and batch, with the verified email — gets access immediately; one who does not is held for admin approval rather than admitted automatically
- College-email sign-up for students, with Clerk email verification
- Department admin and super admin accounts created by the super admin — no public sign-up for those roles
- Three roles: `STUDENT`, `DEPT_ADMIN`, `SUPER_ADMIN`, enforced at every route and mutation

### Student Profile
- Entry type (regular after 12th, or lateral entry after a diploma) chosen at registration and fixed thereafter; it decides which pre-college records the profile asks for and which semesters exist
- Personal info, academic info (10th, then 12th **or** diploma depending on entry type, current CGPA, semester, active backlogs), skills & links (technical/soft skill tags, LinkedIn/GitHub/portfolio), projects, internships/experience, certifications, placement preferences (roles, locations, company type, expected package)
- **Profile completion %**: all seven sections (Personal, Academic, Skills & Links, Projects, Experience, Certifications, Preferences) are required. Completion is a simple ratio — `(required fields filled across all sections) / (total required fields)` — not weighted by section. This is a deliberate choice: reaching 100% is meant to be a real achievement, not a formality, so a student with no internship or certification yet will not show 100% until they add one. The exact required-field list per section is defined when that feature is spec'd (see `context/specs/`), not here — this file fixes the *rule* (all sections count, simple ratio), not the field-by-field checklist.

### Department Admin — Student Management
- Searchable, filterable student roster scoped to the admin's own department
- Bulk student onboarding via Excel/CSV upload (MIS NO., PRN NO., NAME, EMAIL, PH. NO., ROLL NO., DEPT, BATCH) with a downloadable template, row-level validation carrying every error tag a row has (missing field, invalid email/phone, duplicate MIS/PRN/roll number within the file or already registered), import of the clean rows only, an error review, and an exportable error sheet
- A student's batch is their expected passout year (2027), shown as its label (2023-27)
- View and edit individual student records

### Drives & Eligibility Matching
- **Master Drive** (Super Admin): company, logo, package, role, job description, dates, apply method, the master recruitment pipeline, and which details departments may edit (locked unless opened). Assigned only to the departments selected.
- **Department Drive** (department admin): the department's own version — allowed overrides of the master, logistics, a per-department application form (which student fields appear, auto-fill, are editable or mandatory), an eligibility rule set including batch targeting, and its recruitment stages. Lifecycle: assigned → configured → published → closed/archived, or cancelled.
- Configurable, versioned **recruitment pipelines** per department drive (typed stages, stage history). Department changes to a Super Admin drive's stages go through Super Admin approval.
- One server-side **eligibility rule engine** (department, placement status, batch, academics, skills and more) decides what a student sees, whether they may apply, and who is notified.
- A student can apply to an eligible, published drive exactly once. The server decides everything about the submission and stores an immutable snapshot of what the student saw and submitted. Applications are final — no edit, no withdrawal, no reapplying — and survive cancellation of the drive.
- **Placement is explicit and permanent:** a placement record (created when an application is marked selected, or recorded for an off-campus offer) excludes the student from new drives. A mistake is revoked with a reason, never deleted.
- A drive auto-closes the moment its application deadline passes: it's removed from every eligible student's *active* drive list and moves to their application history (if they applied) or simply stops appearing (if they didn't). It remains visible to admins in the "active & past drives" table with a "Closed" status — nothing is deleted.
- Active/past drives list with applicant counts and status

### Super Admin — Institution Oversight
- Manage departments (add, view student counts, activate/deactivate)
- Manage department-admin accounts. An admin is **invited by email**, never created here: CampusHire issues no credential and Clerk owns the sign-up and the password. Access is taken away by **disabling**, not deleting — the account, its history and the drives it published all stay, and from that moment every department-scoped path refuses it. An admin belongs to exactly one department and can be moved to another. A department may have multiple admins (e.g. primary + backup); all of them share identical, undifferentiated access to that department's data — there is no primary/backup permission distinction in the system itself, it's purely an organizational label the college uses.
- **Announcements and notifications.** One notification architecture with a single writer, per-event mutes, and a delivery record the Super Admin can inspect and re-send. Announcements are a first-class entity: a draft notifies nobody, publishing notifies once, archiving expires what it sent. Targeting is decided from the session, never the request.
- **Institution and department settings** — the placement season, default eligibility bars, the default pipeline — and only settings something actually reads.
- **Dashboards and exports.** Each role's "action required" list is computed from current state on every render and never stored, so it cannot go stale. A drive's datasets (eligible, applicants, shortlisted, selected, placed and so on) export to CSV with the actor, the drive, the department and the columns all decided server-side.
- System-wide audit log of imports, drive postings, admin and department changes, exports and bulk operations

## Scope

### In Scope (V1)
- Student sign-up with college-email verification, gated on either matching the imported roster or a department admin approving the request
- Role-based access for Student, Department Admin, Super Admin
- Full student profile management (all tabs from the prototype)
- Excel/CSV bulk student upload with validation
- Master Drive → Department Drive workflow with Super Admin edit permissions, department assignment, per-department configuration and server-validated publishing
- Configurable, versioned recruitment pipelines with Super Admin approval of department changes
- Immutable, server-decided applications with a submission snapshot
- Explicit placement records and permanent exclusion of placed students
- Drive cancellation and controlled deadline extension, both audited
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
- Transactional email beyond sign-up verification and the department admin invitation, which Clerk sends (drive-alert emails, bulk-upload credential emails) — these surface as in-app notifications only in V1, and no screen claims an email was sent. Notification preferences therefore control in-app delivery only, and time-based notifications (a closing deadline, a scheduled announcement) are materialised on the next visit rather than by a scheduler.
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
10. A department admin cannot publish an incomplete drive, and cannot change a master field the Super Admin locked — verified by attempting both directly against the server action.
11. A cancelled drive accepts no applications and disappears for students who did not apply, while every existing application, snapshot and stage history is preserved.
12. `npm run build` passes and there are no TypeScript or console errors across all three role dashboards.