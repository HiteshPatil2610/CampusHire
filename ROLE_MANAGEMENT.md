# Role Management Guide

## Overview

CampusHire has **three roles**:

1. **STUDENT** — Default role for all new sign-ups
2. **DEPT_ADMIN** — Department administrators (manage students in their department)
3. **SUPER_ADMIN** — System administrators (manage all departments and admins)

## Role Hierarchy

```
SUPER_ADMIN (highest)
    ↓
DEPT_ADMIN
    ↓
STUDENT (default)
```

## How to Assign Roles

### 1. Make Someone a Department Admin

**Using the script (recommended):**

```powershell
node scripts/make-admin.mjs
```

**What it does:**
- Changes role from STUDENT → DEPT_ADMIN
- Creates a `DepartmentAdmin` record
- Links user to a department
- Syncs to Clerk

**Access granted:**
- `/admin-dashboard` — Dashboard with KPIs
- `/admin-dashboard/students` — Student roster
- `/admin-dashboard/students/add` — Add students
- Can only see/manage students in their department

---

### 2. Make Someone a Super Admin

**Using the script (recommended):**

```powershell
node scripts/make-super-admin.mjs
```

**What it does:**
- Changes role to SUPER_ADMIN
- Removes any `DepartmentAdmin` record (super admins are not department-scoped)
- Syncs to Clerk

**Access granted:**
- `/super-admin-dashboard` — System overview
- Manage all departments
- Assign/remove department admins
- View audit logs
- Can see ALL data across ALL departments

---

### 3. Direct SQL Approach

If you prefer SQL (e.g., in database GUI):

#### Make Department Admin:

```sql
-- 1. Update role
UPDATE "User" 
SET role = 'DEPT_ADMIN' 
WHERE email = 'user@example.com';

-- 2. Create department admin record
INSERT INTO "DepartmentAdmin" (id, "userId", "departmentId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u.id,
  d.id,
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN "Department" d
WHERE u.email = 'user@example.com'
  AND d.code = 'CS'  -- Change to target department
LIMIT 1;
```

#### Make Super Admin:

```sql
-- 1. Remove department admin record if exists
DELETE FROM "DepartmentAdmin" 
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'user@example.com');

-- 2. Update role
UPDATE "User" 
SET role = 'SUPER_ADMIN' 
WHERE email = 'user@example.com';
```

---

## Production: UI-Based Role Management (Not Yet Implemented)

Once **Unit 08 UI** is built, Super Admins will be able to:

1. Go to `/super-admin-dashboard`
2. Click "Admin Accounts" tab
3. Click "Assign Admin" button
4. Select user and department from dropdowns
5. Click "Assign" — done!

This uses the existing backend actions from Unit 08:
- `assignDepartmentAdmin` action
- `removeDepartmentAdmin` action

**Current status:** Backend complete ✅, UI pending ⏳

---

## Role Constraints

### STUDENT
- ✅ Can manage their own profile
- ✅ Can apply to drives
- ✅ Can view their applications
- ❌ Cannot see other students' data
- ❌ Cannot manage drives

### DEPT_ADMIN
- ✅ All STUDENT permissions
- ✅ Can see all students in their department
- ✅ Can add students manually
- ✅ Can post drives for their department
- ✅ Can review applications
- ❌ Cannot see students from other departments
- ❌ Cannot manage departments or admins

### SUPER_ADMIN
- ✅ Full system access
- ✅ Can create/update/deactivate departments
- ✅ Can assign/remove department admins
- ✅ Can view audit logs
- ✅ Can see ALL data across ALL departments
- ❌ Not department-scoped (no DepartmentAdmin record)

---

## Important Notes

### Super Admin vs Department Admin

- **Super Admins** are NOT linked to a department — they manage the system
- **Department Admins** are linked to ONE department — they manage students/drives in that department
- A user can be either SUPER_ADMIN OR DEPT_ADMIN, never both

### Role Changes Require Sign Out

After changing a user's role:
1. User must **sign out completely**
2. User must **sign back in**
3. Role will be synced from database to Clerk session

### First-Time Setup

For your first admin accounts during development:

1. **Create your super admin first:**
   ```powershell
   node scripts/make-super-admin.mjs
   # Enter your email
   ```

2. **Create department admins for testing:**
   ```powershell
   node scripts/make-admin.mjs
   # Enter another user's email
   ```

3. **Leave some users as students** for testing the student experience

---

## Checking Current Roles

### Via Database:

```sql
SELECT 
  email, 
  role, 
  CASE 
    WHEN role = 'DEPT_ADMIN' THEN (
      SELECT d.name 
      FROM "DepartmentAdmin" da 
      JOIN "Department" d ON d.id = da."departmentId" 
      WHERE da."userId" = "User".id
    )
    ELSE NULL
  END as department
FROM "User"
ORDER BY role DESC, email;
```

### Via Application:

Sign in and check the sidebar:
- **Student sidebar** → You're a STUDENT
- **Admin sidebar** → You're a DEPT_ADMIN
- **Super admin sidebar** → You're a SUPER_ADMIN

---

## Troubleshooting

### "Authorization error after role change"
→ Sign out completely and sign back in

### "Script says user not found"
→ User must sign up first (create account via /sign-up)

### "Clerk sync failed"
→ Safe to ignore, role will sync on next sign-in

### "Cannot access super admin page as dept admin"
→ Users can only have ONE role. Run make-super-admin.mjs to upgrade

### "Cannot access admin page as student"
→ Run make-admin.mjs or make-super-admin.mjs to upgrade

---

## Future: Self-Service Role Requests

Not in V1, but could be added:
- Students request dept admin role
- Super admin reviews and approves
- Email notifications for role changes
- Role request history in audit log
