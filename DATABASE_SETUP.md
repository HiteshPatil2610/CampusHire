# Database Setup Guide for CampusHire

## Current Status

✅ **Schema Defined**: Complete database schema (Unit 02A, 02B, 02C) in `prisma/schema.prisma`

✅ **Schema Validated**: Prisma validation passed successfully

✅ **Client Generated**: Prisma Client types generated successfully with all models

✅ **Migration Applied**: Database migration `student_profile_foundation` successfully applied to Neon PostgreSQL

✅ **Database Ready**: All tables, indexes, constraints, and enums created in production database

## Migration Applied Successfully

**Migration Name**: `20260904192335_student_profile_foundation`

**Applied On**: Neon PostgreSQL database

**Database**: neondb at ep-bold-pine-ae4zx21e-pooler.c-2.us-east-2.aws.neon.tech

**What Was Created**:
- ✅ 2 Enums: `Role`, `SkillType`
- ✅ 9 Tables: `User`, `Department`, `DepartmentAdmin`, `Student`, `StudentAcademic`, `StudentPreferences`, `StudentSkill`, `StudentProject`, `StudentExperience`, `StudentCertification`
- ✅ 17 Unique constraints
- ✅ 13 Indexes for query performance
- ✅ 10 Foreign key constraints with cascade/restrict rules

**Status**: Database schema is up to date ✅

---

## Next Steps to Connect Database

### Option 1: Neon (Recommended - Architecture Requirement)

Neon is the specified PostgreSQL provider for CampusHire per `architecture.md`.

1. **Create Neon Account**:
   - Go to https://neon.tech
   - Sign up (free tier available)
   - Create a new project named "campushire"

2. **Get Connection String**:
   - In Neon dashboard, go to your project
   - Click "Connection Details"
   - Copy the connection string (format: `postgresql://user:password@host/database`)

3. **Update Environment**:
   - Open `.env.local`
   - Replace the DATABASE_URL:
     ```
     DATABASE_URL="postgresql://your-actual-neon-connection-string"
     ```

4. **Run Migration**:
   ```bash
   npx prisma migrate dev --name student_profile_foundation
   ```

### Option 2: Local PostgreSQL (Development Only)

If you prefer local development:

1. **Install PostgreSQL**:
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Or use Docker: `docker run --name campushire-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`

2. **Create Database**:
   ```sql
   CREATE DATABASE campushire;
   ```

3. **Update Environment**:
   - In `.env.local`:
     ```
     DATABASE_URL="postgresql://postgres:password@localhost:5432/campushire"
     ```

4. **Run Migration**:
   ```bash
   npx prisma migrate dev --name student_profile_foundation
   ```

## What Happens During Migration

When you run the migration, Prisma will:

1. Create the `prisma/migrations/` directory
2. Generate SQL migration file for:
   - `Role` enum (STUDENT, DEPT_ADMIN, SUPER_ADMIN)
   - `SkillType` enum (TECHNICAL, SOFT)
   - `User` table with Clerk integration
   - `Department` table
   - `DepartmentAdmin` table with foreign keys
   - `Student` table with foreign keys to User and Department
   - `StudentAcademic` table (one-to-one with Student)
   - `StudentPreferences` table (one-to-one with Student)
   - `StudentSkill` table (many-to-one with Student)
   - `StudentProject` table (many-to-one with Student)
   - `StudentExperience` table (many-to-one with Student)
   - `StudentCertification` table (many-to-one with Student)
3. Execute the SQL against your database
4. Create all tables, indexes, and constraints

## Current Schema

```prisma
// Enums
enum Role {
  STUDENT
  DEPT_ADMIN
  SUPER_ADMIN
}

enum SkillType {
  TECHNICAL
  SOFT
}

// Core Models (Unit 02A)
model User {
  id                  String              @id @default(cuid())
  clerkId             String              @unique
  email               String              @unique
  role                Role
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  departmentAdmin     DepartmentAdmin?
  student             Student?
}

model Department {
  id        String              @id @default(cuid())
  name      String
  code      String              @unique
  isActive  Boolean             @default(true)
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
  admins    DepartmentAdmin[]
  students  Student[]
}

model DepartmentAdmin {
  id           String     @id @default(cuid())
  userId       String     @unique
  departmentId String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  user         User       @relation(...)
  department   Department @relation(...)
}

// Student Models (Unit 02B, 02C)
model Student {
  id           String   @id @default(cuid())
  userId       String   @unique
  departmentId String
  rollNumber   String   @unique
  name         String
  phoneNumber  String?
  linkedinUrl  String?
  githubUrl    String?
  portfolioUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  // Relations to profile data...
}

model StudentAcademic { ... }
model StudentPreferences { ... }
model StudentSkill { ... }
model StudentProject { ... }
model StudentExperience { ... }
model StudentCertification { ... }
```

## Verification After Migration

Once you have a database connected and migrated, verify with:

```bash
# Check migration status
npx prisma migrate status

# View database in Prisma Studio
npx prisma studio
```

## Troubleshooting

### "Can't reach database server"
- Make sure PostgreSQL is running (if local)
- Check connection string is correct
- Check firewall/network settings

### "Environment variable not found: DATABASE_URL"
- Make sure `.env.local` exists in project root
- Verify DATABASE_URL is set correctly
- Restart your terminal/IDE

### Migration conflicts
- If you get conflicts, you can reset with:
  ```bash
  npx prisma migrate reset
  ```
  ⚠️ This will delete all data!

## For Production

When deploying to Vercel:
1. Create production Neon database
2. Add DATABASE_URL to Vercel environment variables
3. Prisma will automatically run migrations on deployment

---

**Current Unit**: Unit 02 (Database & Student Foundation) - Complete schema defined, waiting for database connection to apply migrations.

**Next Unit**: Unit 03 (Authentication & Role Synchronization) - Will implement Clerk integration and student registration flow.
