# Unit 09 — Audit Logging & System Activity

## Overview

This unit implements a centralized, secure audit logging system for CampusHire. The system records important administrative and privileged actions, enabling Super Admins to understand who performed what actions, when, and on which resources.

## Primary Objective

Implement an audit logging system that:

1. **Records important administrative actions** — department management, admin assignments, drive operations, applications
2. **Identifies actors server-side** — never trusts client-provided identity
3. **Maintains immutable records** — audit logs cannot be edited or deleted
4. **Enforces strict authorization** — only Super Admins can view audit logs
5. **Provides queryable history** — paginated, filterable audit trail
6. **Protects sensitive data** — never logs secrets, tokens, or credentials
7. **Integrates seamlessly** — reusable helper for all features

## Database Schema

### AuditLog Model

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String   // Actor who performed the action
  action      String   // Action type (CREATE, UPDATE, DELETE, etc.)
  entityType  String   // Resource type (Department, DepartmentAdmin, Drive, etc.)
  entityId    String?  // Resource identifier (optional for bulk operations)
  metadata    String?  @db.Text // Additional context as JSON (optional)
  ipAddress   String?  // Request IP address (optional)
  userAgent   String?  // Request user agent (optional)
  createdAt   DateTime @default(now())

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId])
  @@index([action])
  @@index([entityType])
  @@index([createdAt])
}
```

**Field Descriptions:**

- `userId` — CampusHire User ID (resolved server-side from authenticated session)
- `action` — Standardized action verb (CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, ASSIGN, UNASSIGN, APPLY, IMPORT)
- `entityType` — Resource type affected (Department, DepartmentAdmin, Drive, DriveApplication, Student, BulkImport)
- `entityId` — Specific resource identifier (CUID of affected record, null for bulk operations)
- `metadata` — JSON string with additional context (row counts, changed fields, relevant details)
- `ipAddress` — Client IP address (optional, for security tracking)
- `userAgent` — Client user agent (optional, for device tracking)
- `createdAt` — Timestamp (server-generated, immutable)

**Relations:**
- `user` — References the User who performed the action
- `onDelete: Restrict` — Cannot delete User with audit logs (preserves history)

**Indexes:**
- `userId` — Query logs by actor
- `action` — Filter by action type
- `entityType` — Filter by resource type
- `createdAt` — Efficient time-based queries and sorting

## Action Vocabulary

Standardized action types for consistency:

| Action | Description | Example Use |
|--------|-------------|-------------|
| `CREATE` | New resource created | Department created, Drive created |
| `UPDATE` | Resource modified | Department updated, Drive updated |
| `DELETE` | Resource removed | (Currently unused - soft deletes only) |
| `ACTIVATE` | Resource enabled | Department activated |
| `DEACTIVATE` | Resource disabled | Department deactivated |
| `ASSIGN` | User assigned role/resource | User assigned as Department Admin |
| `UNASSIGN` | User removed from role/resource | Department Admin removed |
| `APPLY` | Student applied to opportunity | Student applied to drive |
| `IMPORT` | Bulk operation completed | Students imported via Excel |
| `ROLE_CHANGE` | User role modified | User role changed from STUDENT to DEPT_ADMIN |

## Entity Types

Resources that can be audited:

- `Department` — Department management operations
- `DepartmentAdmin` — Admin assignment/removal operations
- `User` — User role changes
- `Drive` — Drive creation/update operations
- `DriveApplication` — Student application submissions
- `Student` — Student record operations (bulk import)
- `BulkImport` — Bulk import operations

## Centralized Audit Helper

### Implementation: `lib/audit.ts`

```typescript
interface CreateAuditLogInput {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

async function createAuditLog(input: CreateAuditLogInput): Promise<void>
```

**Responsibilities:**

1. Resolve authenticated user server-side (never trust client)
2. Validate action and entityType
3. Serialize metadata to JSON
4. Insert audit record into database
5. Handle errors safely (log but don't fail critical operations)

**Usage Pattern:**

```typescript
// Inside a server action after successful operation
await createAuditLog({
  action: "CREATE",
  entityType: "Department",
  entityId: department.id,
  metadata: { name: department.name, code: department.code },
});
```

## Audited Operations

### Department Management (Unit 08)

| Operation | Action | Entity Type | Metadata |
|-----------|--------|-------------|----------|
| Create department | `CREATE` | `Department` | `{ name, code }` |
| Update department | `UPDATE` | `Department` | `{ changedFields: [...] }` |
| Activate department | `ACTIVATE` | `Department` | `{ name, code }` |
| Deactivate department | `DEACTIVATE` | `Department` | `{ name, code }` |

### Admin Account Management (Unit 08)

| Operation | Action | Entity Type | Metadata |
|-----------|--------|-------------|----------|
| Assign Department Admin | `ASSIGN` | `DepartmentAdmin` | `{ userId, departmentId, email }` |
| Remove Department Admin | `UNASSIGN` | `DepartmentAdmin` | `{ userId, departmentId, email }` |
| Change user role | `ROLE_CHANGE` | `User` | `{ oldRole, newRole, email }` |

### Drive Management (Unit 05 - if UI implemented)

| Operation | Action | Entity Type | Metadata |
|-----------|--------|-------------|----------|
| Create drive | `CREATE` | `Drive` | `{ company, role, deadline }` |
| Update drive | `UPDATE` | `Drive` | `{ changedFields: [...] }` |

### Student Applications (Unit 06)

| Operation | Action | Entity Type | Metadata |
|-----------|--------|-------------|----------|
| Student applies to drive | `APPLY` | `DriveApplication` | `{ driveId, studentId }` |

### Bulk Import (Unit 07 - when implemented)

| Operation | Action | Entity Type | Metadata |
|-----------|--------|-------------|----------|
| Bulk import students | `IMPORT` | `BulkImport` | `{ successCount, failureCount, fileName }` |

**Note:** Unit 07 implementation is deferred. Audit integration will be added when bulk import is implemented.

## Authorization Model

### Super Admin Access

- ✅ Can view all audit logs across all departments
- ✅ Can filter and search audit logs
- ✅ Can paginate through historical records

### Department Admin Access

- ❌ **Cannot view audit logs** (not supported in V1)
- Department-scoped audit access may be added in future versions
- For V1, audit visibility is Super Admin only

### Student Access

- ❌ **Cannot view audit logs**
- Students have no visibility into administrative actions

### Authorization Enforcement

```typescript
// In audit query server action
const user = await requireSuperAdmin(); // Throws if not Super Admin
```

## Immutability Guarantees

Audit logs are **immutable historical records**:

1. **No Update Operations** — Once created, audit logs cannot be modified
2. **No Delete Operations** — Audit logs cannot be deleted through application
3. **No Generic Mutation Endpoint** — No public API for arbitrary audit creation
4. **Server-Side Creation Only** — Audit helper called only from authorized server actions
5. **Restrict on User Delete** — Cannot delete User with audit history (preserves actor identity)

## Transaction Behavior

### Atomic Audit Creation

Where possible, audit logs are created within the same transaction as the business operation:

```typescript
await prisma.$transaction(async (tx) => {
  // Perform business operation
  const department = await tx.department.create({ data });
  
  // Create audit record
  await tx.auditLog.create({
    data: {
      userId: currentUser.id,
      action: "CREATE",
      entityType: "Department",
      entityId: department.id,
      metadata: JSON.stringify({ name, code }),
      createdAt: new Date(),
    },
  });
});
```

**Benefits:**
- If business operation fails, audit record is not created (no false success logs)
- If audit creation fails, business operation rolls back (maintains consistency)
- Atomic commit ensures accurate audit trail

### Audit Failure Policy

**Policy:** Audit creation failure should not silently succeed for critical operations.

**Implementation:**
- Audit log creation happens within transaction where possible
- If audit fails, transaction rolls back
- User receives error message (without exposing internal details)
- Critical operations are not marked as successful if audit fails

**Exception:** Non-critical read operations may proceed even if audit fails (if audited at all)

## Audit Query API

### Server Action: `getAuditLogs`

**Input:**
```typescript
{
  page: number;          // Page number (1-indexed, default: 1)
  pageSize: number;      // Records per page (default: 25, max: 100)
  action?: string;       // Filter by action type (optional)
  entityType?: string;   // Filter by entity type (optional)
  userId?: string;       // Filter by actor (optional)
  startDate?: Date;      // Filter by date range start (optional)
  endDate?: Date;        // Filter by date range end (optional)
}
```

**Output:**
```typescript
{
  data: AuditLog[];      // Array of audit records
  page: number;          // Current page
  pageSize: number;      // Records per page
  totalCount: number;    // Total matching records
}
```

**Features:**
- Pagination (offset-based)
- Filtering by action, entity type, actor, date range
- Server-side authorization (Super Admin only)
- Ordered by createdAt DESC (newest first)
- All filters validated with Zod

### Validation Schema

```typescript
const getAuditLogsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().cuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});
```

## Privacy & Security

### What We Log

✅ **Safe to log:**
- User IDs (internal identifiers)
- Action types
- Entity types and IDs
- Department names/codes
- Timestamps
- Aggregate counts (import success/failure)
- Changed field names (not values)
- IP addresses (optional, for security)
- User agents (optional, for device tracking)

### What We DO NOT Log

❌ **Never log:**
- Passwords or password hashes
- Authentication tokens (Clerk, session, JWT)
- API keys or secrets
- OTP codes
- Email verification codes
- Database credentials
- Complete uploaded files or file contents
- Sensitive personal data (SSN, private phone, personal addresses)
- Full database record snapshots (before/after)
- Raw error stack traces with internal paths

### Metadata Best Practices

**DO:**
- Store minimal contextual information
- Use field names, not values (e.g., `{ changedFields: ["name", "code"] }`)
- Store aggregate statistics (e.g., `{ successCount: 45, failureCount: 3 }`)
- Reference resources by ID

**DON'T:**
- Store complete database records
- Duplicate entire related objects
- Store sensitive field values
- Store unnecessary nested data

**Example Metadata:**

```json
{
  "name": "Computer Science",
  "code": "CS",
  "changedFields": ["name"],
  "previousCode": "COMP",
  "successCount": 42,
  "fileName": "students_2024.xlsx"
}
```

## UI Implementation

### Route

`app/(super-admin)/audit-logs/page.tsx`

### Features

1. **Audit Log Table**
   - Timestamp (formatted, newest first)
   - Actor (user email or name)
   - Action (badge with color coding)
   - Entity Type (badge)
   - Entity ID (truncated CUID with copy button)
   - Metadata (expandable JSON viewer)

2. **Filters**
   - Action dropdown (all actions + "All")
   - Entity Type dropdown (all types + "All")
   - Date range picker (start date, end date)
   - User search/select (optional)
   - Clear filters button

3. **Pagination**
   - Previous/Next buttons
   - Page number display
   - Total count display
   - Page size selector (25, 50, 100)

4. **States**
   - Loading state (skeleton table)
   - Empty state ("No audit activity found")
   - Error state (user-friendly message)
   - Unauthorized state (redirect to dashboard)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Audit Logs                                                  │
├─────────────────────────────────────────────────────────────┤
│ Filters:                                                     │
│ Action: [All ▼]  Entity: [All ▼]  Date: [Range Picker]     │
│                                              [Clear Filters] │
├─────────────────────────────────────────────────────────────┤
│ Timestamp         Actor        Action    Entity      Details│
│ 2024-09-05 14:23  admin@...    CREATE    Department  {...}  │
│ 2024-09-05 14:20  admin@...    ASSIGN    DeptAdmin   {...}  │
│ 2024-09-05 14:15  student@...  APPLY     DriveApp    {...}  │
└─────────────────────────────────────────────────────────────┘
         [Previous]  Page 1 of 5 (125 total)  [Next]
```

## Testing

### Audit Creation Tests (8 tests)

1. ✅ Successful operation creates audit record
2. ✅ Actor resolved server-side from authenticated session
3. ✅ Client cannot provide custom actor ID
4. ✅ Client cannot provide custom timestamp
5. ✅ Failed operation does not create audit record (transaction rollback)
6. ✅ Metadata correctly serialized to JSON
7. ✅ Action and entityType validated
8. ✅ Audit creation within transaction works correctly

### Immutability Tests (2 tests)

9. ✅ No update operation exists for audit logs
10. ✅ No delete operation exists for audit logs

### Authorization Tests (5 tests)

11. ✅ Super Admin can query audit logs
12. ✅ Student cannot query audit logs
13. ✅ Dept Admin cannot query audit logs (V1 restriction)
14. ✅ Unauthenticated user cannot query audit logs
15. ✅ Authorization checked before database query

### Query Tests (8 tests)

16. ✅ Pagination works correctly
17. ✅ Default page size is 25
18. ✅ Max page size is 100
19. ✅ Invalid pagination rejected
20. ✅ Action filter works
21. ✅ Entity type filter works
22. ✅ Date range filter works
23. ✅ Results ordered newest first (createdAt DESC)

### Security Tests (5 tests)

24. ✅ Client cannot fabricate actor
25. ✅ Client cannot fabricate timestamp
26. ✅ No generic audit creation endpoint exists
27. ✅ Sensitive data not stored in metadata
28. ✅ User cannot be deleted if audit logs exist

### Integration Tests (3 tests)

29. ✅ Department creation triggers audit log
30. ✅ Admin assignment triggers audit log
31. ✅ Existing unit tests still pass (no regressions)

**Total: 31 tests**

## Integration Points

### Unit 08: Department Management

**Files to modify:**
- `features/departments/actions/create-department.ts`
- `features/departments/actions/update-department.ts`
- `features/departments/actions/toggle-department-status.ts`

**Integration pattern:**
```typescript
// After successful department creation
await createAuditLog({
  action: "CREATE",
  entityType: "Department",
  entityId: department.id,
  metadata: { name: department.name, code: department.code },
});
```

### Unit 08: Admin Account Management

**Files to modify:**
- `features/admin-accounts/actions/assign-department-admin.ts`
- `features/admin-accounts/actions/remove-department-admin.ts`

**Integration pattern:**
```typescript
// After successful admin assignment
await createAuditLog({
  action: "ASSIGN",
  entityType: "DepartmentAdmin",
  entityId: admin.id,
  metadata: {
    userId: validated.userId,
    departmentId: validated.departmentId,
    email: user.email,
  },
});
```

### Unit 06: Student Applications

**Files to modify:**
- `features/applications/actions/apply-to-drive.ts`

**Integration pattern:**
```typescript
// After successful application
await createAuditLog({
  action: "APPLY",
  entityType: "DriveApplication",
  entityId: application.id,
  metadata: {
    driveId: application.driveId,
    studentId: application.studentId,
  },
});
```

### Unit 05: Drive Management (Optional - if UI implemented)

**Files to modify (when drives UI is built):**
- `features/drives/actions/create-drive.ts`
- `features/drives/actions/update-drive.ts`

### Unit 07: Bulk Import (Deferred)

**Not implemented in Unit 09.** When Unit 07 is implemented, add audit integration:

```typescript
// After successful bulk import
await createAuditLog({
  action: "IMPORT",
  entityType: "BulkImport",
  metadata: {
    successCount: validRows.length,
    failureCount: invalidRows.length,
    fileName: file.name,
  },
});
```

## Feature Structure

```
features/audit/
├── schemas/
│   └── audit.ts           # Zod validation schemas
├── queries/
│   └── get-audit-logs.ts  # Paginated audit query
├── __tests__/
│   ├── audit-creation.test.ts    # Audit creation tests
│   ├── audit-authorization.test.ts # Authorization tests
│   └── audit-query.test.ts        # Query tests
lib/
└── audit.ts               # Centralized audit helper

app/(super-admin)/
└── audit-logs/
    └── page.tsx           # Audit log UI page
```

## Error Handling

### Audit Creation Errors

**Approach:** Log error internally but don't expose to user

```typescript
try {
  await createAuditLog({ ... });
} catch (error) {
  console.error("Failed to create audit log:", error);
  // Don't expose error to user
  // Business operation proceeds or fails independently
}
```

**Exception:** Critical operations in transactions will roll back if audit fails (desired behavior)

### Query Errors

**Approach:** Return user-friendly error message

```typescript
try {
  const logs = await getAuditLogs({ ... });
  return { success: true, data: logs };
} catch (error) {
  console.error("Failed to fetch audit logs:", error);
  return {
    success: false,
    error: "Failed to load audit logs. Please try again.",
  };
}
```

## Performance Considerations

### Indexes

Strategic indexes for common queries:
- `userId` — Filter by actor
- `action` — Filter by action type
- `entityType` — Filter by resource type
- `createdAt` — Time-based ordering and filtering

### Pagination

- Offset pagination (page + pageSize)
- Database-level LIMIT and OFFSET
- Count query for total records
- Never load all records into memory

### Filtering

- All filters applied at database level
- No client-side filtering of large datasets
- Validated inputs to prevent SQL injection
- Efficient index usage

## Retention Policy

**V1 Implementation:** No automatic retention/cleanup

**Future Considerations:**
- Audit logs grow indefinitely in V1
- Future versions may implement:
  - Automatic archival after N days
  - Export to external storage
  - Deletion of old records (with admin approval)
  - Compliance-driven retention periods

**Current Approach:** Audit logs are permanent

## Assumptions & Open Questions

### Assumptions Made

1. **Super Admin only access** — V1 does not provide Department Admin audit visibility
2. **No automatic retention** — Audit logs grow indefinitely
3. **Simple metadata** — JSON string, not normalized fields
4. **IP/User Agent optional** — Not required for every audit event
5. **Transaction-based creation** — Audit fails if business operation fails
6. **No before/after snapshots** — Changed fields only, not full records
7. **Restrict on User delete** — Cannot delete users with audit history

### Open Questions

1. **Department Admin audit access** — Should dept admins see their department's audit logs? → Deferred to future
2. **Retention period** — How long should audit logs be kept? → Indefinitely for V1
3. **Export functionality** — Should audit logs be exportable to CSV/Excel? → Deferred to future
4. **Email notifications** — Should admins be notified of critical audit events? → No, not in V1
5. **Real-time updates** — Should audit logs update in real-time? → No, manual refresh
6. **Advanced filtering** — Should we support full-text search on metadata? → No, simple filters only
7. **IP geolocation** — Should IP addresses be resolved to locations? → No, raw IP only

## Success Criteria

- [ ] AuditLog model created in Prisma schema
- [ ] Centralized audit helper implemented (`lib/audit.ts`)
- [ ] Department operations audited (create, update, activate, deactivate)
- [ ] Admin operations audited (assign, remove, role change)
- [ ] Student application audited (apply to drive)
- [ ] Super Admin can query audit logs with pagination
- [ ] Filters work (action, entity type, date range)
- [ ] Audit logs immutable (no update/delete operations)
- [ ] Authorization enforced (Super Admin only)
- [ ] Sensitive data not logged
- [ ] All 31 tests passing
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes
- [ ] Production build succeeds
- [ ] Existing unit tests still pass (no regressions)
- [ ] Progress tracker updated

## Next Steps After Unit 09

After completing Unit 09, recommended next modules:

1. **Unit 08 UI** — Super Admin dashboard UI (departments, admins, audit logs)
2. **Unit 05 UI** — Department Admin dashboard UI (drives, students)
3. **Unit 04 UI** — Student registration and profile UI
4. **Unit 07 Implementation** — Excel/CSV bulk import (specification complete)
5. **Unit 10** — Email notifications and alerts (optional)

Unit 09 establishes the audit infrastructure that supports all administrative operations across the system.
