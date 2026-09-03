# CampusHire — Full-Stack Project Changelog

This file tracks every change made to the **full-stack project** at `CampusHire/`.
For changes to the HTML/CSS clickable prototype, see `CampusHire_Clickable_Prototype_2/CHANGELOG.md`.

All work on this project was initiated on **August 20, 2026**.

---

## Session 1 — Aug 20, 2026 | Initial Full-Stack Scaffold + All Pages

---

### [1] — Aug 20, 2026 | Project folder structure created
**Folders created:** `backend/`, `frontend/` and all subdirectories

Created the full project skeleton at `C:\Users\Hitesh Patil\Downloads\CampusHire\`.

**Backend folders:**
```
backend/
├── app/
│   ├── api/v1/endpoints/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── utils/
├── alembic/versions/
```

**Frontend folders:**
```
frontend/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/common/
│   ├── components/layout/
│   ├── hooks/
│   ├── pages/auth/
│   ├── pages/student/
│   ├── pages/admin/
│   ├── pages/super-admin/
│   ├── store/
│   ├── styles/
│   └── utils/
└── public/
```

---

### [2] — Aug 20, 2026 | FastAPI backend scaffolded
**Files created:** `requirements.txt`, `app/core/config.py`, `app/core/security.py`, `app/core/email.py`, `app/core/deps.py`, `app/core/__init__.py`

**`requirements.txt`** — pinned dependencies:
- `fastapi==0.111.0`, `uvicorn[standard]==0.29.0`
- `sqlalchemy==2.0.30`, `alembic==1.13.1`, `psycopg2-binary==2.9.9`
- `pydantic[email]==2.7.1`, `pydantic-settings==2.2.1`
- `python-jose[cryptography]==3.3.0`, `passlib[bcrypt]==1.7.4`
- `python-multipart==0.0.9`, `openpyxl==3.1.2`, `httpx==0.27.0`

**`config.py`** — `Settings` class via `pydantic-settings`, reads from `.env`. Fields: DATABASE_URL, SECRET_KEY, JWT settings, OTP settings, CORS origins, SMTP, institution domain, upload dir.

**`security.py`** — password hashing (bcrypt), OTP generation + SHA-256 hashing, JWT create/decode for access and refresh tokens, temp password generator.

**`email.py`** — `_send()` wrapper (prints to stdout when SMTP_USER is blank for dev). Provides `send_otp_email()` and `send_credentials_email()` with styled HTML templates.

**`deps.py`** — `get_db()` session generator, `get_current_user()` JWT bearer dependency, `require_student()`, `require_dept_admin()`, `require_super_admin()` role guards.

---

### [3] — Aug 20, 2026 | SQLAlchemy models created — Phase 1 + 2
**Files created:** `app/models/user.py`, `app/models/auth.py`, `app/models/department.py`, `app/models/student.py`, `app/models/__init__.py`

**Models defined (14 tables, covering Phase 1 + 2):**

| Model | Table | Description |
|-------|-------|-------------|
| `User` | `users` | Central auth table. Fields: id, email, password_hash, role (STUDENT/DEPT_ADMIN/SUPER_ADMIN), status, email_verified, must_change_password, registration_source, created_by |
| `OTPVerification` | `otp_verifications` | OTP records with hash, purpose, expiry, attempt count |
| `PasswordResetToken` | `password_reset_tokens` | Hashed reset tokens |
| `UserSession` | `user_sessions` | Refresh token sessions with device info and IP |
| `Department` | `departments` | department_name, department_code (unique), status, created_by |
| `AdminProfile` | `admin_profiles` | full_name, phone_number for admin users |
| `AdminDepartmentMapping` | `admin_department_mapping` | Many-to-many: admins ↔ departments |
| `StudentProfile` | `student_profiles` | full_name, roll_number, department_id, year, semester, DOB, gender, phone, import_job_id |
| `StudentEducation` | `student_education` | 10th/12th/diploma records per student |
| `StudentAcademicRecord` | `student_academic_records` | Per-semester CGPA + backlog tracking |
| `Skill` | `skills` | Master skill table with category (TECHNICAL/SOFT/LANGUAGE/TOOL) |
| `StudentSkill` | `student_skills` | Many-to-many: students ↔ skills with proficiency level |
| `StudentProject` | `student_projects` | title, description, link, dates |
| `ProjectTechnology` | `project_technologies` | Many-to-many: projects ↔ skills |
| `StudentExperience` | `student_experiences` | company, role, dates, currently_working |
| `StudentCertification` | `student_certifications` | title, org, date, credential URL |
| `StudentPreference` | `student_preferences` | company type, package, relocate flag |
| `JobRole` | `job_roles` | Master list of job roles |
| `StudentPreferredRole` | `student_preferred_roles` | Students ↔ job roles |
| `Location` | `locations` | city/state/country master table |
| `StudentPreferredLocation` | `student_preferred_locations` | Students ↔ locations |

---

### [4] — Aug 20, 2026 | Alembic migrations configured
**Files created:** `alembic/env.py`, `alembic/script.py.mako`, `alembic.ini`, `alembic/versions/` (empty, auto-populated by `alembic revision`)

`env.py` imports all models via `app.models`, sets `target_metadata = Base.metadata`. `DATABASE_URL` is pulled from `settings` (reads `.env`) so no duplication.

Run `alembic upgrade head` after configuring `.env` to create all tables.

---

### [5] — Aug 20, 2026 | API router + main.py wired
**Files created:** `app/main.py`, `app/api/v1/router.py`, all `__init__.py` stubs

**`router.py`** — registers `auth`, `student`, `admin` routers under `/api/v1`.

**`main.py`** — FastAPI app with:
- CORS middleware (reads `ALLOWED_ORIGINS` from settings)
- API router mounted at `/api/v1`
- Static file serving for uploads at `/uploads`
- Health check endpoint at `GET /api/health`
- Swagger at `/api/docs`, ReDoc at `/api/redoc`

---

### [6] — Aug 20, 2026 | Backend .env + gitignore
**Files created:** `.env`, `.env.example`, `.gitignore`

`.env` contains all required config with safe dev defaults. `.env.example` is the committed template (no secrets). `.gitignore` excludes `.env`, `__pycache__`, `.venv`, `uploads/`.

---

### [7] — Aug 20, 2026 | Services layer built
**Files created:** `app/services/auth_service.py`, `app/services/student_service.py`, `app/services/admin_service.py`, `app/services/__init__.py`

**`auth_service.py`** — full auth business logic:
- `register_student()` — validates email/roll uniqueness, creates User + StudentProfile, sends OTP
- `verify_otp()` — hash comparison, attempt counting, activates account on REGISTRATION verify
- `resend_otp()` — invalidates old OTPs, sends fresh one
- `login()` — credential check, status validation, creates UserSession with refresh token hash
- `refresh_tokens()` — validates session, rotates refresh token (old revoked, new issued)
- `logout()` — marks session revoked
- `forgot_password()` — OTP flow, email-enumeration safe response
- `reset_password()` — verifies OTP then updates hash
- `change_password()` — verifies current password then updates

**`student_service.py`** — all profile operations:
- `get_full_profile()` — loads all related data in one call
- `update_profile()` — partial update with completion recalculation
- `upsert_education()`, `upsert_academic_records()` — replace-all pattern
- `sync_skills()`, `sync_projects()`, `sync_experiences()`, `sync_certifications()` — replace-all with auto-create for skills/tech
- `update_preferences()` — syncs roles and locations via master tables
- `_recalculate_completion()` — scores 7 sections → percentage

**`admin_service.py`** — admin + super-admin operations:
- Department CRUD with student-count guard on delete
- Admin account create/update/reset-password with temp password + email
- `list_students()` — paginated, filterable by dept/year/search (SQL LIKE)
- `add_student()` — single student with temp password
- `preview_excel_import()` — parses xlsx/csv, validates all rows, returns per-row status without writing to DB
- `confirm_excel_import()` — runs preview again then commits valid rows

---

### [8] — Aug 20, 2026 | Auth, Student, Admin API endpoints
**Files created:** `app/api/v1/endpoints/auth.py`, `app/api/v1/endpoints/student.py`, `app/api/v1/endpoints/admin.py`

**`auth.py`** — 10 endpoints: register, verify-otp, resend-otp, login, refresh, logout, forgot-password, reset-password, change-password, GET /me

**`student.py`** — 9 endpoints (all require STUDENT role): GET + PATCH profile, PUT education, PUT academic-records, PUT skills, PUT projects, PUT experience, PUT certifications, PUT preferences

**`admin.py`** — 12 endpoints: departments CRUD (Super Admin), admin accounts CRUD + reset-password (Super Admin), students list + add + Excel preview + Excel confirm (Dept Admin)

---

### [9] — Aug 20, 2026 | Pydantic schemas
**Files created:** `app/schemas/auth.py`, `app/schemas/student.py`, `app/schemas/admin.py`, `app/schemas/common.py`

Full request/response models for every endpoint. `FullProfileOut` composes all sub-schemas into a single response. `PaginatedResponse` for paginated lists. Field validators on passwords (min 8 chars), emails, year range.

---

### [10] — Aug 20, 2026 | React + Vite frontend scaffolded
**Files created:** `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/styles/index.css`

**Design system in Tailwind:**
- `accent` → `#D85A30` (coral, matches prototype)
- `teal`, `amber`, `danger`, `purple` semantic colors
- `surface-0/1/2`, `border`/`border-strong`, `text-primary/secondary/muted`
- Component classes: `.ch-card`, `.ch-input`, `.ch-label`, `.ch-table`, `.badge-*`, `.progress-track/.progress-fill`, `.sidebar-link`
- Animation classes: `.anim-fade-up`, `.anim-fade-in`, `.anim-scale-in`, `.skeleton`

**Vite proxy:** `/api` and `/uploads` proxied to `http://localhost:8000` — no CORS config needed in dev.

---

### [11] — Aug 20, 2026 | Frontend .env, main.tsx, App.tsx + routing
**Files created:** `src/main.tsx`, `src/App.tsx`, `.env`, `.gitignore`

`App.tsx` sets up all React Router routes organized by role:
- Public: `/login`, `/register`, `/verify-otp`, `/reset-password`
- Student (protected): `/dashboard`, `/profile`, `/readiness`, `/notifications`, `/settings`
- Admin (protected): `/admin`, `/admin/students`, `/admin/students/add`, `/admin/students/import`
- Super Admin (protected): `/super-admin`, `/super-admin/departments`, `/super-admin/admins`

`initAuth()` called on mount to restore session from localStorage.

---

### [12] — Aug 20, 2026 | API layer
**Files created:** `src/api/client.ts`, `src/api/auth.ts`, `src/api/student.ts`, `src/api/admin.ts`

**`client.ts`** — Axios instance with base `/api/v1`. Request interceptor attaches Bearer token. Response interceptor catches 401s, calls `refreshAccessToken()` from authStore, retries original request once. If refresh fails, logs user out and redirects to `/login`.

**`auth.ts`** — typed wrappers for all 10 auth endpoints.

**`student.ts`** — typed wrappers for all 9 student profile endpoints with full TypeScript interfaces for `FullProfileOut`, `StudentProfileOut`, `ProjectOut`, `StudentSkillOut`, etc.

**`admin.ts`** — typed wrappers for all 12 admin endpoints including multipart form-data for Excel upload.

---

### [13] — Aug 20, 2026 | Zustand stores
**Files created:** `src/store/authStore.ts`, `src/store/toastStore.ts`

**`authStore.ts`** — manages `user`, `accessToken`, `refreshToken`, `isAuthenticated`, `isLoading`. Methods: `initAuth()` (restores session on page load), `setTokens()`, `setUser()`, `logout()` (revokes refresh token + clears localStorage), `refreshAccessToken()` (token rotation).

**`toastStore.ts`** — `toasts[]`, `show(message, type, duration)`, `remove(id)`. Auto-dismisses after duration. `toast` convenience object: `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`.

---

### [14] — Aug 20, 2026 | Layout components
**Files created:** `src/components/layout/ProtectedRoute.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/AppLayout.tsx`

**`ProtectedRoute.tsx`** — shows spinner during `isLoading`, redirects to `/login` if not authenticated, redirects to role-appropriate home if wrong role.

**`Sidebar.tsx`** — role-aware nav: student (5 items), admin (4 items), super-admin (3 items). `NavLink` with `active` class. User avatar with email + role label. Logout button calls `authStore.logout()` + `navigate('/login')`. `onClose` prop for mobile.

**`Topbar.tsx`** — hamburger button (mobile), optional title/subtitle, notification bell icon, user avatar initials.

**`AppLayout.tsx`** — `Outlet` wrapper with responsive sidebar. Mobile: fixed sidebar off-screen, slides in on hamburger click with dark overlay. Desktop: static 220px sidebar. `min-h-screen` flex layout.

---

### [15] — Aug 20, 2026 | Common UI components
**Files created:** `src/components/common/Button.tsx`, `src/components/common/Input.tsx`, `src/components/common/Card.tsx`, `src/components/common/Badge.tsx`, `src/components/common/Toast.tsx`, `src/components/common/ConfirmModal.tsx`, `src/components/common/Skeleton.tsx`

**`Button.tsx`** — variants: `primary`, `outline`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. `loading` prop shows spinner. `icon` prop. Hover lift + shadow transition. Disabled state.

**`Input.tsx`** — `Input` (forwardRef), `Select` (forwardRef with options array), `Textarea` (forwardRef). All support `label`, `error`, `hint`. Error state switches border to danger red.

**`Card.tsx`** — `Card` base, `MetricCard` (label/value/sub/trend), `SectionHeader` (title/subtitle/action slot).

**`Badge.tsx`** — colors: `green`, `amber`, `red`, `purple`, `gray`, `blue`. Helper functions: `readinessBadge(score)` → color, `statusBadge(status)` → color.

**`Toast.tsx`** — `ToastContainer` renders from `toastStore`. Each toast has icon, message, close button. Color-coded by type.

**`ConfirmModal.tsx`** — fixed overlay, `anim-scale-in` card, Cancel + Confirm buttons, Escape key closes, focus trap on cancel button, `loading` prop disables buttons.

**`Skeleton.tsx`** — `Skeleton` (single line), `SkeletonCard`, `SkeletonTable`, `SkeletonMetricGrid`. Uses CSS shimmer animation.

---

### [16] — Aug 20, 2026 | Auth pages
**Files created:** `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterPage.tsx`, `src/pages/auth/OTPVerificationPage.tsx`, `src/pages/auth/ResetPasswordPage.tsx`

**`LoginPage.tsx`** — email + password form (`react-hook-form`). Show/hide password toggle. On success: stores tokens, sets user, redirects by role. `must_change_password` → redirects to `/settings` with warning toast.

**`RegisterPage.tsx`** — 8-field form. Fetches live department list from API. Grid layout (2-column). Confirm password validation. On success: navigates to `/verify-otp` with `state: { user_id, email, purpose }`.

**`OTPVerificationPage.tsx`** — 6 individual digit inputs with auto-focus-next, auto-focus-prev on Backspace, paste handler splits digits. 60-second countdown before resend. Guards: redirects to `/register` if no `location.state`.

**`ResetPasswordPage.tsx`** — 3-step flow with animated step indicator (dots with done/active states). Step 1: email → OTP. Step 2: 6-digit OTP entry. Step 3: new password + confirm. Back link throughout.

---

### [17] — Aug 20, 2026 | Student pages
**Files created:** `src/pages/student/Dashboard.tsx`, `src/pages/student/Profile.tsx`, `src/pages/student/Readiness.tsx`, `src/pages/student/Notifications.tsx`, `src/pages/student/Settings.tsx`

**`Dashboard.tsx`** — fetches profile on mount. 3 metric cards (profile %, readiness placeholder, drives placeholder). Animated progress bar. 3 quick action cards (complete profile, view readiness, check drives).

**`Profile.tsx`** — 7-tab sidebar navigation (desktop: sticky left sidebar; mobile: select dropdown). Each tab is a standalone component:
- **Personal** — full_name, phone, alt-email, DOB, gender, address. Read-only: roll number, department, year/semester.
- **Academic** — education cards (10th, 12th) with board/year/percentage/cgpa. 8-slot semester CGPA grid.
- **Skills** — tag-input for technical and soft skills. Enter or comma to add, × to remove.
- **Projects** — repeatable entry cards. Title, description, link, dates, tech tag-input.
- **Experience** — repeatable cards. Company, role, dates, currently_working toggle, description.
- **Certifications** — repeatable cards. Title, org, date, credential URL.
- **Preferences** — company type select, expected package, relocate checkbox, preferred roles tag-input, preferred locations tag-input.

Each tab calls its own API endpoint on save and refreshes the full profile after.

**`Readiness.tsx`** — SVG circular gauge (stroke-dasharray animation). Score breakdown: 3 progress bars (profile, resume, assessment). Suggestions list filtered to only show incomplete items with links to fix them.

**`Notifications.tsx`** — static mock notifications for Phase 1 (drive notifications come in Phase 5). Unread indicator dots. Read/unread visual distinction.

**`Settings.tsx`** — change password form with current + new + confirm fields. 4 notification preference toggles (CSS animated knob). Danger zone card with deactivate button → ConfirmModal → logout + redirect.

---

### [18] — Aug 20, 2026 | Admin pages
**Files created:** `src/pages/admin/Home.tsx`, `src/pages/admin/Students.tsx`, `src/pages/admin/AddStudent.tsx`, `src/pages/admin/ExcelUpload.tsx`

**`Home.tsx`** — 4 metric cards. Quick action cards (view students, add student, import Excel) with hover arrow reveal. Department overview table. Empty state if no departments configured.

**`Students.tsx`** — paginated student table (20/page). Live search with 300ms debounce resets to page 1. Department filter (populated from API), year filter. Progress bar + badge for profile completion. Pagination controls with prev/next and page count. Empty state with clear-filters link.

**`AddStudent.tsx`** — form with name, email, roll number, phone, department select (live from API), year and semester. Info banner explains temp password flow. Cancel navigates back to student list.

**`ExcelUpload.tsx`** — 4-stage flow (`idle` → `previewing` → `preview_ready` → `done`):
1. Download CSV template button.
2. Drag-and-drop zone (also click to browse). Accepts `.xlsx` and `.csv`.
3. "Validate file" calls preview API → shows 3-card summary (total/valid/error) + error rows table.
4. "Import N valid rows" → ConfirmModal → confirm import API → success screen with counts.
Re-upload resets all state.

---

### [19] — Aug 20, 2026 | Super-admin pages
**Files created:** `src/pages/super-admin/Dashboard.tsx`, `src/pages/super-admin/Departments.tsx`, `src/pages/super-admin/AdminAccounts.tsx`

**`Dashboard.tsx`** — 4 KPI cards. "Needs your attention" section (dynamically built from unassigned depts, inactive admins, inactive depts). Department list with status indicators. Recent admins table (top 5) with link to full list.

**`Departments.tsx`** — department table (name, code, student count, admin count, status). Inline create/edit form (toggles open with scale-in animation). Name + code validation. Active checkbox. Edit pencil + delete trash icons per row. Delete guarded by ConfirmModal (backend rejects if students exist).

**`AdminAccounts.tsx`** — admin table with role, departments, last login, status. Inline form: name, email (read-only on edit), phone, role select, status select (on edit), department multi-select (chip toggle buttons, shows warning if none selected for DEPT_ADMIN). Reset password button → ConfirmModal → calls reset API → new credentials emailed.

---

### [20] — Aug 20, 2026 | README.md created
**File created:** `README.md`

Comprehensive setup guide covering:
- Full project structure tree
- Prerequisites table (Python 3.11+, Node 18+, PostgreSQL 14+)
- Step-by-step: create database → backend venv + install + .env + migrate + run
- Step-by-step: frontend install + run
- First-time Super Admin creation (SQL method + Python hash generation)
- Complete API endpoint reference table for all 3 routers
- User flow walkthroughs for all 3 roles
- Development notes: email in dev mode (OTP printed to terminal), running both servers
- Production build commands
- Phase roadmap (Phases 1–6)
- Troubleshooting section (alembic failures, network errors, OTP, psycopg2, port conflicts)

---

## Files Changed — Complete List

### Backend (`backend/`)

| File | Change |
|------|--------|
| `requirements.txt` | Created — all pinned Python dependencies |
| `app/__init__.py` | Created — package stub |
| `app/main.py` | Created — FastAPI app, CORS, router, static files, health check |
| `app/core/config.py` | Created — Settings class (pydantic-settings) |
| `app/core/security.py` | Created — bcrypt, OTP, JWT helpers |
| `app/core/email.py` | Created — SMTP wrapper + OTP/credentials email templates |
| `app/core/deps.py` | Created — DB session, auth dependencies, role guards |
| `app/core/__init__.py` | Created — package stub |
| `app/db/base.py` | Created — SQLAlchemy DeclarativeBase |
| `app/db/session.py` | Created — engine + SessionLocal |
| `app/db/__init__.py` | Created — package stub |
| `app/models/user.py` | Created — User model (enums: role, status, registration_source) |
| `app/models/auth.py` | Created — OTPVerification, PasswordResetToken, UserSession |
| `app/models/department.py` | Created — Department, AdminProfile, AdminDepartmentMapping |
| `app/models/student.py` | Created — 14 student profile models |
| `app/models/__init__.py` | Created — imports all models for Alembic |
| `app/schemas/auth.py` | Created — all auth request/response schemas |
| `app/schemas/student.py` | Created — full profile schemas including FullProfileOut |
| `app/schemas/admin.py` | Created — department, admin, student list, import schemas |
| `app/schemas/common.py` | Created — MessageResponse, PaginatedResponse |
| `app/schemas/__init__.py` | Created — package stub |
| `app/services/auth_service.py` | Created — full auth business logic |
| `app/services/student_service.py` | Created — profile CRUD + completion calculator |
| `app/services/admin_service.py` | Created — departments, admin accounts, students, Excel import |
| `app/services/__init__.py` | Created — package stub |
| `app/api/__init__.py` | Created — package stub |
| `app/api/v1/__init__.py` | Created — package stub |
| `app/api/v1/router.py` | Created — registers all 3 endpoint routers |
| `app/api/v1/endpoints/__init__.py` | Created — package stub |
| `app/api/v1/endpoints/auth.py` | Created — 10 auth endpoints |
| `app/api/v1/endpoints/student.py` | Created — 9 student profile endpoints |
| `app/api/v1/endpoints/admin.py` | Created — 12 admin/super-admin endpoints |
| `app/utils/__init__.py` | Created — package stub |
| `alembic/env.py` | Created — Alembic env with auto model detection |
| `alembic/script.py.mako` | Created — migration template |
| `alembic.ini` | Created — Alembic configuration |
| `.env` | Created — local dev environment variables |
| `.env.example` | Created — committed template (no secrets) |
| `.gitignore` | Created — excludes .env, venv, uploads, cache |

### Frontend (`frontend/`)

| File | Change |
|------|--------|
| `package.json` | Created — React 18, Vite 5, Tailwind 3, Zustand 4, react-hook-form, lucide-react, axios, clsx |
| `vite.config.ts` | Created — React plugin, path alias `@/`, proxy `/api` + `/uploads` to port 8000 |
| `tailwind.config.js` | Created — full design token extension (colors, fonts, radius) |
| `postcss.config.js` | Created — autoprefixer + tailwindcss |
| `tsconfig.json` | Created — strict TS, path alias `@/*` |
| `tsconfig.node.json` | Created — vite.config.ts compiler settings |
| `index.html` | Created — root HTML, Inter font, `<div id="root">` |
| `.env` | Created — VITE_API_BASE_URL |
| `.gitignore` | Created — node_modules, dist, .env |
| `src/styles/index.css` | Created — Tailwind directives + component classes + animation keyframes |
| `src/main.tsx` | Created — ReactDOM.createRoot with BrowserRouter |
| `src/App.tsx` | Created — all routes organized by role with ProtectedRoute wrappers |
| `src/utils/errors.ts` | Created — `getErrorMessage()` extracts readable messages from AxiosError |
| `src/api/client.ts` | Created — Axios instance with Bearer interceptor + 401 refresh interceptor |
| `src/api/auth.ts` | Created — typed wrappers for all auth endpoints |
| `src/api/student.ts` | Created — typed wrappers + TypeScript interfaces for student API |
| `src/api/admin.ts` | Created — typed wrappers + interfaces for admin/super-admin API |
| `src/store/authStore.ts` | Created — Zustand auth store with token management |
| `src/store/toastStore.ts` | Created — Zustand toast store with auto-dismiss |
| `src/components/layout/ProtectedRoute.tsx` | Created — role-aware auth guard |
| `src/components/layout/Sidebar.tsx` | Created — role-aware nav with NavLink active states |
| `src/components/layout/Topbar.tsx` | Created — sticky header with hamburger, bell, avatar |
| `src/components/layout/AppLayout.tsx` | Created — responsive shell with mobile sidebar slide |
| `src/components/common/Button.tsx` | Created — 4 variants, 3 sizes, loading, icon |
| `src/components/common/Input.tsx` | Created — Input, Select, Textarea (all forwardRef) |
| `src/components/common/Card.tsx` | Created — Card, MetricCard, SectionHeader |
| `src/components/common/Badge.tsx` | Created — 6 colors + readinessBadge/statusBadge helpers |
| `src/components/common/Toast.tsx` | Created — ToastContainer reading from toastStore |
| `src/components/common/ConfirmModal.tsx` | Created — accessible modal with Escape + focus trap |
| `src/components/common/Skeleton.tsx` | Created — 4 skeleton variants |
| `src/pages/auth/LoginPage.tsx` | Created — email/password form, role-based redirect |
| `src/pages/auth/RegisterPage.tsx` | Created — 8-field registration with live dept fetch |
| `src/pages/auth/OTPVerificationPage.tsx` | Created — 6-box OTP with paste, countdown, resend |
| `src/pages/auth/ResetPasswordPage.tsx` | Created — 3-step with animated step indicator |
| `src/pages/student/Dashboard.tsx` | Created — metrics, progress bar, quick action cards |
| `src/pages/student/Profile.tsx` | Created — 7-tab profile editor, all tabs wired to API |
| `src/pages/student/Readiness.tsx` | Created — SVG gauge, breakdown bars, suggestions |
| `src/pages/student/Notifications.tsx` | Created — notification list with read/unread states |
| `src/pages/student/Settings.tsx` | Created — change password, notification toggles, danger zone |
| `src/pages/admin/Home.tsx` | Created — KPIs, quick actions, department table |
| `src/pages/admin/Students.tsx` | Created — live-filter paginated student table |
| `src/pages/admin/AddStudent.tsx` | Created — manual add form with dept fetch |
| `src/pages/admin/ExcelUpload.tsx` | Created — drag-drop, validate, preview, confirm import |
| `src/pages/super-admin/Dashboard.tsx` | Created — institution overview, attention items |
| `src/pages/super-admin/Departments.tsx` | Created — inline CRUD form + table |
| `src/pages/super-admin/AdminAccounts.tsx` | Created — inline form with dept multi-select + reset |

### Root

| File | Change |
|------|--------|
| `README.md` | Created — full setup + API reference + troubleshooting |
| `CHANGELOG.md` | Created — this file |

---

## What's Next (Phase 3–6)

The foundation is production-ready for Phases 1 and 2. Planned next phases:

| Phase | What to build |
|-------|--------------|
| **3** | Resume builder, template selection, PDF generation, AI resume analysis |
| **4** | Assessment engine (MCQs), question bank, attempt tracking, readiness score calculation |
| **5** | Placement drives, eligibility matching, application flow, offer tracking |
| **6** | Announcements, push notifications, department reports, audit log, system settings |
