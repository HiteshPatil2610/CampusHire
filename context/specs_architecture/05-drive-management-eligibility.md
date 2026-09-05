# CampusHire — Unit 05: Drive Management & Eligibility

## Current Status

Completed:
- Unit 01 — Project Setup ✅
- Unit 02 — Database & Student Foundation ✅
- Unit 03 — Authentication & Role Synchronization ✅
- Unit 04 — Student Registration & Profile Management ✅

Now implement the complete:

# Unit 05 — Drive Management & Eligibility

---

## 1. Purpose

Implement the complete drive management and eligibility filtering system. This unit enables:

1. Department admins to post and manage placement drives
2. Server-side eligibility rule enforcement
3. Students to view only drives they qualify for
4. Automatic drive status calculation based on deadline
5. Department-scoped drive access control

All drive operations are department-scoped and role-restricted. Drive eligibility is always enforced server-side.

---

## 2. Scope

### In Scope

**Drive Management (Department Admin):**
- Create new drives with full details
- View own department's drives
- Edit own department's drives
- Upload job description PDF to Vercel Blob
- Set eligibility criteria (CGPA, backlogs, departments)

**Drive Eligibility:**
- Server-side eligibility calculation
- Multi-criteria filtering (CGPA, backlogs, department)
- Eligibility enforcement on all student operations

**Student Drive Access:**
- View list of eligible drives only
- View detail of eligible drives
- Filter drives (active/closed)
- Search drives by company/role

**Drive Status:**
- Dynamic status calculation from application deadline
- No stored status field
- Consistent status computation everywhere

### Out of Scope

- Student applications (Unit 06)
- Application tracking
- Application history
- Excel/CSV bulk import (separate unit)
- Drive analytics/reports
- Email notifications
- Drive templates
- Drive duplication
- Drive deletion (admin can edit but not delete for V1)

---

## 3. Drive Model

### Database Structure

```prisma
model Drive {
  id                    String   @id @default(cuid())
  departmentId          String
  companyName           String
  roleName              String
  jobDescriptionUrl     String?  // Vercel Blob URL
  packageOffered        Float
  selectionRounds       String   @db.Text // JSON array of round names
  driveDate             DateTime
  applicationDeadline   DateTime
  applyMethod           ApplyMethod
  externalApplyUrl      String?
  minCGPA               Float
  maxActiveBacklogs     Int
  eligibleDepartments   String   @db.Text // JSON array of department IDs
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  // Relations
  department Department @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  
  @@index([departmentId])
  @@index([applicationDeadline])
}

enum ApplyMethod {
  IN_APP      // Apply through CampusHire (future)
  EXTERNAL    // Apply via external URL
}
```

### Fields Explanation

**Core Information:**
- `companyName` - Hiring company name (required)
- `roleName` - Job role/position title (required)
- `jobDescriptionUrl` - PDF uploaded to Vercel Blob (optional)
- `packageOffered` - Salary package in LPA (required)
- `selectionRounds` - JSON array of round names (required, e.g., ["Aptitude", "Technical", "HR"])
- `driveDate` - Date when drive will be conducted (required)
- `applicationDeadline` - Last date to apply (required)

**Apply Method:**
- `applyMethod` - IN_APP or EXTERNAL (required)
- `externalApplyUrl` - External application URL if EXTERNAL (required when method is EXTERNAL)

**Eligibility Criteria:**
- `minCGPA` - Minimum CGPA required (required, 0-10 scale)
- `maxActiveBacklogs` - Maximum allowed active backlogs (required, typically 0-2)
- `eligibleDepartments` - JSON array of department IDs that can apply (required)

**Metadata:**
- `departmentId` - Posted by which department (required, for department scope)
- `createdAt` / `updatedAt` - Automatic timestamps

### Important Notes

1. **No Status Field**: Drive status is NEVER stored. It is always calculated from `applicationDeadline`.
2. **Department Scope**: Every drive belongs to exactly one department. The department admin who posts it.
3. **JSON Fields**: `selectionRounds` and `eligibleDepartments` stored as JSON text for simplicity.

---

## 4. Drive Status Calculation

### Status Rules

```typescript
export type DriveStatus = "open" | "closed";

export function getDriveStatus(applicationDeadline: Date): DriveStatus {
  const now = new Date();
  return now < applicationDeadline ? "open" : "closed";
}
```

### Important Rules

1. **Never Store Status**: The `Drive` model has NO `status` field
2. **Always Calculate**: Use `getDriveStatus()` everywhere status is needed
3. **Consistent Logic**: Same function used in queries, display, filtering
4. **Automatic Transition**: Drives automatically close when deadline passes

### Usage Locations

- Drive list displays
- Drive detail displays
- Student filtering (show only open drives by default)
- Admin drive management views
- Eligibility checking (only check open drives)

---

## 5. Drive Eligibility System

### Eligibility Criteria

A student is eligible for a drive if ALL conditions are met:

1. **Department Match**: Student's department is in drive's `eligibleDepartments` list
2. **CGPA Requirement**: Student's current CGPA >= drive's `minCGPA`
3. **Backlogs Limit**: Student's active backlogs <= drive's `maxActiveBacklogs`
4. **Drive Status**: Drive must be "open" (deadline not passed)

### Server-Side Enforcement

**CRITICAL**: Eligibility MUST be checked server-side in:

1. **List Queries**: Student drive list only returns eligible drives
2. **Detail Queries**: Student drive detail checks eligibility before returning
3. **Application Actions**: (Future) Apply action checks eligibility

**NEVER**:
- Send all drives to client and filter in React
- Trust client-provided eligibility status
- Allow students to bypass eligibility by URL manipulation

### Eligibility Check Function

```typescript
export function isStudentEligibleForDrive(
  student: Student & { academic: StudentAcademic | null; department: Department },
  drive: Drive
): boolean {
  // Must have academic record
  if (!student.academic) return false;
  
  // Check drive is open
  if (getDriveStatus(drive.applicationDeadline) !== "open") return false;
  
  // Check department eligibility
  const eligibleDeptIds: string[] = JSON.parse(drive.eligibleDepartments);
  if (!eligibleDeptIds.includes(student.departmentId)) return false;
  
  // Check CGPA requirement
  if (student.academic.currentCGPA < drive.minCGPA) return false;
  
  // Check backlogs limit
  if (student.academic.activeBacklogs > drive.maxActiveBacklogs) return false;
  
  return true;
}
```

### Query-Level Filtering

For performance, eligibility should be enforced at query level where possible:

```typescript
// Example: Get eligible drives for student
const drives = await prisma.drive.findMany({
  where: {
    applicationDeadline: { gt: new Date() }, // Open drives only
    minCGPA: { lte: student.academic.currentCGPA },
    maxActiveBacklogs: { gte: student.academic.activeBacklogs },
    eligibleDepartments: { contains: student.departmentId }, // JSON contains check
  },
});

// Then verify each drive's eligibleDepartments array properly
const fullyEligible = drives.filter(drive => {
  const deptIds: string[] = JSON.parse(drive.eligibleDepartments);
  return deptIds.includes(student.departmentId);
});
```

---

## 6. Department Admin Operations

### Authorization Pattern

Every department admin drive operation must verify:

```typescript
const { user, admin, department } = await requireDepartmentAdmin();
// Now we have: authenticated user, valid admin record, active department
```

### Create Drive

**Requirements:**
- Authenticated `DEPT_ADMIN`
- Valid department association
- Drive automatically associated with admin's department
- All fields validated

**Security:**
- Cannot create drive for another department
- Department ID comes from authenticated admin, not client

### View Drives

**Requirements:**
- Authenticated `DEPT_ADMIN`
- Returns only drives from admin's own department
- Paginated results
- Status calculated dynamically

**Filters:**
- All drives (active + past)
- Open drives only
- Closed drives only
- Search by company/role

### Edit Drive

**Requirements:**
- Authenticated `DEPT_ADMIN`
- Drive belongs to admin's department
- Verify ownership before allowing edit
- Cannot change drive's department

**Security:**
- Cannot edit another department's drive
- Drive ownership verified server-side

### View Drive Detail

**Requirements:**
- Authenticated `DEPT_ADMIN`
- Drive belongs to admin's department

---

## 7. Student Operations

### View Eligible Drives List

**Requirements:**
- Authenticated `STUDENT`
- Student has completed academic profile
- Returns only eligible drives (server-side filtered)
- Paginated results

**Filters:**
- Active (open) drives only (default)
- All drives (including closed)
- Search by company/role

**Response:**
- Drive summary info
- Package, company, role
- Application deadline
- Status (calculated)
- Eligibility is implicit (only eligible drives returned)

### View Drive Detail

**Requirements:**
- Authenticated `STUDENT`
- Student must be eligible for the drive
- Re-check eligibility server-side

**Security:**
- Cannot view ineligible drive by changing URL
- Eligibility verified on every detail request
- Returns 403 if not eligible

### Drive Search

**Requirements:**
- Search by company name or role name
- Case-insensitive partial match
- Still applies eligibility filtering
- Still applies status filtering

---

## 8. Pagination

### Standard Format

All drive list endpoints use offset pagination:

```typescript
interface DrivePaginationParams {
  page?: number;      // Default 1
  pageSize?: number;  // Default 25
  status?: "open" | "closed" | "all"; // Default "open"
  search?: string;    // Optional search term
}

interface DrivePaginatedResponse {
  data: Drive[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}
```

### Implementation

- Default page size: 25
- Page numbers: 1-indexed
- Include `totalCount` for UI pagination controls
- Include `hasMore` boolean for infinite scroll support

---

## 9. Job Description PDF Upload

### Architecture

**Storage**: Vercel Blob (same as profile photos)  
**Database**: Store URL reference only in `Drive.jobDescriptionUrl`  
**Validation**: File type, file size

### Upload Flow

1. Admin selects PDF file (client)
2. Client uploads to dedicated upload API route
3. API route validates file (type, size)
4. API route uploads to Vercel Blob
5. API route returns Blob URL
6. Client includes URL in drive creation/update payload
7. Server action saves URL in database

### Validation

- File types: `application/pdf` only
- Max size: 10MB
- Authenticated upload (DEPT_ADMIN only)

### API Route

```
POST /api/drives/job-description
- Requires authentication
- Requires DEPT_ADMIN role
- Verifies department admin association
- Returns Blob URL
```

---

## 10. Validation

### Drive Validation Schema

```typescript
const driveSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  roleName: z.string().min(1, "Role name is required").max(200),
  jobDescriptionUrl: z.string().url().optional(),
  packageOffered: z.number().positive("Package must be positive"),
  selectionRounds: z.array(z.string().min(1)).min(1, "At least one round required"),
  driveDate: z.string().min(1, "Drive date is required"),
  applicationDeadline: z.string().min(1, "Application deadline is required"),
  applyMethod: z.enum(["IN_APP", "EXTERNAL"]),
  externalApplyUrl: z.string().url().optional(),
  minCGPA: z.number().min(0, "CGPA cannot be negative").max(10, "CGPA cannot exceed 10"),
  maxActiveBacklogs: z.number().int().min(0, "Backlogs cannot be negative"),
  eligibleDepartments: z.array(z.string().min(1)).min(1, "At least one department required"),
}).refine(
  (data) => {
    if (data.applyMethod === "EXTERNAL") {
      return !!data.externalApplyUrl;
    }
    return true;
  },
  {
    message: "External URL required when apply method is EXTERNAL",
    path: ["externalApplyUrl"],
  }
).refine(
  (data) => {
    const driveDate = new Date(data.driveDate);
    const deadline = new Date(data.applicationDeadline);
    return deadline < driveDate;
  },
  {
    message: "Application deadline must be before drive date",
    path: ["applicationDeadline"],
  }
);
```

### Validation Rules

1. **Required Fields**: All marked as required must be provided
2. **CGPA Range**: 0-10 (Indian system)
3. **Package**: Positive number (in LPA)
4. **Rounds**: At least one selection round
5. **Departments**: At least one eligible department
6. **Dates**: Application deadline must be before drive date
7. **External URL**: Required when applyMethod is EXTERNAL

---

## 11. Authorization

### Department Admin

**Every drive operation must verify:**

```typescript
// 1. Authentication & Role
const { user, admin, department } = await requireDepartmentAdmin();

// 2. For edit operations, verify drive ownership
const drive = await prisma.drive.findUnique({ where: { id: driveId } });
if (!drive || drive.departmentId !== department.id) {
  throw new AuthorizationError("Drive not found or access denied");
}
```

### Student

**Every drive access must verify:**

```typescript
// 1. Authentication & Role
const { user, student } = await requireStudent();

// 2. For drive detail, verify eligibility
const drive = await prisma.drive.findUnique({ where: { id: driveId } });
if (!drive) {
  throw new Error("Drive not found");
}

if (!isStudentEligibleForDrive(student, drive)) {
  throw new AuthorizationError("You are not eligible for this drive");
}
```

### Security Rules

1. Never trust client-provided IDs (departmentId, studentId)
2. Always get IDs from authenticated session
3. Verify ownership/eligibility on every operation
4. Return generic errors for unauthorized access (don't leak info)

---

## 12. File Structure

```
features/
  drives/
    actions/
      create-drive.ts          // Admin: Create drive
      update-drive.ts          // Admin: Update drive
      get-admin-drives.ts      // Admin: List own department drives
    queries/
      get-eligible-drives.ts   // Student: List eligible drives
      get-drive-detail.ts      // Universal: Get drive detail
      drive-eligibility.ts     // Eligibility check functions
    schemas/
      drive.ts                 // Zod validation schemas
    utils/
      drive-status.ts          // getDriveStatus() function
    __tests__/
      drive-eligibility.test.ts
      drive-status.test.ts
      drive-crud.test.ts
      
lib/
  drives.ts                    // Shared drive utilities (if needed)
  
components/
  drives/
    DriveCard.tsx             // Drive card for lists
    DriveDetailView.tsx       // Drive detail display
    DriveForm.tsx             // Admin: Create/edit form
    DriveFilters.tsx          // Filter controls
    
app/
  (student)/
    student-dashboard/
      drives/
        page.tsx              // Student: Eligible drives list
        [driveId]/
          page.tsx            // Student: Drive detail
  (admin)/
    admin-dashboard/
      drives/
        page.tsx              // Admin: Manage drives list
        new/
          page.tsx            // Admin: Create drive
        [driveId]/
          edit/
            page.tsx          // Admin: Edit drive
  api/
    drives/
      job-description/
        route.ts              // Upload JD PDF to Blob
```

---

## 13. UI Implementation

### Design System

Follow existing CampusHire theme:
- Light-only interface
- Warm paper background (`--surface-0`)
- Terracotta accent (`--accent`)
- Card-based layouts
- Tabler icons
- 8px/12px border radius

### Student Drive List

**Layout:**
- Card grid or list view
- Each card shows: company, role, package, deadline, status badge
- Filters: Active/All, Search
- Pagination controls at bottom

**Drive Card:**
- Company name (heading)
- Role name (subheading)
- Package (LPA)
- Application deadline with status badge
- "View Details" button

**Status Badges:**
- Open: Green/teal badge
- Closed: Gray badge

### Student Drive Detail

**Layout:**
- Full drive information
- Company, role, package details
- Eligibility criteria displayed
- Selection rounds list
- Job description PDF link (if available)
- Application deadline prominently displayed
- Apply button (disabled for now, shows "Applications coming soon")

### Admin Drive List

**Layout:**
- Table view
- Columns: Company, Role, Package, Deadline, Status, Actions
- Filters: All/Active/Closed, Search
- "Create New Drive" button at top
- Pagination controls

**Actions:**
- Edit button (opens edit form)
- View button (opens detail view)

### Admin Drive Form

**Layout:**
- Multi-section form
- Basic Info: Company, role, package
- Schedule: Drive date, deadline
- Eligibility: CGPA, backlogs, departments (multi-select)
- Selection Rounds: Dynamic list (add/remove rounds)
- Job Description: File upload dropzone
- Apply Method: Radio buttons (In-app/External)
- External URL field (shown if External selected)
- Save/Cancel buttons

---

## 14. Testing

### Test Coverage

Create tests in `features/drives/__tests__/`:

**Drive Status Tests:**
- `drive-status.test.ts`
  - Drive with future deadline is "open"
  - Drive with past deadline is "closed"
  - Drive with current date/time is handled correctly

**Eligibility Tests:**
- `drive-eligibility.test.ts`
  - Student meeting all criteria is eligible
  - Student below CGPA requirement is not eligible
  - Student exceeding backlogs limit is not eligible
  - Student from non-eligible department is not eligible
  - Student without academic record is not eligible
  - Closed drive returns not eligible

**Drive CRUD Tests:**
- `drive-crud.test.ts`
  - Department admin can create drive
  - Department admin can view own drives
  - Department admin cannot view other department's drives
  - Student can view eligible drives only
  - Student cannot view ineligible drive detail
  - Validation rejects invalid drive data

**Authorization Tests:**
- Unauthenticated requests rejected
- Student cannot create drives
- Admin cannot access other department drives
- Student cannot access ineligible drives

---

## 15. Database Changes

### New Models

**Drive Model:**
- Core drive information
- Eligibility criteria
- Department relation

**ApplyMethod Enum:**
- IN_APP
- EXTERNAL

### Relations

```
Department ──┐
             ├──< Drive
             │
Student ─────┘

(Future: Drive ──< DriveApplication >── Student)
```

### Indexes

- `Drive.departmentId` - For admin queries
- `Drive.applicationDeadline` - For status filtering

### Migration

Create migration:
```bash
npx prisma migrate dev --name add_drive_model
```

---

## 16. Environment Variables

No new environment variables required for Unit 05.

Existing Blob token used for JD PDF uploads:
- `BLOB_READ_WRITE_TOKEN` (already added in Unit 04)

---

## 17. Error Handling

### Common Cases

**Unauthenticated:**
- Redirect to /sign-in via middleware

**Wrong Role:**
- Student accessing admin routes: Reject with 403
- Admin accessing student routes: Redirect to admin dashboard

**Invalid Drive ID:**
- Return 404 with generic message

**Ineligible Drive Access:**
- Return 403 with "You are not eligible for this drive"

**Department Scope Violation:**
- Return 403 with "Access denied"

**Invalid Input:**
- Return Zod validation errors
- Display field-level errors in form

**File Upload Failure:**
- Return error to client
- Do not save invalid URL
- Allow retry

---

## 18. Open Questions

1. **Drive Deletion**: Should department admins be able to delete drives? Or only edit?
   - Current: No deletion (can edit/close by changing deadline)
   - Future: May add soft delete if needed

2. **Multi-Department Drives**: Can a single drive be posted to multiple departments?
   - Current: Drive belongs to posting department, but can be eligible for multiple departments
   - Eligible departments are in JSON array

3. **Drive Templates**: Should admins be able to save drive templates?
   - Out of scope for V1

4. **Drive Analytics**: View applicant statistics, department-wise breakdown?
   - Out of scope for V1, part of future analytics feature

---

## 19. Success Criteria

### Drive Management

✅ Department admin can create drive with all fields  
✅ Department admin can view own department drives  
✅ Department admin can edit own department drives  
✅ Department admin cannot access other department drives  
✅ Job description PDF uploads to Blob  
✅ Drive data validates correctly  

### Eligibility

✅ Eligibility rules enforce CGPA, backlogs, department  
✅ Eligibility checked server-side on all operations  
✅ Student cannot access ineligible drive by URL manipulation  
✅ Open/closed status calculated correctly  

### Student Access

✅ Student sees only eligible drives in list  
✅ Student can view detail of eligible drive  
✅ Student cannot view ineligible drive detail  
✅ Search and filters work correctly  
✅ Pagination works as expected  

### Authorization

✅ All operations require proper authentication  
✅ Role-based access enforced  
✅ Department scope enforced for admins  
✅ Eligibility enforced for students  

### Code Quality

✅ TypeScript compilation passes  
✅ ESLint passes  
✅ All tests pass  
✅ Build succeeds  

---

## 20. Out of Scope (Explicit)

Do NOT implement:

- Student applications to drives
- Application submission flow
- Application tracking
- Application status
- Application history
- Duplicate application prevention
- Drive application counts
- Excel/CSV bulk student import
- Department/admin management
- Audit logging for drive operations
- Email notifications
- Drive templates
- Drive analytics/reports
- Resume submission
- AI features
- Multi-college support

This unit is ONLY:
**Drive Management + Eligibility System + Eligible Drive Listing**

---

## Summary

Unit 05 implements the complete drive management and eligibility system. Department admins can post drives with detailed eligibility criteria, and students can browse/view only the drives they qualify for based on server-side eligibility enforcement. The system ensures department-scoped access control and automatic drive status calculation based on application deadlines.
