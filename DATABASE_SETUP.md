# Database Setup Guide

## Prerequisites

- Neon PostgreSQL database (or any PostgreSQL instance)
- DATABASE_URL configured in `.env.local`

## Current Database URL

```
postgresql://neondb_owner:npg_KFUBsPhrw6C0@ep-bold-pine-ae4zx21e-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

⚠️ **Note:** This URL is exposed in this file for development purposes. In production, always use environment variables.

## Database Schema

The schema is defined in `prisma/schema.prisma` and includes:
- User (with Clerk integration)
- Department
- DepartmentAdmin
- Student (with profile sections)
- Drive
- DriveApplication
- AuditLog
- Notification

## Running Migrations

### Option 1: Using Prisma CLI (requires DATABASE_URL in .env.local)

```bash
npx prisma migrate dev --name migration_name
```

### Option 2: Manual SQL Execution (if DATABASE_URL not in .env.local)

```bash
# Set environment variable temporarily
$env:DATABASE_URL="postgresql://neondb_owner:..."

# Execute migration
Get-Content migration.sql | npx prisma db execute --stdin --schema prisma/schema.prisma
```

## Seeding the Database

The seed script (`prisma/seed.ts`) creates initial data for development and testing.

### What Gets Seeded

**Departments:**
- Computer Engineering (COMP)
- Information Technology (IT)
- Electronics and Telecommunication (EXTC)
- Mechanical Engineering (MECH)
- Chemical Engineering (CHEM)
- Instrumentation Engineering (INST)

### Running the Seed Script

#### If DATABASE_URL is in .env.local:

```bash
npm run db:seed
```

#### If DATABASE_URL is NOT in .env.local:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://neondb_owner:npg_KFUBsPhrw6C0@ep-bold-pine-ae4zx21e-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"; npm run db:seed
```

### Seed Script Behavior

- **Idempotent:** Running the seed multiple times is safe
- **Skip existing:** If a department already exists (by code), it will be skipped
- **Output:** Shows which departments were created or skipped

### Example Output

```
🌱 Starting database seed...
📚 Creating departments...
  ✅ Created department: Computer Engineering (COMP)
  ✅ Created department: Information Technology (IT)
  ✅ Created department: Electronics and Telecommunication (EXTC)
  ✅ Created department: Mechanical Engineering (MECH)
  ✅ Created department: Chemical Engineering (CHEM)
  ✅ Created department: Instrumentation Engineering (INST)

✨ Seed completed successfully!
```

## Verifying the Data

### Using Prisma Studio

```bash
npx prisma studio
```

This opens a web interface at http://localhost:5555 where you can browse all data.

### Using SQL Client

Connect to your Neon database using any PostgreSQL client and run:

```sql
SELECT * FROM "Department";
```

## Common Issues

### 1. Environment variable not found: DATABASE_URL

**Solution:** Set the DATABASE_URL environment variable before running commands:

```bash
# Windows PowerShell
$env:DATABASE_URL="your-database-url"

# Then run your command
npm run db:seed
```

### 2. Migration failed: table already exists

**Solution:** This usually means the migration was already applied. Check migration status:

```bash
npx prisma migrate status
```

### 3. Seed script fails with unique constraint error

**Solution:** The seed script is idempotent and should skip existing records. If you still get errors, check that the `code` field is being used correctly in the `findFirst` query.

## Resetting the Database (Danger Zone)

⚠️ **WARNING:** This will delete ALL data!

```bash
# Reset database (deletes all data and re-runs migrations)
npx prisma migrate reset

# This will also run the seed script automatically
```

## Production Considerations

1. **Never commit .env files** with production credentials
2. **Use environment variables** in production (Vercel, Netlify, etc.)
3. **Run migrations** through CI/CD pipeline
4. **Backup data** before running migrations in production
5. **Test migrations** in staging environment first

## Adding More Seed Data

To add more initial data (e.g., test users, sample drives), edit `prisma/seed.ts`:

```typescript
// Example: Add a test drive
const drive = await prisma.drive.create({
  data: {
    companyName: "Google",
    roleName: "Software Engineer",
    // ... other fields
  },
});
```

Then run `npm run db:seed` again.

## Migration History

See `prisma/migrations/` folder for all applied migrations with timestamps.

Current migrations:
1. `20260904192335_student_profile_foundation` - Initial schema with User, Department, Student models
2. Manual migration - Added AuditLog table
3. Manual migration - Added Notification table

## Need Help?

- Prisma Docs: https://www.prisma.io/docs
- Neon Docs: https://neon.tech/docs
- Check `context/progress-tracker.md` for implementation status
