# Frontend Integration - Overview

## Problem Statement

Migrate Vite React frontend (`campushire_frontend (temp)`) into Next.js backend, replacing mock data with real database operations while maintaining all UI functionality and improving the architecture.

## Current State

### Source: Vite Frontend
- **Location:** `d:\ADITYA\Projects\CampusHire\CampusHire\campushire_frontend (temp)`
- **Framework:** React 18 + Vite
- **Routing:** React Router DOM v7
- **State:** Context API + localStorage (AppStateContext)
- **Styling:** Custom CSS with design tokens
- **Data:** Mock data from `src/data/mockData.js`
- **Auth:** Custom JWT (not implemented, simulated)

### Target: Next.js Backend
- **Location:** `d:\ADITYA\Projects\CampusHire\CampusHire`
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Clerk (already configured)
- **Styling:** Tailwind CSS with design tokens

## Architecture Decision

**Approach:** Full Migration with Production-Ready Best Practices

### Migration Strategy

1. **Move all UI components** from Vite into Next.js
2. **Convert CSS to Tailwind** utilities using existing design tokens
3. **Replace React Router** with Next.js App Router
4. **Replace mock data** with Prisma database queries
5. **Use Clerk authentication** instead of custom JWT
6. **Adopt Server Components pattern** (Server Components by default, Client Components for interactivity)
7. **Use Server Actions** for all data mutations

### Why This Approach?

- ✅ **Single deployment** - One codebase, one deployment
- ✅ **Type safety** - TypeScript throughout, shared types between frontend/backend
- ✅ **Better performance** - Server Components reduce client bundle size
- ✅ **Simplified data flow** - No REST API layer needed for most operations
- ✅ **Real-time data** - No stale cache, always fresh from database
- ✅ **Better DX** - Co-located components and logic

## Folder Structure

### Before (Vite - Separate)
campushire_frontend (temp)/ ├── src/ │ ├── api/ # REST API client layer │ │ ├── client.js # Fetch wrapper with auth │ │ ├── authService.js # Auth endpoints │ │ ├── studentService.js # Student CRUD │ │ └── driveService.js # Drives CRUD │ │ │ ├── components/ │ │ ├── ui/ # Design system │ │ │ ├── Button.jsx │ │ │ ├── Badge.jsx │ │ │ ├── Modal.jsx │ │ │ ├── DatePicker.jsx │ │ │ ├── UrlField.jsx │ │ │ ├── TagInput.jsx │ │ │ └── ... │ │ ├── layout/ # App shell │ │ │ ├── AppShell.jsx │ │ │ ├── Sidebar.jsx │ │ │ └── Topbar.jsx │ │ └── student/ # Domain components │ │ └── profile/ │ │ ├── ProfileHeaderStrip.jsx │ │ ├── TabPersonalInfo.jsx │ │ ├── TabAcademicInfo.jsx │ │ └── ... │ │ │ ├── pages/ # React Router pages │ │ ├── public/ # Landing, login, register │ │ ├── student/ # Student pages │ │ ├── admin/ # Admin pages │ │ └── superadmin/ # Super admin pages │ │ │ ├── context/ # React Context │ │ ├── AppStateContext.jsx # ⚠️ Mock state (DELETE) │ │ └── ToastContext.jsx # Toast notifications (MIGRATE) │ │ │ ├── data/ # ⚠️ Mock data (DELETE ALL) │ │ ├── mockData.js # Student, drives, notifications │ │ └── driveStore.js # Drive catalog │ │ │ ├── styles/ # CSS files │ │ ├── tokens.css # Design tokens (migrate to Tailwind) │ │ ├── components.css # Component styles (convert to Tailwind) │ │ └── ... │ │ │ └── utils/ # Utilities │ └── profileCompletion.js # Port to TypeScript │ └── package.json



### After (Next.js - Unified)
CampusHire/ ├── app/ │ ├── (student)/ # Student route group │ │ ├── layout.tsx # Student shell layout │ │ ├── profile/ │ │ │ ├── page.tsx # Server Component (fetch data) │ │ │ └── profile-client.tsx # Client Component (interactivity) │ │ ├── dashboard/ │ │ │ └── page.tsx │ │ └── ... │ │ │ ├── (admin)/ # Admin route group │ ├── (super-admin)/ # Super admin route group │ │ │ ├── layout.tsx # Root layout (Clerk + Toast) │ ├── page.tsx # Landing page │ └── globals.css # Design tokens (Tailwind) │ ├── components/ │ ├── ui/ # Migrated design system │ │ ├── button.tsx # TypeScript + Tailwind │ │ ├── badge.tsx │ │ ├── modal.tsx │ │ ├── date-picker.tsx │ │ ├── url-field.tsx │ │ ├── tag-input.tsx │ │ └── ... │ │ │ ├── layout/ # App shell components │ │ ├── app-shell.tsx │ │ ├── sidebar.tsx │ │ └── topbar.tsx │ │ │ └── student/ # Student domain components │ └── profile/ │ ├── profile-header.tsx │ ├── personal-info-tab.tsx │ ├── academic-info-tab.tsx │ └── ... │ ├── features/ # Business logic layer │ └── students/ │ ├── actions/ # Server Actions (mutations) │ │ ├── update-personal-info.ts │ │ ├── update-academic-info.ts │ │ ├── update-skills.ts │ │ └── ... │ │ │ ├── queries/ # Data fetching │ │ ├── get-complete-profile.ts │ │ ├── get-student-by-user-id.ts │ │ └── calculate-completion.ts │ │ │ └── schemas/ # Zod validation │ ├── profile-update.ts │ ├── academic-update.ts │ └── ... │ ├── lib/ │ ├── prisma.ts # Prisma client │ ├── clerk.ts # Clerk helpers (existing) │ ├── auth-helpers.ts # NEW: getCurrentStudent(), etc. │ └── utils.ts # cn() utility │ ├── prisma/ │ └── schema.prisma # Enhanced with new fields │ └── middleware.ts # Clerk route protection



## Data Flow Pattern

### Old Pattern (Vite + Mock Data)
Component (Client) ↓ api/studentService.js ↓ Fetch to backend API (not implemented) ↓ Mock data returned from mockData.js ↓ AppStateContext updates localStorage ↓ Component re-renders



### New Pattern (Next.js + Database)
User Interaction (Client Component) ↓ Call Server Action ↓ Server Action (features/students/actions/*.ts) ↓ Zod Schema Validation ↓ Prisma Database Query/Transaction ↓ Update database ↓ revalidatePath('/profile') to refresh UI ↓ Return { success: true } or { error: "..." } ↓ Client displays toast notification ↓ UI automatically updates (re-fetch)



### Example: Update Personal Info

**Client Component:**
```typescript
'use client';

import { updatePersonalInfo } from '@/features/students/actions/update-personal-info';
import { useToast } from '@/components/ui/use-toast';

export function PersonalInfoTab({ student }) {
  const { toast } = useToast();

  async function handleSubmit(formData: FormData) {
    const result = await updatePersonalInfo(formData);

    if (result.success) {
      toast({ title: "Profile updated successfully" });
    } else {
      toast({ title: result.error, variant: "destructive" });
    }
  }

  return <form action={handleSubmit}>...</form>;
}
Server Action:

typescript

'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentStudent } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  dob: z.string().optional(),
});

export async function updatePersonalInfo(formData: FormData) {
  const student = await getCurrentStudent();

  const data = schema.parse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    dob: formData.get('dob'),
  });

  await prisma.student.update({
    where: { id: student.id },
    data,
  });

  revalidatePath('/profile');

  return { success: true };
}
Key Changes
Aspect	Vite (Old)	Next.js (New)
Routing	React Router (<Route>)	App Router (/app/*/page.tsx)
State Management	Context + localStorage	Server Components + Database
Authentication	Custom JWT (mock)	Clerk sessions + middleware
Data Fetching	
studentService.js
 (REST)*	Server Actions (direct function calls)
Data Storage	mockData.js + localStorage*	PostgreSQL via Prisma
Styling	CSS classes (.btn, .card)	Tailwind utilities (bg-accent rounded-lg)
Forms	Controlled state + useAppState()	Server Actions + optimistic UI
Type Safety	PropTypes (minimal)	Full TypeScript with Zod
Component Type	All Client Components	Server Components (default) + Client ('use client')
Component Type Guidelines
Use Server Components (default) for:
Page layouts
Data fetching and display
Static content
Read-only views
Profile header (displays data*
Benefits:

Smaller bundle size
Better SEO
Direct database access
No client-side hydration
Example:

typescript

// app/(student)/profile/page.tsx
import { getCurrentStudent } from '@/lib/auth-helpers';
import { getCompleteProfile } from '@/features/students/queries/get-complete-profile';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const student = await getCurrentStudent();
  const profile = await getCompleteProfile(student.id);

  // This is a Server Component - runs on server, renders HTML
  return <ProfileClient profile={profile} />;
}
Use Client Components ('use client') for:
Form inputs with state
Event handlers (onClick, onChange)
Browser APIs (localStorage, window*
React hooks (useState, useEffect)
Third-party components requiring client-side JS
Toast notifications
Example:

typescript

'use client';

import { useState } from 'react';

export function PersonalInfoTab() {
  const [name, setName] = useState('');

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
}
Database Schema Enhancements
New Fields Needed
Student model:

prisma

model Student {
  // Existing fields...

  // NEW: Profile metrics
  resumeScore       Int      @default(0)       // 0-100
  readinessScore    Int      @default(0)       // 0-100
  profileCompletion Int      @default(0)       // 0-100

  // NEW: Additional info
  semester          String?                    // "7th semester"
  gender            String?                    // Added for personal info
  address           String?  @db.Text          // Added for personal info
}
StudentAcademic model:

prisma

model StudentAcademic {
  // Existing fields...

  // NEW: Detailed academic info
  tenthBoard        String?
  tenthYear         Int?
  twelfthBoard      String?
  twelfthYear       Int?
  semesterMarks     Json?                      // Array of semester objects
}
StudentPreferences model:

prisma

model StudentPreferences {
  // Existing fields...

  // NEW: Work preferences
  workMode          Json     @default("[]")    // ["On-site", "Remote", "Hybrid"]
  companyType       String?                    // "Product", "Service", "Startup"
}
Authentication Flow
Clerk Integration
Middleware Protection:

typescript

// middleware.ts (existing)
const isStudentRoute = createRouteMatcher(['/profile(.*)', '/dashboard(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  if (isStudentRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    const role = sessionClaims?.publicMetadata?.role;
    if (role !== 'STUDENT') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
});
Get Current User:

typescript

// lib/auth-helpers.ts
import { auth } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

export async function getCurrentStudent() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      department: true,
      academic: true,
      preferences: true
    }
  });

  if (!student) throw new Error("Student profile not found");

  return student;
}
Styling Migration
Design Token Mapping
Vite CSS Variables → Tailwind Config:

javascript

// tailwind.config.ts
theme: {
  extend: {
    colors: {
      surface: {
        0: '#FAF9F5',      // var(--surface-0)
        1: '#F1EFE7',      // var(--surface-1)
        2: '#FFFFFF',      // var(--surface-2)
      },
      accent: {
        DEFAULT: '#D85A30',  // var(--accent)
        dark: '#712B13',     // var(--accent-dark)
        light: '#FAECE7',    // var(--accent-light)
      },
      teal: {
        DEFAULT: '#0F6E56',  // var(--teal)
        light: '#E1F5EE',    // var(--teal-light)
      },
      // ... other colors
    },
    borderRadius: {
      DEFAULT: '8px',        // var(--radius)
      sm: '4px',            // var(--radius-sm)
      md: '10px',           // var(--radius-md)
      lg: '12px',           // var(--radius-lg)
      xl: '14px',           // var(--radius-xl)
      '2xl': '16px',        // var(--radius-2xl)
      full: '9999px',       // var(--radius-pill)
    }
  }
}
CSS Class → Tailwind Utility Conversion
Vite CSS Class	Tailwind Utilities
.btn*	inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium
.btn-primary	bg-accent text-white hover:bg-accent-dark
.card	bg-surface-2 border border-border rounded-lg p-4
.badge	inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold
.badge-teal	bg-teal-light text-teal
Use class-variance-authority for component variants:

typescript

import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-dark",
        outline: "border border-border hover:bg-surface-1",
        ghost: "hover:bg-surface-1 text-text-secondary",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
      }
    }
  }
);
Success Criteria
At the end of all features, the following must be true:

Functional Requirements
✅ Student can sign in with Clerk
✅ Profile page loads with real database data
✅ All 7 profile tabs functional (Personal, Academic, Skills, Projects, Experience, Certifications, Preferences)
✅ Form submissions save to PostgreSQL via Server Actions
✅ Profile completion calculates correctly (0-100%)
✅ Validation works on client and server side
✅ Toast notifications display appropriately
✅ Responsive design works on mobile
Technical Requirements
✅ No mock data remains (all from database*
✅ All components TypeScript with proper types
✅ All styling uses Tailwind (no custom CSS)
✅ Server Components used for data fetching
✅ Client Components only where needed
✅ Server Actions for all mutations
✅ Zod validation on all inputs
✅ Proper error handling throughout
✅ Loading states for async operations
Code Quality
✅ No TypeScript any types
✅ Consistent file naming (kebab-case)
✅ Proper separation of concerns
✅ Reusable components extracted
✅ Comments for complex logic
✅ No console.log in production code
Execution Strategy
Incremental Feature Development
Build and test each feature completely before moving to the next:

Feature 1: Foundation - Database, auth, UI components (4-6 hours)
Feature 2: Profile Personal & Academic - First two tabs (6-8 hours)
Feature 3: Profile Skills & Links - Skills management (4-6 hours)
Feature 4: Profile Projects - Project CRUD (4-6 hours)
Feature 5: Profile Experience & Certs - Two more tabs (6-8 hours)
Feature 6: Profile Preferences & Completion - Final tab + calculator (4-6 hours)
Feature 7: Student Layout - Shell, sidebar, topbar (6-8 hours)
Total Estimated Time: 34-48 hours (5-7 working days)

Testing Approach
After each task:

Demo - Run the demo described in the task
Manual Test - Click through the UI
Database Check - Verify data saved correctly in Prisma Studio
Type Check - Run npm run build to catch TypeScript errors
Mark Complete - Update task checkbox
Risk Mitigation
Potential Issues:

Schema Changes - Might affect existing data

Mitigation: Test migrations on dev database first
Clerk Integration - Role metadata might not sync

Mitigation: Test auth helpers thoroughly in Feature 1
Component Complexity - Some Vite components are complex

Mitigation: Break into smaller sub-components
Styling Differences - Tailwind might not match exact CSS

Mitigation: Reference design tokens consistently
Next Steps
✅ Read this overview
⏳ Review Component Mapping
⏳ Start Feature 1: Foundation
⏳ Complete each feature sequentially
⏳ Update progress in README.md