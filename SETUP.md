# CampusHire — Complete Setup Guide

Follow every step in order. Do not skip any step.

---

## Before You Start — Check Versions

Open PowerShell and run:

```powershell
python --version
node --version
npm --version
```

You need **Python 3.11+** and **Node.js 18+**.

If missing:
- Python → https://python.org/downloads — during install, **check "Add Python to PATH"**
- Node.js → https://nodejs.org — download the LTS version

---

## Step 1 — Create the Database

### Using pgAdmin (recommended — no terminal password issues)

1. Open **pgAdmin** from the Start Menu (installed with PostgreSQL)
2. Enter your PostgreSQL master password when prompted
3. In the left panel: expand **Servers → PostgreSQL → Databases**
4. Right-click **Databases** → **Create** → **Database**
5. In the "Database" field type: `campushire`
6. Click **Save**

Done. The database is ready.

### Using psql (alternative)

```powershell
psql -U postgres
```

When asked for a password, **type it and press Enter — nothing will appear on screen while typing, that is normal.**

```sql
CREATE DATABASE campushire;
\q
```

---

## Step 2 — Backend Setup

Open PowerShell and run these commands **one at a time**:

```powershell
cd "C:\Users\Hitesh Patil\Downloads\CampusHire\backend"
```

```powershell
python -m venv venv
```

```powershell
venv\Scripts\activate
```

Your prompt should now show `(venv)` at the start. If it does not run:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try activating again:

```powershell
venv\Scripts\activate
```

Now install all Python packages:

```powershell
pip install -r requirements.txt
```

This takes 1–2 minutes. Wait for it to finish.

---

## Step 3 — Configure Environment Variables

```powershell
copy .env.example .env
```

Open `.env` in Notepad or VS Code.

Find these two lines and update them:

```
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/campushire
SECRET_KEY=your-super-secret-key-change-this-in-production
```

**For DATABASE_URL:** Replace `YOUR_POSTGRES_PASSWORD` with the password you use to log in to pgAdmin or psql.

**For SECRET_KEY:** Generate a proper random key by running this in PowerShell:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output (a long string of letters and numbers) and paste it as the SECRET_KEY value.

Save and close the `.env` file.

---

## Step 4 — Run Database Migrations

Still inside the backend folder with `(venv)` active:

```powershell
alembic upgrade head
```

You will see several lines like:
```
INFO  [alembic.runtime.migration] Running upgrade ...
```

This creates all the database tables. It should complete without errors.

**If you see an error like "could not connect to server":**
- PostgreSQL is not running. Open the Start Menu, search for **Services**, find `postgresql-x64-16` (or similar), right-click → Start.
- Double-check the password in DATABASE_URL is correct.

**Verify tables were created** — open pgAdmin, expand `campushire → Schemas → public → Tables`. You should see around 20 tables.

---

## Step 5 — Create Your Super Admin Account

You need to create the first Super Admin manually. This is a one-time setup.

**Step 5a — Generate a bcrypt password hash**

In PowerShell (venv active, inside backend folder):

```powershell
python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('Admin@1234'))"
```

You will see output like:
```
$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LhiasZA3ILi
```

Copy that entire string (it starts with `$2b$`).

**Step 5b — Insert the Super Admin into the database**

Open pgAdmin → expand `campushire` → click the **Query Tool** button (looks like a lightning bolt or a small database icon in the toolbar).

Paste this SQL — **replace `PASTE_YOUR_HASH_HERE` with the hash you just copied**:

```sql
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  status,
  email_verified,
  must_change_password,
  registration_source,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'superadmin@college.edu',
  'PASTE_YOUR_HASH_HERE',
  'SUPER_ADMIN',
  'ACTIVE',
  true,
  true,
  'ADMIN_ADDED',
  NOW(),
  NOW()
);
```

Click **Execute** (the ▶ play button or press F5).

You should see `INSERT 0 1` in the result. Super Admin is created.

**Login credentials:**
- Email: `superadmin@college.edu`
- Password: `Admin@1234`

---

## Step 6 — Start the Backend Server

In your PowerShell window (venv active, backend folder):

```powershell
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Leave this window open and running.**

Test it by opening this URL in your browser:
```
http://localhost:8000/api/health
```

You should see: `{"status":"ok","version":"1.0.0"}`

Also, all API endpoints are visible at:
```
http://localhost:8000/api/docs
```

---

## Step 7 — Frontend Setup

**Open a second PowerShell window** (do not close the backend one).

```powershell
cd "C:\Users\Hitesh Patil\Downloads\CampusHire\frontend"
```

```powershell
npm install
```

This downloads all frontend packages. Takes 1–3 minutes. Wait for it to finish.

---

## Step 8 — Start the Frontend

```powershell
npm run dev
```

You should see:
```
  VITE v5.x.x  ready

  ➜  Local:   http://localhost:5173/
```

**Leave this window open and running.**

---

## Step 9 — Open the App

Go to this URL in your browser:

```
http://localhost:5173
```

You will see the CampusHire login page.

---

## Step 10 — First Login

1. Enter email: `superadmin@college.edu`
2. Enter password: `Admin@1234`
3. Click **Sign in**
4. You will be redirected to Settings to change your password — **change it now**
5. After changing password, go to `http://localhost:5173/super-admin`

---

## Step 11 — Initial Platform Setup (Do This in Order)

### 11a — Create departments

Go to `http://localhost:5173/super-admin/departments`

Click **Add department** and create your departments. Example:

| Department Name | Code |
|----------------|------|
| Computer Science & Engineering | CSE |
| Electronics & Communication | ECE |
| Mechanical Engineering | MECH |

You need at least one department before you can add students.

### 11b — Create a Department Admin

Go to `http://localhost:5173/super-admin/admins`

Click **Add admin** and fill in:
- Full name, email address
- Role: `Department Admin`
- Assign to a department

After clicking **Create account**, look at your **backend terminal** (the first PowerShell window). You will see something like:

```
============================================================
TO: admin@college.edu
SUBJECT: Your CampusHire login credentials

Hi Meera Iyer, your account has been created.
Email: admin@college.edu
Temporary password: xK9mP2qRnL4s
You will be asked to change your password on first login.
============================================================
```

That is the admin's temporary password. Give it to them.

### 11c — Register a Student

Go to `http://localhost:5173/register`

Fill in all fields and click **Create account**.

Then look at your **backend terminal** again:

```
============================================================
TO: student@college.edu
SUBJECT: Verify your CampusHire account

Your one-time verification code is:
  4 8 2 9 3 1
============================================================
```

Copy the 6-digit code, paste it on the OTP verification page, and click **Verify & continue**.

The student can now log in at `http://localhost:5173/login`.

---

## Daily Usage — Starting the App

Every time you restart your computer, open **two PowerShell windows** and run:

**Window 1 — Backend:**
```powershell
cd "C:\Users\Hitesh Patil\Downloads\CampusHire\backend"
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Window 2 — Frontend:**
```powershell
cd "C:\Users\Hitesh Patil\Downloads\CampusHire\frontend"
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## URLs Quick Reference

| URL | What it is |
|-----|-----------|
| http://localhost:5173 | The app (login page) |
| http://localhost:5173/register | Student registration |
| http://localhost:5173/super-admin | Super Admin dashboard |
| http://localhost:5173/admin | Department Admin dashboard |
| http://localhost:5173/dashboard | Student dashboard |
| http://localhost:8000/api/docs | API documentation (Swagger) |
| http://localhost:8000/api/health | Backend health check |

---

## Troubleshooting

### "venv\Scripts\activate" gives an error about execution policy

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then run activate again.

### "alembic upgrade head" gives a connection error

- Make sure PostgreSQL is running (check Windows Services)
- Make sure the password in DATABASE_URL in `.env` is correct
- Make sure the `campushire` database was created in pgAdmin

### The app opens but login fails with "Invalid email or password"

- Make sure you did Step 5 (insert the Super Admin SQL)
- Make sure the backend server is running (Step 6)

### OTP never arrives by email

Emails are not actually sent in development mode. All OTPs and credentials are **printed in the backend terminal window** (Window 1). Look there for all codes and passwords.

### "relation users does not exist" in the backend terminal

Run migrations again:
```powershell
cd "C:\Users\Hitesh Patil\Downloads\CampusHire\backend"
venv\Scripts\activate
alembic upgrade head
```

### npm install fails

Make sure Node.js 18+ is installed:
```powershell
node --version
```
If it says a version below 18, download the latest LTS from https://nodejs.org

### Port 8000 already in use

```powershell
netstat -ano | findstr :8000
```
Note the PID number in the last column, then:
```powershell
taskkill /PID <that_number> /F
```

### Port 5173 already in use

```powershell
netstat -ano | findstr :5173
taskkill /PID <that_number> /F
```

---

## Need to Enable Real Email Sending?

By default all emails print to the terminal. To send real emails, open `backend\.env` and fill in your SMTP details:

```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-gmail@gmail.com
```

For Gmail, you need an **App Password** (not your regular Gmail password):
1. Go to your Google Account → Security
2. Enable 2-Step Verification
3. Go to Security → App passwords
4. Create one for "Mail" → copy the 16-character password
5. Paste it as `SMTP_PASSWORD` in `.env`

Restart the backend after changing `.env`.
