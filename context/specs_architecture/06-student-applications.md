# Unit 06 — Student Applications & Application Management

## Purpose

Implement the complete student application workflow for CampusHire, allowing students to apply to eligible drives with comprehensive server-side enforcement of all business rules.

## Scope

### In Scope
- DriveApplication database model with unique constraint
- Server-side application creation with full security checks
- Student application history (own applications only)
- Eligibility re-checking on apply
- Deadline enforcement on apply
- Duplicate prevention at database level
- Authorization and ownership enforcement
- Pagination for application lists
- Tests proving all security boundaries

### Out of Scope
- Application editing/updating
- Application withdrawal/deletion
- Resume file uploads
- Application status workflow (beyond drive status)
- Department admin application viewing
- Application export/reporting
- Email notifications
- Interview scheduling
- Offer management

## Application Lifecycle

1. **Student views eligible drives** (drives they qualify for)
2. **Student opens drive details** (sees eligibility, deadline, etc.)
3. **Student clicks "Apply"** (if eligible and drive is open)
4. **Server validates application**:
   - Authenticated student role
   - Student ownership (cannot apply for another student)
   - Drive exists
   - Eligibility criteria met (re-checked server-side)
   - Application deadline not passed (re-checked server-side)
   - No existing application (checked at app level and DB constraint)
5. **Application created** (immutable record)
6. **Student views application history** (own applications only)

## Database Model

### DriveApplication

```prisma
model DriveApplication {
  id           String   @id @default(cuid())
  studentId    String
  driveId      String
  appliedAt    DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  drive   Drive   @relation(fields: [driveId], references: [id], onDelete: Restrict)

  @@unique([studentId, driveId])
  @@index([studentId])
  @@index([driveId])
}
```

**Key Constraints:**
- `@@unique([studentId, driveId])` — database-level duplicate prevention
- `onDelete: Cascade` on student — if student deleted, applications deleted
- `onDelete: Restrict` on drive — cannot delete drive with applications

**Rejected Fields:**
- No `status` field (drive status calculated via getDriveStatus())
- No `resume` field (out of scope)
- No `score` field (out of scope)
- No `interviewDate` field (out of scope)

## Business Rules

### RULE 1: Authenticated Student Only
- Only authenticated users with role=STUDENT can create applications
- Verified server-side via `requireStudent()` from lib/auth.ts
- DEPT_ADMIN, SUPER_ADMIN, unauthenticated users rejected

### RULE 2: Student Ownership
- Student can only apply for themselves
- Never accept studentId from client
- Resolve student from authenticated user server-side
- Prevents IDOR-style attacks

### RULE 3: Drive Existence
- Verify drive exists before applying
- Return safe not-found error if drive missing
- No database internals exposed

### RULE 4: Eligibility Re-Check
- **CRITICAL**: Eligibility must be re-checked server-side on apply
- Use existing `isStudentEligibleForDrive()` function
- Never trust client-side eligibility checks
- Protects against URL manipulation, stale page state, direct API calls
- Reject application if any eligibility criterion fails

### RULE 5: Application Deadline
- Verify drive is open using `getDriveStatus(applicationDeadline)`
- Reject applications to closed drives
- Never trust client-side deadline checks
- Status calculated dynamically, never stored

### RULE 6: Apply Once (Duplicate Prevention)
- Check for existing application before insert (user experience)
- Database unique constraint `(studentId, driveId)` as authoritative protection
- Handle Prisma unique constraint errors gracefully
- Protects against concurrent requests, double-clicks, race conditions
- Return user-friendly "already applied" error, not raw database error

### RULE 7: No Update/Delete
- DriveApplication records are immutable once created
- No update functionality implemented
- No delete functionality implemented
- No withdrawal functionality implemented

## Server Architecture

### Feature Structure

```
features/applications/
├── actions/
│   └── apply-to-drive.ts          # Application creation mutation
├── queries/
│   ├── get-my-applications.ts     # Student application history
│   └── check-application-exists.ts # Check if already applied
├── schemas/
│   └── application.ts             # Zod validation schemas
└── __tests__/
    ├── apply-to-drive.test.ts     # Application creation tests
    └── application-history.test.ts # Application query tests
```

### Server Actions

#### `applyToDrive(driveId: string)`

Flow:
1. Validate input (driveId is valid cuid)
2. Authenticate via `requireStudent()`
3. Resolve Student record
4. Fetch Drive record (verify exists)
5. Re-run `isStudentEligibleForDrive()` server-side
6. Verify drive is open via `getDriveStatus()`
7. Check for existing application
8. Create DriveApplication via Prisma
9. Handle unique constraint error if occurs (return "already applied")
10. Return success result

**Error Cases:**
- Unauthenticated → authentication error
- Not a student → authorization error
- Student profile missing → profile incomplete error
- Drive not found → not found error
- Student not eligible → eligibility error with reasons
- Drive closed → deadline passed error
- Already applied → duplicate application error
- Database constraint violation → duplicate application error
- Unexpected error → generic server error

#### `getMyApplications({ page, pageSize })`

Flow:
1. Authenticate via `requireStudent()`
2. Resolve Student record
3. Query DriveApplication records for this student only
4. Include related Drive data
5. Apply pagination (offset-based)
6. Return paginated result with totalCount

**Authorization:**
- Student can only see their own applications
- Never returns another student's applications
- Department scoping enforced if student.departmentId used

## Authorization Rules

### Student
- ✅ Can apply to eligible open drives (for themselves only)
- ✅ Can view their own applications
- ❌ Cannot view another student's applications
- ❌ Cannot update applications
- ❌ Cannot delete applications

### Department Admin
- ❌ No application management capabilities in V1
- Future: may view applications for their department's students

### Super Admin
- ❌ No application management capabilities in V1
- Future: may view all applications

## Pagination

All application lists use offset pagination:

```typescript
{
  data: DriveApplication[],
  page: number,
  pageSize: number,
  totalCount: number
}
```

- Default pageSize: 25
- Validate page ≥ 1
- Validate pageSize ≤ 100
- Calculate offset: (page - 1) * pageSize

## Validation

### Input Validation (Zod)

```typescript
// Apply to drive
const applyToDriveSchema = z.object({
  driveId: z.string().cuid()
});

// Get applications
const getApplicationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25)
});
```

## Error Handling

### Error Types

1. **Authentication Error** — user not authenticated
2. **Authorization Error** — user not a student
3. **Profile Incomplete Error** — student profile or academic info missing
4. **Not Found Error** — drive doesn't exist
5. **Eligibility Error** — student doesn't meet criteria
6. **Deadline Error** — application deadline passed
7. **Duplicate Error** — already applied
8. **Server Error** — unexpected database/system error

### Error Messages (User-Safe)

- ❌ Expose: "Prisma unique constraint violation"
- ✅ Return: "You have already applied to this drive"

- ❌ Expose: "Student with id X not found in database"
- ✅ Return: "Student profile not found. Please complete your profile."

- ❌ Expose: SQL errors, stack traces, database internals

## UI Components

### Drive Detail Page
- Shows drive information (company, role, package, etc.)
- Shows eligibility status (eligible/not eligible + reasons)
- Shows drive status (open/closed)
- Shows "Apply" button if:
  - Student is eligible
  - Drive is open
  - Student hasn't applied yet
- Shows "Applied" state if already applied
- Shows ineligibility reasons if not eligible
- Shows "Applications Closed" if deadline passed

### Application Action UX
- Disable button on click (prevent double-click)
- Show loading state during submission
- Handle success: update UI, show confirmation
- Handle already-applied: show appropriate message
- Handle eligibility failure: show reasons
- Handle deadline failure: show closed message
- Re-enable button if error (allow retry)

### Application History Page
- List/table of student's applications
- Each row shows:
  - Company name
  - Role name
  - Applied date
  - Drive status (open/closed)
  - Application deadline
- Pagination controls
- Empty state: "You haven't applied to any drives yet"
- Loading state while fetching
- Error state for fetch failures

## Routing

Applications live in student route group:

```
app/(student)/
├── applications/
│   └── page.tsx              # Application history
└── drives/
    └── [id]/
        └── page.tsx          # Drive detail with apply action
```

## Testing

### Unit Tests Required

1. **Application Creation Tests** (`apply-to-drive.test.ts`):
   - ✅ Student can apply to eligible open drive
   - ✅ Application rejected for unauthenticated user
   - ✅ Application rejected for non-student role
   - ✅ Application rejected if student profile missing
   - ✅ Application rejected if drive not found
   - ✅ Application rejected if student not eligible (CGPA)
   - ✅ Application rejected if student not eligible (backlogs)
   - ✅ Application rejected if student not eligible (department)
   - ✅ Application rejected if drive closed
   - ✅ Application rejected if already applied
   - ✅ Duplicate constraint error handled gracefully
   - ✅ Cannot apply for another student

2. **Application History Tests** (`application-history.test.ts`):
   - ✅ Student can view their own applications
   - ✅ Student cannot see another student's applications
   - ✅ Pagination works correctly
   - ✅ Empty result for student with no applications
   - ✅ Applications include drive information

### Test Approach
- Use Vitest with mocked Prisma
- Mock Clerk authentication
- Focus on business logic and authorization
- No E2E tests (out of scope)

## Implementation Decisions

### Decision 1: No Application Status Field
- **Rationale**: Drive status calculated dynamically via `getDriveStatus()`
- Application doesn't need its own status
- Avoids status synchronization issues

### Decision 2: Immutable Applications
- **Rationale**: Simplifies business logic and audit trail
- Once applied, record is permanent
- No withdrawal/edit complexity
- Matches real-world placement process

### Decision 3: Database Unique Constraint
- **Rationale**: Database is authoritative for duplicate prevention
- Application-level check is UX improvement only
- Protects against race conditions and concurrent requests
- Handles double-click, multiple tabs, direct API calls

### Decision 4: Eligibility Re-Check Required
- **Rationale**: Never trust client-side state
- Student could manipulate URL, page state, or make direct requests
- Server must independently verify all criteria
- Reuses existing `isStudentEligibleForDrive()` function

### Decision 5: Student Ownership Enforcement
- **Rationale**: Prevents IDOR attacks
- Student can only apply for themselves
- Resolve student from authenticated user, never from client input
- Protects against unauthorized application creation

## Environment Variables

No new environment variables required for Unit 06.

## Database Migration

Migration adds:
1. `DriveApplication` model
2. `applications` relation on `Student` model
3. `applications` relation on `Drive` model
4. Unique constraint `(studentId, driveId)`
5. Indexes on `studentId` and `driveId`

Migration name: `student_applications`

## Open Questions

1. **Application notification**: Should students be notified when they successfully apply? → Deferred to future (no email in V1)
2. **Application limit**: Is there a limit on how many drives a student can apply to? → No limit specified, assume unlimited
3. **Department admin access**: Can dept admin view applications for their students? → Deferred to future
4. **Application export**: Can applications be exported for reporting? → Deferred to future
5. **Withdrawal reason**: If withdrawal added later, should reason be required? → N/A (no withdrawal in V1)

## Dependencies

- Unit 03 (Authentication) — uses `requireStudent()`
- Unit 04 (Student Profiles) — requires Student and StudentAcademic records
- Unit 05 (Drives) — uses `isStudentEligibleForDrive()` and `getDriveStatus()`

## Success Criteria

- [ ] DriveApplication model exists with unique constraint
- [ ] Student can apply to eligible open drive
- [ ] Eligibility re-checked server-side on apply
- [ ] Deadline verified server-side on apply
- [ ] Duplicate application prevented (app-level + DB constraint)
- [ ] Student ownership enforced (cannot apply for others)
- [ ] Student can view only their own applications
- [ ] Applications are immutable (no update/delete)
- [ ] Pagination works correctly
- [ ] All tests passing
- [ ] TypeScript compilation passes
- [ ] ESLint passes
- [ ] Build passes
- [ ] Progress tracker updated

## Implementation Notes

- Use existing `lib/auth.ts` helpers for authentication
- Use existing `features/drives/queries/drive-eligibility.ts` for eligibility
- Use existing `features/drives/utils/drive-status.ts` for status
- Follow existing feature structure pattern from `features/students/`
- Use Zod schemas for all input validation
- Handle Prisma errors gracefully (especially unique constraint)
- No business logic in route components
- Keep actions focused and testable
