# CampusHire — Full System Architecture, Component Blueprint & Backend/Database Specification

> **Version:** 1.0.0  
> **Status:** Production Blueprint & Integration Specification  
> **Target Audience:** Full-Stack Developers, Backend Engineers, Database Architects, DevOps Engineers, and System Integrators.

---

## Table of Contents

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
   - 1.1 [High-Level Architectural Topology](#11-high-level-architectural-topology)
   - 1.2 [Multi-Tenant Role-Based Access Control (RBAC) Matrix](#12-multi-tenant-role-based-access-control-rbac-matrix)
2. [Frontend Architecture & Component Blueprint](#2-frontend-architecture--component-blueprint)
   - 2.1 [Global Providers, App Shell & Layouts](#21-global-providers-app-shell--layouts)
   - 2.2 [Design System Primitives (`src/components/ui/`)](#22-design-system-primitives-srccomponentsui)
   - 2.3 [Domain Modules & Component Hierarchy](#23-domain-modules--component-hierarchy)
   - 2.4 [Routing Architecture & Paths Registry](#24-routing-architecture--paths-registry)
3. [Backend Stack & Infrastructure Requirements](#3-backend-stack--infrastructure-requirements)
   - 3.1 [Core Services & Recommended Tech Stack](#31-core-services--recommended-tech-stack)
   - 3.2 [Authentication, Sessions & JWT Security](#32-authentication-sessions--jwt-security)
   - 3.3 [File & Document Storage Architecture](#33-file--document-storage-architecture)
   - 3.4 [Background Workers & Job Queue Engine](#34-background-workers--job-queue-engine)
   - 3.5 [External Integrations (AI / ATS, Email, SMS)](#35-external-integrations-ai--ats-email-sms)
4. [Complete Database Schema Specification](#4-complete-database-schema-specification)
   - 4.1 [Entity Relationship Diagram (Conceptual)](#41-entity-relationship-diagram-conceptual)
   - 4.2 [SQL Table Definitions & Column Specifications](#42-sql-table-definitions--column-specifications)
5. [Complete Dummy Data Inventory & Backend Replacement Mapping](#5-complete-dummy-data-inventory--backend-replacement-mapping)
   - 5.1 [Primary Mock File: `src/data/mockData.js`](#51-primary-mock-file-srcdatamockdatajs)
   - 5.2 [Placement Drive Store: `src/data/driveStore.js`](#52-placement-drive-store-srcdatadrivestorejs)
   - 5.3 [Client-Side Fake Persistence: `src/context/AppStateContext.jsx`](#53-client-side-fake-persistence-srccontextappstatecontextjsx)
   - 5.4 [Application Fields Catalog: `src/data/applicationFieldsCatalog.js`](#54-application-fields-catalog-srcdataapplicationfieldscatalogjs)
   - 5.5 [Inline Screen & Form Dummy Data](#55-inline-screen--form-dummy-data)
   - 5.6 [Auth Simulation Flows (Login, OTP, Password Reset)](#56-auth-simulation-flows-login-otp-password-reset)
6. [API Specification & REST Endpoint Contract](#6-api-specification--rest-endpoint-contract)
   - 6.1 [Authentication & Account Endpoints (`/api/auth`)](#61-authentication--account-endpoints-apiauth)
   - 6.2 [Student Profile & Resume Endpoints (`/api/students`)](#62-student-profile--resume-endpoints-apistudents)
   - 6.3 [Placement Drives & Applications Endpoints (`/api/drives`, `/api/applications`)](#63-placement-drives--applications-endpoints-apidrives-apiapplications)
   - 6.4 [Department Admin Endpoints (`/api/admin`)](#64-department-admin-endpoints-apiadmin)
   - 6.5 [Super Admin / Institutional TPO Endpoints (`/api/superadmin`)](#65-super-admin--institutional-tpo-endpoints-apisuperadmin)
   - 6.6 [Notifications, Feeds & Audit Endpoints (`/api/notifications`, `/api/audit-logs`)](#66-notifications-feeds--audit-endpoints-apinotifications-apiaudit-logs)
7. [Step-by-Step Integration & Migration Plan](#7-step-by-step-integration--migration-plan)
   - 7.1 [Phase 1: Environment & Token Interceptors](#71-phase-1-environment--token-interceptors)
   - 7.2 [Phase 2: Database Provisioning & Seed Data](#72-phase-2-database-provisioning--seed-data)
   - 7.3 [Phase 3: Replacing Context State with Server State (React Query)](#73-phase-3-replacing-context-state-with-server-state-react-query)
   - 7.4 [Phase 4: Real-time Eligibility & Application Engine](#74-phase-4-real-time-eligibility--application-engine)
   - 7.5 [Phase 5: Cleaning Up Deprecated Mock Files](#75-phase-5-cleaning-up-deprecated-mock-files)

---

## 1. Executive Summary & System Architecture

**CampusHire** is an enterprise-grade, multi-tenant university placement automation and student career readiness platform. It bridges the gap between:
1. **Students**: Who build ATS-compliant resumes, monitor campus readiness scores, discover campus recruitment drives, verify their eligibility in real-time, submit applications with custom required fields, and track recruitment interview stages.
2. **Department Placement Coordinators (Dept Admins)**: Who curate departmental student rosters, bulk-import student records via Excel, verify academic backlogs and marks, post department-specific hiring drives with logistical parameters (venue, PPT links, reporting slots), review candidate submissions, and broadcast announcements.
3. **Training & Placement Officers (Super Admins / Central TPO)**: Who oversee institutional placement operations, manage institution-wide Central Placement Drives, monitor cross-department placement matrices, provision staff accounts, audit all system actions, and export regulatory NIRF/NAAC placement analytics.

### 1.1 High-Level Architectural Topology

```
+--------------------------------------------------------------------------------------------------+
|                                      CLIENT TIER (BROWSER)                                       |
|                                                                                                  |
|   React 18 SPA (Vite) + Tailwind Design Tokens CSS                                              |
|   ├── State: Server State (React Query / SWR) + ToastContext                                     |
|   ├── Routing: React Router DOM v6 (Centralized PATHS)                                           |
|   ├── Components: AppShell, DriveCard, DatePicker, UrlField, ApplicationReviewModal              |
|   └── HTTP Client: Fetch Wrapper (src/api/client.js) with Bearer Token Authorization            |
+------------------------------------------------+-------------------------------------------------+
                                                 | HTTPS / REST JSON + Multipart FormData
                                                 v
+--------------------------------------------------------------------------------------------------+
|                                    API GATEWAY / SERVER TIER                                     |
|                                                                                                  |
|   Node.js (Express/NestJS) / Python (FastAPI) / Go / Java (Spring Boot)                          |
|   ├── Middleware: CORS, Helmet, Rate Limiter, Request Logger, Error Handler                      |
|   ├── Auth Middleware: JWT Signature Validation, Token Expiry Check, RBAC Enforcer               |
|   ├── Domain Controllers:                                                                        |
|   │   ├── AuthController (/api/auth)                                                             |
|   │   ├── StudentController (/api/students)                                                      |
|   │   ├── DriveController (/api/drives, /api/applications)                                       |
|   │   ├── AdminController (/api/admin)                                                           |
|   │   ├── SuperAdminController (/api/superadmin)                                                 |
|   │   └── NotificationController (/api/notifications)                                            |
|   └── Service Layer: Business rules, eligibility calculations, PDF generator, Excel parser       |
+-------------------+----------------------------+-----------------------------+-------------------+
                    |                            |                             |
                    v                            v                             v
+-----------------------+    +-----------------------+    +------------------------+    +------------------+
|   PRIMARY DATABASE    |    |     CACHE & QUEUE     |    |   OBJECT / BLOB STORE  |    |  EXTERNAL APIS   |
|   (PostgreSQL/MySQL)  |    |     (Redis + BullMQ)  |    |   (AWS S3 / GCS /      |    |                  |
|                       |    |                       |    |    MinIO)              |    |  Gemini AI API   |
|  - Users & Auth       |    |  - Session Store      |    |                        |    |  (ATS Resume &   |
|  - Students & Profiles|    |  - OTP Invalidation   |    |  - Student Resumes PDF |    |   Job Matching)  |
|  - Placement Drives   |    |  - Rate Limit Buckets |    |  - Candidate Avatars   |    |  SMTP / SendGrid |
|  - Applications       |    |  - Async Mail Queue   |    |  - Excel Batch Uploads |    |  (Alerts/Notifs) |
|  - Audit Log Trail    |    |  - AI Resume Parser   |    |  - Company Logos       |    |  Twilio / SMS    |
+-----------------------+    +-----------------------+    +------------------------+    +------------------+
```

### 1.2 Multi-Tenant Role-Based Access Control (RBAC) Matrix

| Entity / Resource | Public User | Student (`student`) | Department Admin (`admin`) | Super Admin / TPO (`superadmin`) |
|---|---|---|---|---|
| **Public Landing & Info** | Read | Read | Read | Read |
| **Auth (Login/Register/Reset)** | Create | Deny (Already Authenticated) | Deny (Already Authenticated) | Deny (Already Authenticated) |
| **Student Own Profile** | Deny | Read / Update | Read (Scoped to Dept) | Read (Institutional) |
| **Student Academic Details** | Deny | Read / Submit Update | Read / Verify / Edit (Dept) | Read / Audit |
| **Resume Builder & AI Score** | Deny | Read / Create / Optimize | Read (Candidate Resumes) | Read (Candidate Resumes) |
| **Readiness Dashboard** | Deny | Read (Personal) | Read (Dept Aggregates) | Read (Institutional Aggregates) |
| **Department Drives** | Deny | Read (If eligible) / Apply | Create / Read / Update (Own Dept) | Read / Audit / Delete |
| **Central Institutional Drives** | Deny | Read (If eligible) / Apply | Read / View Dept Logistics | Create / Read / Update / Publish |
| **Job Applications** | Deny | Create / Read Own / Withdraw | Read (Dept) / Update Stage | Read All / Export CSV |
| **Excel Student Roster Upload**| Deny | Deny | Upload / Validate / Commit | Upload All / Global Commit |
| **Announcements** | Deny | Read (Own Dept & Central) | Create (Dept) / Read | Create (Institution-wide) / Read |
| **Admin Accounts Management** | Deny | Deny | Deny | Create / Update / Revoke |
| **Audit Logs** | Deny | Deny | Deny | Read (Full Search / Filter) |

---

## 2. Frontend Architecture & Component Blueprint

The client is built on **React 18 with Vite**, adhering to clean unidirectional data flow, component modularity, and strict CSS tokenization without hardcoded styling.

### 2.1 Global Providers, App Shell & Layouts

1. **`AppShell` (`src/components/layout/AppShell.jsx`)**:
   - Authenticated frame that hosts the responsive `Sidebar` and `Topbar`.
   - Injects the authenticated user identity (`role`, `initials`, `name`, `department`).
   - Dynamically adapts menus based on user role (`student`, `admin`, `superadmin`).
   - Contains navigation active-state management and mobile slide-out toggling.
2. **`Sidebar` (`src/components/layout/Sidebar.jsx`)**:
   - Renders role-specific navigation links sourced from `src/routes/paths.js`.
   - Displays unread notifications badge count in real time.
3. **`Topbar` (`src/components/layout/Topbar.jsx`)**:
   - Displays breadcrumb/view title, search bar, active user profile pill, and notification drop trigger.
4. **`ToastContext` (`src/context/ToastContext.jsx`)**:
   - Enterprise notification queue supporting `success`, `error`, `warning`, and `info` alerts.
   - Non-blocking auto-dismissal after 4000ms.
5. **`AppStateContext` (`src/context/AppStateContext.jsx`)**:
   - Current client-side demonstration store (simulates applied drives, read notifications, profile scores).
   - **Target for Backend Migration:** To be replaced with server-side caching (see Section 7.3).

### 2.2 Design System Primitives (`src/components/ui/`)

| Component | Path | Functionality & Parameters |
|---|---|---|
| **`Button`** | `src/components/ui/Button.jsx` | Variants: `primary`, `secondary`, `outline`, `danger`, `ghost`. Sizes: `sm`, `md`, `lg`. Supports `loading` spinners and icon slots. |
| **`Badge`** | `src/components/ui/Badge.jsx` | Semantic chips with variants: `green` (placed/eligible), `amber` (review/warning), `red` (deadline passed/rejected), `purple` (upcoming), `gray` (closed/neutral), `accent` (primary). |
| **`Modal`** | `src/components/ui/Modal.jsx` | Accessible dialog with backdrop blur, `Esc` key dismissal, focus trap, and customizable action footer. |
| **`DatePicker`** | `src/components/ui/DatePicker.jsx` | Standalone dropdown calendar featuring **direct Month & Year `<select>` dropdowns** for rapid navigation across decades, keyboard arrows, and "Today" / "Clear" shortcuts. |
| **`UrlField`** | `src/components/ui/UrlField.jsx` | URL input container featuring auto-prefixing (`https://`, `linkedin.com/in/`, `github.com/`), automatic prefix stripping on paste, and a direct `↗` launch button with disabled state handling. |
| **`KpiCard`** | `src/components/ui/KpiCard.jsx` | Metric tile displaying numeric KPI, title, trend delta pill (+/- percentage), and icon. |
| **`Gauge`** | `src/components/ui/Gauge.jsx` | Circular SVG progress meter for overall readiness score (0–100) with color tier transitions. |
| **`ProgressBar`** | `src/components/ui/ProgressBar.jsx` | Linear progress bar for profile completion percentage with animated fill. |
| **`TagInput`** | `src/components/ui/TagInput.jsx` | Tokenized chip input for technical skills, certifications, and preferred job locations. |
| **`Pagination`** | `src/components/ui/Pagination.jsx` | Accessible table pagination with page numbers, jump-to-page, and rows-per-page selector. |

### 2.3 Domain Modules & Component Hierarchy

#### A. Student Experience
- **`DriveCard` (`src/components/drives/DriveCard.jsx`)**:
  - Central placement card showing company avatar, package/CTC, min CGPA, target departments, deadline counter.
  - **Dynamic Eligibility Evaluation**: Injects student profile and computes CGPA and department matching in real time (`✓ Eligible` or `⚠ CGPA 7.5+ required`).
  - **Expandable Details Drawer**: Shows comprehensive Job Description, selection round breakdown, venue, reporting time, contact person, and career/meeting URLs.
  - **Action Flow Buttons**: "Apply Now", "View Application", "Edit Application", and "Withdraw".
- **`ApplicationReviewModal` (`src/components/drives/ApplicationReviewModal.jsx`)**:
  - Two-column pre-submission review showing verified student information (CGPA, roll number, backlogs) and dynamic drive fields (resume selection, custom question answers, portfolio/GitHub URLs).
- **`WithdrawModal` (`src/components/drives/WithdrawModal.jsx`)**:
  - Cancellation confirmation capturing withdrawal reason (e.g., "Accepted another offer", "Not interested in role").
- **Student Profile Tab Engine (`src/components/student/profile/`)**:
  - `ProfileHeaderStrip.jsx`: Overall avatar, completion gauge, student ID, and instant contact badges.
  - `TabPersonalInfo.jsx`: Legal name, DOB (via `DatePicker`), contact numbers, address.
  - `TabAcademicInfo.jsx`: 10th, 12th/Diploma, Semester-by-semester SGPA/CGPA, active backlog count.
  - `TabSkillsLinks.jsx`: Primary tech stack tags, LinkedIn/GitHub links via `UrlField`.
  - `TabProjects.jsx`: Project cards with live demo and GitHub repository links.
  - `TabExperience.jsx`: Internships, roles, tenure dates, and contribution summaries.
  - `TabCertifications.jsx`: Licensures, credential IDs, and verification URLs.
  - `TabPreferences.jsx`: Preferred roles, target CTC, willingness to relocate.
- **`AiAnalyzerPage` & `ResumeBuilderPage`**:
  - Interactive ATS resume scoring, keyword deficiency analysis, and AI suggestion triggers.

#### B. Department Admin Experience
- **`AdminDriveLogisticsPanel` (`src/components/admin/drives/AdminDriveLogisticsPanel.jsx`)**:
  - Form module for setting on-campus reporting venue, reporting slot time, student coordinator POC, contact phone, and virtual Pre-Placement Talk (PPT) URL via `UrlField`.
- **`AdminApplicationFieldsPanel` (`src/components/admin/drives/AdminApplicationFieldsPanel.jsx`)**:
  - Dynamic field toggle matrix enabling coordinators to select which student attributes are mandatory for a drive.
- **`ExcelUploadPage` (`src/pages/admin/ExcelUploadPage.jsx`)**:
  - Drag-and-drop file ingestion, client-side table parsing preview, validation error highlighting, and commit flow.
- **`AnnouncementsPage` (`src/pages/admin/AnnouncementsPage.jsx`)**:
  - Department bulletin composer with optional deadline date (`DatePicker`) and external document link (`UrlField`).

#### C. Super Admin / Institutional TPO Experience
- **`SuperAdminDrivesPage` (`src/pages/superadmin/SuperAdminDrivesPage.jsx`)**:
  - Master view of all campus drives with modal to post institution-wide central drives, configure department eligibility, and edit logistics.
- **`DepartmentManagementPage` & `GlobalReportsPage`**:
  - Cross-department placement ratios, total offers, highest/average packages, and exportable audit summaries.
- **`AdminAccountsPage` (`src/pages/superadmin/AdminAccountsPage.jsx`)**:
  - Staff user provisioning, department assignment, and access revocation.
- **`AuditLogPage` (`src/pages/superadmin/AuditLogPage.jsx`)**:
  - Immutable audit trail of administrative actions, status changes, and data modifications.

### 2.4 Routing Architecture & Paths Registry

All frontend application routes are defined once in `src/routes/paths.js` and wired in `src/App.jsx`:

```javascript
// src/routes/paths.js
export const PATHS = {
  // Public
  landing: '/',
  login: '/login',
  register: '/register',
  otp: '/verify-otp',
  forgotPassword: '/reset-password',

  // Student
  home: '/student',                          // Active drives catalog
  dashboard: '/student/dashboard',          // Overview & quick stats
  profile: '/student/profile',              // 7-tab profile editor
  resumeBuilder: '/student/resume-builder', // Interactive resume builder
  aiAnalyzer: '/student/ai-analyzer',       // AI resume & ATS analyzer
  assessment: '/student/assessment',        // Readiness self-assessment
  readiness: '/student/readiness',          // Readiness score dashboard
  notifications: '/student/notifications',  // Notifications feed
  settings: '/student/settings',            // Account & password settings

  // Department Admin
  adminHome: '/admin',                      // Dept overview
  adminDashboard: '/admin/dashboard',       // Dept student roster & statuses
  addStudent: '/admin/add-student',         // Manual single-student enrollment
  excelUpload: '/admin/excel-upload',       // Bulk roster ingestion
  postDrive: '/admin/post-drive',           // Drive creation & field config
  announcements: '/admin/announcements',    // Dept announcements
  reports: '/admin/reports',                // Dept placement analytics

  // Super Admin / Central TPO
  superAdmin: '/superadmin',                // Central institutional KPIs
  superAdminStudents: '/superadmin/students',// Cross-department master roster
  superAdminDrives: '/superadmin/drives',   // Central drives management
  departments: '/superadmin/departments',   // Department master settings
  adminAccounts: '/superadmin/accounts',    // Dept admin staff accounts
  globalReports: '/superadmin/reports',     // Institutional analytics & NIRF
  auditLog: '/superadmin/audit-log',        // System audit trail
  systemSettings: '/superadmin/settings',   // Institution config & toggles
};
```

---

## 3. Backend Stack & Infrastructure Requirements

To transition CampusHire from prototype to a scalable production platform, the following backend architecture and services are required:

### 3.1 Core Services & Recommended Tech Stack

| Layer | Recommended Technology | Alternatives | Purpose in CampusHire |
|---|---|---|---|
| **API Server** | **Node.js (NestJS / Express)** | Python (FastAPI), Go, Java (Spring Boot) | Handles REST endpoints, authentication middleware, file validation, and transactional business logic. |
| **Database** | **PostgreSQL (v15+)** | MySQL 8.0+, Amazon Aurora | Relational data integrity for students, departments, drives, applications, and strict foreign keys. |
| **Cache & Queue**| **Redis (v7+) + BullMQ** | RabbitMQ, Celery, AWS SQS | Session caching, OTP expiration timers, rate limiting, and background worker queues. |
| **Object Storage**| **AWS S3 / Cloudflare R2** | Google Cloud Storage, MinIO | Secure storage of uploaded PDF resumes, profile images, and generated Excel placement reports. |
| **AI / ATS Engine**| **Google Gemini 1.5 Flash / Pro** | OpenAI GPT-4o-mini, Local spaCy | Extracts text from PDF resumes, calculates keyword match percentages, and suggests resume revisions. |

### 3.2 Authentication, Sessions & JWT Security

1. **Authentication Flow**:
   - **Login**: Client sends email/password to `POST /api/auth/login`.
   - **Verification**: Server validates against `bcrypt`/`argon2` hash in `users` table.
   - **Token Generation**: Issues:
     - `accessToken` (JWT, 15-minute lifespan, claims: `{ userId, role, deptId, email }`).
     - `refreshToken` (opaque UUID or 7-day JWT stored in HTTP-only, Secure, SameSite cookie).
   - **Client Storage**: The frontend stores the token in `localStorage` under key `'ch_auth_session_v1'` and auto-attaches it as `Authorization: Bearer <token>` on all requests via `src/api/client.js`.
2. **Registration & OTP Lifecycle**:
   - `POST /api/auth/register` creates an unverified account and generates a 6-digit cryptographic OTP.
   - OTP is hashed and saved in Redis with a 5-minute Time-To-Live (TTL).
   - Email/SMS worker dispatches the code.
   - `POST /api/auth/verify-otp` checks the code and activates the account (`is_active = true`).
3. **Role Enforcement Middleware**:
   - Every protected API route passes through an authorization guard that asserts `req.user.role === expectedRole`.

### 3.3 File & Document Storage Architecture

- **PDF Resumes**: Stored with private ACL in S3.
  - Bucket path: `resumes/{student_id}/{uuid}-{filename}.pdf`
  - Served to students and admins via short-lived pre-signed URLs (valid for 15 minutes).
- **Excel Student Import Sheets**:
  - Uploaded via `POST /api/admin/students/import/preview`.
  - Processed in memory or streamed via `xlsx` / `exceljs` library.
- **Company Logos & Student Avatars**:
  - Optimized to WebP and stored with public read access under `cdn.college.edu/avatars/`.

### 3.4 Background Workers & Job Queue Engine

A Redis-backed queue (`BullMQ`) handles asynchronous tasks so the HTTP API remains fast (<100ms):
1. **`mail-queue`**: Sends registration OTPs, drive announcement emails, and application status update alerts.
2. **`resume-parse-queue`**: Extracts raw text from uploaded resumes using `pdf-parse`, parses technical skills and experience, and stores parsed tokens.
3. **`ai-scoring-queue`**: Compares student skills against target company job descriptions using the Gemini API to compute the ATS Match Score.
4. **`excel-batch-queue`**: Inserts 500+ student records in a single database transaction from department spreadsheet uploads.

### 3.5 External Integrations (AI / ATS, Email, SMS)

- **Gemini API Integration**: Used in `AiAnalyzerPage.jsx` and `ResumeBuilderPage.jsx`.
  - Backend proxy route `POST /api/ai/analyze-resume` receives `resumeText` and `targetRole`.
  - Calls Gemini with structured output schemas to return:
    - Overall ATS Score (0–100).
    - Missing Critical Keywords.
    - Formatting & Action Verb Critiques.
    - Bullet point rewrite suggestions.
- **Transactional Communication**:
  - **Email**: SendGrid / Amazon SES for placement drive notices and interview call letters.
  - **SMS / WhatsApp**: Twilio / Gupshup for urgent deadline reminders and round scheduling.

---

## 4. Complete Database Schema Specification

This schema is optimized for **PostgreSQL 15+** with proper primary keys, foreign key constraints, indexes, and JSONB fields for dynamic drive questions.

### 4.1 Entity Relationship Diagram (Conceptual)

```
 [ departments ] 1 <---- N [ students ] 1 <---- N [ applications ] N ----> 1 [ drives ]
       ^                         |                      |                          |
       |                         v                      v                          v
       | 1             [ student_skills ]       [ application_snapshots ]   [ drive_logistics ]
       |               [ student_projects ]                                 [ drive_custom_fields ]
       |               [ student_experience ]
       |               [ semester_marks ]
       |
 [ admins ] (dept & superadmin) 1 <---- N [ announcements ]
       |
       +-------------------------------- N [ audit_logs ]
```

### 4.2 SQL Table Definitions & Column Specifications

```sql
-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('student', 'admin', 'superadmin');
CREATE TYPE drive_status AS ENUM ('Draft', 'Upcoming', 'Open', 'In_Progress', 'Closed', 'Archived');
CREATE TYPE application_stage AS ENUM ('Applied', 'Online Assessment', 'Technical Interview', 'HR Interview', 'Offered', 'Placed', 'Rejected', 'Withdrawn');
CREATE TYPE drive_type AS ENUM ('departmental', 'central');

-- 2. DEPARTMENTS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- e.g. 'CSE', 'ECE', 'MECH', 'IT'
    name VARCHAR(100) NOT NULL,
    head_name VARCHAR(100),
    coordinator_email VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS (Authentication Master)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);

-- 4. ADMIN PROFILES
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL, -- NULL for Super Admin / Central TPO
    designation VARCHAR(100) DEFAULT 'Placement Coordinator',
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. STUDENTS (Comprehensive Student Master)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roll_no VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20),
    dob DATE,
    phone VARCHAR(20),
    personal_email VARCHAR(255),
    college_email VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    batch_year INT NOT NULL, -- e.g. 2026
    current_semester INT NOT NULL DEFAULT 7,
    
    -- Academic Metrics
    cgpa NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    tenth_percentage NUMERIC(5, 2),
    tenth_board VARCHAR(100),
    tenth_year INT,
    twelfth_percentage NUMERIC(5, 2),
    twelfth_board VARCHAR(100),
    twelfth_year INT,
    diploma_percentage NUMERIC(5, 2),
    active_backlogs INT NOT NULL DEFAULT 0,
    cleared_backlogs INT NOT NULL DEFAULT 0,
    gap_years INT NOT NULL DEFAULT 0,
    
    -- Platform Scores & State
    resume_url TEXT,
    resume_score INT DEFAULT 0,
    readiness_score INT DEFAULT 0,
    profile_completion INT DEFAULT 0,
    placement_status VARCHAR(50) DEFAULT 'unplaced', -- 'unplaced', 'placed', 'opted_out'
    placed_company VARCHAR(100),
    placed_package VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_students_dept ON students(department_id);
CREATE INDEX idx_students_cgpa ON students(cgpa);
CREATE INDEX idx_students_roll ON students(roll_no);

-- 6. STUDENT DETAILED SUB-ENTITIES
CREATE TABLE student_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    skill_name VARCHAR(50) NOT NULL,
    proficiency VARCHAR(20) DEFAULT 'Intermediate', -- Beginner, Intermediate, Advanced
    category VARCHAR(50) -- Frontend, Backend, Database, Cloud, Core
);

CREATE TABLE student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'linkedin', 'github', 'portfolio', 'leetcode'
    url TEXT NOT NULL
);

CREATE TABLE student_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    live_url TEXT,
    repo_url TEXT,
    start_date DATE,
    end_date DATE
);

CREATE TABLE student_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    company VARCHAR(150) NOT NULL,
    role VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT
);

CREATE TABLE student_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    issuing_organization VARCHAR(150) NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    credential_id VARCHAR(100),
    credential_url TEXT
);

CREATE TABLE student_preferences (
    student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    preferred_roles JSONB DEFAULT '[]'::jsonb,
    preferred_locations JSONB DEFAULT '[]'::jsonb,
    min_expected_ctc VARCHAR(50),
    willing_to_relocate BOOLEAN DEFAULT TRUE
);

-- 7. RECRUITMENT DRIVES
CREATE TABLE drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(150) NOT NULL,
    company_logo_url TEXT,
    role_title VARCHAR(150) NOT NULL,
    job_description TEXT NOT NULL,
    ctc VARCHAR(50) NOT NULL, -- e.g. "12.0 – 16.0 LPA"
    ctc_breakdown JSONB,     -- Base, Variables, Stocks
    min_cgpa NUMERIC(4, 2) NOT NULL DEFAULT 6.00,
    max_backlogs INT NOT NULL DEFAULT 0,
    allowed_department_ids UUID[] NOT NULL,
    drive_date DATE NOT NULL,
    deadline_date TIMESTAMPTZ NOT NULL,
    status drive_status NOT NULL DEFAULT 'Upcoming',
    drive_type drive_type NOT NULL DEFAULT 'departmental',
    rounds_description TEXT, -- e.g. "Aptitude -> Tech -> HR"
    apply_url TEXT,          -- External company career portal
    created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_drives_deadline ON drives(deadline_date);
CREATE INDEX idx_drives_status ON drives(status);

-- 8. DRIVE LOGISTICS
CREATE TABLE drive_logistics (
    drive_id UUID PRIMARY KEY REFERENCES drives(id) ON DELETE CASCADE,
    venue VARCHAR(255) NOT NULL,
    reporting_time VARCHAR(50) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    ppt_link TEXT,           -- Pre-Placement Talk virtual meeting URL
    additional_notes TEXT,
    configured BOOLEAN DEFAULT TRUE
);

-- 9. DRIVE CUSTOM APPLICATION FIELDS CONFIGURATION
CREATE TABLE drive_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    field_key VARCHAR(50) NOT NULL,     -- e.g. 'github', 'workLocation', 'certifications'
    field_label VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    source_type VARCHAR(20) DEFAULT 'profile', -- 'profile' (prefilled) or 'custom' (user input)
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- 10. APPLICATIONS
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resume_version_url TEXT NOT NULL,
    
    -- Immutable Snapshot of Academic Standing at Application Time
    snapshot_cgpa NUMERIC(4, 2) NOT NULL,
    snapshot_backlogs INT NOT NULL,
    form_responses JSONB DEFAULT '{}'::jsonb, -- Key-value pairs of required fields
    
    current_stage application_stage NOT NULL DEFAULT 'Applied',
    stage_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'active',      -- 'active', 'placed', 'rejected', 'withdrawn'
    withdrawal_reason TEXT,
    withdrawn_at TIMESTAMPTZ,
    
    CONSTRAINT uq_student_drive_application UNIQUE (drive_id, student_id)
);
CREATE INDEX idx_app_student ON applications(student_id);
CREATE INDEX idx_app_drive ON applications(drive_id);

-- 11. ANNOUNCEMENTS
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE, -- NULL = All Departments (Central)
    event_date DATE,
    link_url TEXT,
    posted_by_admin_id UUID NOT NULL REFERENCES admins(id),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. NOTIFICATIONS FEED
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'info', -- 'info', 'drive', 'alert', 'success'
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

-- 13. AUDIT LOGS (Immutable Security Trail)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g. "DRIVE_CREATED", "STUDENT_BULK_IMPORTED", "STAGE_UPDATED"
    target_entity VARCHAR(50) NOT NULL, -- "drive", "student", "application"
    target_id VARCHAR(100),
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

---

## 5. Complete Dummy Data Inventory & Backend Replacement Mapping

This section catalogs **every single piece of mock and demo data** across the repository, identifying its source file, purpose, and the exact database query or REST endpoint that replaces it.

### 5.1 Primary Mock File: `src/data/mockData.js`

| Variable / Export | Where Used in Code | Description of Dummy Data | Database Source & Query | Replacement API Endpoint |
|---|---|---|---|---|
| `STUDENT` | `src/hooks/useStudent.js`, `StudentProfilePage`, `ResumeBuilderPage` | Full mock student object (`Aarav Sharma`, CSE, CGPA 8.84, backlogs, projects, skills). | `students` table joined with `departments`, `student_skills`, `student_projects`, `student_experience`. | `GET /api/students/me` |
| `DEPT_ADMIN` | `AdminHomePage.jsx`, `AdminDashboardPage.jsx`, `PostDrivePage.jsx` | Department Coordinator profile (`Dr. Kavita Rao`, CSE). | `admins` table joined with `departments` where `user_id = req.user.id`. | `GET /api/admin/me` |
| `SUPER_ADMIN` | `SuperAdminDashboardPage.jsx`, `SuperAdminDrivesPage.jsx` | Central TPO profile (`Vikramaditya Roy`, initials VR). | `admins` table where `is_super_admin = true`. | `GET /api/superadmin/me` |
| `STUDENTS_LIST` | `AdminDashboardPage.jsx`, `SuperAdminStudentsPage.jsx`, `ReportsAnalyticsPage.jsx` | Array of 10 student records (`roll`, `dept`, `cgpa`, `status: eligible/placed`). | `SELECT * FROM students WHERE department_id = $deptId ORDER BY roll_no ASC`. | `GET /api/admin/students` (or `/api/superadmin/students`) |
| `DRIVES` | `StudentDashboardPage.jsx`, `PostDrivePage.jsx` | Array of 4 mock departmental drives (Google, TCS, Infosys, Cisco). | `SELECT * FROM drives WHERE allowed_department_ids @> ARRAY[$deptId]::uuid[]`. | `GET /api/drives?scope=department` |
| `NOTIFICATIONS` | `Topbar.jsx`, `NotificationsPage.jsx`, `StudentDashboardPage.jsx` | Static array of 5 notification items. | `SELECT * FROM notifications WHERE user_id = $userId ORDER BY created_at DESC LIMIT 20`. | `GET /api/notifications` |
| `DEADLINES` | `StudentDashboardPage.jsx` | Static array of 3 urgent drive dates. | Dynamic calculation: `SELECT company_name, role_title, deadline_date FROM drives WHERE deadline_date >= NOW() ORDER BY deadline_date ASC LIMIT 5`. | `GET /api/drives/upcoming-deadlines` |
| `QUESTIONS` | `SelfAssessmentPage.jsx` | 10 Likert-scale questions across DSA, System Design, Aptitude, Soft Skills. | `SELECT * FROM assessment_questions WHERE is_active = true ORDER BY category, id`. | `GET /api/assessment/questions` |
| `DEPT_MATRIX` | `SuperAdminDashboardPage.jsx`, `DepartmentManagementPage.jsx` | Departmental placement stats (CSE, ECE, MECH student count, avg readiness, placed). | SQL aggregation: `SELECT d.code, count(s.id), avg(s.readiness_score), count(s.id) FILTER (WHERE s.placement_status = 'placed') FROM departments d JOIN students s ON s.department_id = d.id GROUP BY d.id`. | `GET /api/superadmin/department-matrix` |
| `EXCEL_ROWS` | `ExcelUploadPage.jsx` | 5 sample parsed spreadsheet rows for visual preview. | Replace client preview with backend parsing response: server reads uploaded `.xlsx` file, performs schema validation, and returns rows with validation errors. | `POST /api/admin/students/import/preview` |
| `CENTRAL_DRIVES`| `SuperAdminDashboardPage.jsx`, `SuperAdminDrivesPage.jsx` | Array of central drives (TCS, Microsoft, Wipro) with nested `adminConfig` and `applicationFields`. | `SELECT d.*, row_to_json(l.*) as logistics, json_agg(f.*) as custom_fields FROM drives d LEFT JOIN drive_logistics l ON l.drive_id = d.id LEFT JOIN drive_custom_fields f ON f.drive_id = d.id WHERE d.drive_type = 'central' GROUP BY d.id, l.drive_id`. | `GET /api/superadmin/central-drives` |

### 5.2 Placement Drive Store: `src/data/driveStore.js`

| Variable / Constant | Where Used | Description | Backend Replacement |
|---|---|---|---|
| `DRIVE_STORE` | `HomePage.jsx`, `DriveCard.jsx` | Array of 6 enriched drives with stepper stages, logos, and eligibility parameters. | `GET /api/drives`: Serves drives active for the student's department and batch, including current application stage if student has already applied. |
| `DEMO_TODAY` | `src/utils/driveUtils.js` | Fixed timestamp `new Date('2026-08-09')` used to force fake deadlines to look active. | **Delete entirely.** Replace with standard JavaScript `new Date()` comparing against real UTC timestamps stored in PostgreSQL. |

### 5.3 Client-Side Fake Persistence: `src/context/AppStateContext.jsx`

The file `src/context/AppStateContext.jsx` was implemented to keep the prototype interactive via `localStorage`. In production, this entire file is superseded by standard server state:

| State Key in `AppStateContext` | Fake Simulation Behavior | Production Backend Replacement |
|---|---|---|
| `appliedDrives` | Array of drive IDs stored in `localStorage`. | `GET /api/applications/my-applications` returning `{ driveId, status, stage, appliedAt }`. |
| `applyDrive(driveId, formValues)` | Appends to local array and logs to console. | `POST /api/drives/:id/apply` with payload `{ resumeId, formResponses }`. |
| `withdrawDrive(driveId, reason)` | Removes drive ID from local array. | `POST /api/applications/:id/withdraw` with `{ reason }`. |
| `resumeScore`, `readinessScore`, `profileCompletion` | Numbers stored in `localStorage` modified by button clicks. | Server-computed columns in the `students` table, returned via `GET /api/students/me`. Scores update automatically upon profile changes or assessment submissions. |
| `notifReadIds` | Array of read notification IDs in `localStorage`. | `PATCH /api/notifications/:id/read` updating `is_read = true` in PostgreSQL. |
| `student` | Local JSON object merged over mock `STUDENT` in `useStudent()`. | Direct updates via `PUT /api/students/me`. No local override layer. |

### 5.4 Application Fields Catalog: `src/data/applicationFieldsCatalog.js`

- **Current Use:** Defines the master catalog of 20+ fields (Basic Identity, Academic Records, Resumes, Links, Online Tests) that coordinators can require in `AdminApplicationFieldsPanel.jsx`.
- **Backend Replacement:**
  - Seed this catalog into a database table `master_application_fields`.
  - When a coordinator configures a drive, records are inserted into `drive_custom_fields`.
  - On student application, the frontend dynamically requests `GET /api/drives/:id/required-fields` to render the appropriate form fields.

### 5.5 Inline Screen & Form Dummy Data

Several screens contain localized dummy constants used to populate visual elements:

| Screen File | Inline Constant / Mock | Description | Backend Replacement |
|---|---|---|---|
| `src/pages/student/AiAnalyzerPage.jsx` | `SUGGESTIONS` | 4 hardcoded bullet points suggesting resume improvements. | Real response from `POST /api/ai/analyze-resume` (Gemini API output). |
| `src/pages/student/ReadinessDashboardPage.jsx` | `TREND`, `BREAKDOWN` | Hardcoded 5-point historical score graph & category breakdown. | `GET /api/students/me/readiness-history` returning weekly snapshot scores from table `readiness_history`. |
| `src/pages/admin/AnnouncementsPage.jsx` | Initial `sent` state array | 2 pre-populated announcement items. | `GET /api/admin/announcements` fetching persisted records from `announcements` table. |
| `src/pages/superadmin/AdminAccountsPage.jsx` | `SEED_ACCOUNTS` | 3 mock coordinator accounts. | `GET /api/superadmin/admins` fetching active records from `admins` table. |
| `src/pages/superadmin/AuditLogPage.jsx` | `SEED_LOG` | 4 hardcoded audit entries. | `GET /api/superadmin/audit-logs?page=1&limit=25` querying `audit_logs` table. |

### 5.6 Auth Simulation Flows (Login, OTP, Password Reset)

| Page | Current Simulated Logic | Real Backend Integration |
|---|---|---|
| `LoginPage.jsx` | Checks if email string contains `"admin"` or `"super"` to decide destination route. | Calls `POST /api/auth/login`. Reads returned `role` (`student`, `admin`, `superadmin`) and navigates to `PATHS.home`, `PATHS.adminHome`, or `PATHS.superAdmin`. |
| `RegisterPage.jsx` | Redirects to OTP page with mock state. | Calls `POST /api/auth/register`, creating pending student record and triggering email OTP. |
| `OtpVerificationPage.jsx` | Validates against hardcoded code `528914` with a "Click to auto-fill" button. | Calls `POST /api/auth/verify-otp`. Remove auto-fill button entirely. Server validates against Redis TTL key. |
| `ResetPasswordPage.jsx` | 3-step purely visual state machine. | Step 1: `POST /api/auth/forgot-password` (sends reset token). Step 2: `POST /api/auth/reset-password` (verifies token and updates password hash). |

---

## 6. API Specification & REST Endpoint Contract

This section defines the precise contract between frontend client requests and backend server handlers.

### 6.1 Authentication & Account Endpoints (`/api/auth`)

#### 1. User Login
- **`POST /api/auth/login`**
- **Request Body:**
  ```json
  {
    "email": "aarav.sharma@college.edu",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "c1f7b8a0-56d2-4e89-9a21-123456789abc",
      "name": "Aarav Sharma",
      "email": "aarav.sharma@college.edu",
      "role": "student",
      "department": "CSE"
    }
  }
  ```

#### 2. Student Registration
- **`POST /api/auth/register`**
- **Request Body:**
  ```json
  {
    "fullName": "Aarav Sharma",
    "collegeEmail": "aarav.sharma@college.edu",
    "rollNo": "2022CSE042",
    "department": "CSE",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "OTP verification code sent to aarav.sharma@college.edu",
    "verificationId": "v_982310"
  }
  ```

#### 3. Verify OTP
- **`POST /api/auth/verify-otp`**
- **Request Body:**
  ```json
  {
    "email": "aarav.sharma@college.edu",
    "otp": "528914"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": { ... }
  }
  ```

---

### 6.2 Student Profile & Resume Endpoints (`/api/students`)

#### 1. Fetch Current Logged-in Profile
- **`GET /api/students/me`**
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (`200 OK`):**
  ```json
  {
    "id": "st_101",
    "name": "Aarav Sharma",
    "rollNo": "2022CSE042",
    "dept": "CSE",
    "batch": 2026,
    "cgpa": 8.84,
    "backlogs": 0,
    "phone": "+91 98765 43210",
    "email": "aarav.sharma@college.edu",
    "personalEmail": "aarav.personal@gmail.com",
    "dob": "2004-05-14",
    "readinessScore": 78,
    "resumeScore": 64,
    "profileCompletion": 72,
    "placementStatus": "unplaced",
    "skills": ["React", "TypeScript", "Node.js", "Python", "SQL", "Docker"],
    "links": {
      "linkedin": "https://linkedin.com/in/aaravsharma",
      "github": "https://github.com/aaravsharma"
    },
    "projects": [
      {
        "id": "p1",
        "title": "Placement Portal Pro",
        "description": "Full-stack university recruitment portal with automated eligibility verification.",
        "tech": ["React", "Node.js", "PostgreSQL"],
        "liveUrl": "https://campushire.demo.app",
        "repoUrl": "https://github.com/aaravsharma/campushire"
      }
    ],
    "experience": [
      {
        "id": "e1",
        "company": "TechCorp Labs",
        "role": "Full-Stack Intern",
        "tenure": "Jun 2025 – Aug 2025",
        "description": "Optimized database query latency by 35%."
      }
    ],
    "academics": {
      "tenth": { "board": "CBSE", "year": 2020, "percentage": 94.2 },
      "twelfth": { "board": "CBSE", "year": 2022, "percentage": 91.8 },
      "semesters": [
        { "sem": 1, "sgpa": 8.5 },
        { "sem": 2, "sgpa": 8.7 },
        { "sem": 3, "sgpa": 8.9 },
        { "sem": 4, "sgpa": 9.0 },
        { "sem": 5, "sgpa": 8.8 },
        { "sem": 6, "sgpa": 9.1 }
      ]
    }
  }
  ```

#### 2. Update Student Profile
- **`PUT /api/students/me`**
- **Request Body:** Partial or complete profile fields matching the schema above.
- **Success Response (`200 OK`):** Updated student object with recalculated `profileCompletion`.

#### 3. Upload Resume PDF
- **`POST /api/students/resume`**
- **Content-Type:** `multipart/form-data`
- **Body:** `file: <resume.pdf>`
- **Success Response (`200 OK`):**
  ```json
  {
    "resumeUrl": "https://s3.college.edu/resumes/st_101/aarav_resume_2026.pdf",
    "parsedSkills": ["React", "TypeScript", "PostgreSQL", "Git"],
    "resumeScore": 75
  }
  ```

---

### 6.3 Placement Drives & Applications Endpoints (`/api/drives`, `/api/applications`)

#### 1. List Available Placement Drives (Student-Scoped)
- **`GET /api/drives`**
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "drv_google_01",
      "company": "Google",
      "logoText": "GOOG",
      "role": "Software Engineering Intern / FTE",
      "ctc": "28.0 – 42.0 LPA",
      "minCgpa": 8.0,
      "maxBacklogs": 0,
      "departments": ["CSE", "ECE", "IT"],
      "driveDate": "2026-09-24",
      "deadline": "2026-09-18",
      "open": true,
      "applicants": 142,
      "rounds": "Online Coding Assessment -> Technical 1 -> Technical 2 -> HR",
      "jd": "Google is seeking exceptional software engineers proficient in algorithms, distributed systems, and collaborative engineering.",
      "applyLink": "https://careers.google.com/jobs/results/12345",
      "logistics": {
        "venue": "Campus Convention Hall & Online Meet",
        "reportingTime": "08:30 AM",
        "contactPerson": "Dr. Kavita Rao",
        "contactPhone": "+91 98765 00001",
        "pptLink": "https://meet.google.com/xyz-abc-def"
      },
      "application": {
        "hasApplied": true,
        "currentStage": "Technical Interview",
        "stageLabel": "Round 2: Systems Design",
        "appliedAt": "2026-09-10T14:30:00Z"
      }
    }
  ]
  ```

#### 2. Submit Drive Application
- **`POST /api/drives/:id/apply`**
- **Request Body:**
  ```json
  {
    "resumeUrl": "https://s3.college.edu/resumes/st_101/aarav_resume_2026.pdf",
    "responses": {
      "github": "https://github.com/aaravsharma",
      "linkedin": "https://linkedin.com/in/aaravsharma",
      "willingToRelocate": "Yes",
      "preferredWorkLocation": "Bengaluru / Hyderabad"
    }
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "applicationId": "app_9843",
    "stage": "Applied",
    "message": "Application submitted successfully for Google!"
  }
  ```

#### 3. Withdraw Application
- **`POST /api/applications/:id/withdraw`**
- **Request Body:**
  ```json
  {
    "reason": "Accepted an offer from another tier-1 organization."
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Application withdrawn successfully."
  }
  ```

---

### 6.4 Department Admin Endpoints (`/api/admin`)

- **`GET /api/admin/students`**: Paginated student roster for the coordinator's department.
  - Query Params: `?page=1&limit=25&search=aarav&status=eligible`
- **`POST /api/admin/students`**: Manually enroll a single student into the department.
- **`POST /api/admin/students/import/preview`**: Parse and validate uploaded Excel spreadsheet (`.xlsx`), returning column mappings and syntax/type warnings.
- **`POST /api/admin/students/import/commit`**: Commit validated batch records into the `students` table.
- **`POST /api/admin/drives`**: Post a new departmental recruitment drive with custom logistics and required application fields.
- **`GET /api/admin/announcements`**: Fetch list of broadcasts created for the department.
- **`POST /api/admin/announcements`**: Publish a new announcement (with title, message, date, and link).
- **`GET /api/admin/reports`**: Return department placement metrics (Total Students, Eligible, Placed, Placement %, Average Package).

---

### 6.5 Super Admin / Institutional TPO Endpoints (`/api/superadmin`)

- **`GET /api/superadmin/department-matrix`**: Consolidated table across all departments (CSE, ECE, MECH, CIVIL, IT, BIO) with total students, avg readiness score, and placed percentage.
- **`POST /api/superadmin/central-drives`**: Create an institution-wide placement drive open to multiple designated engineering disciplines.
- **`PUT /api/superadmin/central-drives/:id/config`**: Update central venue, reporting times, coordinator desks, and required application fields.
- **`GET /api/superadmin/admins`**: Retrieve all department coordinator accounts.
- **`POST /api/superadmin/admins`**: Provision a new department coordinator login.
- **`DELETE /api/superadmin/admins/:id`**: Revoke coordinator administrative access.
- **`GET /api/superadmin/audit-logs`**: Query system-wide security audit trail with filtering by actor, action, and date range.
- **`GET /api/superadmin/global-reports`**: Generate institution-wide NIRF/NAAC compliant placement reports.

---

### 6.6 Notifications, Feeds & Audit Endpoints (`/api/notifications`, `/api/audit-logs`)

- **`GET /api/notifications`**: Retrieve real-time notifications for the authenticated user.
- **`PATCH /api/notifications/:id/read`**: Mark an individual notification as read.
- **`PATCH /api/notifications/read-all`**: Mark all pending notifications as read.
- **`POST /api/audit-logs`**: Internal backend middleware hook logging state changes.

---

## 7. Step-by-Step Integration & Migration Plan

This phased roadmap outlines how to transition the codebase from its current mock-data state to live backend APIs without breaking UI functionality.

### 7.1 Phase 1: Environment & Token Interceptors

1. Update `.env.example` and create `.env.local`:
   ```env
   VITE_API_BASE_URL=https://api.campushire.college.edu/api
   ```
2. Verify `src/api/client.js`:
   - Confirm that the `Authorization: Bearer <token>` header is automatically attached to every outgoing HTTP request when a token exists in `localStorage`.
   - Ensure the `401 Unauthorized` handler emits `window.dispatchEvent(new CustomEvent('ch:unauthorized'))` to trigger automated redirection to `PATHS.login`.

### 7.2 Phase 2: Database Provisioning & Seed Data

1. Run the PostgreSQL schema scripts in Section 4.2.
2. Seed initial institution data:
   - Departments: `CSE`, `ECE`, `IT`, `MECH`, `CIVIL`, `AIDS`.
   - Default Super Admin account (`tpo@college.edu`).
   - Standard application field catalog (`AVAILABLE_STUDENT_FIELDS`).

### 7.3 Phase 3: Replacing Context State with Server State (React Query)

Install TanStack React Query:
```bash
npm install @tanstack/react-query
```

Wrap `App.jsx` in `QueryClientProvider`. Replace client-side mock mutations with standard server query hooks:

```javascript
// Example: hooks/useStudentQuery.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../api/studentService';

export function useStudentProfile() {
  return useQuery({
    queryKey: ['student', 'me'],
    queryFn: studentService.getMe,
  });
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: studentService.updateProfile,
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['student', 'me'], updatedData);
    },
  });
}
```

### 7.4 Phase 4: Real-time Eligibility & Application Engine

1. In `src/components/drives/DriveCard.jsx`, connect the "Apply Now" button directly to `driveService.apply(drive.id, payload)`.
2. Connect `ApplicationReviewModal.jsx` to prefill verified fields directly from the server-loaded `student` object.
3. In `WithdrawModal.jsx`, call `driveService.withdraw(drive.id, reason)` and invalidate the `['drives']` query cache upon confirmation.

### 7.5 Phase 5: Cleaning Up Deprecated Mock Files

Once all pages use the services in `src/api/`:
1. Delete `DEMO_TODAY` in `src/utils/driveUtils.js` and use standard `new Date()`.
2. Delete `src/data/mockData.js`.
3. Delete `src/data/driveStore.js`.
4. Deprecate `src/context/AppStateContext.jsx` in favor of React Query cache and remove its provider from `src/main.jsx`.

---

## 8. Summary Checklist for Backend Engineers

- [ ] **Database**: Provision PostgreSQL instance and execute DDL table definitions.
- [ ] **Auth**: Implement JWT login, registration with email/SMS OTP, and RBAC middleware.
- [ ] **Object Store**: Configure AWS S3 / GCS bucket with CORS permissions for PDF resumes and avatars.
- [ ] **API Services**: Implement REST endpoints adhering to the payload contracts in Section 6.
- [ ] **AI Integration**: Create backend proxy for Gemini API to compute ATS scores and resume suggestions.
- [ ] **Frontend Wiring**: Point `VITE_API_BASE_URL` to the backend server and replace mock service methods.
- [ ] **Verification**: Run `npm run build` and test complete applicant and admin placement lifecycle.
