/**
 * Script to verify a user's admin status and department assignment
 * Usage: npx tsx scripts/verify-admin.ts <email>
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

import { prisma } from "@/lib/prisma";

async function verifyAdmin(email: string) {
  console.log(`\n🔍 Checking admin status for: ${email}\n`);

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
    console.error(`❌ User not found: ${email}\n`);
    process.exit(1);
  }

  console.log(`✅ User found:`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - Clerk ID: ${user.clerkId}`);

  if (user.role === "DEPT_ADMIN" && user.departmentAdmin) {
    console.log(`\n📌 Department Admin Details:`);
    console.log(`   - Department: ${user.departmentAdmin.department.name}`);
    console.log(`   - Department Code: ${user.departmentAdmin.department.code}`);
    console.log(`   - Department ID: ${user.departmentAdmin.departmentId}`);
  } else if (user.role === "SUPER_ADMIN") {
    console.log(`\n📌 Super Admin (all departments access)`);
  } else if (user.role === "STUDENT") {
    console.log(`\n📌 Student account`);
  }

  console.log();
}

const email = process.argv[2];

if (!email) {
  console.error(`\n❌ Error: Email required`);
  console.log(`\nUsage: npx tsx scripts/verify-admin.ts <email>\n`);
  process.exit(1);
}

verifyAdmin(email)
  .catch((error) => {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
