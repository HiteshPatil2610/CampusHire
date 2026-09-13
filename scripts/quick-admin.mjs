/**
 * Quick script to upgrade the first STUDENT user to DEPT_ADMIN
 */

import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding STUDENT users...\n');

  // Find all student users
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: { departmentAdmin: true },
    take: 10,
  });

  if (students.length === 0) {
    console.error('❌ No STUDENT users found');
    console.log('💡 Please sign up first at /sign-up');
    process.exit(1);
  }

  console.log('📋 Found users:');
  students.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
  });

  // Upgrade the first one
  const user = students[0];
  console.log(`\n✅ Upgrading: ${user.email}`);

  // Find or create department
  let department = await prisma.department.findFirst({
    where: { isActive: true },
  });

  if (!department) {
    console.log('📝 Creating default department...');
    department = await prisma.department.create({
      data: {
        name: 'Computer Science',
        code: 'CS',
        isActive: true,
      },
    });
    console.log(`✅ Created: ${department.name} (${department.code})`);
  } else {
    console.log(`📚 Department: ${department.name} (${department.code})`);
  }

  // Upgrade in transaction
  console.log('\n🔄 Upgrading to DEPT_ADMIN...');
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { role: 'DEPT_ADMIN' },
    });

    await tx.departmentAdmin.create({
      data: {
        userId: user.id,
        departmentId: department.id,
      },
    });
  });

  console.log('✅ Database updated');

  // Sync to Clerk
  console.log('🔄 Syncing to Clerk...');
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey) {
      const clerk = createClerkClient({ secretKey: clerkSecretKey });
      await clerk.users.updateUser(user.clerkId, {
        publicMetadata: { role: 'DEPT_ADMIN' },
      });
      console.log('✅ Clerk synced');
    }
  } catch (error) {
    console.warn('⚠️  Clerk sync failed (sign out/in will sync)');
  }

  console.log('\n✨ SUCCESS! User upgraded to DEPT_ADMIN');
  console.log(`   Email: ${user.email}`);
  console.log(`   Department: ${department.name}`);
  console.log('\n🔐 Next steps:');
  console.log('   1. Sign out of the application');
  console.log('   2. Sign back in');
  console.log('   3. Navigate to /admin-dashboard');
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
