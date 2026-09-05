# Unit 08 — Department & Admin Account Management

## Overview

This unit implements the administrative foundation for CampusHire by enabling Super Admins to manage departments and Department Admin accounts. It provides CRUD operations for departments, Department Admin account assignment/management, strict role enforcement, and department-level access control.

## Primary Objective

Implement Super Admin capabilities for:

1. **Department Management** — Create, view, update, activate/deactivate departments
2. **Admin Account Management** — Assign users as Department Admins with department scope
3. **Authorization Enforcement** — Strict server-side validation of Super Admin permissions
4. **Department Scoping** — Enforce department-level access control across all operations
5. **Cross-Department Protection** — Prevent Department Admins from accessing other departments

This establishes the administrative foundation required by all other modules while preserving the core security invariant:

**ROLE + DEPARTMENT SCOPE MUST ALWAYS BE VERIFIED SERVER-SIDE**

## Database Schema

### Existing Models (No Changes Required)

The database schema for this unit already exists from Units 01-03:

#### Department Model

```prisma
model Department {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  admins   DepartmentAdmin[]
  students Student[]
  drives   Drive[]

  @@index([code])
}
```

**Fields:**
- `name` — Full department name (e.g., "Computer Science")
- `code` — Short unique identifier (e.g., "CS", "ECE") — case-sensitive, used in UI
- `isActive` — Soft delete flag; inactive departments are hidden from most operations
- Relations to admins, students, and drives

#### DepartmentAdmin Model

```prisma
model DepartmentAdmin {
  id           String     @id @default(cuid())
  userId       String     @unique
  departmentId String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Relations
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  department Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@index([departmentId])
}
```

**Relationship Rules:**
- One User can have at most one DepartmentAdmin record (1:1)
- One Department can have many DepartmentAdmins (1:M)
- A Department Admin belongs to exactly one department
- Cascade delete: deleting User → deletes DepartmentAdmin; deleting Department → deletes DepartmentAdmin

**No schema changes required** — Unit 08 uses the existing models.

## Department Management

### Department Creation

**Authorization:** SUPER_ADMIN only

**Input Validation:**
```typescript
{
  name: string;      // 1-100 characters, non-empty trimmed
  code: string;      // 2-10 characters, uppercase letters/numbers only, unique
  isActive: boolean; // optional, defaults to true
}
```

**Business Rules:**
1. Department code must be unique (case-sensitive)
2. Department code is normalized to uppercase before storage
3. Duplicate codes are rejected with user-friendly error
4. Name must be non-empty after trimming
5. Created departments default to active

**Error Handling:**
- Duplicate code → "A department with code '{code}' already exists"
- Invalid input → Specific field validation errors
- Unauthorized → "Only Super Admins can create departments"

### Department List

**Authorization:** SUPER_ADMIN only

**Query Parameters:**
```typescript
{
  page: number;      // default: 1, min: 1
  pageSize: number;  // default: 25, min: 1, max: 100
  includeInactive: boolean; // optional, default: false
}
```

**Response:**
```typescript
{
  data: Department[];
  page: number;
  pageSize: number;
  totalCount: number;
}
```

**Behavior:**
- Default: returns only active departments
- `includeInactive=true`: returns all departments
- Ordered by: `name` ASC
- Includes counts: admins, students, drives per department

### Department Detail

**Authorization:** SUPER_ADMIN only

**Returns:**
- Full department record
- Admin count
- Student count
- Drive count
- List of assigned admins with user details

### Department Update

**Authorization:** SUPER_ADMIN only

**Updateable Fields:**
- `name` — Full department name
- `code` — Department code (validates uniqueness)
- `isActive` — Active/inactive status

**Business Rules:**
1. Code changes must maintain uniqueness
2. Updating `isActive` does not delete related records
3. Cannot update code to match another department's code

**Not Allowed:**
- Deleting department with existing students/drives/admins (see Deactivation)
- Changing `createdAt` or system timestamps

### Department Activation/Deactivation

**Authorization:** SUPER_ADMIN only

**Deactivation Effects:**
- Department hidden from most lists (unless `includeInactive=true`)
- Department Admins cannot create new drives
- Students cannot register to inactive department
- Existing students/drives/applications remain intact
- Department Admin access to existing data maintained
- **No cascading deletion** — preserves historical data

**Activation Effects:**
- Department visible in active lists
- Department Admins regain full capabilities
- Student registration enabled

**Business Rules:**
- Deactivation is **soft delete** — never destructive
- Cannot hard-delete departments with related records
- Inactive departments still count in admin/student/drive totals

## Department Admin Management

### Admin Assignment Workflow

**Authorization:** SUPER_ADMIN only

**Conceptual Flow:**
```
1. Super Admin selects existing CampusHire User
2. System verifies user eligibility:
   - User exists in database
   - User does NOT already have DEPT_ADMIN role
   - User does NOT already have DepartmentAdmin record
3. Super Admin selects target Department
4. System validates:
   - Department exists
   - Department is active
5. Server performs atomic operation:
   - Update User.role to DEPT_ADMIN
   - Create DepartmentAdmin record linking user to department
   - Sync role to Clerk metadata
6. Department Admin can now access department-scoped resources
```

**Input Validation:**
```typescript
{
  userId: string;       // Valid CUID, must exist
  departmentId: string; // Valid CUID, must exist and be active
}
```

### Admin Assignment Rules

**Allowed:**
- Assigning STUDENT user as DEPT_ADMIN (upgrades role)
- Assigning user with no prior role assignments

**Forbidden:**
- Assigning SUPER_ADMIN as DEPT_ADMIN (role protection)
- Assigning user who already has DepartmentAdmin record (duplicate)
- Assigning to inactive department
- Assigning non-existent users or departments

**Error Messages:**
- User not found → "User not found"
- Department not found → "Department not found"
- Department inactive → "Cannot assign admin to inactive department"
- Already assigned → "User is already assigned as Department Admin"
- Super Admin protection → "Cannot assign Super Admin to department admin role"

### Admin List

**Authorization:** SUPER_ADMIN only

**Query Parameters:**
```typescript
{
  page: number;           // default: 1
  pageSize: number;       // default: 25
  departmentId?: string;  // optional filter by department
}
```

**Response:**
```typescript
{
  data: Array<{
    id: string;
    user: {
      id: string;
      email: string;
      clerkId: string;
    };
    department: {
      id: string;
      name: string;
      code: string;
      isActive: boolean;
    };
    createdAt: Date;
  }>;
  page: number;
  pageSize: number;
  totalCount: number;
}
```

**Behavior:**
- Returns all DepartmentAdmin assignments
- Optionally filter by specific department
- Includes user and department details
- Ordered by: `createdAt` DESC (newest first)

### Admin Removal

**Authorization:** SUPER_ADMIN only

**Input:**
```typescript
{
  userId: string; // User ID of the admin to remove
}
```

**Behavior:**
1. Finds DepartmentAdmin record for user
2. Deletes DepartmentAdmin record
3. Updates User.role to STUDENT (safe default)
4. Syncs role change to Clerk metadata
5. **Does NOT delete** Clerk identity
6. **Does NOT delete** CampusHire User record
7. Former admin loses department access immediately

**Business Rules:**
- Only removes admin assignment, not user identity
- User can be re-assigned to same or different department later
- Historical data created by admin remains intact
- Cannot remove Super Admin accounts

### Department Scope Resolution

**Authorization Pattern:**

All Department Admin operations resolve scope as:

```
Authenticated Clerk User
        ↓
CampusHire User (requireAuth)
        ↓
Verify role = DEPT_ADMIN (requireDepartmentAdmin)
        ↓
Resolve DepartmentAdmin record
        ↓
Extract departmentId
        ↓
Query resources with WHERE departmentId = ?
```

**Never:**
```
Authenticated User
        ↓
Client-provided departmentId
        ↓
Database query
```

The latter is **forbidden** and creates IDOR vulnerabilities.

## Authorization Model

### Role Hierarchy

```
SUPER_ADMIN
  - Full system access
  - Manage all departments
  - Manage all admin accounts
  - View all data across departments
  
DEPT_ADMIN
  - Scoped to single department
  - Manage own department's students
  - Create drives for own department
  - View own department's applications
  - CANNOT access other departments
  - CANNOT change own department scope
  
STUDENT
  - View own profile
  - Apply to eligible drives
  - View own applications
  - CANNOT access admin functions
```

### Permission Matrix

| Action | SUPER_ADMIN | DEPT_ADMIN | STUDENT |
|--------|-------------|------------|---------|
| Create Department | ✅ | ❌ | ❌ |
| Update Department | ✅ | ❌ | ❌ |
| Deactivate Department | ✅ | ❌ | ❌ |
| List All Departments | ✅ | ❌ | ❌ |
| Assign Department Admin | ✅ | ❌ | ❌ |
| Remove Department Admin | ✅ | ❌ | ❌ |
| List All Admins | ✅ | ❌ | ❌ |
| View Own Department | ❌ | ✅ | ❌ |
| Manage Own Dept Students | ❌ | ✅ | ❌ |
| Create Drives | ❌ | ✅ | ❌ |
| View Own Profile | ❌ | ❌ | ✅ |
| Apply to Drives | ❌ | ❌ | ✅ |

### Security Boundaries

**Enforced Server-Side:**

1. **Authentication** — All operations require valid Clerk session
2. **Role Verification** — Database role checked on every request
3. **Department Scope** — Department Admin queries always filtered by their department
4. **Cross-Department Protection** — Dept Admin A cannot access Dept B's resources
5. **Client Mistrust** — Never trust role/department from client input

**Test Cases Required:**
- Unauthenticated user blocked from all operations
- Student cannot create departments
- Dept Admin cannot create departments
- Dept Admin cannot view other department's students
- Dept Admin cannot change own department assignment
- Client-supplied departmentId cannot bypass server scope
- Super Admin cannot be downgraded to Dept Admin

## Reusable Authorization Helpers

### Existing Helpers (lib/auth.ts)

Already implemented:
- `requireSuperAdmin()` — Throws if not SUPER_ADMIN
- `requireDepartmentAdmin()` — Returns admin context with department
- `canAccessDepartment(departmentId)` — Checks if user can access department
- `requireDepartmentAccess(departmentId)` — Throws if cannot access
- `getCurrentUser()` — Gets authenticated user
- `requireAuth()` — Throws if not authenticated

### No New Helpers Needed

Unit 08 uses existing authorization infrastructure. No additional helpers required.

## Server Actions & Data Access

### Feature Structure

```
features/departments/
├── actions/
│   ├── create-department.ts
│   ├── update-department.ts
│   ├── toggle-department-status.ts
├── queries/
│   ├── get-departments.ts
│   ├── get-department-detail.ts
│   └── get-department-stats.ts
├── schemas/
│   └── department.ts
└── __tests__/
    ├── department-crud.test.ts
    └── department-security.test.ts

features/admin-accounts/
├── actions/
│   ├── assign-department-admin.ts
│   └── remove-department-admin.ts
├── queries/
│   ├── get-department-admins.ts
│   └── get-available-users.ts
├── schemas/
│   └── admin.ts
└── __tests__/
    ├── admin-assignment.test.ts
    └── admin-security.test.ts
```

### Validation Schemas

**Department Schema:**
```typescript
const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(2).max(10).regex(/^[A-Z0-9]+$/),
  isActive: z.boolean().default(true),
});

const updateDepartmentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(2).max(10).regex(/^[A-Z0-9]+$/).optional(),
  isActive: z.boolean().optional(),
});
```

**Admin Assignment Schema:**
```typescript
const assignAdminSchema = z.object({
  userId: z.string().cuid(),
  departmentId: z.string().cuid(),
});

const removeAdminSchema = z.object({
  userId: z.string().cuid(),
});
```

**Pagination Schema:**
```typescript
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
```

## Error Handling

### Error Types

**Authentication Errors:**
- Not authenticated → "You must be signed in"
- Session expired → "Your session has expired, please sign in again"

**Authorization Errors:**
- Wrong role → "Only Super Admins can perform this action"
- Insufficient permissions → "You do not have permission to access this resource"

**Validation Errors:**
- Invalid input → Field-specific error messages
- Missing required fields → "Field '{name}' is required"

**Business Logic Errors:**
- Duplicate code → "A department with code '{code}' already exists"
- Not found → "Department not found"
- Already assigned → "User is already assigned as Department Admin"
- Role conflict → "Cannot assign Super Admin to department admin role"

**Database Errors:**
- Constraint violation → Translated to user-friendly message
- Connection error → "Database temporarily unavailable, please try again"

### Error Response Format

```typescript
// Success
{ success: true, data: T }

// Failure
{ success: false, error: string }
```

Never expose:
- SQL queries
- Prisma stack traces
- Internal exception details
- Database constraint names
- Clerk credentials

## UI Components

### Department Management Page

**Route:** `app/(super-admin)/departments/page.tsx`

**Features:**
- Department list with pagination
- Create new department button + dialog
- Edit department button per row
- Activate/Deactivate toggle
- Show admin count, student count, drive count per department
- Filter: Show active only / Show all
- Empty state for no departments

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Departments                     [+ New Dept]    │
├─────────────────────────────────────────────────┤
│ ☑ Show inactive departments                     │
├─────────────────────────────────────────────────┤
│ Name          Code  Admins  Students  Drives    │
│ Computer Sci  CS    2       150       8    [Edit]│
│ Electronics   ECE   1       120       5    [Edit]│
│ Mechanical    MECH  1       90        3    [Edit]│
└─────────────────────────────────────────────────┘
         [Previous]  Page 1 of 3  [Next]
```

### Admin Account Management Page

**Route:** `app/(super-admin)/admin-accounts/page.tsx`

**Features:**
- Admin assignment list with pagination
- Assign new admin button + dialog
- Remove admin button per row
- Filter by department
- Show user email, department, assigned date
- Confirmation dialog for removal

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Department Admins           [+ Assign Admin]    │
├─────────────────────────────────────────────────┤
│ Filter by Department: [All Departments ▼]       │
├─────────────────────────────────────────────────┤
│ Email              Department      Assigned      │
│ admin@college.edu  Computer Sci    2024-01-15   │
│                                           [Remove]│
│ admin2@college.edu Electronics     2024-02-20   │
│                                           [Remove]│
└─────────────────────────────────────────────────┘
         [Previous]  Page 1 of 2  [Next]
```

### Create/Edit Department Dialog

**Fields:**
- Department Name (text input)
- Department Code (text input, uppercase)
- Active Status (checkbox, default: true)

**Validation:**
- Real-time field validation
- Error messages below fields
- Submit button disabled until valid

### Assign Admin Dialog

**Fields:**
- Select User (dropdown/search, filtered by non-admin users)
- Select Department (dropdown, active departments only)

**Workflow:**
1. Search/select user by email
2. Select department
3. Confirm assignment
4. Show success message

## Testing

### Unit Tests

**Department CRUD (12 tests):**
1. ✅ Super Admin can create department
2. ✅ Duplicate code is rejected
3. ✅ Invalid code format is rejected
4. ✅ Super Admin can update department
5. ✅ Code update maintains uniqueness
6. ✅ Super Admin can activate department
7. ✅ Super Admin can deactivate department
8. ✅ Deactivation preserves related records
9. ✅ Department list pagination works
10. ✅ Department list filters inactive correctly
11. ✅ Department detail includes counts
12. ✅ Department not found handled

**Admin Assignment (13 tests):**
13. ✅ Super Admin can assign valid user
14. ✅ Student can be upgraded to Dept Admin
15. ✅ Duplicate assignment is rejected
16. ✅ Super Admin cannot be assigned as Dept Admin
17. ✅ Invalid user ID is rejected
18. ✅ Invalid department ID is rejected
19. ✅ Cannot assign to inactive department
20. ✅ Admin has exactly one department
21. ✅ Super Admin can remove admin
22. ✅ Removal changes role to STUDENT
23. ✅ Removal preserves User record
24. ✅ Admin list pagination works
25. ✅ Admin list filters by department

**Security (10 tests):**
26. ✅ Unauthenticated blocked from all operations
27. ✅ Student cannot create department
28. ✅ Student cannot update department
29. ✅ Student cannot assign admin
30. ✅ Dept Admin cannot create department
31. ✅ Dept Admin cannot update other department
32. ✅ Dept Admin cannot assign admin
33. ✅ Dept Admin cannot access other department
34. ✅ Client departmentId cannot override scope
35. ✅ Dept Admin cannot change own department

**Regression (4 tests):**
36. ✅ Existing student operations still work
37. ✅ Existing drive operations still work
38. ✅ Existing application operations still work
39. ✅ Unit 07 schema preserved

**Total: 39 new tests**

### Test Approach

- Mock Prisma Client for database calls
- Mock Clerk for authentication
- Test pure business logic functions
- Verify authorization before and after operations
- Test both success and failure paths
- Verify error messages are user-friendly

## Migration Status

**No migration required** — Department and DepartmentAdmin models already exist from Unit 02A.

**Verification:**
- ✅ `npx prisma validate` — Schema valid
- ✅ `npx prisma generate` — Client generated
- ✅ Database schema up to date

## Environment Variables

**No new environment variables required** — Uses existing:
- `DATABASE_URL` — PostgreSQL connection
- `CLERK_SECRET_KEY` — For Clerk API calls
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — For Clerk client

## Compatibility

### Unit 07 Compatibility

**Preserves pending student pattern:**
- `Student.userId` remains optional
- `Student.email` remains unique
- `Student.isPending` remains functional

**Department management compatible with bulk import:**
- Inactive departments prevent new student registration
- Pending students remain assigned to departments
- Deactivation does not delete pending students

### Existing Unit Compatibility

**Unit 04 (Student Registration):**
- Students can only register to active departments
- Department selection filtered by `isActive = true`

**Unit 05 (Drive Management):**
- Dept Admins can only create drives for own department
- Drive creation blocked if department inactive

**Unit 06 (Applications):**
- Applications remain valid even if department deactivated
- Historical data preserved

## Performance

**Database Queries:**
- Department list: Single query with counts (optimized join)
- Admin list: Single query with user + department (optimized join)
- Detail views: Use `include` for related data
- Pagination: Use `skip` and `take` with `count`

**No Caching:**
- Department data changes infrequently
- Admin assignments change infrequently
- Database queries sufficiently fast
- Premature optimization avoided

## Out of Scope

**Explicitly NOT Implemented:**
- Excel/CSV bulk import production code
- Audit logging system (deferred to Unit 09)
- Email notifications
- Department-level settings/configuration
- Multi-role users
- Dept Admin self-service department changes
- Hard deletion of departments
- Historical admin assignment tracking

## Assumptions & Open Questions

### Assumptions Made

1. **Department code format:** Uppercase alphanumeric only (e.g., "CS", "ECE", "MECH")
2. **Role change default:** Removed admins revert to STUDENT role (safe default)
3. **Inactive department behavior:** Blocks new operations, preserves existing data
4. **Admin removal:** Does not delete user identity, only removes admin assignment
5. **Code case sensitivity:** Department codes are case-sensitive and normalized to uppercase

### Open Questions

1. **Email notifications:** Should admins receive email when assigned/removed? → Deferred to future
2. **Department deletion:** Should hard deletion ever be allowed? → No, only deactivation
3. **Admin approval workflow:** Should new admins require approval? → No, immediate assignment
4. **Multi-department admins:** Should one user manage multiple departments? → No, one department per admin
5. **Department hierarchy:** Should departments have parent/child relationships? → No, flat structure

## Success Criteria

- [ ] Super Admin can create, update, activate/deactivate departments
- [ ] Department code uniqueness enforced
- [ ] Super Admin can assign users as Department Admins
- [ ] Admin assignment validates role conflicts
- [ ] Super Admin can remove Department Admin assignments
- [ ] Dept Admin has exactly one department scope
- [ ] Dept Admin cannot access other departments
- [ ] Unauthenticated/Student/Dept Admin blocked from Super Admin operations
- [ ] Department deactivation preserves historical data
- [ ] All 39 tests passing
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes
- [ ] Production build succeeds
- [ ] Unit 07 schema preserved
- [ ] Existing units remain functional

## Implementation Order

1. ✅ Read all context files
2. ✅ Inspect Prisma schema
3. ✅ Verify migration status
4. ✅ Create specification
5. Implement department schemas
6. Implement department queries
7. Implement department actions
8. Implement admin schemas
9. Implement admin queries
10. Implement admin actions
11. Create department tests
12. Create admin tests
13. Create security tests
14. Run regression tests
15. Implement Super Admin UI
16. Verify all operations
17. Update progress tracker
18. Final security review

## Next Steps After Unit 08

After completing Unit 08, the recommended next modules are:

1. **Unit 05 UI** — Department Admin dashboard and drive management UI
2. **Unit 09** — Audit logging system (depends on admin accounts)
3. **Unit 07 Implementation** — Excel/CSV bulk import production code (optional)
4. **Unit 04 UI** — Student registration and profile management UI

Unit 08 provides the administrative foundation required by all future modules.
