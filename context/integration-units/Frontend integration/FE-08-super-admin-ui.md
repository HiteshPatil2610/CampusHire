# CampusHire — Integration Unit FE-08: Super Admin UI

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
- **FE-03 — Student Drives & Applications ✅**
- **FE-04 — Notifications Page ✅**
- **FE-05 — Admin Home & Student Roster ✅**
- **FE-06 — Drive Management (Admin) ✅**
- **FE-07 — Excel Bulk Import ✅**
  - Full backend + UI implemented and tested
  - `npm run build` passes ✅

Now implement:

# FE-08 — Super Admin UI

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md` — super admin scope:
  - Single super admin account, provisioned via `scripts/seed-super-admin.ts`
  - Manages departments (add, edit, activate/deactivate)
  - Manages dept admin accounts (add, assign to one dept, remove)
  - Views system-wide audit log
  - V1: Does NOT post drives — deferred
  - A dept can have multiple admins with identical access
- `context/architecture.md` — super admin access model
- `INTEGRATION_GUIDE.md` §6.2 — super admin V1 scope decisions
- `lib/auth.ts` — `requireSuperAdmin()` function
- All existing super admin features (backend complete):
  - `features/departments/actions/` — `createDepartment()`,
    `updateDepartment()`, `toggleDepartmentStatus()`
  - `features/departments/queries/` — `getDepartments()`,
    `getDepartmentDetail()`, `getDepartmentStats()`
  - `features/departments/schemas/department.ts` — Zod schemas + types
  - `features/admin-accounts/actions/assign-department-admin.ts`
  - `features/admin-accounts/actions/remove-department-admin.ts`
  - `features/admin-accounts/queries/get-department-admins.ts`
  - `features/admin-accounts/queries/get-available-users.ts`
  - `features/admin-accounts/schemas/admin.ts`
  - `features/audit/queries/get-audit-logs.ts`
  - `features/audit/actions/get-audit-logs-action.ts`
- `components/audit/AuditLogsTable.tsx` — already exists
- The current placeholder super admin pages in `app/(super-admin)/`

Then read all temp frontend source files for this unit:

- `campushire_frontend (temp)/src/pages/superadmin/SuperAdminDashboardPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/DepartmentManagementPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/AdminAccountsPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/SuperAdminStudentsPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/SuperAdminDrivesPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/GlobalReportsPage.jsx`
- `campushire_frontend (temp)/src/pages/superadmin/SystemSettingsPage.jsx`

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

This unit covers:

1. **New queries** — `getSystemStats()` and `getDepartmentMatrix()`
2. **New action** — `createAdminAccount()` for provisioning a new dept admin
   via Clerk's backend API
3. **Super Admin Dashboard** — system-wide KPIs + dept matrix
4. **Department Management page** — create, edit, activate/deactivate
5. **Admin Accounts page** — list, assign/remove admins per dept
6. **Super Admin Students page** — cross-dept student directory (read-only)
7. **Super Admin Drives page** — read-only view of all drives (no posting)
8. **Global Reports page** — placement analytics
9. **System Settings page** — UI-only toggles (no backend model yet)

This unit does **NOT** implement:

- Super admin posting central drives — out of V1 scope
- Audit log UI — that is FE-09
- Any student or dept admin pages
- Resume builder, AI features, readiness score

---

# 3. NEW QUERIES

## 3.1 `features/departments/queries/get-system-stats.ts` (NEW FILE)

System-wide KPIs for the super admin dashboard.

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export interface SystemStats {
  totalStudents:     number;
  registeredStudents: number; // isPending = false
  pendingStudents:   number;  // isPending = true (bulk-imported, not yet registered)
  totalDepartments:  number;
  activeDepartments: number;
  totalAdmins:       number;
  totalDrives:       number;
  openDrives:        number;  // applicationDeadline > now
  placedStudents:    number;
  overallPlacementRate: number; // percentage 0–100
}

export async function getSystemStats(): Promise<SystemStats> {
  await requireSuperAdmin();

  const [
    totalStudents,
    registeredStudents,
    totalDepartments,
    activeDepartments,
    totalAdmins,
    totalDrives,
    openDrives,
    placedStudents,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { isPending: false } }),
    prisma.department.count(),
    prisma.department.count({ where: { isActive: true } }),
    prisma.departmentAdmin.count(),
    prisma.drive.count(),
    prisma.drive.count({ where: { applicationDeadline: { gt: new Date() } } }),
    prisma.student.count({ where: { placementStatus: 'placed' } }),
  ]);

  const overallPlacementRate =
    registeredStudents > 0
      ? Math.round((placedStudents / registeredStudents) * 100)
      : 0;

  return {
    totalStudents,
    registeredStudents,
    pendingStudents: totalStudents - registeredStudents,
    totalDepartments,
    activeDepartments,
    totalAdmins,
    totalDrives,
    openDrives,
    placedStudents,
    overallPlacementRate,
  };
}
```

## 3.2 `features/departments/queries/get-department-matrix.ts` (NEW FILE)

Per-department aggregate stats for the super admin dashboard table and
global reports page.

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export interface DepartmentMatrixRow {
  id:              string;
  name:            string;
  code:            string;
  isActive:        boolean;
  totalStudents:   number;
  registeredStudents: number;
  placedStudents:  number;
  placementRate:   number;  // percentage 0–100
  adminCount:      number;
  openDrives:      number;
}

export async function getDepartmentMatrix(): Promise<DepartmentMatrixRow[]> {
  await requireSuperAdmin();

  const departments = await prisma.department.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: {
        select: { admins: true },
      },
    },
  });

  const rows = await Promise.all(
    departments.map(async (dept) => {
      const [totalStudents, registeredStudents, placedStudents, openDrives] =
        await Promise.all([
          prisma.student.count({ where: { departmentId: dept.id } }),
          prisma.student.count({ where: { departmentId: dept.id, isPending: false } }),
          prisma.student.count({
            where: { departmentId: dept.id, placementStatus: 'placed' },
          }),
          prisma.drive.count({
            where: {
              departmentId: dept.id,
              applicationDeadline: { gt: new Date() },
            },
          }),
        ]);

      const placementRate =
        registeredStudents > 0
          ? Math.round((placedStudents / registeredStudents) * 100)
          : 0;

      return {
        id:                dept.id,
        name:              dept.name,
        code:              dept.code,
        isActive:          dept.isActive,
        totalStudents,
        registeredStudents,
        placedStudents,
        placementRate,
        adminCount:        dept._count.admins,
        openDrives,
      };
    })
  );

  return rows;
}
```

> **Performance note:** The per-department Promise.all loops run N×4 queries.
> For a realistic single-college setup (≤20 departments), this is fine.
> If performance becomes a concern, this can be rewritten with SQL GROUP BY
> in a later optimisation pass. Correctness takes priority in V1.

---

# 4. NEW ACTION — `createAdminAccount`

## 4.1 The existing `assignDepartmentAdmin` action

`features/admin-accounts/actions/assign-department-admin.ts` already
exists and handles assigning an **existing CampusHire user** (who is
already in the `User` table) as a dept admin.

It requires a `userId` that already exists — used when the super admin
wants to promote a student who is already registered.

## 4.2 What's missing

There is no action to **create a brand new Clerk account** for a dept admin
who does not yet exist in the system. Per `project-overview.md`:

> "Department admin and super admin accounts created by the super admin —
> no public sign-up for those roles"

The Admin Accounts page in the temp frontend has an "Invite dept admin"
form with name, email, and department fields. In V1, this means the super
admin enters the new admin's email and department, the system creates a
Clerk account for them and immediately assigns them as a dept admin.

## 4.3 Target file

`features/admin-accounts/actions/create-admin-account.ts` (NEW FILE)

## 4.4 Implementation

```typescript
"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

const createAdminAccountSchema = z.object({
  email:        z.string().email("Invalid email address").toLowerCase().trim(),
  name:         z.string().min(2).max(200).trim(),
  departmentId: z.string().cuid("Invalid department ID"),
  // A temporary password is generated — the admin resets it on first login.
  // Clerk's "Forgot Password" flow handles the reset.
});

export type CreateAdminAccountInput = z.infer<typeof createAdminAccountSchema>;

export type CreateAdminAccountResult =
  | { success: true; adminId: string; email: string }
  | { success: false; error: string };

/**
 * Create a new Clerk account for a dept admin and immediately assign them
 * to the specified department.
 *
 * Flow:
 * 1. Validate input
 * 2. Check email not already in use
 * 3. Verify department exists + is active
 * 4. Create Clerk user (skipPasswordRequirement = true, emailAddressVerified = true)
 * 5. Set Clerk publicMetadata.role = 'DEPT_ADMIN'
 * 6. Upsert CampusHire User record (clerkId, email, role=DEPT_ADMIN)
 * 7. Create DepartmentAdmin record
 * 8. Audit log
 *
 * Authorization: SUPER_ADMIN only
 */
export async function createAdminAccount(
  input: CreateAdminAccountInput
): Promise<CreateAdminAccountResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = createAdminAccountSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }

    const { email, name, departmentId } = validated.data;

    // Check email not already used in CampusHire
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "A user with this email already exists." };
    }

    // Verify department
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return { success: false, error: "Department not found." };
    }
    if (!department.isActive) {
      return { success: false, error: "Cannot assign admin to an inactive department." };
    }

    // Create Clerk user
    const clerk = await clerkClient();
    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: name.split(' ')[0],
        lastName:  name.split(' ').slice(1).join(' ') || undefined,
        // Skip requiring password on create — admin sets their own via Forgot Password
        skipPasswordRequirement: true,
        publicMetadata: { role: 'DEPT_ADMIN' },
      });
    } catch (clerkError: any) {
      // Clerk returns 422 if email already exists in Clerk
      if (clerkError?.status === 422 || clerkError?.errors?.[0]?.code === 'form_identifier_exists') {
        return { success: false, error: "An account with this email already exists." };
      }
      console.error("Clerk user creation error:", clerkError);
      return { success: false, error: "Failed to create user account. Please try again." };
    }

    // Upsert CampusHire User + create DepartmentAdmin
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where:  { clerkId: clerkUser.id },
        create: {
          clerkId: clerkUser.id,
          email,
          role: 'DEPT_ADMIN',
        },
        update: {
          role:  'DEPT_ADMIN',
          email,
        },
      });

      const admin = await tx.departmentAdmin.create({
        data: { userId: user.id, departmentId },
      });

      return { user, admin };
    });

    // Audit log
    await createAuditLog({
      action:     AuditAction.CREATE,
      entityType: AuditEntityType.DEPARTMENT_ADMIN,
      entityId:   result.admin.id,
      metadata: {
        email,
        name,
        departmentId,
        departmentName: department.name,
        createdBy:      superAdmin.id,
      },
    });

    return { success: true, adminId: result.admin.id, email };
  } catch (error) {
    console.error("createAdminAccount error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
```

**Note on password:** Clerk's `skipPasswordRequirement: true` creates the
account without a password. The admin logs in via the "Forgot Password"
flow on their first visit, or the super admin can use Clerk's dashboard
to send an invite email. This is the simplest V1 approach that avoids
storing passwords or sending credentials in the UI.

---

# 5. SUPER ADMIN DASHBOARD PAGE

## 5.1 Target file

`app/(super-admin)/super-admin-dashboard/page.tsx` — **REPLACE placeholder**

## 5.2 Source

`campushire_frontend (temp)/src/pages/superadmin/SuperAdminDashboardPage.jsx`

## 5.3 Architecture

```
SuperAdminDashboardPage (Server Component)
  ├── calls requireSuperAdmin() → user
  ├── calls getSystemStats() → SystemStats
  ├── calls getDepartmentMatrix() → DepartmentMatrixRow[]
  └── renders:
      ├── page title "Institutional Overview"
      ├── 4 KPI cards
      ├── Department comparison table
      └── Recent drives activity feed (optional)
```

## 5.4 KPI cards (4 across)

| Value | Label | Link |
|---|---|---|
| `stats.totalStudents` | "Total Students" | `/super-admin-dashboard/students` |
| `stats.placedStudents` | "Placed" | `/super-admin-dashboard/students?status=placed` |
| `stats.openDrives` | "Open Drives" | `/super-admin-dashboard/drives` |
| `stats.totalDepartments` | "Departments" | `/super-admin-dashboard/departments` |

Use `KpiCard` from FE-01. Wrap each with `<Link>` for navigation.

## 5.5 Department comparison table

Port from `SuperAdminDashboardPage.jsx`. Use real `getDepartmentMatrix()`
data. Columns: Department, Students, Placed, Placement %.

Show a `StatusBadge variant="red"` "Inactive" label for inactive departments.

## 5.6 Recent drives feed

Optional: fetch 5 most recent drives across all departments
(`prisma.drive.findMany({ take: 5, orderBy: { createdAt: 'desc' } })`)
and show as `.activity-item` list with company, role, dept.

---

# 6. DEPARTMENT MANAGEMENT PAGE

## 6.1 Target files

- `app/(super-admin)/super-admin-dashboard/departments/page.tsx` (NEW)
- `app/(super-admin)/super-admin-dashboard/departments/[id]/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/departments/`

## 6.2 Source

`campushire_frontend (temp)/src/pages/superadmin/DepartmentManagementPage.jsx`

## 6.3 List page architecture

```
DepartmentManagementPage (Server Component)
  ├── calls requireSuperAdmin()
  ├── reads search params: ?page=1&includeInactive=false
  ├── calls getDepartments({ page, pageSize: 25, includeInactive })
  └── renders:
      ├── page header + "Add Department" button
      ├── "Show inactive" toggle (URL param)
      ├── DepartmentTable (client — table + pagination)
      └── CreateDepartmentDialog (client — shadcn Dialog)
```

## 6.4 Department table columns

| Column | Data |
|---|---|
| Name | `dept.name` |
| Code | `dept.code` (monospace badge) |
| Students | `dept.studentCount` |
| Admins | `dept.adminCount` |
| Drives | `dept.driveCount` |
| Status | Active/Inactive `StatusBadge` |
| Actions | "Edit" button + "Deactivate/Activate" toggle |

## 6.5 Create department dialog

A shadcn `Dialog` with two fields:

- Department Name (required) — maps to `name`
- Department Code (required, uppercase, 2–10 chars, `[A-Z0-9]+`) — maps to `code`

On submit calls `createDepartment({ name, code, isActive: true })`.
After success: `router.refresh()` to reload the server component.

## 6.6 Edit department

The "Edit" button opens a second dialog (or the same dialog pre-populated)
that calls `updateDepartment({ id, name, code })`.

## 6.7 Activate/Deactivate

Clicking the toggle calls `toggleDepartmentStatus({ id, isActive: !dept.isActive })`.
Show a shadcn `AlertDialog` confirmation before deactivating:
"Deactivating this department will prevent its admins from accessing their dashboard
until it is reactivated."

## 6.8 Department detail page

A simple server page at `/super-admin-dashboard/departments/[id]` showing:
- Department name, code, status
- Stats (student count, admin count, drive count)
- List of assigned admins (call `getDepartmentAdmins({ departmentId: id })`)
- "Back to Departments" link

This is a read-only detail view. Editing happens via dialogs on the list page.

---

# 7. ADMIN ACCOUNTS PAGE

## 7.1 Target file

`app/(super-admin)/super-admin-dashboard/admins/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/admins/`

## 7.2 Source

`campushire_frontend (temp)/src/pages/superadmin/AdminAccountsPage.jsx`

## 7.3 Architecture

```
AdminAccountsPage (Server Component)
  ├── calls requireSuperAdmin()
  ├── reads search params: ?page=1&departmentId=
  ├── calls getDepartmentAdmins({ page, pageSize: 25, departmentId? })
  ├── calls getDepartments({ page: 1, pageSize: 100 })  ← for dept filter + assign form
  └── renders:
      ├── page header + "Create Admin Account" button
      ├── DepartmentFilter (client — filter by dept)
      ├── AdminAccountsTable (client — table + pagination)
      └── CreateAdminDialog (client — create new admin form)
```

## 7.4 Admin accounts table columns

| Column | Data |
|---|---|
| Name | `admin.user.email` (name not in User model — show email) |
| Email | `admin.user.email` |
| Department | `admin.department.name` + code badge |
| Assigned | `admin.createdAt` formatted |
| Actions | "Remove Admin" button |

**Note on name:** The `User` model does not store a name field — only
`clerkId`, `email`, and `role`. The student's name is on the `Student`
model, not `User`. For dept admins, only the email is available in the
database. Display email as the primary identifier. If Clerk's API could
be queried for the name, that's optional — for V1 just show email.

## 7.5 Create Admin Account dialog

A shadcn `Dialog` with:
- Name (display only — passed to Clerk user creation) — `name`
- Email (required) — `email`
- Department (required, `<select>` from active departments) — `departmentId`

On submit calls `createAdminAccount({ name, email, departmentId })`.
After success: `router.refresh()` + success toast showing:
"Admin account created. They can log in with {email} using 'Forgot Password' to set their password."

## 7.6 Assign Existing User as Admin

The existing `assignDepartmentAdmin({ userId, departmentId })` action
promotes an existing CampusHire user to dept admin role.

Add an "Assign Existing User" secondary button that opens a second dialog
with:
- User search (calls `getAvailableUsers({ search, limit: 10 })` on input change)
- Department select
- Calls `assignDepartmentAdmin()`

This covers the case where a student has already self-registered and the
super admin wants to promote them.

## 7.7 Remove Admin

"Remove Admin" button shows a shadcn `AlertDialog` confirmation:
"This will revoke {email}'s admin access. They will no longer be able to
manage the {deptName} department."

On confirm calls `removeAdminAccount({ userId: admin.user.id })`.

Read `features/admin-accounts/actions/remove-department-admin.ts` before
implementing — understand what it does (removes `DepartmentAdmin` record,
changes role back to STUDENT, syncs Clerk).

---

# 8. SUPER ADMIN STUDENTS PAGE

## 8.1 Target file

`app/(super-admin)/super-admin-dashboard/students/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/students/`

## 8.2 Source

`campushire_frontend (temp)/src/pages/superadmin/SuperAdminStudentsPage.jsx`

## 8.3 Architecture

```
SuperAdminStudentsPage (Server Component)
  ├── calls requireSuperAdmin()
  ├── reads search params: ?deptId=&status=all&search=&page=1
  ├── builds query with NO departmentId scope (super admin sees all)
  ├── calls prisma.student.findMany(...) with search/filter/pagination
  ├── calls getDepartments({ includeInactive: false }) for dept filter dropdown
  └── renders:
      ├── page header + "Export CSV" button
      ├── dept filter pills + status filter + search input
      └── StudentTable (client — read-only table + pagination)
```

**No `requireDepartmentAdmin()` here — super admin sees all departments.**
Use `requireSuperAdmin()` only.

## 8.4 Student table columns

Same as FE-05 admin roster, but with a visible Department column:

| Column | Data |
|---|---|
| Student | `student.name` + email |
| Roll Number | `student.rollNumber` |
| Department | `student.department.code` |
| CGPA | `student.academic?.currentCGPA` |
| Backlogs | `student.academic?.activeBacklogs` |
| Status | Placed/Eligible/Pending badge |

This is **read-only** — no "View Details" dialog needed (super admin
can navigate to the relevant dept admin view for details).

## 8.5 Department filter

Show active department filter pills (or a `<select>` for many depts).
When a dept is selected, add `?deptId={deptId}` to URL.
Server component re-fetches with the `departmentId` filter applied.

Remove the mock `DEPTS = ['All', 'CSE', 'ECE', 'Mech', 'Civil']` array —
use real departments from `getDepartments()`.

## 8.6 Remove readiness column

The temp frontend's `SuperAdminStudentsPage.jsx` has a `Readiness`
column. **Remove it** — out of V1 scope. Replace with the `Backlogs`
column which is V1-compliant.

---

# 9. SUPER ADMIN DRIVES PAGE

## 9.1 Target file

`app/(super-admin)/super-admin-dashboard/drives/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/drives/`

## 9.2 Source

`campushire_frontend (temp)/src/pages/superadmin/SuperAdminDrivesPage.jsx`

## 9.3 V1 scope — READ-ONLY, no posting

Per `INTEGRATION_GUIDE.md §6.2`:
> "Super Admin drives page shows read-only view of all drives across all
> departments. Remove the 'Post Central Drive' button/flow."

**Remove the "Post Central Drive" button and modal entirely.**
The super admin can see all drives but cannot create them in V1.

## 9.4 Architecture

```
SuperAdminDrivesPage (Server Component)
  ├── calls requireSuperAdmin()
  ├── reads search params: ?deptId=&status=all&page=1
  ├── fetches all drives (no dept scope filter for super admin)
  │   with _count.applications and department.code
  └── renders:
      ├── page header (no "Post" button)
      ├── dept filter + status filter
      └── DrivesTable (client — read-only, sortable)
```

## 9.5 Drive table columns

| Column | Data |
|---|---|
| Company | `drive.companyName` |
| Role | `drive.roleName` |
| Department | `drive.department.code` |
| Package | `drive.packageDisplay` or formatted `packageOffered` |
| Deadline | `drive.applicationDeadline` formatted |
| Status | `getDriveStatus()` → "Open" / "Closed" badge |
| Applicants | `drive._count.applications` |

No edit or delete actions — super admin view is read-only for drives in V1.

---

# 10. GLOBAL REPORTS PAGE

## 10.1 Target file

`app/(super-admin)/super-admin-dashboard/reports/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/reports/`

## 10.2 Source

`campushire_frontend (temp)/src/pages/superadmin/GlobalReportsPage.jsx`

## 10.3 Architecture

```
GlobalReportsPage (Server Component)
  ├── calls requireSuperAdmin()
  ├── calls getSystemStats() → SystemStats
  ├── calls getDepartmentMatrix() → DepartmentMatrixRow[]
  └── renders:
      ├── 3 KPI cards: Total Students, Placed, Overall Rate
      ├── Placement rate by department (progress bars)
      └── Department breakdown table
```

## 10.4 Placement rate progress bars

Port from `GlobalReportsPage.jsx`. For each department in `deptMatrix`:
- Show dept code label + rate % on one line
- `.progress-track` + `.progress-fill.teal` bar
- Width: `(dept.placementRate / maxRate) * 100%` where
  `maxRate = Math.max(...deptMatrix.map(d => d.placementRate))`

## 10.5 Remove readiness score column

The temp frontend shows `readiness` in the student table at the bottom.
**Remove it** — out of V1 scope.

Show: Name, Dept, CGPA, Status (from the recent students list using
`prisma.student.findMany({ take: 20, orderBy: { updatedAt: 'desc' } })`).

---

# 11. SYSTEM SETTINGS PAGE

## 11.1 Target file

`app/(super-admin)/super-admin-dashboard/settings/page.tsx` (NEW)

Create directory: `app/(super-admin)/super-admin-dashboard/settings/`

## 11.2 Source

`campushire_frontend (temp)/src/pages/superadmin/SystemSettingsPage.jsx`

## 11.3 V1 approach — UI only, no backend model

The temp frontend's system settings (placement season dates, CGPA floor,
multi-apply toggle) have no corresponding database model in V1. The
`SystemSettings` table is not in `prisma/schema.prisma`.

Port the UI but make it **display-only** in V1:
- Show the form fields with sensible default values
- Add a comment: `// TODO: wire to SystemSettings model when added`
- When "Save settings" is clicked, show a toast: "Settings saved (stored locally
  for this session — persistence coming in a future update)"
- Store state in `useState` — do NOT call any server action

This gives the super admin a working-looking UI without requiring a new
database migration in this unit.

## 11.4 Settings to show

- Placement season: start date + end date (`DatePicker` from FE-01)
- Institution-wide minimum CGPA floor (number input)
- "Allow students to apply to multiple drives" toggle switch
- "Restrict to college email domain" toggle switch (new — shown but no-op)

---

# 12. NEW FILES TO CREATE

```
features/departments/queries/
  ├── get-system-stats.ts             ← institution-wide KPIs
  └── get-department-matrix.ts        ← per-dept aggregate stats

features/admin-accounts/actions/
  └── create-admin-account.ts         ← Clerk user creation + assignment
```

Files to **create** (new pages):

```
app/(super-admin)/super-admin-dashboard/
  ├── page.tsx                         ← REPLACE placeholder
  ├── departments/
  │   ├── page.tsx                     ← dept management list
  │   └── [id]/
  │       └── page.tsx                 ← dept detail (read-only)
  ├── admins/
  │   └── page.tsx                     ← admin accounts
  ├── students/
  │   └── page.tsx                     ← cross-dept student directory
  ├── drives/
  │   └── page.tsx                     ← all drives (read-only)
  ├── reports/
  │   └── page.tsx                     ← global reports
  └── settings/
      └── page.tsx                     ← system settings (UI only)
```

---

# 13. FIELD NAME AND DATA MAPPING

## Temp frontend mock data → real Prisma data

| Temp `DEPT_MATRIX` field | Real source |
|---|---|
| `d.dept` | `DepartmentMatrixRow.code` |
| `d.students` | `DepartmentMatrixRow.totalStudents` |
| `d.placed` | `DepartmentMatrixRow.placedStudents` |
| `d.rate` | `DepartmentMatrixRow.placementRate` |
| `d.avgCompletion` | **Remove** — not in V1 schema |
| `d.avgReadiness` | **Remove** — out of V1 scope |

| Temp `STUDENTS_LIST` field | Real source |
|---|---|
| `s.roll` | `student.rollNumber` |
| `s.dept` | `student.department.code` |
| `s.cgpa` | `student.academic?.currentCGPA` |
| `s.readiness` | **Remove** — out of V1 scope |
| `s.status === 'placed'` | `student.placementStatus === 'placed'` |
| `s.status === 'attention_needed'` | `student.academic.activeBacklogs > 0 && not placed` |

| Temp drive field | Real source |
|---|---|
| `d.company` | `drive.companyName` |
| `d.role` | `drive.roleName` |
| `d.ctc` | `drive.packageDisplay` |
| `d.departments` | Parse `drive.eligibleDepartments` JSON |
| `d.status === 'Open'` | `getDriveStatus(drive.applicationDeadline) === 'open'` |

---

# 14. WHAT NOT TO DO

- Do NOT implement super admin posting central drives — out of V1 scope
- Do NOT add a "Post Central Drive" button or modal on the drives page
- Do NOT show readiness score or resume score anywhere
- Do NOT show `avgCompletion` or `avgReadiness` in the dept matrix table
  (these require out-of-scope features)
- Do NOT implement `SystemSettings` database model in this unit — UI only
- Do NOT trust `departmentId` from client requests in `createAdminAccount` —
  the action validates the `departmentId` from the Zod schema, but the
  department existence and active status are re-verified server-side
- Do NOT make the drives page editable — super admin drive view is read-only
- Do NOT add pagination to `getDepartmentMatrix()` — departments are few enough
  to always return all rows

---

# 15. TYPESCRIPT RULES

- All files: `.tsx` / `.ts`, strict mode, no `any`
- `DepartmentMatrixRow`, `SystemStats` — export from their query files
  and import in page/component files
- `requireSuperAdmin()` — returns `User`, import from `lib/auth.ts`
- `getDriveStatus()` — import from `features/drives/utils/drive-status`
  for the drives page status badge computation
- All dialogs use shadcn `Dialog` and `AlertDialog`
- All mutations: `useTransition` + `startTransition` + `router.refresh()`

---

# 16. VERIFICATION

Run in order:

```bash
npx tsc --noEmit
npm run lint
npm run test          # all existing tests must still pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Super Admin Dashboard
- [ ] Page loads at `/super-admin-dashboard`
- [ ] 4 KPI cards show real values
- [ ] Department comparison table shows all departments with real data
- [ ] Clicking KPI cards navigates to correct sub-pages

### Department Management
- [ ] Page loads at `/super-admin-dashboard/departments`
- [ ] All departments listed with student/admin/drive counts
- [ ] "Add Department" opens dialog with Name + Code fields
- [ ] Code field enforces uppercase + only letters/numbers
- [ ] Duplicate code submission shows clear error
- [ ] New dept appears in list after creation
- [ ] "Edit" button opens pre-populated dialog
- [ ] "Deactivate" shows confirmation dialog before toggling
- [ ] Deactivated dept shows "Inactive" badge
- [ ] "Show inactive" toggle shows/hides inactive depts
- [ ] Dept detail page at `/super-admin-dashboard/departments/{id}` loads

### Admin Accounts
- [ ] Page loads at `/super-admin-dashboard/admins`
- [ ] Table shows existing dept admins with email, dept, assigned date
- [ ] "Create Admin Account" opens dialog with Name, Email, Department fields
- [ ] Creating an account shows success toast with login instructions
- [ ] New admin immediately appears in the list
- [ ] "Assign Existing User" searches registered users (non-admins)
- [ ] Assigning existing user works and shows in list
- [ ] "Remove Admin" shows confirmation dialog
- [ ] Removed admin no longer appears in list
- [ ] Filter by department works

### Super Admin after admin creation
- [ ] Newly created admin (via `createAdminAccount`) can log in to
      `/sign-in` using the "Forgot Password" flow to set their password
- [ ] After login, admin sees only their assigned department's data

### Students page
- [ ] Page loads at `/super-admin-dashboard/students`
- [ ] All students across all departments visible
- [ ] Department filter pills show real department codes
- [ ] Filtering by dept shows only that dept's students
- [ ] Search by name and roll number works
- [ ] Status filter works (placed, eligible, pending)
- [ ] No readiness score column
- [ ] Export CSV downloads file with all filtered students

### Drives page
- [ ] Page loads at `/super-admin-dashboard/drives`
- [ ] All drives visible (no dept filter applied by default)
- [ ] No "Post Central Drive" button exists
- [ ] Status badge computed from deadline
- [ ] Filter by dept and status works

### Global Reports
- [ ] Page loads at `/super-admin-dashboard/reports`
- [ ] 3 KPI cards with real totals
- [ ] Placement rate bars show correct proportions
- [ ] Department breakdown table shows real data
- [ ] No readiness score column

### System Settings
- [ ] Page loads at `/super-admin-dashboard/settings`
- [ ] Form fields visible and editable
- [ ] "Save" shows a toast (no server call in V1)

---

# 17. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-08 complete
- `getSystemStats()` created
- `getDepartmentMatrix()` created
- `createAdminAccount()` server action created (Clerk + Prisma)
- Super Admin Dashboard wired to real data
- Department Management pages created and wired
- Admin Accounts page: create new account, assign existing, remove
- Super Admin Students: cross-dept read-only roster
- Super Admin Drives: read-only, no posting
- Global Reports: real dept matrix with progress bars
- System Settings: UI-only, no backend in V1
- All tests still passing
- Build passing

Set next unit: **FE-09 — Audit Log UI & Final Polish**

---

# 18. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Audit log UI (FE-09)
- Any changes to student or dept admin pages
- New database models

The next unit is **FE-09**.

---

# FINAL REPORT

When finished, provide a summary covering:

## New Queries & Actions
- `getSystemStats`: fields returned
- `getDepartmentMatrix`: per-dept query approach, performance note
- `createAdminAccount`: Clerk creation flow, password approach

## Pages Built
- Dashboard: KPI sources
- Departments: CRUD dialogs, activate/deactivate flow
- Admin Accounts: create vs assign existing, remove flow
- Students: cross-dept query, readiness removal
- Drives: read-only enforced how
- Reports: progress bar logic
- Settings: UI-only approach

## V1 Scope Decisions Applied
- List everything removed from the temp frontend (central drives posting,
  readiness columns, avgCompletion, avgReadiness, system settings backend)

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (total test count)
- `npm run build` result

## Scope Confirmation
Explicitly confirm:
**"Post Central Drive" button not implemented. Readiness score not shown
anywhere. System settings stored in useState only — no backend model.
Super admin drives page is read-only.**
