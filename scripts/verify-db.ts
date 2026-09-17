/**
 * Read-only sanity check of whatever DATABASE_URL points at.
 *
 * Run it after a restore to confirm the data is where you expect:
 *   npx tsx scripts/verify-db.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)/)?.[1] ?? 'unknown';
  console.log(`\nconnected to: ${host}\n`);

  const [users, students, depts, drives, apps, notifs, audits] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.department.count(),
    prisma.drive.count(),
    prisma.driveApplication.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ]);

  console.log(`  users         ${users}`);
  console.log(`  students      ${students}`);
  console.log(`  departments   ${depts}`);
  console.log(`  drives        ${drives}`);
  console.log(`  applications  ${apps}`);
  console.log(`  notifications ${notifs}`);
  console.log(`  auditLogs     ${audits}`);

  const byRole = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
  console.log('\n  roles: ' + byRole.map((r) => `${r.role}=${r._count._all}`).join(' '));

  const linked = await prisma.student.findMany({
    where: { userId: { not: null } },
    select: { email: true, rollNumber: true },
    orderBy: { email: 'asc' },
  });
  console.log('\n  linked student accounts:');
  for (const s of linked) console.log(`    ${s.email}  roll=${s.rollNumber ?? '-'}`);

  const yours = await prisma.student.count({ where: { NOT: { email: { endsWith: '@seed.test' } } } });
  const yourDepts = await prisma.department.findMany({
    where: { NOT: { code: { startsWith: 'SD' } } },
    select: { code: true },
    orderBy: { code: 'asc' },
  });
  console.log(`\n  your own students: ${yours}`);
  console.log(`  your departments:  ${yourDepts.map((d) => d.code).join(', ')}`);

  const ok = users > 0 && students > 0 && depts > 0;
  console.log(ok ? '\nLooks healthy.\n' : '\nEMPTY — this is not the restored data.\n');

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
})();
