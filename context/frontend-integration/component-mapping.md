---

## **File 2: `context/frontend-integration/component-mapping.md`**

```markdown
# Component Mapping: Vite → Next.js

Complete reference for migrating every component from the Vite frontend to Next.js backend.

## Quick Reference

- 🟢 **Server Component** - Async, can fetch data, no interactivity
- 🔵 **Client Component** - `'use client'`, has state/hooks/events
- 🔴 **DELETE** - Remove entirely, no longer needed
- ⏳ **Not Started** - Waiting to be migrated
- ✅ **Complete** - Migrated and tested

---

## UI Components (Design System)

### Core Interactive Components

| Vite Path | Next.js Path | Type | Priority | Status |
|-----------|--------------|------|----------|--------|
| `src/components/ui/Button.jsx` | `components/ui/button.tsx` | 🔵 Client | High | ⏳ |
| `src/components/ui/Badge.jsx` | `components/ui/badge.tsx` | 🟢 Server | High | ⏳ |
| `src/components/ui/Modal.jsx` | `components/ui/modal.tsx` | 🔵 Client | High | ⏳ |
| `src/components/ui/DatePicker.jsx` | `components/ui/date-picker.tsx` | 🔵 Client | High | ⏳ |
| `src/components/ui/UrlField.jsx` | `components/ui/url-field.tsx` | 🔵 Client | High | ⏳ |
| `src/components/ui/TagInput.jsx` | `components/ui/tag-input.tsx` | 🔵 Client | High | ⏳ |

**Migration Notes:**
- Convert all to TypeScript
- Use Tailwind for styling
- Use `class-variance-authority` for variants
- Add proper TypeScript types
- Use `cn()` utility for className merging

**Example Pattern:**
```typescript
// components/ui/button.tsx
'use client';

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-dark",
        outline: "border border-border hover:bg-surface-1",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
Display Components
Vite Path	Next.js Path	Type	Priority	Status

KpiCard.jsx

kpi-card.tsx
🟢 Server	Medium	⏳

Gauge.jsx

gauge.tsx
🟢 Server	Medium	⏳

ProgressBar.jsx

progress-bar.tsx
🟢 Server	Medium	⏳

Pagination.jsx

pagination.tsx
🔵 Client	Low	⏳
Migration Notes:

These are mostly presentational
Can be Server Components unless they have click handlers
Props should be typed interfaces
Layout Components
Vite Path	Next.js Path	Type	Priority	Status	Notes

AppShell.jsx
app/(student)/layout.tsx	🟢 Server	High	⏳	Convert to Next.js layout

Sidebar.jsx

sidebar.tsx
🔵 Client	High	⏳	Needs Link + active state

Topbar.jsx

topbar.tsx
🔵 Client	High	⏳	Needs Clerk user data
Migration Details:

AppShell → layout.tsx
Old: HOC wrapping page content
New: Next.js layout.tsx file
Changes:
Remove role prop (get from Clerk)
Remove showProfileCompletion prop (fetch from DB)
Sidebar + Topbar as children
typescript

// app/(student)/layout.tsx
import { getCurrentStudent } from '@/lib/auth-helpers';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await getCurrentStudent();

  return (
    <div className="flex h-screen">
      <Sidebar role="student" />
      <div className="flex-1 flex flex-col">
        <Topbar user={student} />
        <main className="flex-1 overflow-y-auto bg-surface-0 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
Sidebar
Old: Uses PATHS from React Router
New: Uses Next.js Link and usePathname
Changes:
Replace <Link to={}> with <Link href={}>
Use usePathname() for active state
Get navigation items based on role
typescript

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const studentNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  { href: '/drives', label: 'Drives', icon: '💼' },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-surface-2 border-r border-border">
      {studentNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-4 py-2 text-sm",
            pathname === item.href
              ? "bg-accent-light text-accent-dark font-medium"
              : "text-text-secondary hover:bg-surface-1"
          )}
        >
          <span>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </aside>
  );
}
Topbar
Old: Gets user from props
New: Gets user from Clerk useUser()
Changes:
Use Clerk's UserButton component
Display student name and department
Student Profile Components
Main Page
Vite Path	Next.js Path	Type	Priority	Status

StudentProfilePage.jsx
app/(student)/profile/page.tsx	🟢 Server	Critical	⏳
- (new)	app/(student)/profile/profile-client.tsx	🔵 Client	Critical	⏳
Migration Strategy:

page.tsx (Server Component):

typescript

// app/(student)/profile/page.tsx
import { getCurrentStudent } from '@/lib/auth-helpers';
import { getCompleteProfile } from '@/features/students/queries/get-complete-profile';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const student = await getCurrentStudent();
  const profile = await getCompleteProfile(student.id);

  return <ProfileClient profile={profile} />;
}
profile-client.tsx (Client Component):

typescript

'use client';

import { useState } from 'react';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export function ProfileClient({ profile }: { profile: CompleteProfile }) {
  const [activeTab, setActiveTab] = useState('Personal Info');

  // Tab state and logic here

  return (
    <div>
      <ProfileHeader profile={profile} />
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabContent activeTab={activeTab} profile={profile} />
    </div>
  );
}
Profile Header
Vite Path	Next.js Path	Type	Priority	Status

ProfileHeaderStrip.jsx

profile-header.tsx
🔵 Client	High	⏳
Migration Notes:

Needs to be Client Component (has save button with onClick)
Display avatar, name, roll number, department
Show profile completion progress bar
Save button triggers Server Action
Props:

typescript

interface ProfileHeaderProps {
  student: {
    name: string;
    rollNumber: string;
    department: { name: string };
    profileCompletion: number;
  };
  onSave: () => Promise<void>;
}
Profile Tabs
Vite Path	Next.js Path	Type	Priority	Status	Feature

TabPersonalInfo.jsx

personal-info-tab.tsx
🔵 Client	Critical	⏳	F2

TabAcademicInfo.jsx

academic-info-tab.tsx
🔵 Client	Critical	⏳	F2

TabSkillsLinks.jsx

skills-links-tab.tsx
🔵 Client	High	⏳	F3

TabProjects.jsx

projects-tab.tsx
🔵 Client	High	⏳	F4

TabExperience.jsx

experience-tab.tsx
🔵 Client	High	⏳	F5

TabCertifications.jsx

certifications-tab.tsx
🔵 Client	High	⏳	F5

TabPreferences.jsx

preferences-tab.tsx
🔵 Client	High	⏳	F6
Common Pattern for All Tabs:

typescript

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { updatePersonalInfo } from '@/features/students/actions/update-personal-info';

interface PersonalInfoTabProps {
  student: {
    name: string;
    phone?: string;
    dob?: string;
    // ... other fields
  };
}

export function PersonalInfoTab({ student }: PersonalInfoTabProps) {
  const [form, setForm] = useState(student);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const result = await updatePersonalInfo(formData);

    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Profile updated successfully" });
    } else {
      toast({
        title: result.error || "Failed to update profile",
        variant: "destructive"
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
Tab-Specific Notes:

Personal Info:

Fields: name, phone, DOB (DatePicker), gender, address
Photo upload preview (no actual upload in MVP)
Academic Info:

10th: percentage, board, year
12th: percentage, board, year
Current: CGPA, semester, active backlogs
Semester marks (optional JSON field)
Skills & Links:

Technical skills (TagInput array)
LinkedIn (UrlField with auto-prefix)
GitHub (UrlField with auto-prefix)
Portfolio (UrlField)
Projects:

Array of project cards
Each: title, description, technologies, URL, dates
Add/Edit/Delete functionality
Experience:

Array of experience cards
Each: company, role, description, start/end dates
File upload reference (offer letter)
Certifications:

Array of certification cards
Each: name, issuing org, issue date, expiry date, credential URL
Preferences:

Preferred roles (TagInput)
Preferred locations (TagInput)
Company type (dropdown)
Expected package (min/max)
Relocation (toggle)
Work mode (chips: On-site, Remote, Hybrid)
Context & State Management
Vite Path	Next.js Solution	Action	Notes

ToastContext.jsx

use-toast.ts
 + Provider	Migrate	Use shadcn/ui pattern

AppStateContext.jsx
-	🔴 DELETE	Replace with Server Components + DB

useStudent.js
-	🔴 DELETE	Use getCurrentStudent() instead
ToastContext Migration:

Create two files:


use-toast.ts
:
typescript

import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const addToast = useToastStore((state) => state.addToast);

  return {
    toast: addToast,
  };
}

toaster.tsx
:
typescript

'use client';

import { useToastStore } from './use-toast';

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-lg p-4 shadow-lg",
            toast.type === 'success' && "bg-teal text-white",
            toast.type === 'error' && "bg-red text-white",
            toast.type === 'warning' && "bg-amber text-white",
          )}
          onClick={() => removeToast(toast.id)}
        >
          <p className="font-medium">{toast.title}</p>
          {toast.description && (
            <p className="text-sm opacity-90">{toast.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
Add to root layout:
typescript

// app/layout.tsx
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
Data & Services Layer
Vite Path	Next.js Path	Action	Notes

mockData.js
-	🔴 DELETE	Replace with Prisma queries

driveStore.js
-	🔴 DELETE	Replace with drive queries

applicationFieldsCatalog.js
-	Keep as config	Move to 
constants.ts

client.js
-	🔴 DELETE	No REST API needed

authService.js
-	🔴 DELETE	Use Clerk

studentService.js
features/students/actions/*.ts	Replace	Convert to Server Actions

driveService.js
features/drives/actions/*.ts	Future	Not in current scope

adminService.js
features/admin/actions/*.ts	Future	Not in current scope
Migration Strategy:

Each function in 
studentService.js
 becomes a Server Action:

Old Service Function	New Server Action	Feature
studentService.getMe()	getCompleteProfile(studentId)	Query (F2)
studentService.updateProfile()	updatePersonalInfo(formData)	Action (F2)
- (new)	updateAcademicInfo(formData)	Action (F2)
- (new)	updateSkills(skills)	Action (F3)
- (new)	updateProjects(projects)	Action (F4)
- (new)	updateExperiences(experiences)	Action (F5)
- (new)	updateCertifications(certifications)	Action (F5)
- (new)	updatePreferences(preferences)	Action (F6)
studentService.uploadResume()	uploadResume(formData)	Future
studentService.submitAssessment()	submitAssessment(answers)	Future
Utilities
Vite Path	Next.js Path	Action	Notes

profileCompletion.js

calculate-completion.ts
Port to TS	Keep same logic

driveUtils.js

drive-utils.ts
Future	Not needed for profile
profileCompletion Migration:

typescript

// features/students/queries/calculate-completion.ts
import type { CompleteProfile } from './profile-completion';

export function calculateProfileCompletion(profile: CompleteProfile): number {
  let requiredFieldsFilled = 0;
  const totalRequiredFields = 10;

  // 1. Personal Info (3 fields)
  if (profile.student.name) requiredFieldsFilled++;
  if (profile.student.phoneNumber) requiredFieldsFilled++;
  if (profile.student.linkedinUrl || profile.student.githubUrl) requiredFieldsFilled++;

  // 2. Academic Info (1 field)
  if (profile.academic?.currentCGPA) requiredFieldsFilled++;

  // 3. Skills (1 field)
  if (profile.skills.length > 0) requiredFieldsFilled++;

  // 4. Projects (1 field)
  if (profile.projects.length > 0) requiredFieldsFilled++;

  // 5. Experience (1 field)
  if (profile.experiences.length > 0) requiredFieldsFilled++;

  // 6. Certifications (1 field)
  if (profile.certifications.length > 0) requiredFieldsFilled++;

  // 7. Preferences (2 fields)
  if (profile.preferences?.preferredRoles) requiredFieldsFilled++;
  if (profile.preferences?.preferredLocations) requiredFieldsFilled++;

  return Math.round((requiredFieldsFilled / totalRequiredFields) * 100);
}
Pages (Routes)
Vite Path	Next.js Path	Priority	Status	Feature

StudentProfilePage.jsx
app/(student)/profile/page.tsx	Critical	⏳	F2-F6

HomePage.jsx
app/(student)/page.tsx	High	⏳	Future

StudentDashboardPage.jsx
app/(student)/dashboard/page.tsx	High	⏳	Future

ResumeBuilderPage.jsx
app/(student)/resume-builder/page.tsx	Medium	⏳	Future

AiAnalyzerPage.jsx
app/(student)/ai-analyzer/page.tsx	Medium	⏳	Future

SelfAssessmentPage.jsx
app/(student)/assessment/page.tsx	Medium	⏳	Future

ReadinessDashboardPage.jsx
app/(student)/readiness/page.tsx	Medium	⏳	Future

NotificationsPage.jsx
app/(student)/notifications/page.tsx	Low	⏳	Future

SettingsPage.jsx
app/(student)/settings/page.tsx	Low	⏳	Future
Current Scope: Only Profile page (Features 2-6)

Future Work: All other pages will follow similar patterns after profile is complete.

Summary Statistics
Components to Migrate
UI Components: 10
Layout Components: 3
Profile Tabs: 7
Other Components: 5
Total: 25 components
Code to Delete

AppStateContext.jsx
 (380 lines)

mockData.js
 (450 lines)
src/api/*Service.js (5 files, ~800 lines)
Total: ~1,630 lines deleted
Code to Create
Server Actions: ~15 files
Queries: ~8 files
Schemas: ~8 files
Components: ~25 files
Total: ~2,500 lines new TypeScript code
Net Change
Before: 7,000+ lines (Vite)
After: 5,900+ lines (Next.js)
Reduction: ~15% less code with better type safety
Next Steps
✅ Review this mapping
⏳ Start with Feature 1
⏳ Migrate components one feature at a time
⏳ Update this file with ✅ as components are completed
⏳ Document any deviations or issues