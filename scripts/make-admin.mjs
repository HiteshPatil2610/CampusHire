/**
 * Interactive script to upgrade a user to Department Admin
 * 
 * Usage: node scripts/make-admin.mjs
 */

import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('🔧 Department Admin Upgrade Tool\n');

  // Get email from user
  const email = await question('Enter user email: ');

  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address');
    process.exit(1);
  }

  console.log(`\n🔍 Looking for user: ${email}`);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.trim() },
    include: {
      departmentAdmin: true,
    },
  });

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\n💡 Tips:');
    console.log('   - Make sure the user has signed up first');
    console.log('   - Check for typos in the email address');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email}`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Current Role: ${user.role}`);

  // Check if already admin
  if (user.role === 'DEPT_ADMIN' && user.departmentAdmin) {
    console.log(`\n✅ User is already a DEPT_ADMIN`);
    console.log(`   Department ID: ${user.departmentAdmin.departmentId}`);
    console.log('\n✨ No changes needed. You can access /admin-dashboard now.');
    rl.close();
    return;
  }

  // Find or create department
  let department = await prisma.department.findFirst({
    where: { isActive: true },
  });

  if (!department) {
    console.log('\n📝 No active department found. Creating default department...');
    department = await prisma.department.create({
      data: {
        name: 'Computer Science',
        code: 'CS',
        isActive: true,
      },
    });
    console.log(`✅ Created: ${department.name} (${department.code})`);
  } else {
    console.log(`\n📚 Department: ${department.name} (${department.code})`);
  }

  // Confirm upgrade
  const confirm = await question('\n⚠️  Upgrade this user to DEPT_ADMIN? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 Upgrading user...');

  // Upgrade in transaction
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
    if (!clerkSecretKey) {
      console.warn('⚠️  CLERK_SECRET_KEY not found, skipping Clerk sync');
    } else {
      const clerk = createClerkClient({ secretKey: clerkSecretKey });
      await clerk.users.updateUser(user.clerkId, {
        publicMetadata: { role: 'DEPT_ADMIN' },
      });
      console.log('✅ Clerk synced');
    }
  } catch (error) {
    console.warn('⚠️  Clerk sync failed:', error.message);
    console.log('   (User can still access admin pages after signing out/in)');
  }

  console.log('\n✨ SUCCESS! User upgraded to DEPT_ADMIN');
  console.log(`   Email: ${user.email}`);
  console.log(`   Department: ${department.name}`);
  console.log('\n🔐 Next steps:');
  console.log('   1. Sign out of the application');
  console.log('   2. Sign back in');
  console.log('   3. Navigate to /admin-dashboard');

  rl.close();
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
