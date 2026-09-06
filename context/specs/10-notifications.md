# Unit 10 — In-App Notifications & System Communication

## Overview

This unit implements a centralized in-app notification system for CampusHire. The system enables authenticated users to receive important system-generated notifications relevant to their role and actions.

## Primary Objective

Implement a secure, server-generated notification system that:

1. **Creates notifications server-side only** — no client can fabricate notifications
2. **Enforces user ownership** — users see only their own notifications
3. **Maintains read/unread state** — users can mark notifications as read
4. **Integrates with existing workflows** — meaningful events trigger notifications
5. **Provides efficient queries** — pagination and unread counts
6. **Follows CampusHire patterns** — reuses existing auth, validation, architecture

## Database Schema

### Notification Model

```prisma
model Notification {
  id           String   @id @default(cuid())
  userId       String   // Recipient (resolved server-side)
  type         String   // Notification category
  title        String   // Short notification title
  message      String   @db.Text // Full notification message
  resourceType String?  // Optional: type of related resource (Drive, Application, etc.)
  resourceId   String?  // Optional: ID of related resource
  isRead       Boolean  @default(false)
  createdAt    DateTime @default(now())

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isRead])
  @@index([createdAt])
}
```

**Field Descriptions:**

- `userId` — CampusHire User ID (recipient, never from client input)
- `type` — Notification category (APPLICATION, DRIVE, PROFILE, ADMIN, SYSTEM)
- `title` — Brief notification headline (shown in list)
- `message` — Detailed notification content (shown when expanded/clicked)
- `resourceType` — Optional type of related resource for navigation
- `resourceId` — Optional ID of related resource for navigation
- `isRead` — Read/unread state (modifiable by recipient only)
- `createdAt` — Server-generated timestamp (never from client)

**Relations:**
- `user` — References the User who receives the notification
- `onDelete: Cascade` — Notifications deleted when user deleted

**Indexes:**
- `userId` — Efficient notification list queries
- `userId, isRead` — Efficient unread count and filtering
- `createdAt` — Efficient time-based ordering

## Notification Types

Standardized notification categories:

| Type | Description | Example Use |
|------|-------------|-------------|
| `APPLICATION` | Student application events | Application submitted successfully |
| `DRIVE` | Drive-related events | New eligible drive posted |
| `PROFILE` | Profile-related reminders | Profile incomplete - complete to apply |
| `ADMIN` | Administrative events | Bulk import completed successfully |
| `SYSTEM` | System-wide messages | Maintenance notice, policy updates |

**Implementation:** Simple string field, not enum, for flexibility in future additions.

## Centralized Notification Service

### Implementation: `lib/notifications.ts`

```typescript
interface CreateNotificationInput {
  userId: string;        // Recipient (from trusted server state)
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: string; // Optional related resource
  resourceId?: string;   // Optional related resource ID
}

async function createNotification(input: CreateNotificationInput): Promise<void>
```

**Responsibilities:**

1. Validate recipient exists
2. Sanitize title/message
3. Insert notification record
4. Handle errors safely (log but don't fail critical operations)
5. Never trust client-provided recipient or timestamp

**Usage Pattern:**

```typescript
// Inside a server action after successful operation
await createNotification({
  userId: student.userId,
  type: "APPLICATION",
  title: "Application Submitted",
  message: `You successfully applied to ${drive.companyName} - ${drive.roleName}`,
  resourceType: "Drive",
  resourceId: drive.id,
});
```

## Recipient Resolution

**Critical Security Rule:** Recipients are ALWAYS resolved server-side from trusted state.

**Forbidden:**
```typescript
// NEVER accept recipient from client
createNotification({ 
  userId: clientProvidedUserId, // ❌ VULNERABLE
  ...
});
```

**Required:**
```typescript
// ALWAYS resolve recipient from authenticated session or trusted database query
const auth = await requireStudent();
createNotification({
  userId: auth.user.id, // ✅ SERVER-RESOLVED
  ...
});
```

## Notified Events

### Student Notifications

| Event | Type | When | Example |
|-------|------|------|---------|
| Application submitted | APPLICATION | After successful drive application | "Application Submitted - You applied to Google SDE" |
| New eligible drive | DRIVE | When drive posted and student is eligible | "New Drive Available - Microsoft is hiring for SDE" |
| Profile incomplete | PROFILE | When student tries to apply with incomplete profile | "Complete Your Profile - Add academic details to apply" |

### Admin Notifications

| Event | Type | When | Example |
|-------|------|------|---------|
| Bulk import complete | ADMIN | After successful Excel/CSV import | "Import Completed - 50 students added successfully" |
| Bulk import failed | ADMIN | After failed Excel/CSV import | "Import Failed - 5 rows rejected, review errors" |

### System Notifications

| Event | Type | When | Example |
|-------|------|------|---------|
| System announcements | SYSTEM | Manual super admin broadcast | "Placement Week Schedule - Check dates for upcoming drives" |

**Note:** Drive status notifications (application accepted/rejected) are NOT implemented in V1 - CampusHire does not track application outcomes yet.

## Authorization Model

### Read Access

- **Students:** See only their own notifications
- **Department Admins:** See only their own notifications
- **Super Admins:** See only their own notifications

**No cross-user notification access.** Even Super Admins cannot view another user's notifications unless explicitly implementing a separate system-wide broadcast mechanism.

### Write Access (Mark as Read)

- **Users:** Can mark only their own notifications as read
- **No generic update endpoint** — only read state modification allowed

### Security Boundaries Tested

1. User A cannot read User B's notifications
2. User A cannot mark User B's notification as read
3. Unauthenticated users cannot read any notifications
4. Client cannot fabricate recipient, timestamp, or content
5. Client cannot bypass resource authorization via notification links

## Notification Queries

### Get Notifications (Paginated)

**Server Query:** `features/notifications/queries/get-notifications.ts`

**Input:**
```typescript
{
  page: number;        // Page number (1-indexed, default: 1)
  pageSize: number;    // Records per page (default: 25, max: 100)
  isRead?: boolean;    // Optional: filter by read/unread
}
```

**Output:**
```typescript
{
  data: Notification[];
  page: number;
  pageSize: number;
  totalCount: number;
}
```

**Features:**
- Pagination (offset-based)
- Optional read/unread filtering
- User-scoped (automatic filter on userId)
- Ordered by createdAt DESC (newest first)
- Includes all notification fields

### Get Unread Count

**Server Query:** `features/notifications/queries/get-unread-count.ts`

**Returns:** `number` (count of unread notifications for authenticated user)

**Implementation:** Efficient database count query, not in-memory filtering.

```typescript
await prisma.notification.count({
  where: {
    userId: auth.user.id,
    isRead: false,
  },
});
```

## Notification Actions

### Mark Notification as Read

**Server Action:** `features/notifications/actions/mark-notification-read.ts`

**Input:**
```typescript
{
  notificationId: string; // CUID of notification to mark as read
}
```

**Authorization:**
- Verify notification belongs to authenticated user
- Throw if attempting to mark another user's notification

**Idempotency:** Marking already-read notification remains read (no error).

### Mark All Notifications as Read

**Server Action:** `features/notifications/actions/mark-all-notifications-read.ts`

**Authorization:**
- Marks all notifications for authenticated user
- Cannot affect other users' notifications

**Implementation:**
```typescript
await prisma.notification.updateMany({
  where: {
    userId: auth.user.id,
    isRead: false,
  },
  data: {
    isRead: true,
  },
});
```

## Validation Schemas

### Notification Query Schema

```typescript
const getNotificationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  isRead: z.boolean().optional(),
});
```

### Mark as Read Schema

```typescript
const markNotificationReadSchema = z.object({
  notificationId: z.string().cuid("Invalid notification ID"),
});
```

## UI Implementation

### Notification Bell Icon

**Location:** Top navigation bar (all authenticated users)

**Features:**
- Shows unread count badge
- Clicking opens notification popover/dropdown
- Real-time unread count on page load
- No auto-refresh (user must refresh page to see new notifications)

### Notification Popover/Center

**Features:**
- Shows recent 5-10 notifications
- "View All" link to full notification page
- Mark as read inline (per notification)
- "Mark All as Read" button
- Empty state: "No notifications yet"
- Displays title, timestamp, read/unread indicator

### Full Notifications Page

**Route:** `app/(student)/notifications/page.tsx` (and equivalents for other roles)

**Features:**
- Full paginated list of all notifications
- Filter: All / Unread / Read
- Sort: Newest first (fixed)
- Mark individual as read
- Mark all as read
- Pagination controls
- Empty state for each filter

### Notification Item Display

**Components:**
- Title (bold if unread)
- Message (truncated or full)
- Timestamp (relative: "2 hours ago")
- Read/unread indicator (badge or dot)
- Optional: Link to related resource if applicable

### Navigation from Notifications

If a notification has `resourceType` and `resourceId`:

**Examples:**
- Drive notification → navigate to drive detail page (if exists)
- Application notification → navigate to application history (if exists)

**Security:** Only generate navigation links for resources the user can access. Server must verify authorization before creating notification with resource link.

## Transactional Creation

### Critical Operations

For operations where notification is essential:

```typescript
await prisma.$transaction(async (tx) => {
  // Perform business operation
  const application = await tx.driveApplication.create({ data });
  
  // Create notification
  await tx.notification.create({
    data: {
      userId: student.userId,
      type: "APPLICATION",
      title: "Application Submitted",
      message: `Successfully applied to ${drive.companyName}`,
      resourceType: "Drive",
      resourceId: drive.id,
    },
  });
});
```

**Policy:** Application submissions create notifications transactionally to ensure accurate user feedback.

### Non-Critical Operations

For informational notifications:

```typescript
// Business operation first
const drive = await createDrive(...);

// Notification best-effort (failure doesn't break operation)
try {
  await createNotification({
    userId: eligibleStudent.userId,
    type: "DRIVE",
    title: "New Drive Available",
    message: `${drive.companyName} is hiring for ${drive.roleName}`,
  });
} catch (error) {
  console.error("Failed to create notification:", error);
  // Operation succeeds even if notification fails
}
```

## Privacy & Security

### What We Store

✅ **Safe to store:**
- User IDs (internal identifiers)
- Notification types
- Titles and messages (non-sensitive content)
- Resource references (Drive IDs, Application IDs)
- Read/unread state
- Timestamps

### What We DO NOT Store

❌ **Never store:**
- Passwords or credentials
- Authentication tokens
- API keys or secrets
- Complete database records
- Sensitive personal data (SSN, private addresses)
- Other users' private information
- Clerk IDs or session data

### Content Safety

**DO:**
- Store minimal contextual information
- Use generic messages ("New drive available")
- Reference resources by ID and type
- Keep messages user-friendly

**DON'T:**
- Include sensitive student data in admin notifications
- Include confidential eligibility reasons
- Store complete drive/application objects
- Include other users' personal information

## Performance Considerations

### Indexes

Strategic indexes for common queries:
- `userId` — Filter by recipient
- `userId, isRead` — Unread count and filtering
- `createdAt` — Time-based ordering

### Pagination

- Offset pagination (page + pageSize)
- Database-level LIMIT and OFFSET
- Count query for total records
- Never load all notifications into memory

### Unread Count

- Database COUNT query (efficient)
- Cached on page load (no polling)
- Updated on user interaction (mark as read)

## Retention Policy

**V1 Implementation:** No automatic deletion/archival

**Assumptions:**
- Notifications grow indefinitely
- No cron jobs or scheduled cleanup
- Manual cleanup via database if needed (future)

**Rationale:** Notifications are relatively small records. Automatic deletion can be added in V2 if needed.

## Integration Points

### Unit 06: Student Applications

**Modified File:** `features/applications/actions/apply-to-drive.ts`

**Integration:**
```typescript
// After successful application creation
await createNotification({
  userId: auth.user.id,
  type: "APPLICATION",
  title: "Application Submitted",
  message: `You successfully applied to ${drive.companyName} - ${drive.roleName}`,
  resourceType: "Drive",
  resourceId: drive.id,
});
```

### Unit 07: Bulk Import (When Implemented)

**Future Integration:** When Unit 07 bulk import is implemented, add notifications:

```typescript
// After successful bulk import
await createNotification({
  userId: admin.user.id,
  type: "ADMIN",
  title: "Import Completed",
  message: `Successfully imported ${successCount} students`,
});
```

### Unit 05: Drive Management (When UI Implemented)

**Future Integration:** When drives are posted, notify eligible students:

```typescript
// For each eligible student
await createNotification({
  userId: student.userId,
  type: "DRIVE",
  title: "New Drive Available",
  message: `${drive.companyName} is hiring for ${drive.roleName}`,
  resourceType: "Drive",
  resourceId: drive.id,
});
```

**Note:** Mass notifications can be slow. Consider queueing or batch creation in production.

## Testing

### Notification Creation Tests (5 tests)

1. ✅ Authorized server operation creates notification
2. ✅ Notification belongs to correct recipient
3. ✅ Client cannot choose another recipient
4. ✅ Client cannot fabricate notification type
5. ✅ Client cannot fabricate timestamp

### Authorization Tests (5 tests)

6. ✅ User can retrieve their own notifications
7. ✅ User cannot retrieve another user's notifications
8. ✅ Unauthenticated user cannot retrieve notifications
9. ✅ User can mark their own notification as read
10. ✅ User cannot mark another user's notification as read

### Read State Tests (4 tests)

11. ✅ New notification is unread by default
12. ✅ Marking notification as read updates state
13. ✅ Already-read notification remains read (idempotent)
14. ✅ Unread count is accurate

### Pagination Tests (4 tests)

15. ✅ Default page size is 25
16. ✅ Pagination returns correct shape {data, page, pageSize, totalCount}
17. ✅ Invalid pagination is rejected
18. ✅ Results are ordered newest first

### Security Tests (3 tests)

19. ✅ No generic client notification creation endpoint exists
20. ✅ Notification content cannot be arbitrarily injected
21. ✅ Notification resource links respect authorization

### Regression Tests (1 test)

22. ✅ Existing Unit 01-09 tests continue to pass

**Total: 22 tests**

## Error Handling

### Notification Creation Errors

**Approach:** Log error internally but don't expose to user

```typescript
try {
  await createNotification({ ... });
} catch (error) {
  console.error("Failed to create notification:", error);
  // Don't expose error to user
  // Operation continues
}
```

**Exception:** Transactional notifications (like application submissions) fail the entire operation if notification fails.

### Query Errors

**Approach:** Return user-friendly error message

```typescript
try {
  const notifications = await getNotifications({ ... });
  return { success: true, data: notifications };
} catch (error) {
  console.error("Failed to fetch notifications:", error);
  return {
    success: false,
    error: "Failed to load notifications. Please try again.",
  };
}
```

## Feature Structure

```
features/notifications/
├── schemas/
│   └── notification.ts        # Zod validation schemas
├── queries/
│   ├── get-notifications.ts   # Paginated notification list
│   └── get-unread-count.ts    # Efficient unread count
├── actions/
│   ├── mark-notification-read.ts     # Mark single as read
│   └── mark-all-notifications-read.ts # Mark all as read
├── __tests__/
│   ├── notification-creation.test.ts    # Creation tests
│   ├── notification-authorization.test.ts # Auth tests
│   └── notification-query.test.ts       # Query/read state tests

lib/
└── notifications.ts           # Centralized notification service

components/notifications/
├── NotificationBell.tsx       # Header bell icon with badge
├── NotificationPopover.tsx    # Dropdown with recent notifications
└── NotificationList.tsx       # Full paginated list component

app/(student)/notifications/
└── page.tsx                   # Full notifications page (student)

app/(admin)/notifications/
└── page.tsx                   # Full notifications page (dept admin)

app/(super-admin)/notifications/
└── page.tsx                   # Full notifications page (super admin)
```

## UI Accessibility

### Keyboard Navigation

- Tab through notification list
- Enter to mark as read
- Enter to navigate to resource

### Focus States

- Visible focus ring on interactive elements
- Focus maintained after marking as read

### Screen Readers

- Aria labels for bell icon ("Notifications, 3 unread")
- Semantic HTML (buttons, links)
- Read/unread state announced

### Visual Indicators

- Don't rely only on color for unread state
- Use bold text + icon/badge for unread
- Clear timestamp formatting

## Assumptions & Open Questions

### Assumptions Made

1. **No email notifications** — All notifications are in-app only
2. **No push notifications** — Browser/mobile push deferred to future
3. **No notification preferences** — Users cannot disable categories
4. **No notification deletion** — Users can mark as read but not delete
5. **No notification scheduling** — All notifications immediate
6. **Simple retention** — Notifications persist indefinitely
7. **Single recipient** — No broadcast/group notifications in V1
8. **Manual refresh** — No real-time updates or polling

### Open Questions

1. **Drive notifications:** Should all eligible students be notified when drive is posted? → Yes, but mass notification implementation deferred until drive UI is built
2. **Notification limit:** Should we limit notifications per user? → No, indefinite storage for V1
3. **Read state persistence:** Should read state sync across devices? → Yes, via database (automatic)
4. **Notification deletion:** Should users be able to delete notifications? → No, mark as read only
5. **Notification editing:** Should system be able to edit sent notifications? → No, immutable after creation
6. **Failure notifications:** Should failed actions create notifications? → No, show inline errors instead
7. **Duplicate prevention:** Should we deduplicate similar notifications? → No, simple creation for V1

## Success Criteria

- [ ] Notification model created in Prisma schema
- [ ] Centralized notification service implemented (`lib/notifications.ts`)
- [ ] Student application creates notification after successful submission
- [ ] Users can query their own notifications with pagination
- [ ] Users can get unread count efficiently
- [ ] Users can mark notifications as read
- [ ] Users can mark all notifications as read
- [ ] Authorization enforced (users see only their own notifications)
- [ ] Notification UI integrated into application shell
- [ ] Notification bell shows unread count
- [ ] Notification popover displays recent notifications
- [ ] Full notifications page with pagination
- [ ] All 22 tests passing
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes
- [ ] Production build succeeds
- [ ] Existing unit tests still pass (no regressions)
- [ ] Progress tracker updated

## Next Steps After Unit 10

After completing Unit 10, recommended next modules:

1. **Unit 05 UI** — Drive management UI (Department Admin can post drives, students can browse/apply)
2. **Unit 08 UI** — Super Admin dashboard UI (departments and admins management)
3. **Unit 04 UI** — Student registration and profile management UI
4. **Unit 07 Implementation** — Excel/CSV bulk import (specification complete, needs implementation)
5. **Notification Enhancements** — Integrate notifications when new UIs are built

Unit 10 establishes the notification infrastructure that all future features can leverage for user communication.

## Out of Scope

Strictly **NOT** implemented in Unit 10:

- ❌ Transactional email (SendGrid, Resend, Nodemailer)
- ❌ Browser push notifications
- ❌ Mobile push notifications
- ❌ SMS or WhatsApp notifications
- ❌ Notification analytics or read receipts
- ❌ Notification campaigns or broadcasts
- ❌ Advanced notification preferences
- ❌ Scheduled or delayed notifications
- ❌ Cron jobs or background workers
- ❌ Unit 07 bulk import implementation
- ❌ Resume functionality
- ❌ Interview management
- ❌ Placement outcome tracking
