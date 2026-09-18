/**
 * Read-only sanity check of whatever DATABASE_URL points at.
 *
 * Run it after a restore to confirm the data is where you expect:
 *   npx tsx scripts/verify-db.ts
 */
import { config } from 'dotenv';
// Env lives in two files and the split matters: .env.local holds the
// hand-managed keys (Clerk, Blob) while .env is written by the Neon CLI and
// owns DATABASE_URL. Load .env first, then .env.local, both with override, so
// .env.local wins over .env AND both win over a value exported in the shell.
// Without override dotenv keeps whatever is already in process.env, and a
// forgotten machine-level CLERK_SECRET_KEY silently aims these scripts at a
// different Clerk application than the files name — which read as every User
// row being "orphaned". This deliberately differs from `next dev`, where the
// shell still wins; if the app and these scripts ever disagree, clear the shell.
config({ path: ".env", override: true });
config({ path: ".env.local", override: true });
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

  // An empty database is a perfectly good state for a freshly created project,
  // so this reports what it found rather than judging it. What it is really
  // for is confirming *which* database answered.
  const empty = users === 0 && students === 0 && depts === 0;
  console.log(
    empty
      ? '\nReachable, schema present, no rows yet — expected on a fresh project.\n'
      : '\nReachable, and holding data.\n'
  );

  await prisma.$disconnect();
})();
