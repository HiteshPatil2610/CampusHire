/**
 * Give every application submitted before snapshots existed a BACKFILL
 * snapshot, built from only what was recorded at submission time.
 *
 *   npx tsx scripts/backfill-application-snapshots.ts --dry-run
 *   npx tsx scripts/backfill-application-snapshots.ts
 *   npx tsx scripts/backfill-application-snapshots.ts --dry-run --database-url <url>
 *
 * What goes in: the inline columns every application already has —
 * `snapshotCgpa`, `snapshotBacklogs`, `submittedDetails`, `consentAcceptedAt`,
 * `appliedAt` — and the student and drive ids. What does not: the eligibility
 * rules, form, drive content and placement state at the time. Those were never
 * recorded, and deriving them from today's data would state today's rules as
 * the ones the student was judged on. The payload lists them under
 * `notCaptured` instead, and the row has no hashes (the CHECK constraint
 * allows that only for origin BACKFILL).
 *
 * Nothing existing is modified: snapshots are inserted, applications are not
 * touched (a trigger would refuse it anyway).
 *
 * Idempotent: only applications with no snapshot are selected, and
 * `skipDuplicates` on the unique `applicationId` covers a concurrent writer.
 * Inserts go in batches of 500 — round trips, not rows, are what cost here.
 *
 * Read-only unless invoked without --dry-run.
 */
import { config } from 'dotenv';
// .env owns DATABASE_URL (written by the Neon CLI); .env.local holds the rest.
config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';
import { buildBackfillSnapshot } from '../features/applications/utils/application-snapshot';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 500;

/**
 * `--database-url <url>` targets a specific database, overriding .env. The
 * dotenv calls above use `override: true`, so a DATABASE_URL exported in the
 * shell is ignored — this flag is the only safe way to aim at a test branch.
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

  const [total, missing] = await Promise.all([
    prisma.driveApplication.count(),
    prisma.driveApplication.findMany({
      where: { snapshot: null },
      select: {
        id: true,
        studentId: true,
        driveId: true,
        appliedAt: true,
        snapshotCgpa: true,
        snapshotBacklogs: true,
        submittedDetails: true,
        consentAcceptedAt: true,
      },
      orderBy: { appliedAt: 'asc' },
    }),
  ]);

  const withCgpa = missing.filter((a) => a.snapshotCgpa !== null).length;
  const withDetails = missing.filter((a) => a.submittedDetails !== null).length;
  const withConsent = missing.filter((a) => a.consentAcceptedAt !== null).length;

  console.log(`Applications:                  ${total}`);
  console.log(`Without a snapshot:            ${missing.length}`);
  console.log(`  …with recorded CGPA/backlogs ${withCgpa}`);
  console.log(`  …with submittedDetails       ${withDetails}`);
  console.log(`  …with consent timestamp      ${withConsent}`);

  if (missing.length > 0) {
    const sample = buildBackfillSnapshot(missing[0]);
    console.log(`\nSample payload (${missing[0].id}):\n  ${sample.payload}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — nothing written.\n');
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (let start = 0; start < missing.length; start += BATCH) {
    const batch = missing.slice(start, start + BATCH);
    const result = await prisma.driveApplicationSnapshot.createMany({
      data: batch.map((application) => {
        const built = buildBackfillSnapshot(application);
        return {
          applicationId: application.id,
          origin: 'BACKFILL' as const,
          schemaVersion: built.schemaVersion,
          payload: built.payload,
        };
      }),
      skipDuplicates: true,
    });
    written += result.count;
    console.log(`  batch ${start / BATCH + 1}: ${result.count} written`);
  }

  console.log(`\nWrote ${written} BACKFILL snapshot(s). No application was modified.\n`);
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
