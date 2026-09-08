# CampusHire — Integration Unit FE-02: Student Dashboard & Profile

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
  - All CSS merged into `app/globals.css`
  - UI primitives ported: `DatePicker`, `UrlField`, `TagInput`, `ProgressBar`,
    `KpiCard`, `Pagination`, `StatusBadge`
  - `AppShell`, `Sidebar`, `Topbar` ported and wired to Clerk
  - All 3 role layouts replaced
  - Auth page visual wrappers added
  - Landing page and 404 page ported
  - `npm run build` passes ✅

Now implement:

# FE-02 — Student Dashboard & Profile

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md`
- `context/architecture.md`
- `context/ui-context.md`
- `context/code-standards.md`
- `context/progress-tracker.md`
- `INTEGRATION_GUIDE.md` (root of project)
- `prisma/schema.prisma` — understand the exact Student, StudentAcademic,
  StudentSkill, StudentProject, StudentExperience, StudentCertification,
  StudentPreferences models and their field names
- `lib/auth.ts` — understand `requireStudent()` and what it returns
- `features/students/queries/get-profile.ts` — `getStudentProfile()` and
  `getStudentProfileByUserId()` and the `CompleteProfile` type
- `features/students/queries/profile-completion.ts` — `calculateProfileCompletion()`
  and the `ProfileCompletion` type, the 17 required fields and 7 sections
- All server actions in `features/students/actions/`:
  - `profile-personal.ts` — inputs it accepts, what it validates, what it returns
  - `profile-academic.ts`
  - `profile-skills.ts`
  - `profile-projects.ts`
  - `profile-experience.ts`
  - `profile-certifications.ts`
  - `profile-preferences.ts`
  - `profile-photo.ts`
- `features/students/schemas/profile.ts` — all Zod schemas (field names and types)
- `app/api/students/profile-photo/route.ts` — how photo upload works
- `features/notifications/queries/get-notifications.ts`
- `features/notifications/actions/get-notifications-action.ts`
- `app/(student)/student-dashboard/page.tsx` — current placeholder
- `components/students/RegistrationForm.tsx` — existing registration component

Then read all temp frontend source files relevant to this unit:

- `campushire_frontend (temp)/src/pages/student/StudentDashboardPage.jsx`
- `campushire_frontend (temp)/src/pages/student/StudentProfilePage.jsx`
- `campushire_frontend (temp)/src/pages/student/SettingsPage.jsx`
- `campushire_frontend (temp)/src/components/student/profile/ProfileHeaderStrip.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabPersonalInfo.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabAcademicInfo.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabSkillsLinks.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabProjects.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabExperience.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabCertifications.jsx`
- `campushire_frontend (temp)/src/components/student/profile/TabPreferences.jsx`
- `campushire_frontend (temp)/src/hooks/useStudent.js`
- `campushire_frontend (temp)/src/utils/profileCompletion.js`

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **Schema additions** — new fields on `Student` model
2. **Prisma migration** — one migration for all schema changes
3. **Student Dashboard page** — wire to real data
4. **Student Profile page** — all 7 tabs, wired to real server actions
5. **Settings page** — password change via Clerk, notification prefs UI
6. **Registration flow integration** — ensure `RegistrationForm` still works
   correctly in the dashboard flow after FE-01 layout changes

This unit does **NOT** implement:

- Drives or applications (FE-03)
- Notifications page (FE-04)
- Any admin pages
- Any super admin pages
- Resume builder, AI analyzer, self-assessment, readiness (out of V1 scope)

---

# 3. SCHEMA ADDITIONS

The existing `Student` model is missing fields that the temp frontend's profile
tabs display and edit. Add the following fields before implementing any UI.

## 3.1 Fields to add to `Student` model in `prisma/schema.prisma`

```prisma
model Student {
  // ... all existing fields remain unchanged ...

  // New fields for FE-02:
  gender         String?    // "Male" | "Female" | "Other" | "Prefer not to say"
  dateOfBirth    DateTime?  // DOB — displayed + edited in Personal Info tab
  address        String?    @db.Text  // Current address
  personalEmail  String?    // Alternate/personal email (not the login email)
  batchYear      Int?       // Graduation batch year, e.g. 2026

  // Placement tracking — used in admin roster + super admin reports (later units)
  placementStatus String  @default("unplaced")
  // "unplaced" | "placed" | "opted_out"
  placedCompany  String?
  placedPackage  String?
}
```

## 3.2 New `SemesterMark` model

The Academic Info tab shows a semester-by-semester SGPA grid. This requires
a new model.

```prisma
model SemesterMark {
  id        String   @id @default(cuid())
  studentId String
  semester  Int      // 1 through 8
  sgpa      Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, semester])
  @@index([studentId])
}
```

Also add the reverse relation to the `Student` model:

```prisma
model Student {
  // ... existing fields ...
  semesterMarks  SemesterMark[]
}
```

## 3.3 Migration

After updating `prisma/schema.prisma`:

```bash
npx prisma validate           # must pass
npx prisma migrate dev --name "frontend-student-fields"
npx prisma generate
npx tsc --noEmit              # must pass before any UI work
```

## 3.4 Update `features/students/queries/get-profile.ts`

After migration, update `getStudentProfileByUserId()` and `getStudentProfile()`
to include the new `semesterMarks` relation:

```typescript
include: {
  // ... existing includes ...
  semesterMarks: {
    orderBy: { semester: 'asc' },
  },
}
```

Also update the `CompleteProfile` interface in
`features/students/queries/profile-completion.ts` to include:

```typescript
export interface CompleteProfile {
  student: Student & {
    department: Pick<Department, 'id' | 'name' | 'code'>;
  };
  academic: StudentAcademic | null;
  semesterMarks: SemesterMark[];    // ADD THIS
  skills: StudentSkill[];
  projects: StudentProject[];
  experiences: StudentExperience[];
  certifications: StudentCertification[];
  preferences: StudentPreferences | null;
}
```

---

# 4. NEW SERVER ACTIONS NEEDED

The existing server actions in `features/students/actions/` handle saving
each profile section, but some fields from the temp frontend don't yet map
to them. Read each action file before implementing the UI to understand
the exact inputs they accept.

## 4.1 Update `features/students/actions/profile-personal.ts`

Read the current file. It likely does not yet save `gender`, `dateOfBirth`,
`address`, `personalEmail`, `batchYear`. Extend it to include these new
fields from the schema addition in §3.1.

The action must:
- Accept the new fields as optional inputs
- Validate them with Zod (add to the existing schema in
  `features/students/schemas/profile.ts`)
- Update the Student record with `prisma.student.update()`
- Re-check ownership: `student.userId === authenticatedUserId`

## 4.2 New action: `features/students/actions/profile-semester-marks.ts`

Create this new server action for saving semester SGPA entries.

```typescript
// Accepts an array of semester marks and upserts them for the student
// Input: { marks: Array<{ semester: number; sgpa: number }> }
// Each { semester, sgpa } is upserted with @@unique([studentId, semester])
// Authorization: requireStudent() — ownership enforced by resolving
//   studentId from the authenticated user, never from client input
```

Use `prisma.$transaction()` with multiple `upsert` calls — one per semester entry.
Validate: semester must be 1–8, sgpa must be 0.00–10.00.

---

# 5. STUDENT DASHBOARD PAGE

## 5.1 Target file

`app/(student)/student-dashboard/page.tsx`

Replace the current placeholder entirely.

## 5.2 Source

`campushire_frontend (temp)/src/pages/student/StudentDashboardPage.jsx`

## 5.3 Architecture pattern

This page is a **server component**. It fetches all data server-side and
passes it to client components for interactivity.

```
StudentDashboardPage (Server Component)
  ├── calls requireStudent() → gets { user, student }
  ├── calls getStudentProfileByUserId(userId) → gets CompleteProfile
  ├── calls calculateProfileCompletion(profile) → gets ProfileCompletion
  ├── calls getNotificationsAction({ page: 1, pageSize: 5 }) → gets recent notifs
  └── renders:
      ├── DashboardHeader (client — has avatar click navigation)
      ├── KpiCard × 3 (profile %, upcoming drives count, applications count)
      ├── RecentNotifications (client — activity feed from real data)
      ├── UpcomingDeadlines (derived from real drives — use placeholder for now,
      │   FE-03 wires real drives)
      └── QuickActions grid (links to profile, drives, applications)
```

## 5.4 What to port from `StudentDashboardPage.jsx`

Port the entire visual layout. Replace all mock data sources:

| Temp Frontend Source | Real Replacement |
|---|---|
| `useStudent()` hook | Props passed from server component using `getStudentProfileByUserId()` |
| `student.profileCompletion` | `profileCompletion.percentage` from `calculateProfileCompletion()` |
| `student.readinessScore` | **Remove** — out of V1 scope. Do not show a readiness score KPI. |
| `student.resumeScore` | **Remove** — out of V1 scope. Do not show a resume score KPI. |
| `NOTIFICATIONS` mock array | `getNotificationsAction()` result — pass as prop |
| `DEADLINES` mock array | **Remove** — replace with placeholder text "Coming soon" or hide until FE-03 |
| `DRIVES` mock table | **Remove** the drives table from dashboard — the full drives list is on its own page (FE-03). The dashboard shows a "View Drives →" link to `/student-dashboard/drives`. |
| `allDrives.filter(open).slice(0, 2)` | **Remove** — no drive cards on dashboard. The dashboard is a summary page. FE-03 handles drive listing. |
| `WithdrawModal` | **Delete** — withdrawal is out of V1 scope |
| `ApplicationReviewModal` | **Remove from dashboard** — the apply flow is on the drive detail page (FE-03) |

## 5.5 KPI cards on dashboard

Show 3 KPI cards:

1. **Profile Completion** — `profileCompletion.percentage + "%"`, label "Profile Completion",
   clicking navigates to `/student-dashboard/profile`
2. **Upcoming Drives** — show `0` with label "Eligible Drives" and note "Available soon"
   as a placeholder. FE-03 will wire real count.
3. **Applications** — show `0` with label "Applications Submitted" as placeholder.
   FE-03 will wire real count.

## 5.6 Quick Actions grid

Port the 3-card quick actions grid but adapt for V1 scope:

| Temp Card | V1 Action |
|---|---|
| "Build resume" → `ResumeBuilderPage` | **Replace with** "Complete Profile" → `/student-dashboard/profile` |
| "Take assessment" → `SelfAssessmentPage` | **Replace with** "Browse Drives" → `/student-dashboard/drives` |
| "View suggestions" → `AiAnalyzerPage` | **Replace with** "My Applications" → `/student-dashboard/applications` |

Keep the same visual card structure (`.icon-tile`, `.card`), just change the
labels, icons, and links.

## 5.7 Recent notifications section

Port the notifications activity feed on the dashboard. Replace mock
`NOTIFICATIONS` with the real data passed as a prop from the server component.

Show the 5 most recent notifications (paginated full list is in FE-04).
Each notification: title, message truncated to 1 line, relative timestamp.
Show "View all notifications →" link to `/notifications`.

If no notifications yet, show an empty state:
"No notifications yet. You'll see drive alerts and updates here."

---

# 6. STUDENT PROFILE PAGE

## 6.1 Target file

`app/(student)/student-dashboard/profile/page.tsx` (NEW FILE)

Also create: `app/(student)/student-dashboard/profile/` directory.

## 6.2 Source

`campushire_frontend (temp)/src/pages/student/StudentProfilePage.jsx`

## 6.3 Architecture pattern

```
StudentProfilePage (Server Component)
  ├── calls requireStudent() → gets { user, student }
  ├── calls getStudentProfileByUserId(userId) → gets CompleteProfile
  ├── calls calculateProfileCompletion(profile) → gets ProfileCompletion
  └── renders:
      └── StudentProfileClient (Client Component — "use client")
            ├── receives: profile (CompleteProfile), completion (ProfileCompletion)
            ├── manages: activeTab state
            ├── renders: ProfileHeaderStrip
            └── renders: active tab component
```

The profile page must be a **thin server shell + one client component**. All
tab state, form state, and save interactions live in the client component.

## 6.4 Profile header strip

Port `ProfileHeaderStrip.jsx` →
`components/students/profile/profile-header-strip.tsx`

Changes from the source:
- Remove `showToast` prop — use shadcn `useToast()` internally
- Remove `onSave` prop from the header strip — each individual tab has its
  own Save button. The header strip shows completion % and avatar only.
- Photo: if `student.profilePhotoUrl` is set, show the image. Otherwise
  show initials avatar.

## 6.5 Tab components — Port all 7

Create the directory `components/students/profile/` and port all 7 tabs.

Each tab is a `"use client"` component. Each one:
- Receives its section's data as props (passed from the parent client component)
- Manages its own local form state (initialized from props)
- Has a Save button that calls the corresponding server action via
  `useTransition` + `startTransition`
- Shows a toast on success or error using shadcn `useToast()`
- Re-fetches profile data after a successful save using
  `router.refresh()` from `useRouter()` — this is the Next.js pattern
  for refreshing server component data after a client mutation

### Tab 1 — Personal Info
`components/students/profile/tab-personal-info.tsx`

Source: `TabPersonalInfo.jsx`

Fields to show and save (map to `profile-personal.ts` action):
- Full Name (maps to `student.name`)
- Phone Number (maps to `student.phoneNumber`)
- Date of Birth (maps to `student.dateOfBirth` — new field, use `DatePicker`)
- Personal Email (maps to `student.personalEmail` — new field)
- Current Address (maps to `student.address` — new field)
- Gender (maps to `student.gender` — new field, port the gender toggle)

**Locked/read-only display** (cannot be edited):
- College email (`student.email`) — display with a "🔒 Verified" badge
- Roll Number (`student.rollNumber`) — display as read-only
- Department (`student.department.name`) — display as read-only
- Batch Year (`student.batchYear` if set) — display as read-only if present

**Profile photo upload:**
The photo is uploaded via a `POST` to `app/api/students/profile-photo/route.ts`
(already exists). Then `profile-photo.ts` server action updates the URL.

Implementation steps:
1. Hidden `<input type="file" accept="image/*">` triggered by "Change photo" button
2. On file select: `POST` the file to `/api/students/profile-photo`
   as `multipart/form-data`
3. On success: the response contains a `photoUrl`. Call `updateProfilePhoto(photoUrl)`
   server action to persist it.
4. Show success toast. Call `router.refresh()` to reload the server component.

Read `app/api/students/profile-photo/route.ts` carefully to understand
the accepted content types, size limits, and response shape before wiring.

### Tab 2 — Academic Info
`components/students/profile/tab-academic-info.tsx`

Source: `TabAcademicInfo.jsx`

**Fields saved by `profile-academic.ts` action:**
- 10th Percentage (`tenthPercentage: Float`)
- 12th Percentage (`twelfthPercentage: Float`)
- Current CGPA (`currentCGPA: Float`, 0–10 scale)
- Current Semester (`currentSemester: Int`, 1–8)
- Active Backlogs (`activeBacklogs: Int`, ≥ 0)

**File attachments (10th/12th marksheets):**
The temp frontend allows attaching PDF marksheets. In V1, marksheet file upload
is **out of scope** — the file storage spec only covers profile photos and JD PDFs
(see `project-overview.md`). Remove the attach-file buttons from 10th/12th cards.
Show only the text inputs for percentage, board name, and year.

**Semester-wise SGPA grid:**
The temp frontend's semester grid is the centerpiece of this tab. Port it fully.
Wire the "Add semester result" / "Save semester results" flow to the new
`profile-semester-marks.ts` server action (§4.2).

Semester grid behavior:
- Show existing `semesterMarks` from the `CompleteProfile` data
- Allow adding/editing entries for semesters 1 through `currentSemester - 1`
- Each entry: semester label, SGPA input (0.00–10.00)
- A single "Save semester results" button saves all entries at once via
  `profile-semester-marks.ts`
- Do NOT show the marksheet file attach UI (out of V1 scope)

### Tab 3 — Skills & Links
`components/students/profile/tab-skills-links.tsx`

Source: `TabSkillsLinks.jsx`

**Technical skills** — use `TagInput` from FE-01.
Each tag maps to a `StudentSkill` with `skillType: TECHNICAL`.
Saved via `profile-skills.ts` action. Read that action to understand
how it accepts an array of skills — it likely replaces all skills of a type,
or adds/removes individually. Implement accordingly.

**Soft skills** — same `TagInput` component.
Each tag maps to `skillType: SOFT`.

**Links** — use `UrlField` from FE-01.
- LinkedIn → `student.linkedinUrl`
- GitHub → `student.githubUrl`
- Portfolio → `student.portfolioUrl`

Links are saved via `profile-personal.ts` (they are on the `Student` model
directly, not a separate table). Read `profile-personal.ts` to confirm.
If the action doesn't yet accept these link fields, extend it.

### Tab 4 — Projects
`components/students/profile/tab-projects.tsx`

Source: `TabProjects.jsx`

Read the source file in full. Each project maps to a `StudentProject` record.

Saved via `profile-projects.ts` action. Read that action to understand:
- Whether it handles add/edit/delete individually or replaces all
- The exact field names it accepts

`StudentProject` fields:
- `title` (String, required)
- `description` (String, `@db.Text`, required)
- `technologiesUsed` (String, `@db.Text` — stored as comma-separated or JSON)
- `projectUrl` (String?, optional)
- `startDate` (DateTime?, optional) — use `DatePicker`
- `endDate` (DateTime?, optional) — use `DatePicker`

Port the project card list with add/edit/delete. Each project card shows
title, description, tech stack tags, and links.

### Tab 5 — Internships & Experience
`components/students/profile/tab-experience.tsx`

Source: `TabExperience.jsx`

Each experience maps to `StudentExperience`:
- `companyName` (String, required)
- `role` (String, required)
- `description` (String, `@db.Text`, required)
- `startDate` (DateTime, required) — use `DatePicker`
- `endDate` (DateTime?, optional) — use `DatePicker`. If null, show "Present"
- File attachments (offer letter, certificate) — **out of V1 scope**, remove

Saved via `profile-experience.ts` action.

### Tab 6 — Certifications
`components/students/profile/tab-certifications.tsx`

Source: `TabCertifications.jsx`

Each certification maps to `StudentCertification`:
- `certificationName` (String, required)
- `issuingOrganization` (String, required)
- `issueDate` (DateTime, required) — use `DatePicker`
- `expiryDate` (DateTime?, optional) — use `DatePicker`
- `credentialUrl` (String?, optional) — use `UrlField`

Saved via `profile-certifications.ts` action.

### Tab 7 — Preferences
`components/students/profile/tab-preferences.tsx`

Source: `TabPreferences.jsx`

Maps to `StudentPreferences`:
- `preferredRoles` (String stored as JSON array) — use `TagInput`
- `preferredLocations` (String stored as JSON array) — use `TagInput`
- `preferredCompanyTypes` (String stored as JSON array) — use `TagInput`
  or a multi-select. Types: "Product", "Service", "Startup", "PSU", "Consulting"
- `willingToRelocate` (Boolean) — use toggle switch (`.toggle-switch` class)
- `expectedPackageMin` (Float?, in LPA)
- `expectedPackageMax` (Float?, in LPA)

Saved via `profile-preferences.ts` action. Read the action's Zod schema
(`features/students/schemas/profile.ts`) to understand the exact input shape,
especially how JSON array fields are serialized.

---

# 7. SETTINGS PAGE

## 7.1 Target file

`app/(student)/student-dashboard/settings/page.tsx` (NEW FILE)

Create: `app/(student)/student-dashboard/settings/` directory.

## 7.2 Source

`campushire_frontend (temp)/src/pages/student/SettingsPage.jsx`

## 7.3 Architecture

Server component shell + client component for interactive cards.

## 7.4 What to port

Port 3 of the 4 cards from `SettingsPage.jsx`:

### Card 1 — Notification Preferences
Port the toggle switches for email/SMS alerts.
In V1, these toggles are **UI only** — there is no server-side setting
model for notification preferences yet. Store state in `useState` and
show a toast on toggle. Add a comment: `// TODO: wire to server once
notification preference model is added`.

### Card 2 — Change Password
Do NOT implement a custom password change form.
In the real app, password management is handled entirely by Clerk.
Replace this card with a Clerk-powered option:

```tsx
import { useClerk } from '@clerk/nextjs';

// Show a button:
<button onClick={() => clerk.openUserProfile()}>
  Manage Password & Security →
</button>
```

Or simply show a link to Clerk's hosted account page.
Keep the card visual, just replace the form with the Clerk button.

### Card 3 — Placement Preferences Link
Port as-is. Change navigation from `PATHS.studentProfile` to
`/student-dashboard/profile` using Next.js `<Link>`.

### Card 4 — Danger Zone (Reset Demo Data)
**Remove entirely.** This was a demo-only feature (`resetState()` on
`AppStateContext`). There is no equivalent in the real app.

---

# 8. REGISTRATION FLOW INTEGRATION

`components/students/RegistrationForm.tsx` already exists and is used in the
current student dashboard page. After FE-01 replaced the layout, verify that:

1. The student dashboard page still correctly detects when a student has no
   `Student` record yet and shows `RegistrationForm`
2. After registration, the page correctly redirects or refreshes to show the
   full dashboard
3. The `RegistrationForm` component itself does not need changes — only
   confirm it still works within the new `AppShell` layout

---

# 9. WIRING PATTERN — SERVER ACTIONS FROM CLIENT COMPONENTS

All save actions in the profile tabs follow this exact pattern:

```typescript
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { updateProfilePersonal } from '@/features/students/actions/profile-personal';

export function TabPersonalInfo({ profile }: { profile: CompleteProfile }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: profile.student.name,
    phoneNumber: profile.student.phoneNumber ?? '',
    gender: profile.student.gender ?? '',
    // ... other fields
  });

  function handleSave() {
    startTransition(async () => {
      const result = await updateProfilePersonal(form);

      if (result.success) {
        toast({ title: 'Saved', description: 'Personal info updated.' });
        router.refresh(); // re-runs the server component, gets fresh data
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    // ... form JSX ...
    <button
      className="btn btn-primary"
      onClick={handleSave}
      disabled={isPending}
    >
      {isPending ? 'Saving…' : 'Save changes'}
    </button>
  );
}
```

Apply this exact pattern to every tab's save button.

The `result` shape from every server action must be
`{ success: true, data? }` or `{ success: false, error: string }`.
Read each action file before wiring — if the return shape differs, adapt.

---

# 10. FIELD NAME MAPPING — TEMP FRONTEND vs PRISMA SCHEMA

The temp frontend uses camelCase field names that may differ from the Prisma
schema. Use this table as the authoritative mapping when porting each tab.

| Temp Frontend Field | Prisma Model | Prisma Field |
|---|---|---|
| `student.name` | `Student` | `name` |
| `student.rollNo` | `Student` | `rollNumber` |
| `student.email` | `Student` | `email` |
| `student.phone` | `Student` | `phoneNumber` |
| `student.dob` | `Student` | `dateOfBirth` (new) |
| `student.personalEmail` | `Student` | `personalEmail` (new) |
| `student.address` | `Student` | `address` (new) |
| `student.gender` | `Student` | `gender` (new) |
| `student.linkedin` | `Student` | `linkedinUrl` |
| `student.github` | `Student` | `githubUrl` |
| `student.portfolio` | `Student` | `portfolioUrl` |
| `student.cgpa` | `StudentAcademic` | `currentCGPA` |
| `student.tenth` | `StudentAcademic` | `tenthPercentage` |
| `student.twelfth` | `StudentAcademic` | `twelfthPercentage` |
| `student.semester` | `StudentAcademic` | `currentSemester` |
| `student.activeBacklogs` | `StudentAcademic` | `activeBacklogs` |
| `form.semesters[].sgpa` | `SemesterMark` | `sgpa` |
| `form.technicalSkills[]` | `StudentSkill` | `skillName` where `skillType: TECHNICAL` |
| `form.softSkills[]` | `StudentSkill` | `skillName` where `skillType: SOFT` |
| `project.title` | `StudentProject` | `title` |
| `project.description` | `StudentProject` | `description` |
| `project.tech[]` | `StudentProject` | `technologiesUsed` (JSON string) |
| `project.liveUrl` | `StudentProject` | `projectUrl` |
| `project.repoUrl` | `StudentProject` | (no separate field — store in `projectUrl` or add to description) |
| `exp.company` | `StudentExperience` | `companyName` |
| `exp.role` | `StudentExperience` | `role` |
| `exp.description` | `StudentExperience` | `description` |
| `cert.name` | `StudentCertification` | `certificationName` |
| `cert.org` | `StudentCertification` | `issuingOrganization` |
| `cert.credentialUrl` | `StudentCertification` | `credentialUrl` |
| `prefs.roles[]` | `StudentPreferences` | `preferredRoles` (JSON) |
| `prefs.locations[]` | `StudentPreferences` | `preferredLocations` (JSON) |
| `prefs.companyType` | `StudentPreferences` | `preferredCompanyTypes` (JSON) |
| `prefs.relocate` | `StudentPreferences` | `willingToRelocate` (Boolean) |

**Note on `project.repoUrl`:** The current `StudentProject` model only has
`projectUrl`. The temp frontend shows both a live URL and a repo URL.
Either: (a) use `projectUrl` for the live URL and skip repo URL, or
(b) add a `repoUrl String?` field to `StudentProject` in the migration.
Make this decision by reading `profile-projects.ts` to see what it accepts.
Document your decision in the final report.

---

# 11. TYPESCRIPT AND COMPONENT RULES

- All new files: `.tsx`, strict mode, no `any`
- Use `@/` alias for all imports
- Server actions are imported directly in client components — Next.js supports
  calling server actions from `"use client"` components
- Never pass a server action as a prop — import it directly
- All form state is local to the tab component — do NOT lift state to the
  profile page or use a global store
- Profile completion % displayed in the header must always come from the
  server — do NOT recompute it client-side. After `router.refresh()`,
  the server component re-runs `calculateProfileCompletion()` and passes
  the fresh value down.
- Do NOT use `React.FC<Props>` — use plain typed function declarations

---

# 12. NEW FILES TO CREATE

```
app/(student)/student-dashboard/profile/
  └── page.tsx                              ← server shell for profile page

app/(student)/student-dashboard/settings/
  └── page.tsx                              ← settings page

components/students/profile/
  ├── profile-header-strip.tsx
  ├── student-profile-client.tsx            ← top-level "use client" wrapper
  ├── tab-personal-info.tsx
  ├── tab-academic-info.tsx
  ├── tab-skills-links.tsx
  ├── tab-projects.tsx
  ├── tab-experience.tsx
  ├── tab-certifications.tsx
  └── tab-preferences.tsx

features/students/actions/
  └── profile-semester-marks.ts             ← new action for SGPA entries
```

Files to **update** (not create):

```
app/(student)/student-dashboard/page.tsx   ← replace placeholder with real dashboard
features/students/queries/get-profile.ts   ← add semesterMarks include
features/students/queries/profile-completion.ts  ← add SemesterMark[] to interface
features/students/actions/profile-personal.ts    ← add new fields (gender, dob, etc.)
features/students/schemas/profile.ts             ← add Zod rules for new fields
prisma/schema.prisma                            ← schema additions from §3
```

---

# 13. WHAT NOT TO DO

- Do NOT implement drives, applications, or the `/drives` page — that is FE-03
- Do NOT implement the notifications page — that is FE-04
- Do NOT add readiness score, resume score, or AI features — out of V1 scope
- Do NOT port `ResumeBuilderPage.jsx`, `AiAnalyzerPage.jsx`,
  `SelfAssessmentPage.jsx`, `ReadinessDashboardPage.jsx`
- Do NOT port `WithdrawModal.jsx` or `ApplicationReviewModal.jsx` — not needed here
- Do NOT implement marksheet PDF upload (10th/12th PDFs) — out of V1 scope
- Do NOT implement offer letter / experience certificate upload — out of V1 scope
- Do NOT add the "Reset Demo Data" danger zone — demo-only feature
- Do NOT compute profile completion % client-side — always use
  `calculateProfileCompletion()` server-side and pass down as props
- Do NOT use `localStorage` or `sessionStorage` for any profile state
- Do NOT invent new fields or data structures not defined in the Prisma schema
  or this spec

---

# 14. VERIFICATION

Run in order after all implementation:

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test          # all existing tests must still pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Dashboard
- [ ] Student dashboard loads with correct name in welcome header
- [ ] Profile completion % KPI shows a real value (not 0 for a student
      who has already saved profile data)
- [ ] Quick actions link to the correct pages
- [ ] Recent notifications section shows real notifications (or empty state)
- [ ] Registration form still appears for a new student with no `Student` record
- [ ] After registration, dashboard loads correctly within the AppShell

### Profile page
- [ ] Profile page loads at `/student-dashboard/profile`
- [ ] All 7 tab buttons are visible and switching tabs works
- [ ] Profile header shows correct name, roll number, department, email,
      completion bar, and photo (or initials if no photo)

### Personal Info tab
- [ ] Fields pre-populated from database (name, phone, etc.)
- [ ] College email is shown as read-only with "🔒 Verified" badge
- [ ] Roll number and department are read-only
- [ ] `DatePicker` opens for Date of Birth
- [ ] Save button calls server action, shows success toast, updates header
- [ ] Profile completion % updates after saving (if this tab completes a section)

### Academic Info tab
- [ ] 10th/12th percentage fields pre-populated
- [ ] CGPA and semester selectors work
- [ ] Backlogs field works
- [ ] Semester SGPA grid shows existing entries
- [ ] "Add semester result" adds a new row
- [ ] Save semester results persists to database
- [ ] Saving without completing required fields shows validation error

### Skills & Links tab
- [ ] Technical skills shown as tags
- [ ] Soft skills shown as tags
- [ ] `TagInput` adds on Enter or comma, removes on ✕
- [ ] `UrlField` shows LinkedIn with correct prefix
- [ ] Saving skills persists correctly
- [ ] Saving links persists to `linkedinUrl`, `githubUrl`, `portfolioUrl`

### Projects tab
- [ ] Existing projects listed as cards
- [ ] "Add project" opens a form / inline editor
- [ ] Saving a project persists it
- [ ] Deleting a project removes it

### Experience tab
- [ ] Existing experiences listed
- [ ] Add / edit / delete works and persists

### Certifications tab
- [ ] Existing certifications listed
- [ ] Add / edit / delete works and persists
- [ ] `UrlField` for credential URL works

### Preferences tab
- [ ] `TagInput` for roles and locations works
- [ ] Company type selection works
- [ ] Relocate toggle works
- [ ] Package range fields work
- [ ] Saving persists correctly

### Profile photo upload
- [ ] "Change photo" button opens file picker
- [ ] Selecting an image uploads to Vercel Blob via `/api/students/profile-photo`
- [ ] Photo URL saved via `updateProfilePhoto` action
- [ ] Header strip shows the new photo after `router.refresh()`

### Settings page
- [ ] Settings page loads at `/student-dashboard/settings`
- [ ] Notification preference toggles work (UI state, no server call yet)
- [ ] "Manage Password & Security" opens Clerk's user profile
- [ ] "Edit Placement Preferences" links to `/student-dashboard/profile`

---

# 15. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-02 complete
- Schema migration: `frontend-student-fields` applied
- `SemesterMark` model added
- `Student` model extended with `gender`, `dateOfBirth`, `address`,
  `personalEmail`, `batchYear`, `placementStatus`, `placedCompany`, `placedPackage`
- `get-profile.ts` updated to include `semesterMarks`
- `profile-personal.ts` updated to handle new fields
- `profile-semester-marks.ts` created
- Student dashboard page wired to real data
- Student profile page created with all 7 tabs
- Settings page created
- All tests still passing
- Build passing

Set next unit: **FE-03 — Student Drives & Applications**

---

# 16. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Drives or applications pages
- Notifications page integration
- Any admin pages
- Any super admin pages

The next unit is **FE-03**.

---

# FINAL REPORT

When finished, provide a summary covering:

## Schema
- Fields added to `Student`
- `SemesterMark` model: fields, relations, constraints
- Migration name and status

## Server Actions
- `profile-personal.ts`: new fields added
- `profile-semester-marks.ts`: inputs, validation, transaction approach

## Dashboard Page
- Data sources wired
- Mock data removed
- V1 scope adaptations (removed readiness/resume scores, removed drive table)

## Profile Page
- Tab components created
- Field mapping decisions (especially `repoUrl` decision)
- Photo upload wiring

## Settings Page
- Cards ported
- Clerk password management integration
- What was removed (danger zone)

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (test count)
- `npm run build` result

## Open Questions
Any ambiguities encountered and how they were resolved.

## Scope Confirmation
Explicitly confirm:
**No drives pages, no applications pages, no notifications page, no admin
pages, no super admin pages, and no out-of-V1-scope features were implemented.**
