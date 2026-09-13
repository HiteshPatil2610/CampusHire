/**
 * Upgrade User to Department Admin
 * 
 * Usage:
 * 1. Update the EMAIL constant below with your user's email
 * 2. Run: npx tsx scripts/upgrade-to-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

// ⚠️ UPDATE THIS with your user's email
const EMAIL = 'your-email@example.com';

async function main() {
  console.log(`🔍 Looking for user with email: ${EMAIL}`);

  // 1. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: {
      departmentAdmin: true,
    },
  });

  if (!user) {
    console.error(`❌ User not found with email: ${EMAIL}`);
    console.log('\n💡 Make sure you have signed up with this email first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);

  // 2. Check if already a department admin
  if (user.role === 'DEPT_ADMIN' && user.departmentAdmin) {
    console.log(`✅ User is already a DEPT_ADMIN`);
    console.log(`   Department: ${user.departmentAdmin.departmentId}`);
    console.log('\n✨ No changes needed. You can access /admin-dashboard now.');
    return;
  }

  // 3. Find or create a department
  let department = await prisma.department.findFirst({
    where: { isActive: true },
  });

  if (!department) {
    console.log('📝 No active department found. Creating one...');
    department = await prisma.department.create({
      data: {
        name: 'Computer Science',
        code: 'CS',
        isActive: true,
      },
    });
    console.log(`✅ Created department: ${department.name} (${department.code})`);
  } else {
    console.log(`✅ Found department: ${department.name} (${department.code})`);
  }

  // 4. Upgrade user role and create DepartmentAdmin record
  console.log('\n🔄 Upgrading user to DEPT_ADMIN...');

  await prisma.$transaction(async (tx) => {
    // Update role in database
    await tx.user.update({
      where: { id: user.id },
      data: { role: 'DEPT_ADMIN' },
    });

    // Create DepartmentAdmin record
    await tx.departmentAdmin.create({
      data: {
        userId: user.id,
        departmentId: department.id,
      },
    });
  });

  console.log('✅ Database updated successfully');

  // 5. Sync role to Clerk
  console.log('🔄 Syncing role to Clerk...');
  try {
    const client = await clerkClient();
    await client.users.updateUser(user.clerkId, {
      publicMetadata: { role: 'DEPT_ADMIN' },
    });
    console.log('✅ Clerk metadata updated');
  } catch (error) {
    console.warn('⚠️  Clerk sync failed (user may need to sign out and back in):');
    console.warn(error);
  }

  console.log('\n✨ SUCCESS! User upgraded to DEPT_ADMIN');
  console.log(`   Email: ${user.email}`);
  console.log(`   Department: ${department.name} (${department.code})`);
  console.log('\n🔐 Next steps:');
  console.log('   1. Sign out of the application');
  console.log('   2. Sign back in with this account');
  console.log('   3. Navigate to /admin-dashboard');
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
