# CampusHire Project Structure

## 🏗️ Architecture Overview

**CampusHire uses Next.js 15 App Router** - which means **Frontend and Backend are NOT separate**. This is a **Full-Stack Monolithic** architecture where frontend and backend code live together in one unified codebase.

## ❓ Why Not Separate Frontend/Backend?

### Traditional Approach (Separate):
```
project/
├── frontend/          ❌ NOT used in this project
│   ├── react-app/
│   └── components/
└── backend/           ❌ NOT used in this project
    ├── api/
    └── controllers/
```

### Next.js Approach (Unified):
```
CampusHire/
├── app/              ✅ Frontend + Backend together
│   ├── page.tsx      → Frontend UI (React components)
│   ├── api/          → Backend API routes
│   └── actions.ts    → Backend server actions
├── lib/              ✅ Shared utilities
└── prisma/           ✅ Database
```

## 📁 Current Project Structure Explained

```
CampusHire/
│
├── app/                          🎨 FRONTEND + ⚙️ BACKEND (Route-based)
│   ├── (auth)/                   🎨 Frontend: Auth pages
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx      → Clerk sign-in UI component
│   │   └── sign-up/
│   │       └── [[...sign-up]]/
│   │           └── page.tsx      → Clerk sign-up UI component
│   │
│   ├── (student)/                🎨 Frontend: Student pages
│   │   ├── layout.tsx            → Student shell layout
│   │   └── student-dashboard/
│   │       └── page.tsx          → Student dashboard UI
│   │
│   ├── (admin)/                  🎨 Frontend: Admin pages
│   │   ├── layout.tsx            → Admin shell layout
│   │   └── admin-dashboard/
│   │       └── page.tsx          → Admin dashboard UI
│   │
│   ├── (super-admin)/            🎨 Frontend: Super Admin pages
│   │   ├── layout.tsx            → Super admin shell layout
│   │   └── super-admin-dashboard/
│   │       └── page.tsx          → Super admin dashboard UI
│   │
│   ├── api/                      ⚙️ BACKEND: API Routes
│   │   └── (future endpoints here)
│   │
│   ├── layout.tsx                🎨 Root layout (wraps all pages)
│   ├── page.tsx                  🎨 Home page
│   ├── not-found.tsx             🎨 404 page
│   └── globals.css               🎨 Global styles
│
├── features/                     ⚙️ BACKEND: Business Logic (Future)
│   ├── auth/                     → Authentication logic
│   ├── students/                 → Student management
│   ├── drives/                   → Drive management
│   └── excel-upload/             → Excel upload logic
│
├── lib/                          ⚙️ BACKEND: Utilities & Helpers
│   ├── prisma.ts                 → Database client
│   ├── clerk.ts                  → Auth helpers
│   ├── env.ts                    → Environment validation
│   └── utils.ts                  → Utility functions
│
├── prisma/                       💾 DATABASE: Schema & Migrations
│   └── schema.prisma             → Database models
│
├── components/                   🎨 FRONTEND: Reusable UI Components
│   ├── ui/                       → shadcn/ui components
│   └── shared/                   → Custom shared components
│
├── scripts/                      🔧 BACKEND: Utility Scripts
│   └── seed-super-admin.ts       → (Future) Create super admin
│
├── middleware.ts                 ⚙️ BACKEND: Route Protection
│
└── context/                      📚 DOCUMENTATION
    ├── architecture.md
    ├── code-standards.md
    ├── project-overview.md
    └── specs/
```

## 🔍 Detailed Breakdown

### 1. **Frontend Components (UI)**

| Location | Purpose | Type |
|----------|---------|------|
| `app/**/page.tsx` | Page UI components | React Server Components |
| `app/**/layout.tsx` | Layout wrappers | React Server Components |
| `components/ui/` | shadcn/ui components | React Client Components |
| `components/shared/` | Custom components | React Client/Server Components |
| `app/globals.css` | Global styles | CSS |

**Example:**
```tsx
// app/(student)/student-dashboard/page.tsx
// This is FRONTEND code (React component that renders UI)
export default function StudentDashboard() {
  return <div>Welcome Student!</div>
}
```

### 2. **Backend Logic**

| Location | Purpose | Type |
|----------|---------|------|
| `app/api/*` | REST API endpoints | Route Handlers |
| `features/*/actions.ts` | Server Actions | Server-side functions |
| `features/*/service.ts` | Business logic | TypeScript functions |
| `lib/*` | Utilities | TypeScript functions |
| `middleware.ts` | Auth & routing | Edge middleware |

**Example:**
```tsx
// features/students/actions.ts (Future)
// This is BACKEND code (runs on server only)
'use server'

export async function getStudents() {
  const students = await prisma.student.findMany()
  return students
}
```

### 3. **Database Layer**

| Location | Purpose |
|----------|---------|
| `prisma/schema.prisma` | Database schema definition |
| `lib/prisma.ts` | Database client singleton |
| SQL queries | Via Prisma ORM |

### 4. **How They Work Together**

```
User Browser (Frontend)
    ↓
Next.js Server
    ↓
┌─────────────────────────────────────┐
│  SAME APPLICATION                   │
│                                     │
│  ┌──────────┐    ┌──────────┐     │
│  │ Frontend │ ←→ │ Backend  │     │
│  │  (UI)    │    │ (Logic)  │     │
│  └──────────┘    └──────────┘     │
│       ↓                 ↓          │
│   page.tsx          actions.ts     │
│                                    │
└─────────────────────────────────────┘
          ↓
      Database (Prisma + PostgreSQL)
```

## 🎯 How Next.js Unifies Frontend & Backend

### **Server Components (Backend-ish)**
```tsx
// app/(student)/student-dashboard/page.tsx
// Runs on SERVER - can access database directly
import { prisma } from '@/lib/prisma'

export default async function StudentDashboard() {
  // This runs on the server (backend logic)
  const student = await prisma.student.findUnique({ ... })
  
  // This renders on the server, sent to client as HTML (frontend)
  return <div>{student.name}</div>
}
```

### **Client Components (Frontend)**
```tsx
// components/student-profile-form.tsx
'use client'  // ← Makes it client-side only

export function StudentProfileForm() {
  const [name, setName] = useState('')  // React hooks work here
  
  return <input value={name} onChange={e => setName(e.target.value)} />
}
```

### **Server Actions (Backend)**
```tsx
// features/students/actions.ts
'use server'  // ← Makes it server-side only

export async function updateStudent(data: StudentData) {
  // This runs on server (backend logic)
  await prisma.student.update({ ... })
  revalidatePath('/student-dashboard')
}
```

### **API Routes (Backend)**
```tsx
// app/api/students/route.ts
export async function GET() {
  const students = await prisma.student.findMany()
  return Response.json(students)
}
```

## ✅ Benefits of This Unified Architecture

### 1. **No API Layer Needed for Simple Operations**
```tsx
// OLD WAY (Separate):
// Frontend → Fetch API → Backend → Database

// NEW WAY (Unified):
// Frontend (Server Component) → Database (direct)
```

### 2. **Type Safety Across Full Stack**
```tsx
// Database types from Prisma are automatically available everywhere
type Student = Prisma.Student  // Works in frontend AND backend
```

### 3. **Single Deployment**
- One build command: `npm run build`
- One deployment: Deploy to Vercel
- No CORS issues between frontend/backend

### 4. **Code Reuse**
```tsx
// lib/utils.ts can be used in both:
// - Server components (backend)
// - Client components (frontend)
```

## 📊 File Type Reference

| File Type | Purpose | Runs Where |
|-----------|---------|------------|
| `page.tsx` | Page UI | Server (default) or Client (if `'use client'`) |
| `layout.tsx` | Layout wrapper | Server |
| `route.ts` | API endpoint | Server |
| `actions.ts` | Server actions | Server |
| `middleware.ts` | Route protection | Edge (CDN) |
| `*.test.ts` | Unit tests | Build time |
| `schema.prisma` | Database schema | Database |

## 🔐 Where Is Business Logic?

Currently in Unit 01, we have minimal business logic. In future units:

```
features/
├── auth/
│   ├── actions.ts           ⚙️ Server actions (login, register)
│   └── service.ts           ⚙️ Business logic
│
├── students/
│   ├── actions.ts           ⚙️ CRUD operations
│   ├── service.ts           ⚙️ Profile completion calculation
│   └── components/          🎨 Student-specific UI components
│
├── drives/
│   ├── actions.ts           ⚙️ Drive CRUD
│   ├── eligibility.ts       ⚙️ Eligibility matching logic
│   └── components/          🎨 Drive UI components
│
└── excel-upload/
    ├── actions.ts           ⚙️ Upload handling
    ├── parser.ts            ⚙️ Excel parsing logic
    └── components/          🎨 Upload UI
```

## 🆚 Comparison: Traditional vs Next.js

### Traditional MERN/Separate Architecture:
```
project/
├── frontend/                 (Port 3000)
│   ├── src/
│   │   ├── components/      🎨 React components
│   │   ├── pages/           🎨 React pages
│   │   └── api/             → Calls backend
│   └── package.json
│
└── backend/                  (Port 5000)
    ├── src/
    │   ├── routes/          ⚙️ Express routes
    │   ├── controllers/     ⚙️ Business logic
    │   └── models/          💾 Database models
    └── package.json

Communication: HTTP/REST between two separate apps
```

### Next.js (CampusHire) Architecture:
```
CampusHire/                   (Port 3000 - ONE app)
├── app/
│   ├── page.tsx             🎨 + ⚙️ Frontend + Backend
│   └── api/                 ⚙️ API routes
├── features/                ⚙️ Business logic
├── components/              🎨 UI components
└── lib/                     ⚙️ Utilities

Communication: Direct function calls (no HTTP needed!)
```

## 📝 Summary

### **Is frontend/backend separate?**
❌ **No** - They are unified in one Next.js application

### **Where is the frontend?**
✅ **Frontend UI**: `app/**/page.tsx`, `app/**/layout.tsx`, `components/`

### **Where is the backend?**
✅ **Backend Logic**: `features/*/actions.ts`, `lib/`, `app/api/`, `middleware.ts`

### **How do they communicate?**
✅ **Direct function calls** - No REST API needed for most operations
- Server Components can call server-side code directly
- Client Components can call Server Actions directly
- API routes available for external clients or complex operations

### **Is this a problem?**
❌ **No** - This is the **modern recommended approach** for full-stack TypeScript apps
- ✅ Better type safety
- ✅ Faster development
- ✅ Less boilerplate
- ✅ Single deployment
- ✅ Better performance (no network roundtrips for many operations)

---

## 🎓 Key Takeaway

**CampusHire is a full-stack monolithic application where:**
- 🎨 **Frontend** (React components, UI) and
- ⚙️ **Backend** (server logic, database access)

**Live together in the same codebase and work seamlessly through Next.js's unified architecture.**

This is the recommended modern approach for TypeScript full-stack applications!
