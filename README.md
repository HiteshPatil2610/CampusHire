# CampusHire

A full-stack campus placement management platform.

**Stack:** React + Vite (frontend) · FastAPI (backend) · PostgreSQL (database)  
**Auth:** JWT access + refresh tokens · OTP email verification  
**Phase:** 1 + 2 — Authentication, Student Profile Management, Department Admin, Super Admin

---

## Project Structure

```
CampusHire/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/v1/           # Route handlers (auth, student, admin)
│   │   ├── core/             # Config, security, email, dependencies
│   │   ├── db/               # SQLAlchemy engine + session
│   │   ├── models/           # ORM models (user, auth, department, student)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic layer
│   │   └── main.py           # FastAPI app + CORS + router mount
│   ├── alembic/              # Database migrations
│   ├── .env                  # Environment variables (git-ignored)
│   ├── .env.example          # Template — copy to .env and fill in values
│   └── requirements.txt      # Python dependencies
│
└── frontend/                 # React + Vite application
    ├── src/
    │   ├── api/              # Axios API clients (auth, student, admin)
    │   ├── components/
    │   │   ├── common/       # Button, Input, Card, Badge, Toast, Modal, Skeleton
    │   │   └── layout/       # AppLayout, Sidebar, Topbar, ProtectedRoute
    │   ├── pages/
    │   │   ├── auth/         # Login, Register, OTP, Reset Password
    │   │   ├── student/      # Dashboard, Profile (7 tabs), Readiness, Notifications, Settings
    │   │   ├── admin/        # Home, Students, AddStudent, ExcelUpload
    │   │   └── super-admin/  # Dashboard, Departments, AdminAccounts
    │   ├── store/            # Zustand stores (auth, toast)
    │   ├── styles/           # Tailwind CSS + design tokens
    │   └── utils/            # Error helpers
    ├── .env                  # Frontend env (VITE_API_BASE_URL)
    └── package.json
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | 14+ | [postgresql.org](https://postgresql.org) |
| pip | latest | bundled with Python |

---

## 1 — Database Setup

Open **pgAdmin** or **psql** and create the database:

```sql
CREATE DATABASE campushire;
```

If you want a dedicated user (recommended):

```sql
CREATE USER campushire_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE campushire TO campushire_user;
```

---

## 2 — Backend Setup

### 2a. Create and activate a virtual environment

```bash
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 2b. Install dependencies

```bash
pip install -r requirements.txt
```

### 2c. Configure environment variables

```bash
# Copy the example file
copy .env.example .env       # Windows
cp .env.example .env         # macOS / Linux
```

Edit `.env` and set at minimum:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/campushire
SECRET_KEY=your-random-secret-key-at-least-32-chars
```

Generate a secure secret key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2d. Run database migrations

```bash
alembic upgrade head
```

This creates all tables in the database.

### 2e. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now running at `http://localhost:8000`

- **Interactive docs (Swagger):** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc
- **Health check:** http://localhost:8000/api/health

---

## 3 — Frontend Setup

### 3a. Install dependencies

```bash
cd frontend
npm install
```

### 3b. Configure environment

The `.env` file is already pre-configured for local development:

```env
VITE_API_BASE_URL=http://localhost:8000
```

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:8000` automatically — no CORS issues in development.

### 3c. Start the frontend dev server

```bash
npm run dev
```

The app is now running at `http://localhost:5173`

---

## 4 — First-Time Setup (create a Super Admin)

Since Super Admin accounts are not publicly registerable, create one directly via the API:

**Option A — Swagger UI:**
1. Go to http://localhost:8000/api/docs
2. Use `POST /api/v1/auth/register` with a student account first, verify OTP
3. Then manually update the role in PostgreSQL:

```sql
UPDATE users SET role = 'SUPER_ADMIN', status = 'ACTIVE', email_verified = true
WHERE email = 'superadmin@college.edu';
```

**Option B — Direct SQL (quickest for development):**

```sql
-- First insert a user with a known bcrypt hash
-- Hash for 'Admin@1234' — replace in production
INSERT INTO users (id, email, password_hash, role, status, email_verified, must_change_password, registration_source, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'superadmin@college.edu',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- "secret"
  'SUPER_ADMIN',
  'ACTIVE',
  true,
  true,
  'ADMIN_ADDED',
  NOW(),
  NOW()
);
```

> Replace the password hash with one generated by:
> ```python
> from passlib.context import CryptContext
> print(CryptContext(schemes=["bcrypt"]).hash("YourPassword"))
> ```

Then log in at http://localhost:5173/login with those credentials. You'll be prompted to change the password on first login.

---

## 5 — User Roles & Flows

### Student (self-registers)
1. Go to `/register` → fill in details → submit
2. OTP is sent to email (printed to console in dev mode)
3. Enter OTP at `/verify-otp` → account activated
4. Log in → redirected to `/dashboard`
5. Complete profile at `/profile` (7 tabs)
6. Check readiness at `/readiness`

### Department Admin (created by Super Admin)
1. Super Admin creates account at `/super-admin/admins`
2. Credentials emailed (printed to console in dev mode)
3. Log in → must change password → redirected to `/admin`
4. Manage students: view, add, import via Excel

### Super Admin
1. Created via SQL (see above) or by another Super Admin
2. Log in → `/super-admin`
3. Create departments → assign admins → manage platform

---

## 6 — API Endpoints Reference

### Auth (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Student self-registration |
| POST | `/verify-otp` | Verify email OTP |
| POST | `/resend-otp` | Resend OTP |
| POST | `/login` | Login (all roles) |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Revoke refresh token |
| POST | `/forgot-password` | Send password reset OTP |
| POST | `/reset-password` | Reset password with OTP |
| POST | `/change-password` | Change password (authenticated) |
| GET | `/me` | Get current user info |

### Student (`/api/v1/student`) — requires STUDENT role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get full profile |
| PATCH | `/profile` | Update personal info |
| PUT | `/profile/education` | Save education records |
| PUT | `/profile/academic-records` | Save semester CGPAs |
| PUT | `/profile/skills` | Sync skills |
| PUT | `/profile/projects` | Sync projects |
| PUT | `/profile/experience` | Sync experience |
| PUT | `/profile/certifications` | Sync certifications |
| PUT | `/profile/preferences` | Update placement preferences |

### Admin (`/api/v1/admin`) — requires DEPT_ADMIN or SUPER_ADMIN role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/departments` | List all departments |
| POST | `/departments` | Create department (Super Admin) |
| PATCH | `/departments/{id}` | Update department (Super Admin) |
| DELETE | `/departments/{id}` | Delete department (Super Admin) |
| GET | `/accounts` | List admin accounts (Super Admin) |
| POST | `/accounts` | Create admin account (Super Admin) |
| PATCH | `/accounts/{id}` | Update admin account (Super Admin) |
| POST | `/accounts/{id}/reset-password` | Reset admin password |
| GET | `/students` | List students (filterable, paginated) |
| POST | `/students` | Add single student |
| POST | `/students/import/preview` | Preview Excel import |
| POST | `/students/import/confirm` | Confirm and execute import |

---

## 7 — Development Notes

### Email in development
SMTP credentials are blank by default. All emails (OTP codes, credentials) are printed to the **backend terminal** instead of being sent. Look for output like:

```
============================================================
TO: student@college.edu
SUBJECT: Verify your CampusHire account

Your OTP is: 482931
============================================================
```

### Running both servers
You need two terminals:

```bash
# Terminal 1 — backend
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

### Build for production

```bash
# Frontend
cd frontend && npm run build    # outputs to frontend/dist/

# Backend — use gunicorn or run with uvicorn workers
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 8 — Phase Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| 1 | Auth, departments, admin accounts, student profile | ✅ Done |
| 2 | Skills, projects, experience, certifications, preferences | ✅ Done |
| 3 | Resume builder, resume templates, AI analysis | Planned |
| 4 | Assessments, question bank, readiness scoring | Planned |
| 5 | Placement drives, applications, offers | Planned |
| 6 | Announcements, notifications, reports, audit log | Planned |

---

## 9 — Troubleshooting

**`alembic upgrade head` fails:**
- Check `DATABASE_URL` in `.env` is correct
- Ensure PostgreSQL is running and the database exists
- On Windows, make sure your venv is activated

**Frontend shows "Network Error":**
- Make sure the backend is running on port 8000
- Check the Vite proxy config in `vite.config.ts`

**OTP not arriving:**
- In dev mode, check the **backend terminal** — OTP is printed there
- To enable real email, set `SMTP_USER` and `SMTP_PASSWORD` in `.env`

**`psycopg2` install fails on Windows:**
- Use `psycopg2-binary` (already in requirements.txt — this is correct)

**Port already in use:**
```bash
# Kill process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```
