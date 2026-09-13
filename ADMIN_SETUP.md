 Admin Account Setup Guide

## Problem

You're seeing this error when accessing `/admin-dashboard`:

```
Error [AuthorizationError]: This action requires DEPT_ADMIN role. You have STUDENT role.
```

This means you're signed in with a STUDENT account, but the admin dashboard requires DEPT_ADMIN role.

## Solution: Upgrade Your Account

### Option 1: Interactive Script (Recommended)

Run the interactive upgrade script:

```powershell
node scripts/make-admin.mjs
```

The script will:
1. Ask for your email address
2. Find your user account
3. Show current role and department info
4. Ask for confirmation
5. Upgrade you to DEPT_ADMIN
6. Sync to Clerk

### Option 2: Direct Database Update (Quick)

If you prefer SQL, you can run this directly in your database:

```sql
-- 1. Find your user ID
SELECT id, email, role FROM "User" WHERE email = 'your-email@example.com';

-- 2. Update role to DEPT_ADMIN
UPDATE "User" SET role = 'DEPT_ADMIN' WHERE email = 'your-email@example.com';

-- 3. Create department if needed
INSERT INTO "Department" (id, name, code, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Computer Science', 'CS', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. Link user to department
INSERT INTO "DepartmentAdmin" (id, "userId", "departmentId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, d.id, NOW(), NOW()
FROM "User" u, "Department" d
WHERE u.email = 'your-email@example.com'
  AND d.code = 'CS'
  AND NOT EXISTS (
    SELECT 1 FROM "DepartmentAdmin" WHERE "userId" = u.id
  );
```

### Option 3: Create a New Admin Account

If you want to keep your student account separate:

1. Sign up with a different email (e.g., admin@college.edu)
2. Run the upgrade script for that email
3. Use that account for admin tasks

## After Upgrading

1. **Sign out** of the application completely
2. **Sign back in** with the upgraded account
3. Navigate to `/admin-dashboard` — you should now have access!

## Verify Your Role

You can check your current role by looking at the sidebar:
- **Student role**: Shows student navigation items
- **Admin role**: Shows admin navigation items

Or check the database:

```sql
SELECT email, role FROM "User" WHERE email = 'your-email@example.com';
```

## Creating Multiple Admins

### Department Admins

To create additional department admins:

```powershell
# Run the script for each email
node scripts/make-admin.mjs
```

### Super Admins

To create a super admin (full system access):

```powershell
node scripts/make-super-admin.mjs
```

**Note:** Super admins are NOT department-scoped. They manage the entire system (all departments, all admins).

### Production Process

Once Unit 08 UI is implemented, Super Admins can assign department admins via the UI at `/super-admin-dashboard`.

## Troubleshooting

### "User not found"
- Make sure you've signed up with that email first
- Check for typos in the email address

### "Still getting authorization error after upgrade"
- Sign out completely (clear cookies if needed)
- Sign back in
- The role should now be synced

### "Clerk sync failed"
- The database is updated correctly
- Signing out and back in will sync the role to Clerk
- You can ignore this warning

## Tech Details

The upgrade process:
1. Updates `User.role` from `STUDENT` to `DEPT_ADMIN`
2. Creates a `DepartmentAdmin` record linking user to department
3. Syncs role to Clerk `publicMetadata`
4. Creates audit log entry (if Unit 09 is active)

All admin pages use `requireDepartmentAdmin()` which checks:
- User is authenticated
- User has DEPT_ADMIN role
- User has a DepartmentAdmin record
- Returns the associated department for scoping queries
