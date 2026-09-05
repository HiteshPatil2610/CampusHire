# CampusHire

A modern **Campus Placement Management System** built with **Next.js (App Router)**, **TypeScript**, **Prisma**, **PostgreSQL**, **Clerk Authentication**, and **Tailwind CSS**.

CampusHire streamlines the campus placement process by providing separate dashboards for **Students**, **Department Admins**, and the **Super Admin**, with secure role-based access and server-side eligibility management.

---

# Architecture

CampusHire follows a **Monolithic Full-Stack Architecture** using **Next.js App Router**.

Although the frontend and backend live in the same repository, they are logically separated.

```
                    CampusHire
                         │
         ┌───────────────┴────────────────┐
         │                                │
    Frontend (React)                Backend (Next.js)
         │                                │
         │                                │
         └──────────────┬─────────────────┘
                        │
                 Business Layer
                    (features/)
                        │
                     Prisma ORM
                        │
                  PostgreSQL (Neon)
```

The application is deployed as **one project**, not as separate frontend and backend services.

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Authentication | Clerk |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Storage | Vercel Blob |
| Testing | Vitest |
| Deployment | Vercel |

---

# Project Structure

```
CampusHire/
│
├── app/
│   ├── (auth)
│   ├── (student)
│   ├── (admin)
│   ├── (super-admin)
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── students/
│   ├── drives/
│   ├── shared/
│   └── ui/
│
├── context/
│
├── features/
│   ├── auth/
│   ├── students/
│   ├── drives/
│   ├── excel-upload/
│   ├── departments/
│   └── admin-accounts/
│
├── lib/
│
├── prisma/
│
├── scripts/
│
├── middleware.ts
├── package.json
└── README.md
```

---

# Folder Responsibilities

## app/

Contains only:

- Pages
- Layouts
- Route Groups
- Route Handlers

Business logic **must not** be written here.

Example:

```
app/
    (student)/
    (admin)/
    api/
```

---

## features/

Contains the complete backend business logic.

Each feature owns:

- Server Actions
- Queries
- Validation
- Business Logic
- Database Operations

Example:

```
features/
    students/
        actions/
        queries/
        schemas/

    drives/
        actions/
        queries/

    auth/

    departments/

    excel-upload/
```

---

## components/

Reusable UI components.

```
components/

    students/

    drives/

    shared/

    ui/
```

No database code should exist here.

---

## prisma/

Contains:

- Prisma Schema
- Database Models
- Migrations

---

## lib/

Shared utilities such as:

- Prisma Client
- Authentication Helpers
- Permissions
- Blob Helpers
- Utility Functions

---

## scripts/

One-time scripts such as:

- Seed Super Admin
- Database Utilities

---

# Development Workflow

Two developers can work simultaneously without conflicts.

## Backend Developer

Responsible for:

- Prisma
- Database
- Authentication
- Validation
- Business Logic
- APIs
- Server Actions

Works mainly inside:

```
features/
lib/
prisma/
app/api/
```

---

## Frontend Developer

Responsible for:

- Pages
- Components
- Forms
- Tables
- Dashboard
- Navigation
- Styling

Works mainly inside:

```
app/
components/
```

---

# Communication Between Frontend & Backend

The frontend never communicates directly with the database.

Instead, it interacts with the backend using:

- Server Actions
- Route Handlers (`/api`)

Flow:

```
React Component

        │

        ▼

Server Action / API Route

        │

        ▼

Business Logic (features)

        │

        ▼

Prisma

        │

        ▼

PostgreSQL
```

---

# Recommended Feature Flow

```
Page

↓

Component

↓

Server Action

↓

Business Logic

↓

Prisma

↓

Database
```

---

# Development Strategy

Both developers can work independently.

Example:

Backend Developer

```
Create Student Registration API
```

Frontend Developer

```
Build Registration UI
```

Initially, the frontend can use mock data.

Once the backend is complete, replace the mock implementation with the actual Server Action or API call.

---

# Git Workflow

Recommended branching strategy:

```
main

│

dev

├── feature/auth

├── feature/student-profile

├── feature/student-dashboard

├── feature/drive-module

├── feature/excel-upload

└── feature/admin-dashboard
```

Development happens on feature branches.

Merge order:

```
Feature Branch

↓

dev

↓

Testing

↓

main
```

---

# API Contract

Before implementing a feature, define:

- Endpoint / Server Action
- Request Body
- Response Body
- Validation Rules
- Error Responses

Example:

```
POST /api/students/register
```

Request

```json
{
  "name": "John Doe",
  "departmentId": 2,
  "rollNumber": "CS001"
}
```

Response

```json
{
  "success": true,
  "studentId": 15
}
```

This allows frontend and backend development to proceed independently.

---

# Server Actions vs API Routes

### Use Server Actions for

- Create
- Update
- Delete
- Form submissions
- Internal application mutations

Examples:

- Update Profile
- Add Project
- Apply for Drive
- Upload Student Data

---

### Use API Routes for

- File uploads
- Clerk Webhooks
- External integrations
- Third-party callbacks
- Public REST endpoints (if required)

Examples:

```
/api/webhooks/clerk

/api/students/profile-photo
```

---

# Development Principles

- Keep business logic inside `features/`
- Keep pages thin
- Validate all input using Zod
- Enforce authentication on the server
- Never trust client-side validation
- Use Prisma for all database operations
- Write reusable, feature-based modules
- Maintain strict TypeScript typing
- Follow a feature-first folder structure

---

# Getting Started

Install dependencies

```bash
npm install
```

Run the development server

```bash
npm run dev
```

Generate Prisma Client

```bash
npx prisma generate
```

Run migrations

```bash
npx prisma migrate dev
```

Run tests

```bash
npm run test
```

Build the application

```bash
npm run build
```

---

# Roles

### Student

- Register
- Complete Profile
- View Eligible Drives
- Apply for Drives

### Department Admin

- Manage Students
- Bulk Excel Upload
- Post Drives
- View Applications

### Super Admin

- Manage Departments
- Manage Department Admins
- View Audit Logs

---

# Design Philosophy

CampusHire follows a **feature-based monolithic architecture**.

The project remains a single deployable application while maintaining a clean separation between:

- Presentation Layer
- Business Logic
- Data Access
- Database

This architecture keeps the codebase modular, scalable, and easy for multiple developers to work on simultaneously without introducing the operational complexity of microservices.
