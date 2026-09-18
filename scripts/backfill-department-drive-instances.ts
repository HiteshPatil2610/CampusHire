/**
 * Backfill one Department Drive instance per existing assignment.
 *
 *   npx tsx scripts/backfill-department-drive-instances.ts --dry-run
 *   npx tsx scripts/backfill-department-drive-instances.ts
 *
 * Why this is required, not optional: student visibility is gated on
 * `DriveDepartmentConfig.status = 'PUBLISHED'` for the student's own
 * department. Before this migration the instance table was empty — 97
 * `DriveEligibleDepartment` rows and 0 instances — so without a backfill every
 * drive students can currently see would vanish from their lists.
 *
 * Existing instances are created as PUBLISHED because those drives are already
 * live: students can see and apply to them today, and the backfill must not
 * change that. `publishedAt` is set to the drive's creation time rather than
 * "now", so the record does not claim the drive was released during the
 * migration. `lockedAt` is set to match, because those drives already have
 * applications and their content must not become editable.
 *
 * Idempotent: the unique (driveId, departmentId) constraint is the guard, and
 * an assignment that already has an instance is skipped and reported. Safe to
 * re-run after a partial failure.
 *
 * Read-only unless invoked without --dry-run. Writes nothing else: no drive
 * row, no application, no notification.
 */
import { config } from 'dotenv';
// Env lives in two files and the split matters: .env is written by the Neon CLI
// and owns DATABASE_URL, .env.local holds the hand-managed keys. Load .env
// first, then .env.local, both with override.
config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * `--database-url <url>` targets a specific database, overriding .env.
 *
 * This exists because the dotenv calls above use `override: true`, so a
 * DATABASE_URL exported in the shell is *ignored* — which makes the obvious
 * way to aim this at a Neon test branch silently run it against production
 * instead. An explicit flag is the only safe way to point it elsewhere.
 */
const urlFlagIndex = process.argv.indexOf('--database-url');
const DATABASE_URL =
  urlFlagIndex !== -1 ? process.argv[urlFlagIndex + 1] : process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('\nNo DATABASE_URL. Set it in .env or pass --database-url <url>.\n');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

(async () => {
  const dbHost = DATABASE_URL.match(/@([^/]+)/)?.[1] ?? 'unknown';
  console.log(`\nDatabase: ${dbHost}`);
  console.log(DRY_RUN ? 'Mode:     DRY RUN (nothing will be written)\n' : 'Mode:     WRITE\n');

  const [links, existing] = await Promise.all([
    prisma.driveEligibleDepartment.findMany({
      select: {
        driveId: true,
        departmentId: true,
        drive: { select: { createdAt: true, companyName: true } },
        department: { select: { code: true } },
      },
    }),
    prisma.driveDepartmentConfig.findMany({
      select: { driveId: true, departmentId: true },
    }),
  ]);

  const have = new Set(existing.map((row) => `${row.driveId}:${row.departmentId}`));
  const missing = links.filter(
    (link) => !have.has(`${link.driveId}:${link.departmentId}`)
  );

  console.log(`Assignments (DriveEligibleDepartment): ${links.length}`);
  console.log(`Existing instances:                    ${existing.length}`);
  console.log(`Instances to create:                   ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('Nothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  const sample = missing.slice(0, 10);
  console.log('Sample of what will be created (status=PUBLISHED):');
  for (const link of sample) {
    console.log(
      `  ${link.department.code.padEnd(6)} ${link.drive.companyName.slice(0, 34).padEnd(34)} publishedAt=${link.drive.createdAt.toISOString()}`
    );
  }
  if (missing.length > sample.length) {
    console.log(`  … and ${missing.length - sample.length} more`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('Dry run complete. Re-run without --dry-run to apply.\n');
    await prisma.$disconnect();
    return;
  }

  // skipDuplicates makes the unique constraint the real guard, so a concurrent
  // run or a re-run after a partial failure cannot double-insert.
  const result = await prisma.driveDepartmentConfig.createMany({
    data: missing.map((link) => ({
      driveId: link.driveId,
      departmentId: link.departmentId,
      status: 'PUBLISHED' as const,
      // The assignment predates this migration; dating it to the drive's
      // creation is closer to the truth than "now".
      assignedAt: link.drive.createdAt,
      publishedAt: link.drive.createdAt,
      // These drives already carry applications — their content must be locked.
      lockedAt: link.drive.createdAt,
      // Nobody published them through the app, so there is no user to record.
      publishedByUserId: null,
    })),
    skipDuplicates: true,
  });

  const finalCount = await prisma.driveDepartmentConfig.count();

  console.log(`Created ${result.count} instance(s).`);
  console.log(`Instances now: ${finalCount} (assignments: ${links.length})`);

  if (finalCount !== links.length) {
    console.log(
      `\nWARNING: counts disagree. Every assignment should have exactly one instance.`
    );
    process.exitCode = 1;
  } else {
    console.log('\nEvery assignment has an instance.\n');
  }

  await prisma.$disconnect();
})();
