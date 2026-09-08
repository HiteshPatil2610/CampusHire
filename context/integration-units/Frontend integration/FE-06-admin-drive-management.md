# CampusHire — Integration Unit FE-06: Drive Management (Admin)

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
- **FE-03 — Student Drives & Applications ✅**
- **FE-04 — Notifications Page ✅**
- **FE-05 — Admin Home & Student Roster ✅**
  - Student roster, add student, student details dialog — all wired
  - `npm run build` passes ✅

Now implement:

# FE-06 — Drive Management (Admin)

---

# 1. READ THE PROJECT CONTEXT FIRST

Before making any changes, thoroughly read:

- `context/project-overview.md` — drive posting rules:
  - Only dept admins post drives (super admin does NOT post in V1)
  - Drive status is NEVER stored — computed from `applicationDeadline`
  - Eligibility filtering is server-side
  - A drive auto-closes when deadline passes — no manual status change
- `context/architecture.md` — invariants §2, §7, §8
- `INTEGRATION_GUIDE.md` §6.2 "Adapt" — drive scope decisions for V1
- `prisma/schema.prisma` — `Drive` model with ALL fields (including the new
  fields added in FE-03: `companyLogoUrl`, `packageDisplay`, `venue`,
  `reportingTime`, `contactPerson`, `contactPhone`, `pptLink`,
  `applicationFields`)
- `features/drives/actions/create-drive.ts` — existing `createDrive()`:
  what it accepts, how it enforces `departmentId` server-side
- `features/drives/actions/update-drive.ts` — existing `updateDrive()`
- `features/drives/actions/get-admin-drives.ts` — existing `getAdminDrives()`
- `features/drives/schemas/drive.ts` — `driveSchema` Zod validation,
  `DriveInput` type — understand all fields it validates
- `features/drives/utils/drive-status.ts` — `getDriveStatus()`,
  `getDaysUntilDeadline()`
- `features/applications/queries/get-my-applications.ts` — understand the
  query pattern to model the new admin-facing applications query
- `lib/auth.ts` — `requireDepartmentAdmin()` and `DepartmentAdminContext`

Then read all temp frontend source files for this unit:

- `campushire_frontend (temp)/src/pages/admin/PostDrivePage.jsx` (read in full)
- `campushire_frontend (temp)/src/components/admin/drives/AdminDriveLogisticsPanel.jsx`
- `campushire_frontend (temp)/src/components/admin/drives/AdminApplicationFieldsPanel.jsx`
- `campushire_frontend (temp)/src/components/admin/drives/AdminDrivePreviewCard.jsx`
- `campushire_frontend (temp)/src/data/applicationFieldsCatalog.js`
  (to understand what fields exist and seed the catalog constant)

Do not begin implementation until you have read all of the above.

---

# 2. UNDERSTANDING THE TEMP FRONTEND DRIVE PAGE — CRITICAL

`PostDrivePage.jsx` has **two tabs** in the temp frontend:

1. **"Super Admin Drives" tab** — shows drives posted by the Super Admin
   (Central Placement Cell). The dept admin configures logistics and
   application fields for those central drives.
2. **"Post Department Drive" tab** — the dept admin creates their own
   departmental drive.

**In V1 of the real app, the Super Admin Drives tab does NOT exist.**

Per `context/project-overview.md` and `INTEGRATION_GUIDE.md §6.2`:
- In V1, only dept admins post drives.
- Super admins do NOT post central drives in V1 — that is deferred.
- The "configure logistics for a Super Admin central drive" workflow is
  therefore also out of V1 scope.

This unit implements **only the "Post Department Drive" functionality**:
- Dept admin creates a new drive
- Dept admin edits an existing drive
- Dept admin views a list of their drives
- Dept admin views applicants for a drive

The logistics panel and application fields panel from the temp frontend
**are still ported** — they are used when creating/editing a departmental
drive, not only for Super Admin central drives.

---

# 3. SCOPE OF THIS UNIT

This unit covers exactly and only:

1. **New query** — `getDriveApplications()` for admin to view applicants
2. **Update `createDrive()` and `updateDrive()`** — add new Drive fields
   (logistics + applicationFields) to the create/update flow
3. **Drive management list page** — table of admin's drives
4. **Post drive page** — create drive form with logistics + application fields
5. **Edit drive page** — pre-populated edit form
6. **Drive applications page** — view applicants for a specific drive
7. **Port `AdminDriveLogisticsPanel`** — as a form section component
8. **Port `AdminApplicationFieldsPanel`** — as a form section component
9. **Port `AdminDrivePreviewCard`** — simplified V1 version

This unit does **NOT** implement:

- "Super Admin central drives" configuration workflow (deferred/out of V1)
- Super admin posting drives (out of V1)
- Excel bulk import (FE-07)
- Admin announcements (after this unit)
- Admin reports (after this unit)
- Any super admin pages (FE-08)

---

# 4. NEW QUERY — `getDriveApplications`

## 4.1 Target file

`features/applications/queries/get-drive-applications.ts` (NEW FILE)

## 4.2 Implementation

Admin needs to see all students who applied to a specific drive,
scoped to their own department.

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import type {
  DriveApplication, Student, StudentAcademic, Department
} from "@prisma/client";

export type DriveApplicationItem = DriveApplication & {
  student: Student & {
    academic: StudentAcademic | null;
    department: Pick<Department, "id" | "name" | "code">;
  };
};

export interface GetDriveApplicationsParams {
  driveId: string;
  page?: number;
  pageSize?: number;
}

export interface DriveApplicationsResult {
  data: DriveApplicationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Get paginated list of applications for a specific drive.
 * Authorization: dept admin only, drive must belong to their department.
 */
export async function getDriveApplications(
  params: GetDriveApplicationsParams
): Promise<DriveApplicationsResult> {
  const { department } = await requireDepartmentAdmin();

  // Verify the drive belongs to this admin's department
  const drive = await prisma.drive.findUnique({
    where: { id: params.driveId },
    select: { departmentId: true },
  });

  if (!drive) throw new Error("Drive not found");

  if (drive.departmentId !== department.id) {
    throw new AuthorizationError(
      "You do not have permission to view applications for this drive"
    );
  }

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;

  const totalCount = await prisma.driveApplication.count({
    where: { driveId: params.driveId },
  });

  const data = await prisma.driveApplication.findMany({
    where: { driveId: params.driveId },
    skip,
    take: pageSize,
    orderBy: { appliedAt: "desc" },
    include: {
      student: {
        include: {
          academic: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return { data, page, pageSize, totalCount };
}
```

---

# 5. UPDATE DRIVE SCHEMA AND ACTIONS

## 5.1 Extend `features/drives/schemas/drive.ts`

The existing `driveSchema` does not include the logistics fields or
`applicationFields` added to the `Drive` model in FE-03. Extend it:

```typescript
// ADD to driveSchema (as optional fields):
export const driveSchema = z.object({
  // ... ALL EXISTING FIELDS UNCHANGED ...

  // New display fields:
  packageDisplay:   z.string().max(100).optional(),  // e.g. "12–16 LPA"

  // Logistics fields (all optional):
  venue:            z.string().max(500).optional(),
  reportingTime:    z.string().max(100).optional(),
  contactPerson:    z.string().max(200).optional(),
  contactPhone:     z.string().max(50).optional(),
  pptLink:          z.string().url().optional().or(z.literal("")),

  // Application fields configuration (JSON string):
  applicationFields: z.string().optional(), // JSON array serialized as string
});
```

Add these fields to `DriveInput` — `z.infer<typeof driveSchema>` picks
them up automatically.

## 5.2 Update `features/drives/actions/create-drive.ts`

Add the new fields to the `prisma.drive.create()` call:

```typescript
const drive = await prisma.drive.create({
  data: {
    // ... existing fields unchanged ...
    packageDisplay:   validated.packageDisplay ?? null,
    venue:            validated.venue ?? null,
    reportingTime:    validated.reportingTime ?? null,
    contactPerson:    validated.contactPerson ?? null,
    contactPhone:     validated.contactPhone ?? null,
    pptLink:          validated.pptLink ?? null,
    applicationFields: validated.applicationFields ?? null,
  },
});
```

## 5.3 Update `features/drives/actions/update-drive.ts`

Same addition — include all new fields in the `prisma.drive.update()` call.

---

# 6. APPLICATION FIELDS CATALOG — CONSTANT FILE

## 6.1 Source

`campushire_frontend (temp)/src/data/applicationFieldsCatalog.js`

## 6.2 Target file

`features/drives/data/application-fields-catalog.ts` (NEW FILE)

Port `AVAILABLE_STUDENT_FIELDS` and `FIELD_PRESETS` from the temp
frontend into a TypeScript constant file. This is used by
`AdminApplicationFieldsPanel` to show which fields can be required.

```typescript
export interface ApplicationFieldDef {
  key: string;
  label: string;
  source: 'profile' | 'resume' | 'student_input';
  category: string;
  icon: string;
  description?: string;
  defaultRequired: boolean;
}

export const AVAILABLE_STUDENT_FIELDS: ApplicationFieldDef[] = [
  // Port the full array from AVAILABLE_STUDENT_FIELDS in applicationFieldsCatalog.js
  // ...
];

export interface FieldPreset {
  name: string;
  description: string;
  keys: string[];
}

export const FIELD_PRESETS: Record<string, FieldPreset> = {
  // Port the full FIELD_PRESETS object from applicationFieldsCatalog.js
  // ...
};
```

Read the source file fully and port all entries. Remove the resume-related
fields (resume URL, ATS score) from the catalog since resume upload is out
of V1 scope. Keep all profile-based fields.

---

# 7. ADMIN DRIVE COMPONENTS

Port these 3 components from the temp frontend.
Place them in `components/admin/drives/`.

## 7.1 `AdminDriveLogisticsPanel` → `admin-drive-logistics-panel.tsx`

Source: `AdminDriveLogisticsPanel.jsx`

A `"use client"` form section for configuring venue, reporting time,
contact info, PPT link, and special instructions.

```typescript
interface AdminDriveLogisticsPanelProps {
  venue:            string;
  reportingTime:    string;
  contactPerson:    string;
  contactPhone:     string;
  pptLink:          string;
  additionalNotes?: string;
  onChange: (field: string, value: string) => void;
}
```

Changes from the source:
- Use Lucide `ExternalLink` icon in place of `↗` character in `UrlField`
  (already handled by `UrlField` from FE-01)
- Use `UrlField` component from FE-01 for the PPT link
- All other fields use standard `.field` + `<input>` CSS pattern from
  `globals.css`
- No additional changes needed — port visually as-is

## 7.2 `AdminApplicationFieldsPanel` → `admin-application-fields-panel.tsx`

Source: `AdminApplicationFieldsPanel.jsx`

A `"use client"` form section for configuring which student fields are
required when applying to a drive.

```typescript
interface AdminApplicationFieldsPanelProps {
  fields: ApplicationFieldConfig[];    // current active fields list
  onChange: (fields: ApplicationFieldConfig[]) => void;
}

interface ApplicationFieldConfig {
  key:         string;
  label:       string;
  source:      string;
  category:    string;
  icon:        string;
  description?: string;
  required:    boolean;
  enabled:     boolean;
}
```

Changes from the source:
- Replace `import { AVAILABLE_STUDENT_FIELDS, FIELD_PRESETS } from
  '../../../data/applicationFieldsCatalog'` with
  `import { AVAILABLE_STUDENT_FIELDS, FIELD_PRESETS } from
  '@/features/drives/data/application-fields-catalog'`
- Replace `Modal` with shadcn `Dialog` for the custom field modal
- All other logic ports as-is (add/remove fields, toggle required,
  presets, catalog search)
- Remove resume-related fields from presets (resume builder out of V1)

## 7.3 `AdminDrivePreviewCard` → `admin-drive-preview-card.tsx`

Source: `AdminDrivePreviewCard.jsx`

A `"use client"` component that shows a live preview of how the drive
looks to students, using the current form state.

**V1 simplification — remove the "Application Submission Card" preview tab:**

The temp frontend's preview card has two tabs:
- "Student Drive Card" — shows the drive card as students see it
- "Application Submission Card" — shows the full modal preview

In V1, the "Application Submission Card" tab references `STUDENT` mock data
and shows the `ApplicationReviewModal` preview with resume, editable fields,
etc. Since all of that is out of V1 scope (resume builder deferred,
application fields not on the student apply flow in V1), **remove this tab
entirely**. Only port the "Student Drive Card" preview tab.

```typescript
interface AdminDrivePreviewCardProps {
  drive: Partial<Drive>;         // current form state (not yet saved)
  venue?: string;                // from logistics panel
  reportingTime?: string;
  deptCode: string;              // to display in eligible dept list
}
```

Changes from the source:
- Remove `viewMode` state and the "Application Submission Card" tab
- Remove `STUDENT` mock data import
- Remove `DEMO_TODAY` — use `getDriveStatus(drive.applicationDeadline)`
  from `features/drives/utils/drive-status`
- Remove the stage stepper (V1 has no application stage tracking)
- Keep the drive card preview showing company, role, package, min CGPA,
  deadline badge, and apply button shape

---

# 8. DRIVE MANAGEMENT LIST PAGE

## 8.1 Target file

`app/(admin)/admin-dashboard/drives/page.tsx` (NEW FILE)

Create directory: `app/(admin)/admin-dashboard/drives/`

## 8.2 Architecture

```
AdminDrivesPage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  ├── reads search params: ?status=all|open|closed&search=&page=1
  ├── calls getAdminDrives({ status, search, page, pageSize: 25 })
  │     → AdminDrivesResult { data, page, pageSize, totalCount }
  ├── for each drive: getDriveStatus(drive.applicationDeadline)
  └── renders:
      ├── DepartmentScopeBanner
      ├── page header + "Post New Drive" button
      ├── DrivesListFilters (client — search + status filter)
      └── DrivesTable (client — table + pagination)
```

## 8.3 Drive table columns

| Column | Data |
|---|---|
| Company | `drive.companyName` + `drive.roleName` below |
| Package | `drive.packageDisplay` or format `drive.packageOffered` as "X LPA" |
| Eligibility | Min CGPA, Max backlogs |
| Drive Date | `drive.driveDate` formatted |
| Deadline | `drive.applicationDeadline` formatted + badge |
| Status | `getDriveStatus()` → "Open" or "Closed" badge |
| Applications | application count — pass `drive._count?.applications` (use Prisma `_count` in the query) |
| Actions | "View Applicants" / "Edit" buttons |

Update `getAdminDrives()` to include `_count: { select: { applications: true } }`:

```typescript
// In get-admin-drives.ts, update findMany:
const drives = await prisma.drive.findMany({
  where,
  // ...
  include: {
    _count: { select: { applications: true } },
  },
});
```

## 8.4 Action buttons per row

- "View Applicants →" → `/admin-dashboard/drives/{id}/applications`
- "Edit →" → `/admin-dashboard/drives/{id}/edit`

## 8.5 Empty state

When `totalCount === 0`:
```
📋 No drives posted yet.
Post your first campus placement drive to get started.
[Post New Drive →]
```

---

# 9. POST DRIVE PAGE

## 9.1 Target file

`app/(admin)/admin-dashboard/drives/new/page.tsx` (NEW FILE)

Create directory: `app/(admin)/admin-dashboard/drives/new/`

## 9.2 Source

The "Post Department Drive" tab form from `PostDrivePage.jsx`
(second tab in the source file — starts at `newDriveForm` state).

## 9.3 Architecture

```
PostDrivePage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  └── renders:
      └── PostDriveForm (client — "use client")
            ├── receives: departmentId, departmentName, allActiveDepts
            └── manages form state + calls createDrive()
```

Pass `allActiveDepts` from the server component so the admin can select
eligible departments. Fetch them with:

```typescript
const allDepts = await prisma.department.findMany({
  where: { isActive: true },
  select: { id: true, name: true, code: true },
  orderBy: { code: 'asc' },
});
```

## 9.4 Form sections

Port the form from the "Post Department Drive" tab. Organize into sections:

### Section 1 — Company & Role Details

| Field | Input Type | Validation | Schema Field |
|---|---|---|---|
| Company Name * | text | required | `companyName` |
| Role / Job Title * | text | required | `roleName` |
| Package (numeric) * | number | > 0, max 1000 | `packageOffered` (in LPA) |
| Package Display | text | optional | `packageDisplay` (e.g. "12–16 LPA") |
| Job Description URL | `UrlField` | valid URL, optional | `jobDescriptionUrl` |

### Section 2 — Eligibility Criteria

| Field | Input Type | Validation | Schema Field |
|---|---|---|---|
| Min CGPA * | number 0–10, step 0.01 | 0–10 | `minCGPA` |
| Max Active Backlogs * | number 0–10 | ≥ 0 | `maxActiveBacklogs` |
| Eligible Departments * | checkbox group | min 1 | `eligibleDepartments` (array of dept IDs) |

The eligible departments checkbox group shows all active departments.
The admin's own department is pre-checked and **cannot be unchecked** —
since the drive is posted by that department, it must always include it.

```typescript
// Enforce: admin's own department is always included
const eligibleDepts = form.eligibleDepartments.includes(departmentId)
  ? form.eligibleDepartments
  : [...form.eligibleDepartments, departmentId];
```

### Section 3 — Dates & Application Method

| Field | Input Type | Validation | Schema Field |
|---|---|---|---|
| Drive Date * | `DatePicker` | required, after deadline | `driveDate` |
| Application Deadline * | `DatePicker` | required, future, before drive date | `applicationDeadline` |
| Apply Method * | radio: IN_APP / EXTERNAL | required | `applyMethod` |
| External Apply URL | `UrlField` | required if EXTERNAL | `externalApplyUrl` |

### Section 4 — Selection Rounds

A dynamic list of round names. Show text inputs to add/remove rounds.
Minimum 1 round required.

Maps to `selectionRounds` (array of strings, stored as JSON in DB).

Default value: `["Aptitude Test", "Technical Interview", "HR Interview"]`

### Section 5 — Logistics (Admin Internal)

Render `AdminDriveLogisticsPanel` component (from §7.1).

Maps to the individual logistics fields: `venue`, `reportingTime`,
`contactPerson`, `contactPhone`, `pptLink`.

### Section 6 — Application Fields Configuration

Render `AdminApplicationFieldsPanel` component (from §7.2).

The selected fields are serialized to JSON and stored in `applicationFields`.

Serialize before submitting:
```typescript
applicationFields: JSON.stringify(form.applicationFields),
```

### Section 7 — Live Preview

Render `AdminDrivePreviewCard` component (from §7.3) — shows how the
drive card will look to students. This is a visual preview only,
it does not affect form state.

## 9.5 Submit handler

```typescript
function handleSubmit(e: FormEvent) {
  e.preventDefault();
  startTransition(async () => {
    const result = await createDrive({
      companyName:        form.companyName,
      roleName:           form.roleName,
      packageOffered:     parseFloat(form.packageOffered),
      packageDisplay:     form.packageDisplay || undefined,
      jobDescriptionUrl:  form.jobDescriptionUrl || undefined,
      minCGPA:            parseFloat(form.minCGPA),
      maxActiveBacklogs:  parseInt(form.maxActiveBacklogs),
      eligibleDepartments: form.eligibleDepartments, // array of dept IDs
      driveDate:          form.driveDate,             // ISO string
      applicationDeadline: form.applicationDeadline,  // ISO string
      applyMethod:        form.applyMethod,           // 'IN_APP' | 'EXTERNAL'
      externalApplyUrl:   form.externalApplyUrl || undefined,
      selectionRounds:    form.selectionRounds,       // string[]
      venue:              form.venue || undefined,
      reportingTime:      form.reportingTime || undefined,
      contactPerson:      form.contactPerson || undefined,
      contactPhone:       form.contactPhone || undefined,
      pptLink:            form.pptLink || undefined,
      applicationFields:  form.applicationFields.length
                           ? JSON.stringify(form.applicationFields)
                           : undefined,
    });

    if (result.success) {
      toast({ title: 'Drive posted!', description: `Drive posted successfully. Students will see it in their eligible drives list.` });
      router.push('/admin-dashboard/drives');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  });
}
```

After a successful post, the drive immediately appears in eligible students'
`getEligibleDrives()` results (server-side eligibility filtering in FE-03
handles this automatically via the `eligibleDepartments` JSON array).

---

# 10. EDIT DRIVE PAGE

## 10.1 Target file

`app/(admin)/admin-dashboard/drives/[id]/edit/page.tsx` (NEW FILE)

Create directories: `app/(admin)/admin-dashboard/drives/[id]/` and
`app/(admin)/admin-dashboard/drives/[id]/edit/`

## 10.2 Architecture

```
EditDrivePage (Server Component)
  ├── params: { id: string }
  ├── calls requireDepartmentAdmin() → { department }
  ├── fetches drive: prisma.drive.findUnique({ where: { id } })
  ├── verifies drive.departmentId === department.id (throw 403 if not)
  └── renders:
      └── EditDriveForm (client)
            ├── receives: drive (pre-populated data), allActiveDepts
            └── calls updateDrive(driveId, input)
```

**Important:** Verifying `drive.departmentId === department.id` in the
server component catches unauthorized access before rendering any data.
Show a "Drive not found or access denied" page if verification fails.

## 10.3 Form

Identical form structure to the Post Drive page (§9.4) but pre-populated
with existing drive data.

Pre-populate from the `Drive` record:
- Parse `selectionRounds` JSON string → string array
- Parse `eligibleDepartments` JSON string → dept ID array
- Parse `applicationFields` JSON string → ApplicationFieldConfig array

Submit calls `updateDrive(driveId, input)` instead of `createDrive(input)`.

After successful update, navigate to `/admin-dashboard/drives`.

---

# 11. DRIVE APPLICATIONS PAGE

## 11.1 Target file

`app/(admin)/admin-dashboard/drives/[id]/applications/page.tsx` (NEW FILE)

Create directory: `app/(admin)/admin-dashboard/drives/[id]/applications/`

## 11.2 Architecture

```
DriveApplicationsPage (Server Component)
  ├── params: { id: string }
  ├── calls requireDepartmentAdmin() → { department }
  ├── fetches drive summary (companyName, roleName, applicationDeadline)
  ├── verifies drive.departmentId === department.id
  ├── reads search params: ?page=1
  ├── calls getDriveApplications({ driveId: id, page, pageSize: 25 })
  └── renders:
      ├── page header: "{companyName} — {roleName} Applications"
      ├── drive summary strip (status, deadline, total applicants)
      └── ApplicantsTable (client — table + pagination + CSV export)
```

## 11.3 Applicants table columns

| Column | Data |
|---|---|
| Student | `application.student.name` + roll number below |
| Department | `application.student.department.code` |
| CGPA | `application.snapshotCgpa` (CGPA at time of application) |
| Backlogs | `application.snapshotBacklogs` |
| Applied On | `application.appliedAt` formatted |
| Profile | Profile completion % from `calculateProfileCompletion()` (optional) |
| Skills count | `application.student._count.skills` (if included in query) |

**Note on snapshot fields:** `snapshotCgpa` and `snapshotBacklogs` are
the academic values captured at application time (added in FE-03's schema
migration). They are more trustworthy than the current `student.academic`
values (which may have changed since application). Show snapshot values
in the table.

## 11.4 Export to CSV

Add a "Export Applicants CSV" button (same pattern as FE-05's student
roster export using `lib/csv-export.ts`).

CSV columns: Name, Roll Number, Department, CGPA (at application), Backlogs,
Applied Date.

## 11.5 Empty state

When `totalCount === 0`:
```
📭 No applications yet for this drive.
The drive {is open / has closed} — 
{applications will appear here once students apply.}
```

---

# 12. ADMIN ANNOUNCEMENTS AND REPORTS PAGES

These two pages exist in the temp frontend (`AnnouncementsPage.jsx`,
`ReportsAnalyticsPage.jsx`) and are in the admin route group.
They are simple and can be added in this same unit to complete the
admin section.

## 12.1 Announcements page

## Target file

`app/(admin)/admin-dashboard/announcements/page.tsx` (NEW FILE)

## What it does

In V1, admin "announcements" are broadcast via the existing `Notification`
system. The page allows an admin to create a notification that goes to
all students in their department.

This is a **new server action** needed: `broadcastDepartmentNotification`.

### New file: `features/notifications/actions/broadcast-department-notification.ts`

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { z } from "zod";

const broadcastSchema = z.object({
  title:   z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(2000).trim(),
});

export type BroadcastResult =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * Broadcast a notification to all active (non-pending) students in
 * the authenticated admin's department.
 */
export async function broadcastDepartmentNotification(
  input: z.infer<typeof broadcastSchema>
): Promise<BroadcastResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = broadcastSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }

    // Get all non-pending students in this department who have User accounts
    const students = await prisma.student.findMany({
      where: { departmentId: department.id, isPending: false, userId: { not: null } },
      select: { userId: true },
    });

    if (students.length === 0) {
      return { success: false, error: "No registered students in your department to notify." };
    }

    // Create one notification per student
    await prisma.notification.createMany({
      data: students.map((s) => ({
        userId:       s.userId!,
        type:         "ADMIN",
        title:        validated.data.title,
        message:      validated.data.message,
        resourceType: "ANNOUNCEMENT",
        resourceId:   department.id,
      })),
    });

    // Audit log
    await createAuditLog({
      action:     AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT, // closest entity type for now
      metadata: {
        broadcastTitle:   validated.data.title,
        departmentId:     department.id,
        recipientCount:   students.length,
        sentBy:           user.id,
      },
    });

    return { success: true, count: students.length };
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return { success: false, error: "Failed to send announcement. Please try again." };
  }
}
```

### Page architecture

```
AnnouncementsPage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  ├── fetches recent notifications sent by this dept (type='ADMIN', resourceId=deptId)
  │   ordered by createdAt desc, limit 20
  └── renders:
      ├── page title "Announcements"
      └── AnnouncementsClient (client — compose form + sent list)
```

Port the visual layout from `AnnouncementsPage.jsx`:
- Compose form: title input, message textarea, "Send to all {deptCode} students" button
- Sent announcements list: shows past broadcasts with title, date, recipient count

## 12.2 Reports & Analytics page

### Target file

`app/(admin)/admin-dashboard/reports/page.tsx` (NEW FILE)

### Architecture

```
ReportsPage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  ├── calls getAdminDashboardStats() (from FE-05) → stats
  ├── calls getDepartmentStudents({ pageSize: 1 }) → just totalCount
  ├── calls getAdminDrives({ status: 'all', pageSize: 1 }) → just totalCount
  └── renders: KPIs + placement breakdown table
```

Port `ReportsAnalyticsPage.jsx` from the temp frontend. Replace mock
student data with real data from `getDepartmentStudents()` and
`getAdminDashboardStats()`.

Show:
- Total students, placed, unplaced, opted out
- Placement rate %
- Open drives count
- A simple table of students with their status (same as roster but read-only)

This page is primarily informational — no mutations.

---

# 13. NEW FILES TO CREATE

```
features/applications/queries/
  └── get-drive-applications.ts           ← admin applicants query

features/drives/data/
  └── application-fields-catalog.ts       ← ported field catalog constant

features/notifications/actions/
  └── broadcast-department-notification.ts ← dept announcement action

components/admin/drives/
  ├── admin-drive-logistics-panel.tsx
  ├── admin-application-fields-panel.tsx
  └── admin-drive-preview-card.tsx
```

Files to **create** (new pages):

```
app/(admin)/admin-dashboard/drives/
  ├── page.tsx                             ← drive list
  ├── new/
  │   └── page.tsx                         ← post new drive form
  └── [id]/
      ├── edit/
      │   └── page.tsx                     ← edit drive form
      └── applications/
          └── page.tsx                     ← view applicants

app/(admin)/admin-dashboard/announcements/
  └── page.tsx

app/(admin)/admin-dashboard/reports/
  └── page.tsx
```

Files to **update**:

```
features/drives/schemas/drive.ts           ← add logistics + applicationFields fields
features/drives/actions/create-drive.ts    ← add new fields to create data
features/drives/actions/update-drive.ts    ← add new fields to update data
features/drives/actions/get-admin-drives.ts ← add _count: { applications } include
```

---

# 14. WHAT NOT TO DO

- Do NOT implement the "Super Admin central drives" configuration tab
  from `PostDrivePage.jsx` — that is out of V1 scope
- Do NOT implement the "Application Submission Card" preview tab in
  `AdminDrivePreviewCard` — remove it, keep only the drive card preview
- Do NOT implement application stage tracking (no stage update action)
- Do NOT let the admin change the drive's `departmentId` — it is always
  the admin's own department, resolved server-side
- Do NOT implement drive deletion — not in V1 spec
- Do NOT implement Excel bulk import in this unit — that is FE-07
- Do NOT store drive status anywhere — always compute with `getDriveStatus()`
- Do NOT use `DEMO_TODAY` — use real `new Date()` everywhere
- Do NOT port the "StudentApplicationPreviewModal" from the temp frontend —
  it shows the full `ApplicationReviewModal` which is out of V1 scope
- Do NOT let the admin edit another department's drive — verify ownership
  in both the server component and `updateDrive()` action

---

# 15. TYPESCRIPT RULES

- All new files: `.tsx` / `.ts`, strict mode, no `any`
- `Drive` type from `@prisma/client` — use for all drive objects
- `DriveInput` from `features/drives/schemas/drive.ts` — use for form type
- `DriveStatus` from `features/drives/utils/drive-status.ts`
- `ApplicationFieldConfig` — define this interface in
  `admin-application-fields-panel.tsx` and export it
- Form state in `PostDriveForm` and `EditDriveForm` — keep local with
  `useState`, no need for a form library unless validation complexity grows
- Use `useTransition` + `startTransition` for all form submits

---

# 16. VERIFICATION

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

### Drive management list
- [ ] Page loads at `/admin-dashboard/drives`
- [ ] `DepartmentScopeBanner` shows correct dept
- [ ] "Post New Drive" button links to `/admin-dashboard/drives/new`
- [ ] Table shows drives for admin's own department only
- [ ] Status badge computed from deadline (not stored)
- [ ] Application count column shows correct numbers
- [ ] "Edit →" links to the edit page
- [ ] "View Applicants →" links to applications page
- [ ] Empty state message when no drives exist

### Post drive page
- [ ] Page loads at `/admin-dashboard/drives/new`
- [ ] All form sections visible: company, eligibility, dates, rounds,
      logistics, application fields, preview
- [ ] Admin's own dept is pre-checked in eligible departments and cannot
      be unchecked
- [ ] `DatePicker` works for drive date and deadline
- [ ] `UrlField` works for PPT link and external apply URL
- [ ] External URL field appears only when "External" apply method selected
- [ ] `AdminDriveLogisticsPanel` fields work
- [ ] `AdminApplicationFieldsPanel` presets, add/remove fields work
- [ ] `AdminDrivePreviewCard` shows live preview of the drive card
- [ ] Submitting with invalid data shows validation error toast
- [ ] Deadline must be before drive date — validated before submit
- [ ] Successful submit creates drive, shows success toast, redirects to list
- [ ] Posted drive immediately appears in eligible students' drive list
      (verify by logging in as a student in the eligible dept with matching CGPA)

### Edit drive page
- [ ] Page loads at `/admin-dashboard/drives/{id}/edit`
- [ ] All form fields pre-populated from existing drive data
- [ ] Editing another dept's drive ID in URL is rejected server-side
- [ ] Successful save shows toast and redirects to drive list

### Drive applications page
- [ ] Page loads at `/admin-dashboard/drives/{id}/applications`
- [ ] Header shows drive company + role name
- [ ] Applicants table shows correct student data
- [ ] `snapshotCgpa` and `snapshotBacklogs` shown (values at apply time)
- [ ] "Export CSV" downloads correct file
- [ ] Pagination works
- [ ] Empty state when no applications

### Announcements page
- [ ] Page loads at `/admin-dashboard/announcements`
- [ ] Compose form accepts title and message
- [ ] "Send" button dispatches to all active dept students
- [ ] Students in that dept see new notification in their notifications page
- [ ] Non-pending students only receive the notification (pending = not registered yet)
- [ ] Success toast shows recipient count
- [ ] Sent announcements list shows recent broadcasts

### Reports page
- [ ] Page loads at `/admin-dashboard/reports`
- [ ] KPIs show real values from `getAdminDashboardStats()`
- [ ] Placement rate matches manual calculation

---

# 17. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-06 complete
- `getDriveApplications()` query created with dept-scope check
- `driveSchema` extended with logistics + applicationFields
- `createDrive()` and `updateDrive()` updated with new fields
- `getAdminDrives()` updated to include `_count.applications`
- Application fields catalog ported to TypeScript constant
- `AdminDriveLogisticsPanel`, `AdminApplicationFieldsPanel`,
  `AdminDrivePreviewCard` components ported
- Drive list, post drive, edit drive, applications pages created
- Announcements page with `broadcastDepartmentNotification` action
- Reports page using existing stats queries
- All tests still passing
- Build passing

Set next unit: **FE-07 — Excel Bulk Import (Admin)**

---

# 18. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Excel bulk import (FE-07)
- Super admin pages (FE-08)
- Audit log UI (FE-09)

The next unit is **FE-07**.

---

# FINAL REPORT

When finished, provide a summary covering:

## New Query & Actions
- `getDriveApplications`: scope enforcement, snapshot fields usage
- `broadcastDepartmentNotification`: recipient selection logic

## Schema Updates
- Fields added to `driveSchema`
- Fields added to `createDrive()` and `updateDrive()` prisma calls

## Drive Components
- `AdminDriveLogisticsPanel`: what changed from source
- `AdminApplicationFieldsPanel`: what changed from source, catalog import
- `AdminDrivePreviewCard`: what was removed (tab 2, stepper, DEMO_TODAY)

## Pages
- Drive list: data source, filter behavior
- Post drive: form sections, eligible dept enforcement
- Edit drive: JSON deserialization of stored fields
- Applications: snapshot fields usage

## Announcements & Reports
- Announcement broadcast logic
- Reports data sources

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (test count)
- `npm run build` result

## Scope Confirmation
Explicitly confirm:
**"Super Admin central drives" configuration tab not ported.
"Application Submission Card" preview tab removed.
No drive deletion. No application stage tracking.
Drive status always computed — never stored.**
