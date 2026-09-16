/**
 * Script to promote a user to SUPER_ADMIN role
 * Usage: npx tsx scripts/make-super-admin.ts <email>
 */

// Load environment variables first
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { retireStudentRecord } from "@/features/admin-accounts/utils/retire-student-record";

async function makeSuperAdmin(email: string) {
  console.log(`\n🔍 Looking for user: ${email}\n`);

  // 1. Find user in database
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User not found in database: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Found user in database:`);
  console.log(`   - ID: ${user.id}`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Current Role: ${user.role}`);
  console.log(`   - Clerk ID: ${user.clerkId}\n`);

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

  if (user.role === "SUPER_ADMIN") {
    console.log(`✅ User is already a SUPER_ADMIN`);
    process.exit(0);
  }

  // 2. Update database
  console.log(`📝 Updating database role to SUPER_ADMIN...`);
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });
  console.log(`✅ Database updated\n`);

  // 3. Update Clerk metadata
  console.log(`📝 Syncing role to Clerk metadata...`);
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.clerkId, {
    publicMetadata: {
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✅ Clerk metadata synced\n`);

  console.log(`🎉 SUCCESS! ${email} is now a SUPER_ADMIN\n`);
  console.log(`Next steps:`);
  console.log(`   1. Log out if currently logged in`);
  console.log(`   2. Log back in`);
  console.log(`   3. Navigate to /super-admin-dashboard\n`);
}

// Get email from command line args
const email = process.argv[2];

if (!email) {
  console.error(`\n❌ Error: Email required`);
  console.log(`\nUsage: npx tsx scripts/make-super-admin.ts <email>\n`);
  console.log(`Example: npx tsx scripts/make-super-admin.ts admin@campushire.edu\n`);
  process.exit(1);
}

makeSuperAdmin(email)
  .catch((error) => {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
