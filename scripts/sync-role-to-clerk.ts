/**
 * Script to sync database role to Clerk metadata
 * Usage: npx tsx scripts/sync-role-to-clerk.ts <email>
 */

// Load environment variables first
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
// Env lives in two files and the split matters: .env.local holds the
// hand-managed keys (Clerk, Blob) while .env is written by the Neon CLI and
// owns DATABASE_URL. Load .env first, then .env.local, both with override, so
// .env.local wins over .env AND both win over a value exported in the shell.
// Without override dotenv keeps whatever is already in process.env, and a
// forgotten machine-level CLERK_SECRET_KEY silently aims these scripts at a
// different Clerk application than the files name — which read as every User
// row being "orphaned". This deliberately differs from `next dev`, where the
// shell still wins; if the app and these scripts ever disagree, clear the shell.
config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";

async function syncRoleToClerk(email: string) {
  console.log(`\n🔍 Looking for user: ${email}\n`);

  // Check for Clerk secret key
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error(`❌ CLERK_SECRET_KEY not found in environment variables`);
    console.log(`   Make sure .env.local contains CLERK_SECRET_KEY\n`);
    process.exit(1);
  }

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

  // 2. Sync to Clerk
  console.log(`📝 Syncing role to Clerk metadata...`);
  
  try {
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    await clerk.users.updateUserMetadata(user.clerkId, {
      publicMetadata: {
        role: user.role,
      },
    });
    console.log(`✅ Clerk metadata synced successfully\n`);
    
    console.log(`🎉 SUCCESS! Role synced to Clerk\n`);
    console.log(`Next steps:`);
    console.log(`   1. Log out if currently logged in`);
    console.log(`   2. Log back in`);
    console.log(`   3. Navigate to /super-admin-dashboard\n`);
  } catch (error) {
    console.error(`❌ Failed to sync to Clerk:`, error);
    console.log(`\n⚠️  The database role is correct (${user.role})`);
    console.log(`   But Clerk sync failed. You may need to update Clerk manually.\n`);
    process.exit(1);
  }
}

// Get email from command line args
const email = process.argv[2];

if (!email) {
  console.error(`\n❌ Error: Email required`);
  console.log(`\nUsage: npx tsx scripts/sync-role-to-clerk.ts <email>\n`);
  console.log(`Example: npx tsx scripts/sync-role-to-clerk.ts admin@campushire.edu\n`);
  process.exit(1);
}

syncRoleToClerk(email)
  .catch((error) => {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
