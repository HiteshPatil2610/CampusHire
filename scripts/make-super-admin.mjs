/**
 * Interactive script to upgrade a user to Super Admin
 * 
 * Usage: node scripts/make-super-admin.mjs
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
  console.log('🔧 Super Admin Upgrade Tool\n');

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

  // Check if already super admin
  if (user.role === 'SUPER_ADMIN') {
    console.log(`\n✅ User is already a SUPER_ADMIN`);
    console.log('\n✨ No changes needed. You can access /super-admin-dashboard now.');
    rl.close();
    return;
  }

  // Warn if they have DepartmentAdmin record
  if (user.departmentAdmin) {
    console.log(`\n⚠️  Warning: This user is currently a DEPT_ADMIN`);
    console.log(`   Their DepartmentAdmin record will be removed`);
    console.log(`   Department: ${user.departmentAdmin.departmentId}`);
  }

  // Confirm upgrade
  const confirm = await question('\n⚠️  Upgrade this user to SUPER_ADMIN? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 Upgrading user...');

  // Upgrade in transaction
  await prisma.$transaction(async (tx) => {
    // Remove DepartmentAdmin record if exists
    if (user.departmentAdmin) {
      await tx.departmentAdmin.delete({
        where: { userId: user.id },
      });
      console.log('   Removed DepartmentAdmin record');
    }

    // Update role to SUPER_ADMIN
    await tx.user.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN' },
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
        publicMetadata: { role: 'SUPER_ADMIN' },
      });
      console.log('✅ Clerk synced');
    }
  } catch (error) {
    console.warn('⚠️  Clerk sync failed:', error.message);
    console.log('   (User can still access super admin pages after signing out/in)');
  }

  console.log('\n✨ SUCCESS! User upgraded to SUPER_ADMIN');
  console.log(`   Email: ${user.email}`);
  console.log('\n🔐 Next steps:');
  console.log('   1. Sign out of the application');
  console.log('   2. Sign back in');
  console.log('   3. Navigate to /super-admin-dashboard');
  console.log('\n📚 Super Admin can:');
  console.log('   - Manage departments');
  console.log('   - Assign/remove department admins');
  console.log('   - View audit logs');

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
