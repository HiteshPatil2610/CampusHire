/**
 * Script to promote a user to DEPT_ADMIN role and assign to a department
 * Usage: npx tsx scripts/make-dept-admin.ts <email> <department-code>
 */

// Load environment variables first
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { retireStudentRecord } from "@/features/admin-accounts/utils/retire-student-record";

async function makeDeptAdmin(email: string, departmentCode: string) {
  console.log(`\n🔍 Looking for user: ${email}\n`);

  // 1. Find user in database
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      departmentAdmin: {
        include: {
          department: true,
        },
      },
    },
  });

  if (!user) {
    console.error(`❌ User not found in database: ${email}`);
    console.log(`\n💡 User must be registered in the system first.`);
    process.exit(1);
  }

  console.log(`✅ Found user in database:`);
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Current Role: ${user.role}`);
  console.log(`   - Clerk ID: ${user.clerkId}\n`);

  // 2. Find department
  console.log(`🔍 Looking for department: ${departmentCode}\n`);
  const department = await prisma.department.findUnique({
    where: { code: departmentCode },
  });

  if (!department) {
    console.error(`❌ Department not found: ${departmentCode}`);
    console.log(`\n💡 Available departments:`);
    const departments = await prisma.department.findMany({
      select: { code: true, name: true },
    });
    departments.forEach((dept) => {
      console.log(`   - ${dept.code}: ${dept.name}`);
    });
    console.log();
    process.exit(1);
  }

  console.log(`✅ Found department:`);
  console.log(`   - ID: ${department.id}`);
  console.log(`   - Code: ${department.code}`);
  console.log(`   - Name: ${department.name}\n`);

  // Retire any leftover student record BEFORE the "already an admin" exit
  // below, so re-running this script also repairs an account promoted earlier.
  const retirement = await retireStudentRecord(prisma, user.id);
  if (retirement.action === "refuse") {
    console.error(`❌ ${retirement.reason}\n`);
    process.exit(1);
  }
  if (retirement.applied) {
    console.log(`🧹 ${retirement.reason}`);
    console.log(`   They no longer appear in the student roster or counts.\n`);
  }

  // 3. Check if already a dept admin for this department
  if (user.role === "DEPT_ADMIN" && user.departmentAdmin) {
    if (user.departmentAdmin.departmentId === department.id) {
      console.log(`✅ User is already a DEPT_ADMIN for ${department.name}`);
      process.exit(0);
    } else {
      console.log(
        `⚠️  User is already a DEPT_ADMIN for ${user.departmentAdmin.department.name}`
      );
      console.log(`   Reassigning to ${department.name}...\n`);
    }
  }

  // 4. Update database role
  console.log(`📝 Updating user role to DEPT_ADMIN...`);
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "DEPT_ADMIN" },
  });
  console.log(`✅ Role updated\n`);

  // 5. Create or update DepartmentAdmin record
  if (user.departmentAdmin) {
    console.log(`📝 Updating department assignment...`);
    await prisma.departmentAdmin.update({
      where: { id: user.departmentAdmin.id },
      data: { departmentId: department.id },
    });
  } else {
    console.log(`📝 Creating department admin record...`);
    await prisma.departmentAdmin.create({
      data: {
        userId: user.id,
        departmentId: department.id,
      },
    });
  }
  console.log(`✅ Department assignment complete\n`);

  // 6. Update Clerk metadata
  console.log(`📝 Syncing role to Clerk metadata...`);
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.clerkId, {
      publicMetadata: {
        role: "DEPT_ADMIN",
        departmentId: department.id,
      },
    });
    console.log(`✅ Clerk metadata synced\n`);
  } catch (clerkError) {
    console.log(`⚠️  Clerk metadata sync failed (this is OK - will sync on next login)`);
    console.log(`   Error: ${clerkError instanceof Error ? clerkError.message : String(clerkError)}\n`);
  }

  console.log(`🎉 SUCCESS! ${email} is now a DEPT_ADMIN for ${department.name}\n`);
  console.log(`📌 Database changes complete. Role will be active on next login.\n`);
  console.log(`Next steps:`);
  console.log(`   1. Log out if currently logged in`);
  console.log(`   2. Log back in (this will sync the role to Clerk)`);
  console.log(`   3. Navigate to /admin-dashboard\n`);
}

// Get email and department code from command line args
const email = process.argv[2];
const departmentCode = process.argv[3];

if (!email || !departmentCode) {
  console.error(`\n❌ Error: Email and department code required`);
  console.log(`\nUsage: npx tsx scripts/make-dept-admin.ts <email> <department-code>\n`);
  console.log(
    `Example: npx tsx scripts/make-dept-admin.ts admin@example.com COMPS\n`
  );
  process.exit(1);
}

makeDeptAdmin(email, departmentCode.toUpperCase())
  .catch((error) => {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
