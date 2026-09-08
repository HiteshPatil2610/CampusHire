# CampusHire — Integration Unit FE-05: Department Admin Home & Student Roster

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
- **FE-03 — Student Drives & Applications ✅**
- **FE-04 — Notifications Page ✅**
  - Notifications page redesigned, filters added, pagination wired
  - `npm run build` passes ✅

Now implement:

# FE-05 — Department Admin Home & Student Roster

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md` — department admin scope rules:
  - Admin can only see/edit students in their own department
  - A department can have multiple admins — all with identical access
  - Cross-department access must be impossible at every layer
- `context/architecture.md` — invariant §2: "A department admin can only
  read or write students, drives, and uploads belonging to their own
  department. There is no query path that omits the `departmentId` filter
  for a `DEPT_ADMIN` caller."
- `lib/auth.ts` — read `requireDepartmentAdmin()` fully. Understand the
  `DepartmentAdminContext` interface it returns:
  `{ user: User, admin: DepartmentAdmin & { department }, department }`
- `prisma/schema.prisma` — `Student`, `StudentAcademic`, `StudentSkill`,
  `StudentProject`, `Department`, `DepartmentAdmin` models
- `features/drives/actions/get-admin-drives.ts` — use this as the pattern
  for how to write department-scoped queries (it always filters by
  `departmentId: department.id` from `requireDepartmentAdmin()`)

Then read all temp frontend source files for this unit:

- `campushire_frontend (temp)/src/pages/admin/AdminHomePage.jsx`
- `campushire_frontend (temp)/src/pages/admin/AdminDashboardPage.jsx`
- `campushire_frontend (temp)/src/pages/admin/AddStudentPage.jsx`
- `campushire_frontend (temp)/src/components/admin/DepartmentScopeBanner.jsx`
- `campushire_frontend (temp)/src/components/admin/students/StudentDetailsModal.jsx`

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **New server queries** — `getDepartmentStudents()` and `getAdminDashboardStats()`
2. **New server action** — `addStudentManual()`
3. **Admin Home page** — KPI cards, attention list, recent drives widget
4. **Admin Student Roster page** — searchable, filterable, paginated table
5. **Student Details Modal** — view full student profile in a dialog
6. **Add Student page** — manual single-student enrollment form
7. **`DepartmentScopeBanner`** — shared component showing current department
   scope to the admin (without the demo department switcher)

This unit does **NOT** implement:

- Admin drives management (FE-06)
- Excel bulk import (FE-07)
- Admin announcements or reports (those come after FE-06)
- Super admin pages (FE-08)
- Any student-facing pages

---

# 3. NEW SERVER QUERIES NEEDED

No student roster query exists for the admin role yet. Create these two files.

## 3.1 `features/students/queries/get-department-students.ts`

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import type { Student, StudentAcademic, Department } from "@prisma/client";

export type StudentRosterItem = Student & {
  academic: StudentAcademic | null;
  department: Pick<Department, "id" | "name" | "code">;
  _count: { skills: number; projects: number; applications: number };
};

export interface GetDepartmentStudentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  // "all" | "placed" | "unplaced" | "pending"
  // pending = isPending true (bulk-imported, not yet self-registered)
  status?: "all" | "placed" | "unplaced" | "pending";
}

export interface DepartmentStudentsResult {
  data: StudentRosterItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Get paginated, searchable student roster for the authenticated dept admin.
 * ALWAYS scoped to admin's own department — never returns cross-dept students.
 * Authorization: requireDepartmentAdmin()
 */
export async function getDepartmentStudents(
  params: GetDepartmentStudentsParams = {}
): Promise<DepartmentStudentsResult> {
  // Authorization: dept admin only, resolves department server-side
  const { department } = await requireDepartmentAdmin();

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim();
  const status = params.status ?? "all";

  // Build where clause — departmentId is ALWAYS fixed to admin's own dept
  const where: any = {
    departmentId: department.id,  // CRITICAL: never trust client-provided dept
  };

  if (search) {
    where.OR = [
      { name:       { contains: search, mode: "insensitive" } },
      { rollNumber: { contains: search, mode: "insensitive" } },
      { email:      { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "placed") {
    where.placementStatus = "placed";
  } else if (status === "unplaced") {
    where.placementStatus = "unplaced";
    where.isPending = false;
  } else if (status === "pending") {
    where.isPending = true;
  }

  const totalCount = await prisma.student.count({ where });

  const data = await prisma.student.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [{ name: "asc" }],
    include: {
      academic: true,
      department: { select: { id: true, name: true, code: true } },
      _count: { select: { skills: true, projects: true, applications: true } },
    },
  });

  return { data, page, pageSize, totalCount };
}
```

**Important:** The `placementStatus` field (`"unplaced"` | `"placed"` |
`"opted_out"`) was added to the `Student` model in FE-02's schema migration
(`frontend-student-fields`). Verify it exists in `prisma/schema.prisma`
before referencing it in the query. If for any reason it does not exist,
add it in this unit's migration (see §3.3).

## 3.2 `features/students/queries/get-admin-dashboard-stats.ts`

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";

export interface AdminDashboardStats {
  totalStudents: number;
  placedStudents: number;
  pendingStudents: number;       // bulk-imported, not yet registered
  openDrivesCount: number;       // drives with deadline in the future
  placementRate: number;         // percentage (0–100)
  studentsNeedingAttention: Array<{
    id: string;
    name: string;
    rollNumber: string;
    cgpa: number | null;
    activeBacklogs: number;
  }>;
}

/**
 * Get admin dashboard KPI stats + attention list, scoped to admin's dept.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { department } = await requireDepartmentAdmin();
  const deptId = department.id;

  const [totalStudents, placedStudents, pendingStudents, openDrivesCount] =
    await Promise.all([
      prisma.student.count({ where: { departmentId: deptId } }),
      prisma.student.count({
        where: { departmentId: deptId, placementStatus: "placed" },
      }),
      prisma.student.count({
        where: { departmentId: deptId, isPending: true },
      }),
      prisma.drive.count({
        where: {
          departmentId: deptId,
          applicationDeadline: { gt: new Date() },
        },
      }),
    ]);

  // Students needing attention: active backlogs > 0 AND not yet placed
  const needingAttention = await prisma.student.findMany({
    where: {
      departmentId: deptId,
      isPending: false,
      placementStatus: { not: "placed" },
      academic: { activeBacklogs: { gt: 0 } },
    },
    take: 5,
    orderBy: { name: "asc" },
    include: { academic: { select: { currentCGPA: true, activeBacklogs: true } } },
  });

  const placementRate =
    totalStudents > 0
      ? Math.round((placedStudents / totalStudents) * 100)
      : 0;

  return {
    totalStudents,
    placedStudents,
    pendingStudents,
    openDrivesCount,
    placementRate,
    studentsNeedingAttention: needingAttention.map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      cgpa: s.academic?.currentCGPA ?? null,
      activeBacklogs: s.academic?.activeBacklogs ?? 0,
    })),
  };
}
```

## 3.3 Migration check

Both queries reference `student.placementStatus`. If the `frontend-student-fields`
migration from FE-02 was applied, this field already exists. Run:

```bash
npx prisma validate
```

If validation fails because of missing fields, re-read `prisma/schema.prisma`
and add any fields that are missing, then run:

```bash
npx prisma migrate dev --name "admin-student-fields"
npx prisma generate
npx tsc --noEmit   # must pass before any UI work
```

---

# 4. NEW SERVER ACTION — `addStudentManual`

## 4.1 Target file

`features/students/actions/add-student-manual.ts` (NEW FILE)

## 4.2 What it does

A dept admin manually enrolls a single student into their department's
placement roster. This creates a `Student` record with `isPending: true`
(no Clerk account yet — the student self-registers later and gets linked).

This is different from `registration.ts` which creates the student record
for a student who is already authenticated via Clerk.

## 4.3 Implementation

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

const addStudentManualSchema = z.object({
  name:       z.string().min(2, "Name must be at least 2 characters").trim(),
  rollNumber: z.string().min(1, "Roll number is required").trim().toUpperCase(),
  email:      z.string().email("Invalid email address").toLowerCase().trim(),
  phoneNumber:z.string().optional(),
  batchYear:  z.number().int().min(2000).max(2100).optional(),
});

export type AddStudentManualInput = z.infer<typeof addStudentManualSchema>;

export type AddStudentManualResult =
  | { success: true; studentId: string }
  | { success: false; error: string };

export async function addStudentManual(
  input: AddStudentManualInput
): Promise<AddStudentManualResult> {
  try {
    // 1. Auth: dept admin only, get department server-side
    const { user, department } = await requireDepartmentAdmin();

    // 2. Validate input
    const validated = addStudentManualSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { name, rollNumber, email, phoneNumber, batchYear } = validated.data;

    // 3. Check for duplicate roll number (institution-wide unique)
    const existing = await prisma.student.findFirst({
      where: { OR: [{ rollNumber }, { email }] },
    });
    if (existing) {
      if (existing.rollNumber === rollNumber) {
        return { success: false, error: "A student with this roll number already exists." };
      }
      return { success: false, error: "A student with this email already exists." };
    }

    // 4. Create the pending student record
    // departmentId is taken from the authenticated admin's context — NEVER from client
    const student = await prisma.student.create({
      data: {
        userId:      null,       // no Clerk account yet
        isPending:   true,       // will be linked when student self-registers
        departmentId: department.id,
        name,
        rollNumber,
        email,
        phoneNumber:  phoneNumber ?? null,
        batchYear:    batchYear ?? null,
      },
    });

    // 5. Audit log
    await createAuditLog({
      action:     AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT,
      entityId:   student.id,
      metadata: {
        name,
        rollNumber,
        email,
        departmentId: department.id,
        addedBy:      user.id,
        method:       "manual",
      },
    });

    return { success: true, studentId: student.id };
  } catch (error) {
    console.error("Error adding student manually:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
```

---

# 5. DEPARTMENT SCOPE BANNER COMPONENT

## 5.1 Target file

`components/shared/department-scope-banner.tsx` (NEW FILE)

## 5.2 Source

`campushire_frontend (temp)/src/components/admin/DepartmentScopeBanner.jsx`

## 5.3 V1 adaptation — remove the demo department switcher

The temp frontend's banner has a `<select>` dropdown letting the demo user
switch which department they see. In the real app, the admin's department
is fixed by their `DepartmentAdmin` record — it cannot be changed from the UI.

**Remove the department switcher entirely.**

Keep only:
- The terracotta banner with the `.dept-scope-banner` class
- Department name and code
- Student count badge
- Drive count badge (optional — can be null)

```typescript
interface DepartmentScopeBannerProps {
  departmentName: string;   // e.g. "Computer Science & Engineering"
  departmentCode: string;   // e.g. "CSE"
  studentCount: number;
  driveCount?: number;      // optional — pass when known
}
```

The banner is a **server component** — it receives data as props. It has
no client interactivity (the switcher is removed).

---

# 6. ADMIN HOME PAGE

## 6.1 Target file

`app/(admin)/admin-dashboard/page.tsx` — **REPLACE the placeholder**

## 6.2 Source

`campushire_frontend (temp)/src/pages/admin/AdminHomePage.jsx`

## 6.3 Architecture

```
AdminHomePage (Server Component)
  ├── calls requireDepartmentAdmin() → { user, admin, department }
  ├── calls getAdminDashboardStats() → AdminDashboardStats
  ├── calls getAdminDrives({ page: 1, pageSize: 4 }) → recent drives
  └── renders:
      ├── DepartmentScopeBanner (server — passes real dept name, student count)
      ├── page title "Department Overview"
      ├── KPI cards row (4 cards)
      ├── Two-column lower section:
      │   ├── Students needing attention card
      │   └── Recent drives card
```

## 6.4 KPI cards

Use `KpiCard` from FE-01 (`components/shared/kpi-card.tsx`):

| Value | Label | On Click |
|---|---|---|
| `stats.totalStudents` | `"{deptCode} Students"` | `/admin-dashboard/students` |
| `stats.placedStudents` | `"Placed Students"` | `/admin-dashboard/students?status=placed` |
| `stats.openDrivesCount` | `"Open Drives"` | `/admin-dashboard/drives` |
| `stats.placementRate + "%"` | `"Placement Rate"` | `/admin-dashboard/reports` |

For the onClick navigation use Next.js `<Link>` wrapping each card rather
than a click handler — keeps KPI cards as server-rendered links.

## 6.5 Students needing attention card

Port from `AdminHomePage.jsx`. Use real data from
`stats.studentsNeedingAttention`.

Each attention item uses `.attn-item` + `.attn-icon.urgent` CSS classes.
Shows student name, roll number, CGPA, active backlogs.

When `studentsNeedingAttention.length === 0`, show:
`"✓ All {deptCode} students are in good standing"`

Link each item to `/admin-dashboard/students` — clicking opens the student
roster where the admin can search for that student.

## 6.6 Recent drives card

Port from `AdminHomePage.jsx`. Use the `getAdminDrives({ pageSize: 4 })`
result.

Each drive row shows:
- `drive.companyName` (bold)
- `drive.roleName` · `drive.packageDisplay` (secondary)
- Drive status badge: compute with `getDriveStatus(drive.applicationDeadline)`
- Drive date

When no drives, show: `"No drives posted yet for {deptCode}."`

"Manage Drives →" button links to `/admin-dashboard/drives`.

---

# 7. ADMIN STUDENT ROSTER PAGE

## 7.1 Target file

`app/(admin)/admin-dashboard/students/page.tsx` (NEW FILE)

Create directory: `app/(admin)/admin-dashboard/students/`

## 7.2 Source

`campushire_frontend (temp)/src/pages/admin/AdminDashboardPage.jsx`

## 7.3 Architecture

```
AdminStudentsPage (Server Component)
  ├── calls requireDepartmentAdmin() → { user, admin, department }
  ├── reads search params: ?search=&status=all&page=1
  ├── calls getDepartmentStudents({ search, status, page, pageSize: 25 })
  │     → DepartmentStudentsResult { data, page, pageSize, totalCount }
  └── renders:
      ├── DepartmentScopeBanner (server)
      ├── page header + action buttons row
      ├── StudentRosterFilters (client — search input + status pills)
      └── StudentRosterTable (client — table + pagination + detail modal)
```

## 7.4 Page header and action buttons

```
{deptCode} Department Students
Showing verified student records enrolled in {deptCode}.

[Export CSV]  [Bulk Import]  [+ Add Student]
```

- "Export CSV" → client button that triggers a CSV download (see §7.6)
- "Bulk Import" → `<Link href="/admin-dashboard/students/import">`
  (FE-07 implements this page)
- "+ Add Student" → `<Link href="/admin-dashboard/students/add">`

## 7.5 Search and status filter

Implement search and status filter as URL params so the server component
re-fetches on change. Use the same URL-param pattern from FE-03/FE-04.

The client `StudentRosterFilters` component:

```typescript
'use client';
// Renders:
// - Search input: debounced (300ms), updates ?search= param
// - Status buttons: "All" | "Placed" | "Unplaced" | "Pending"
//   maps to status param: "all" | "placed" | "unplaced" | "pending"
```

Status badge mapping for the table rows:

| `student.placementStatus` | `student.isPending` | Badge |
|---|---|---|
| `"placed"` | false | `badge-green` "Placed" |
| `"unplaced"` | false | `badge-purple` "Eligible" |
| `"opted_out"` | false | `badge-gray` "Opted Out" |
| any | true | `badge-amber` "Pending Registration" |

## 7.6 Student roster table

Port the `.table-wrap` table from `AdminDashboardPage.jsx`.

Columns:

| Column | Data Source |
|---|---|
| Student Name | `student.name` + `student.email` below as secondary |
| Roll Number | `student.rollNumber` (monospace) |
| Department | `student.department.code` |
| CGPA | `student.academic?.currentCGPA` — show "—" if null |
| Backlogs | `student.academic?.activeBacklogs` — red if > 0 |
| Status | Status badge per §7.5 |
| Actions | "View Details ↗" button |

Clicking a row OR the "View Details ↗" button opens the `StudentDetailsDialog`
(§8). Pass the student's `id` to the dialog which fetches full profile
data client-side.

**Export CSV:**
Add a client-side CSV export button. When clicked, it generates a CSV from
the currently displayed `data[]` array (not a new server call) and triggers
a browser download. Use this pure utility function:

```typescript
// lib/csv-export.ts
export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Create this as `lib/csv-export.ts`.

## 7.7 Pagination

Use `Pagination` from FE-01, wired to URL `?page=` param (same pattern as
FE-03 and FE-04).

---

# 8. STUDENT DETAILS DIALOG

## 8.1 Target file

`components/admin/students/student-details-dialog.tsx` (NEW FILE)

## 8.2 Source

`campushire_frontend (temp)/src/components/admin/students/StudentDetailsModal.jsx`

## 8.3 Architecture

The dialog is a `"use client"` component that receives a `studentId` when
opened, fetches the full profile data, and renders it.

Do NOT pass the full student object as a prop — only pass the `id`.
The dialog fetches data itself to ensure the admin sees fresh, server-validated
data, not stale data from the table's initial render.

```typescript
'use client';

interface StudentDetailsDialogProps {
  studentId: string | null;   // null = closed
  onClose: () => void;
}
```

When `studentId` is not null, call `getStudentProfile(studentId)` inside
a `useEffect` to fetch the full student data. Show a loading spinner while
fetching.

**Authorization note:** `getStudentProfile()` does not currently enforce
department scope — it fetches by any student ID. For this admin-facing dialog,
add a new server action wrapper that re-checks department scope before
returning data:

### New file: `features/students/actions/get-student-detail-for-admin.ts`

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { getStudentProfile } from "../queries/get-profile";

export async function getStudentDetailForAdmin(studentId: string) {
  // 1. Auth: dept admin only
  const { department } = await requireDepartmentAdmin();

  // 2. Verify the student belongs to this admin's department
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { departmentId: true },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  if (student.departmentId !== department.id) {
    throw new AuthorizationError(
      "You do not have permission to view this student's details"
    );
  }

  // 3. Return full profile (now safe — ownership verified)
  return getStudentProfile(studentId);
}
```

Use this action in the dialog's `useEffect`:

```typescript
useEffect(() => {
  if (!studentId) return;
  setLoading(true);
  getStudentDetailForAdmin(studentId)
    .then(setProfile)
    .catch((err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      onClose();
    })
    .finally(() => setLoading(false));
}, [studentId]);
```

## 8.4 Visual layout

Use shadcn `Dialog` from FE-01. Port the visual sections from
`StudentDetailsModal.jsx`:

1. **Header strip** — avatar (initials), name, roll number, department, status badge
2. **Academic metrics grid** — 3 KPI tiles: CGPA, Active Backlogs, Profile Completion %
   - Remove Readiness and Resume ATS tiles — out of V1 scope
   - Add Profile Completion % instead (compute from `calculateProfileCompletion()`)
3. **Institutional records card** — department, semester, 10th %, 12th %
4. **Contact details card** — college email, phone, LinkedIn link, GitHub link
5. **Skills card** — technical skills tags (only if student has skills)

## 8.5 What to remove from the source

| Temp Frontend | V1 Action |
|---|---|
| `student.readiness` KPI tile | **Remove** — out of V1 scope |
| `student.resumeScore` KPI tile | **Remove** — out of V1 scope |
| `student.status === 'attention_needed'` check | Map to `student.placementStatus` and `student.academic.activeBacklogs > 0` |
| `student.roll` field | Use `student.rollNumber` (Prisma field name) |
| `student.dept` field | Use `student.department.code` |
| `student.backlogs` field | Use `student.academic?.activeBacklogs` |
| `student.year` field | Derive from `student.batchYear` or `student.academic.currentSemester` |

---

# 9. ADD STUDENT PAGE

## 9.1 Target file

`app/(admin)/admin-dashboard/students/add/page.tsx` (NEW FILE)

Create directory: `app/(admin)/admin-dashboard/students/add/`

## 9.2 Source

`campushire_frontend (temp)/src/pages/admin/AddStudentPage.jsx`

## 9.3 Architecture

Server component shell that passes `departmentCode` as a prop to the form.

```
AddStudentPage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  └── renders:
      └── AddStudentForm (client — "use client")
            ├── receives: departmentCode, departmentId (for display only)
            ├── form fields: name, rollNumber, email, phoneNumber, batchYear
            └── save: addStudentManual() server action
```

## 9.4 Form fields

Port from `AddStudentPage.jsx`. Map to the `addStudentManual()` input schema:

| Form Field | Validation | Maps to |
|---|---|---|
| Full Name * | min 2 chars | `name` |
| Roll Number * | required, uppercase | `rollNumber` |
| College Email * | valid email | `email` |
| Phone Number | optional | `phoneNumber` |
| Batch Year | optional, number | `batchYear` (e.g. 2026) |

**Department:** Show as read-only locked field — the department is always
the admin's own department, derived server-side. Never accept a
department input from the client.

```tsx
<div className="field">
  <label>Department (Locked)</label>
  <div className="locked-email-row">
    <span>🏛️ {departmentCode}</span>
    <span className="le-badge">🔒 Auto-assigned</span>
  </div>
</div>
```

## 9.5 Submit handler

```typescript
function handleSubmit(e: FormEvent) {
  e.preventDefault();
  startTransition(async () => {
    const result = await addStudentManual({
      name: form.name,
      rollNumber: form.rollNumber,
      email: form.email,
      phoneNumber: form.phoneNumber || undefined,
      batchYear: form.batchYear ? parseInt(form.batchYear) : undefined,
    });

    if (result.success) {
      toast({ title: 'Student enrolled', description: `${form.name} added to the roster.` });
      router.push('/admin-dashboard/students');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  });
}
```

---

# 10. NEW FILES TO CREATE

```
features/students/queries/
  └── get-department-students.ts           ← paginated dept-scoped student list

features/students/queries/ (or actions/)
  └── get-admin-dashboard-stats.ts         ← KPI stats + attention list

features/students/actions/
  ├── add-student-manual.ts                ← manual single-student enrollment
  └── get-student-detail-for-admin.ts      ← dept-scoped student detail fetch

lib/
  └── csv-export.ts                        ← pure CSV download utility

components/shared/
  └── department-scope-banner.tsx          ← real dept banner (no demo switcher)

components/admin/students/
  └── student-details-dialog.tsx           ← student profile viewer dialog
```

Files to **create** (new pages):

```
app/(admin)/admin-dashboard/page.tsx        ← REPLACE placeholder
app/(admin)/admin-dashboard/students/
  ├── page.tsx                              ← student roster
  └── add/
      └── page.tsx                          ← add student form
```

---

# 11. FIELD NAME MAPPING — TEMP FRONTEND vs PRISMA SCHEMA

Use this table when porting admin components. The temp frontend uses
shorter field names from the mock data structure.

| Temp Frontend `student.*` | Prisma `Student.*` |
|---|---|
| `student.roll` / `student.id` | `student.rollNumber` |
| `student.dept` | `student.department.code` |
| `student.cgpa` | `student.academic?.currentCGPA` |
| `student.backlogs` | `student.academic?.activeBacklogs` |
| `student.status === 'placed'` | `student.placementStatus === 'placed'` |
| `student.status === 'attention_needed'` | `student.academic.activeBacklogs > 0 && student.placementStatus !== 'placed'` |
| `student.status === 'eligible'` | `student.isPending === false && student.placementStatus === 'unplaced'` |
| `student.year` | Derive from `student.batchYear` or `student.academic.currentSemester` |
| `student.tenth` | `student.academic?.tenthPercentage` |
| `student.twelfth` | `student.academic?.twelfthPercentage` |
| `student.linkedin` | `student.linkedinUrl` |
| `student.github` | `student.githubUrl` |
| `student.readiness` | **Remove** — out of V1 scope |
| `student.resumeScore` | **Remove** — out of V1 scope |

---

# 12. WHAT NOT TO DO

- Do NOT let a dept admin see students from another department — every query
  must get `departmentId` from `requireDepartmentAdmin()`, never from the
  client request
- Do NOT implement a department switcher on the `DepartmentScopeBanner` —
  remove it entirely (it was a demo-only feature)
- Do NOT show readiness score or resume score in the student details dialog
  — these are out of V1 scope
- Do NOT port `student.status === 'attention_needed'` as a stored field —
  attention status is derived from `activeBacklogs > 0 && not placed`
- Do NOT implement admin drives management — that is FE-06
- Do NOT implement Excel bulk import — that is FE-07
- Do NOT implement announcements or reports pages — they follow FE-06
- Do NOT use any student data from client input to determine scope — always
  use `requireDepartmentAdmin()` to get the department server-side
- Do NOT call `getStudentProfile()` directly from the admin dialog — use
  `getStudentDetailForAdmin()` which re-checks department ownership first

---

# 13. TYPESCRIPT RULES

- All new files: `.tsx` / `.ts`, strict mode, no `any`
- `StudentRosterItem` type: export it from `get-department-students.ts`
  and import in page/component files
- `requireDepartmentAdmin()` returns `DepartmentAdminContext` — import the
  type from `lib/auth.ts`
- `getDriveStatus()` — import from `features/drives/utils/drive-status`
  when needed in the recent drives card
- `useTransition` + `startTransition` for all form submit handlers
- `router.refresh()` after successful mutations where the parent server
  component needs to re-fetch

---

# 14. VERIFICATION

Run in order:

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test          # all existing tests must still pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Admin Home page
- [ ] Page loads at `/admin-dashboard` for an authenticated dept admin
- [ ] `DepartmentScopeBanner` shows correct dept name and code
- [ ] No department switcher dropdown in the banner
- [ ] 4 KPI cards show real values (not 0 unless the data is genuinely 0)
- [ ] Students needing attention: shows real students with backlogs > 0
- [ ] "All students in good standing" message when no attention cases
- [ ] Recent drives card shows drives for admin's dept (or empty state)
- [ ] "Manage Drives →" links to `/admin-dashboard/drives`

### Student Roster page
- [ ] Page loads at `/admin-dashboard/students`
- [ ] `DepartmentScopeBanner` shows student count
- [ ] Table shows only students from admin's own department
- [ ] Cross-department test: attempting to access `/admin-dashboard/students`
      as an admin from Dept A never shows Dept B students
- [ ] Search by name works and updates URL param
- [ ] Search by roll number works
- [ ] Status filter "Placed" shows only placed students
- [ ] Status filter "Pending" shows only `isPending: true` students
- [ ] "Export CSV" downloads a CSV file with correct columns
- [ ] Pagination renders when `totalCount > 25`

### Student Details Dialog
- [ ] Clicking "View Details ↗" or a table row opens the dialog
- [ ] Loading spinner shows while fetching
- [ ] Dialog shows correct: name, roll, department, CGPA, backlogs, email
- [ ] Status badge correct (Placed / Eligible / Pending Registration)
- [ ] Profile completion % shows (not readiness/resume score)
- [ ] LinkedIn and GitHub links show if present
- [ ] Skills tags show if present
- [ ] Dialog closes on Esc or close button
- [ ] Attempting to open a student from another department via URL
      manipulation is rejected server-side (dialog shows error toast)

### Add Student page
- [ ] Page loads at `/admin-dashboard/students/add`
- [ ] Department field shows admin's dept as locked/read-only
- [ ] Form requires name, roll number, email
- [ ] Submit with duplicate roll number shows clear error message
- [ ] Submit with duplicate email shows clear error message
- [ ] Successful submit redirects to `/admin-dashboard/students`
- [ ] New student appears in roster with "Pending Registration" badge
- [ ] Audit log entry created (verify in super admin audit page after FE-08)

---

# 15. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-05 complete
- `getDepartmentStudents()` created with dept-scope enforcement
- `getAdminDashboardStats()` created
- `addStudentManual()` server action created
- `getStudentDetailForAdmin()` dept-scoped detail action created
- `DepartmentScopeBanner` ported (demo switcher removed)
- Admin Home page wired to real stats
- Admin Student Roster page with search, filter, pagination, CSV export
- Student Details Dialog wired to real data
- Add Student page wired to `addStudentManual()` action
- All tests still passing
- Build passing

Set next unit: **FE-06 — Drive Management (Admin)**

---

# 16. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Drive management pages (FE-06)
- Excel bulk import (FE-07)
- Super admin pages (FE-08)
- Audit log UI (FE-09)

The next unit is **FE-06**.

---

# FINAL REPORT

When finished, provide a summary covering:

## New Queries & Actions
- `getDepartmentStudents`: params, scope enforcement, how status filter works
- `getAdminDashboardStats`: KPIs returned, attention logic
- `addStudentManual`: validation, duplicate check, audit log
- `getStudentDetailForAdmin`: dept ownership check

## Admin Home Page
- KPIs wired to real data
- Attention list behavior
- Recent drives wired

## Student Roster Page
- Search and filter implementation (URL params vs client-side)
- Table columns and field mapping
- CSV export approach

## Student Details Dialog
- How it fetches data (effect on studentId change)
- What was removed (readiness, resume score)
- Dept scope enforcement

## Add Student Page
- Form fields, locked dept display
- Duplicate prevention

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (test count)
- `npm run build` result

## Scope Confirmation
Explicitly confirm:
**No cross-department data returned at any point. No admin drives pages.
No Excel import page. No super admin pages. Readiness and resume score
metrics not shown anywhere. Department switcher not implemented.**
