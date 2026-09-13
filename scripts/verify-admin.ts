/**
 * Script to verify a user's admin status and department assignment
 * Usage: npx tsx scripts/verify-admin.ts <email>
 */

// Load environment variables first
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

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
