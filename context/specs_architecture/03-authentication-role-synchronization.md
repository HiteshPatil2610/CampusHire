# CampusHire — Unit 03: Authentication & Role Synchronization

## 1. Purpose

Establish the complete authentication and authorization foundation for CampusHire by:
- Integrating Clerk authentication with the application's User model
- Synchronizing Clerk identity with CampusHire database records
- Implementing role-based access control (RBAC)
- Enforcing department-scoped authorization for department admins
- Providing reusable server-side authorization helpers
- Protecting routes based on authentication and role

This unit provides the security foundation required for all subsequent features.

## 2. Scope

This unit encompasses:

### Authentication (Already Partially Complete from Unit 01)
- ✅ Clerk integration in root layout
- ✅ Sign-in/sign-up pages using Clerk components
- ✅ Basic middleware with Clerk session handling
- ⏳ Email verification flow configuration
- ⏳ Clerk webhook setup for user lifecycle events

### User Synchronization (To Implement)
- Clerk User ↔ CampusHire User record synchronization
- Automatic user creation on sign-up
- User record lookup by Clerk ID
- Idempotent user creation (no duplicates)
- Role storage in both Clerk metadata and database

### Authorization (To Implement)
- Server-side authorization helpers with database lookup
- Role verification (STUDENT, DEPT_ADMIN, SUPER_ADMIN)
- Department scope enforcement for DEPT_ADMIN
- Protected route access control
- Server action authorization
- API route authorization

### Middleware Enhancement (To Update)
- Keep session-based authentication checks
- Improve role-based route protection
- Maintain separation: middleware handles routes, server actions handle business logic

### Out of Scope for Unit 03
- ❌ Student profile management UI
- ❌ Admin dashboards (placeholder only)
- ❌ Department management features
- ❌ Drive posting/management
- ❌ Excel bulk upload
- ❌ Profile completion calculation
- ❌ Email notifications beyond Clerk's built-in verification

## 3. Authentication Architecture

### Clerk Responsibilities

Clerk is the single source of truth for:
- **Authentication state**: Who is signed in
- **Session management**: Maintaining user sessions
- **Email verification**: OTP/magic link flows
- **Sign-in/sign-up UI**: Pre-built authentication components
- **Password management**: Password reset, security
- **Identity storage**: Clerk user ID (the external identity)

### CampusHire Responsibilities

The application handles:
- **Authorization**: What users can do based on their role
- **User records**: Application-specific user data in PostgreSQL
- **Role management**: Assigning and enforcing STUDENT, DEPT_ADMIN, SUPER_ADMIN
- **Department scoping**: Restricting admins to their department
- **Business logic**: All feature-specific authorization
- **Data relationships**: Student profiles, department associations, etc.

### Integration Points

1. **Clerk User ID → CampusHire User**: One-to-one mapping via `User.clerkId`
2. **Role Storage**: Dual storage for performance
   - Clerk `publicMetadata.role` (for quick middleware checks)
   - Database `User.role` (source of truth for authorization)
3. **Webhooks**: Clerk notifies CampusHire of user lifecycle events
4. **Server-side helpers**: Always fetch from database for authorization decisions

## 4. College Email Verification

### Requirement

From project-overview.md:
> College-email self-registration for students, with email verification

### Implementation Strategy

**Use Clerk's built-in email verification** with configuration to restrict email domains.

#### Clerk Configuration (Dashboard)
1. Enable email address as primary identifier
2. Enable email verification (OTP code)
3. Configure allowed email domains in Clerk dashboard:
   - Pattern: `*@college.edu` (or specific college domain)
   - Verification: Email OTP before account activation

#### College Domain Question

**Open Question**: The exact college email domain is not specified in the existing context.

Options:
1. Use environment variable: `ALLOWED_EMAIL_DOMAIN=college.edu`
2. Store in database configuration (for future multi-college support)
3. Configure directly in Clerk dashboard

**Decision for V1**: Configure in Clerk dashboard as `*@college.edu` pattern. Document this in setup guide.

### No Custom OTP Implementation

Do NOT implement:
- Custom OTP generation
- Custom email sending
- Custom verification token system
- Bypass of Clerk's verification

Clerk handles all email verification natively.

## 5. Clerk User ↔ CampusHire User Synchronization

### Data Flow

```
Sign Up Flow:
1. User signs up via Clerk (email + verification)
2. Clerk sends webhook → `user.created` event
3. CampusHire creates User record with:
   - clerkId: from Clerk
   - email: from Clerk
   - role: STUDENT (default for self-registration)
4. CampusHire updates Clerk metadata with role

Sign In Flow:
1. User signs in via Clerk
2. Middleware checks session exists
3. Server action fetches User from database by clerkId
4. Authorization decision based on database User.role
```

### Database Schema (Already Complete from Unit 02)

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  role      Role
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  departmentAdmin DepartmentAdmin?
  student         Student?
}

enum Role {
  STUDENT
  DEPT_ADMIN
  SUPER_ADMIN
}
```

### Synchronization Rules

1. **One Clerk User = One CampusHire User**
   - Enforced by unique constraint on `User.clerkId`
   - Webhook handler must check for existing user before creating

2. **Role Assignment**
   - **Self-registration** (sign-up page) → `STUDENT` role
   - **Admin creation** (super admin action) → `DEPT_ADMIN` role
   - **Super admin** (seed script) → `SUPER_ADMIN` role

3. **Dual Role Storage**
   - **Database**: `User.role` (source of truth)
   - **Clerk metadata**: `publicMetadata.role` (for middleware performance)
   - Always sync both when role changes

4. **Idempotency**
   - Webhook handler must handle duplicate events gracefully
   - Use upsert pattern: create if not exists, update if exists
   - Never error on duplicate clerkId

### Missing User Handling

If a Clerk user exists but no CampusHire User record:
- **Cause**: Webhook failure, database error during sign-up
- **Recovery**: Create user on first authenticated request
- **Implementation**: `getOrCreateUser()` helper that upserts

## 6. Role Handling

### Three Roles

```typescript
enum Role {
  STUDENT      // Self-registered users, access student features
  DEPT_ADMIN   // Created by super admin, manage department
  SUPER_ADMIN  // System admin, manage all departments and admins
}
```

### Role Assignment Rules

| Role | How Assigned | Who Can Assign | Database Requirements |
|------|--------------|----------------|----------------------|
| STUDENT | Automatic on self-registration | System (webhook) | User record only |
| DEPT_ADMIN | Manual creation by super admin | SUPER_ADMIN | User + DepartmentAdmin records |
| SUPER_ADMIN | Seed script (one per system) | System setup | User record only |

### Role Verification

**Never trust client-provided role**. Always verify server-side:

```typescript
// ❌ WRONG - Client can manipulate metadata
const { sessionClaims } = await auth();
const role = sessionClaims?.publicMetadata?.role;
if (role === 'SUPER_ADMIN') { /* dangerous */ }

// ✅ CORRECT - Database lookup
const user = await getCurrentUser();
if (user.role === 'SUPER_ADMIN') { /* safe */ }
```

### Role Enforcement Layers

1. **Middleware** (route-level): Quick publicMetadata check for route access
2. **Server Actions** (operation-level): Database role lookup for authorization
3. **API Routes** (endpoint-level): Database role lookup for authorization

## 7. Department Scope

### Requirement

From architecture.md:
> A DEPT_ADMIN account is scoped to exactly one Department via an adminOf relation

### Database Relationship

```prisma
model DepartmentAdmin {
  id           String     @id @default(cuid())
  userId       String     @unique      // One admin account per user
  departmentId String                  // One department per admin
  user         User       @relation(...)
  department   Department @relation(...)
}
```

### Scope Enforcement

Department admins must ONLY access data from their assigned department:

```typescript
// ✅ CORRECT - Scoped query
const students = await prisma.student.findMany({
  where: { 
    departmentId: adminDepartment.id  // Always filter by admin's department
  }
});

// ❌ WRONG - Cross-department access possible
const students = await prisma.student.findMany({
  where: { 
    id: req.body.studentId  // Student could be from any department
  }
});
```

### Scope Verification Helper

```typescript
async function requireDepartmentAdmin(): Promise<{
  user: User;
  department: Department;
}> {
  const user = await requireRole('DEPT_ADMIN');
  
  const admin = await prisma.departmentAdmin.findUnique({
    where: { userId: user.id },
    include: { department: true }
  });
  
  if (!admin) {
    throw new Error('No department association found');
  }
  
  return { user, department: admin.department };
}
```

### Invalid Department Admin

If a `DEPT_ADMIN` user has no valid `DepartmentAdmin` record:
- **Reject privileged operations**: Cannot access department features
- **Allow profile access**: Can view own profile, change password
- **Show error message**: "Contact administrator to assign department"

## 8. Authorization Helpers

Create reusable authorization utilities in `lib/auth.ts`:

### Core Helpers

```typescript
// Get authenticated Clerk user ID (fast, from Clerk session)
async function getAuthUserId(): Promise<string | null>

// Get or create CampusHire user (database lookup/upsert)
async function getOrCreateUser(): Promise<User | null>

// Require authentication (throws if not authenticated)
async function requireAuth(): Promise<User>

// Require specific role (throws if wrong role)
async function requireRole(role: Role): Promise<User>

// Require any of multiple roles (throws if no match)
async function requireAnyRole(roles: Role[]): Promise<User>

// Get department admin with scope (throws if not valid admin)
async function requireDepartmentAdmin(): Promise<{
  user: User;
  admin: DepartmentAdmin;
  department: Department;
}>

// Check if user can access specific department resource
async function canAccessDepartment(departmentId: string): Promise<boolean>
```

### Helper Implementation Rules

1. **Always use database** as source of truth for authorization
2. **Throw descriptive errors** for unauthorized access
3. **Return strongly-typed results** (no `any`)
4. **Include user data** in return value to avoid duplicate queries
5. **Handle missing records gracefully**

### Error Types

```typescript
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
```

## 9. Middleware Responsibilities

### What Middleware Should Do

✅ **Session-based route protection**:
- Redirect unauthenticated users from protected routes
- Check Clerk session exists

✅ **Quick role-based route protection**:
- Use `publicMetadata.role` for fast checks
- Redirect wrong-role users from role-specific route groups

✅ **Public route allowance**:
- Allow `/`, `/sign-in`, `/sign-up` without authentication

### What Middleware Should NOT Do

❌ **Database queries**: Too slow, runs on every request  
❌ **Business logic**: Belongs in server actions  
❌ **Resource-level authorization**: Check ownership, department scope in server actions  
❌ **Complex permission checks**: Middleware is for routes, not operations

### Current Implementation (Unit 01)

```typescript
// Already implemented:
- Session check via clerkMiddleware
- Role-based route matchers
- Redirects for wrong role
- Public route allowance
```

### Improvements Needed

- Better handling when user has no role yet
- Consistent redirect URLs
- Add API route protection patterns

## 10. Route Protection

### Route Groups (Already Established)

```
app/
├── (auth)/              # Public: sign-in, sign-up
├── (student)/           # Requires: STUDENT role
├── (admin)/             # Requires: DEPT_ADMIN role
├── (super-admin)/       # Requires: SUPER_ADMIN role
└── api/                 # Varies: some public, most protected
```

### Protection Matrix

| Route | Auth Required | Role Required | Additional Checks |
|-------|---------------|---------------|-------------------|
| `/` | No | None | Public landing page |
| `/sign-in` | No | None | Public |
| `/sign-up` | No | None | Public |
| `/student-dashboard` | Yes | STUDENT | Must have Student record |
| `/admin-dashboard` | Yes | DEPT_ADMIN | Must have DepartmentAdmin record |
| `/super-admin-dashboard` | Yes | SUPER_ADMIN | None |
| `/api/*` | Varies | Varies | Check per endpoint |

### Server Action Protection

Every server action must verify authorization:

```typescript
'use server';

export async function updateStudentProfile(data: ProfileData) {
  // Always check authorization first
  const user = await requireRole('STUDENT');
  
  const student = await prisma.student.findUnique({
    where: { userId: user.id }
  });
  
  if (!student) {
    throw new Error('Student profile not found');
  }
  
  // Verify ownership
  if (data.id !== student.id) {
    throw new AuthorizationError('Cannot modify another student\'s profile');
  }
  
  // Business logic here...
}
```

## 11. Webhooks

### Clerk Webhook Events

Required webhooks to implement:

#### `user.created`
- **Trigger**: User completes sign-up and email verification
- **Action**: Create CampusHire User record with STUDENT role
- **Fields**: clerkId, email, role=STUDENT
- **Also**: Update Clerk metadata with role

#### `user.updated`
- **Trigger**: User updates email or other Clerk profile data
- **Action**: Sync email to CampusHire User record
- **Fields**: email (if changed)

#### `user.deleted`
- **Trigger**: User is deleted from Clerk (rare, admin action)
- **Action**: Soft-delete or handle CampusHire User record
- **Note**: Cascade delete will handle related records via Prisma

### Webhook Implementation

**Endpoint**: `/api/webhooks/clerk`

**Security**:
- Verify webhook signature using Clerk's signing secret
- Reject requests with invalid signatures
- Use `CLERK_WEBHOOK_SECRET` environment variable

**Idempotency**:
- Check if user exists before creating (upsert pattern)
- Handle duplicate events gracefully
- Log all webhook events for debugging

**Error Handling**:
- Return 200 OK even if operation fails (prevent Clerk retries)
- Log errors for manual review
- Implement retry logic internally if needed

### Webhook Configuration

1. **Clerk Dashboard**:
   - Add endpoint URL: `https://your-domain.vercel.app/api/webhooks/clerk`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy signing secret

2. **Environment Variables**:
   ```env
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

3. **Local Testing**:
   - Use Clerk's webhook testing UI
   - Or use ngrok/localtunnel for local development

## 12. Authentication Invariants

### Security Rules

1. **Authentication First**: Check Clerk session before any operation
2. **Authorization Second**: Check database role after authentication
3. **Never Trust Client**: Always verify server-side
4. **Fail Secure**: Deny access on errors or missing data
5. **Audit Trail**: Log all authorization failures (future audit log)

### Data Integrity Rules

1. **One Clerk User = One CampusHire User**: Enforced by unique clerkId
2. **Role Consistency**: Database role is source of truth
3. **Department Scope**: DEPT_ADMIN must have valid DepartmentAdmin record
4. **Student Link**: STUDENT should have Student record (created after profile setup)
5. **No Self-Promotion**: Users cannot change their own role

### Synchronization Rules

1. **Clerk → Database**: Webhooks must create/update User records
2. **Database → Clerk**: Role changes must update Clerk metadata
3. **Idempotent Operations**: Handle duplicate events safely
4. **Recovery**: Missing User records created on first auth request

## 13. Error & Unauthorized Behavior

### Unauthenticated User

**Scenario**: No Clerk session

**Middleware**: Redirect to `/sign-in?redirect_url=<original-url>`

**Server Action**: Throw `AuthenticationError('Authentication required')`

**API Route**: Return 401 Unauthorized

### Wrong Role

**Scenario**: Authenticated but wrong role for route/operation

**Middleware**: Redirect to `/` (home page)

**Server Action**: Throw `AuthorizationError('Insufficient permissions')`

**API Route**: Return 403 Forbidden

### Missing CampusHire User

**Scenario**: Clerk user exists but no database User record

**Recovery**: Call `getOrCreateUser()` to create missing record

**If Creation Fails**: Treat as authentication failure, redirect to sign-in

### Missing Department Admin

**Scenario**: DEPT_ADMIN user but no DepartmentAdmin record

**Behavior**: Deny department operations

**Message**: "Your account is not associated with a department. Please contact the administrator."

### Missing Student Record

**Scenario**: STUDENT user but no Student record yet

**Behavior**: Allow authentication, prompt profile creation

**Note**: Student record created during profile setup (Unit 04)

## 14. Out of Scope

This unit does NOT implement:

### Features
- ❌ Student profile creation workflow (Unit 04)
- ❌ Student dashboard content (later units)
- ❌ Admin dashboard content (later units)
- ❌ Super admin management UI (later units)
- ❌ Department management (later units)
- ❌ Student management (later units)
- ❌ Drive posting (later units)
- ❌ Excel upload (later units)
- ❌ Audit logging (later units)

### Authentication Features
- ❌ Two-factor authentication
- ❌ Social login (Google, GitHub, etc.)
- ❌ Passwordless magic links (unless Clerk default)
- ❌ Phone number authentication
- ❌ Biometric authentication

### This Unit Is ONLY
- ✅ Authentication foundation
- ✅ User synchronization
- ✅ Role authorization
- ✅ Department scope enforcement
- ✅ Reusable auth helpers
- ✅ Webhook setup

## 15. Open Questions

### Resolved by Specification

1. **College Email Domain**: Configure in Clerk dashboard, document in setup guide
2. **Role Storage**: Dual storage (database + Clerk metadata) for performance
3. **Missing User Handling**: Use `getOrCreateUser()` pattern with upsert
4. **Webhook Security**: Verify signature using CLERK_WEBHOOK_SECRET

### Remaining Open Questions

1. **Profile Photo Storage**: Where to store? (Likely Vercel Blob, deferred to profile unit)
2. **Session Duration**: Use Clerk defaults or customize? (Use defaults for V1)
3. **Multi-Factor Auth**: Required for admin roles? (Not for V1)
4. **Password Policy**: Enforce complexity? (Use Clerk defaults)
5. **Account Deletion**: Soft or hard delete? (Decide in user management unit)

## 16. Verification Plan

### Authentication Tests

```typescript
describe('Authentication', () => {
  it('should reject unauthenticated requests');
  it('should allow authenticated requests');
  it('should create user on first sign-in');
  it('should not duplicate users');
  it('should handle missing Clerk user gracefully');
});
```

### Authorization Tests

```typescript
describe('Role Authorization', () => {
  it('should allow STUDENT to access student routes');
  it('should reject DEPT_ADMIN from student routes');
  it('should allow DEPT_ADMIN to access admin routes');
  it('should reject STUDENT from admin routes');
  it('should allow SUPER_ADMIN to access all routes');
  it('should require valid role for protected operations');
});
```

### Department Scope Tests

```typescript
describe('Department Scope', () => {
  it('should return admin\'s department');
  it('should reject admin without department');
  it('should prevent cross-department data access');
  it('should allow admin to access own department data');
  it('should not allow admin to access other department data');
});
```

### Webhook Tests

```typescript
describe('Clerk Webhooks', () => {
  it('should create user on user.created event');
  it('should update user on user.updated event');
  it('should handle user.deleted event');
  it('should reject invalid webhook signatures');
  it('should handle duplicate events idempotently');
});
```

### Manual Verification

- [ ] Sign up with college email → Creates User with STUDENT role
- [ ] Sign in with existing account → Authenticates successfully
- [ ] Access student route as STUDENT → Allowed
- [ ] Access admin route as STUDENT → Redirected
- [ ] Access admin route as DEPT_ADMIN → Allowed
- [ ] Super admin can access all routes

### Build Verification

- [ ] `npx prisma validate` — Schema valid
- [ ] `npx prisma generate` — Client generated
- [ ] `npx tsc --noEmit` — No TypeScript errors
- [ ] `npm run lint` — No ESLint warnings
- [ ] `npm run test` — All tests passing
- [ ] `npm run build` — Production build successful

## 17. Implementation Checklist

### Phase 1: Authorization Helpers
- [ ] Create `lib/auth.ts` with all helper functions
- [ ] Implement `getAuthUserId()`
- [ ] Implement `getOrCreateUser()` with upsert
- [ ] Implement `requireAuth()`
- [ ] Implement `requireRole()`
- [ ] Implement `requireAnyRole()`
- [ ] Implement `requireDepartmentAdmin()`
- [ ] Add error classes

### Phase 2: Webhook Handler
- [ ] Add `CLERK_WEBHOOK_SECRET` to env validation
- [ ] Create `/api/webhooks/clerk/route.ts`
- [ ] Implement signature verification
- [ ] Handle `user.created` event
- [ ] Handle `user.updated` event
- [ ] Handle `user.deleted` event
- [ ] Add error logging

### Phase 3: Middleware Updates
- [ ] Improve role-based redirects
- [ ] Add better no-role handling
- [ ] Ensure API route protection
- [ ] Test all route protection scenarios

### Phase 4: Testing
- [ ] Add authentication tests
- [ ] Add role authorization tests
- [ ] Add department scope tests
- [ ] Add webhook handler tests
- [ ] Add integration tests

### Phase 5: Documentation
- [ ] Update SETUP.md with Clerk configuration steps
- [ ] Update SETUP.md with webhook setup
- [ ] Document environment variables
- [ ] Update progress tracker

## 18. Success Criteria

Unit 03 is complete when:

1. ✅ User can sign up with college email and Clerk creates verified account
2. ✅ Webhook creates CampusHire User record with STUDENT role
3. ✅ User can sign in and access role-appropriate routes
4. ✅ STUDENT cannot access admin routes (redirected)
5. ✅ DEPT_ADMIN cannot access student routes (redirected)
6. ✅ SUPER_ADMIN can access all routes
7. ✅ Server actions use database role for authorization
8. ✅ Department admin can only access their department data
9. ✅ All authorization tests passing
10. ✅ Build passes with no errors

---

## Summary

Unit 03 establishes the security foundation for CampusHire by:
- Integrating Clerk authentication with application database
- Synchronizing user records via webhooks
- Implementing role-based access control
- Enforcing department scope for admins
- Providing reusable authorization helpers
- Protecting routes and operations

This enables subsequent units to build features with confidence that authentication and authorization are handled correctly and consistently.
