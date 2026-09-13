-- Make adityakhebad111@gmail.com a Department Admin

-- Step 1: Update user role to DEPT_ADMIN
UPDATE "User" 
SET role = 'DEPT_ADMIN' 
WHERE email = 'adityakhebad111@gmail.com';

-- Step 2: Create department if it doesn't exist
INSERT INTO "Department" (id, name, code, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(), 
  'Computer Science', 
  'CS', 
  true, 
  NOW(), 
  NOW()
)
ON CONFLICT DO NOTHING;

-- Step 3: Create DepartmentAdmin record
INSERT INTO "DepartmentAdmin" (id, "userId", "departmentId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u.id,
  d.id,
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN "Department" d
WHERE u.email = 'adityakhebad111@gmail.com'
  AND d.code = 'CS'
  AND NOT EXISTS (
    SELECT 1 FROM "DepartmentAdmin" WHERE "userId" = u.id
  )
LIMIT 1;

-- Verify the changes
SELECT 
  u.email,
  u.role,
  d.name as department,
  d.code as dept_code
FROM "User" u
LEFT JOIN "DepartmentAdmin" da ON da."userId" = u.id
LEFT JOIN "Department" d ON d.id = da."departmentId"
WHERE u.email = 'adityakhebad111@gmail.com';
