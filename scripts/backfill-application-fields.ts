/**
 * Backfill `DriveApplicationField` rows from the legacy `applicationFields`
 * JSON, and snapshot the form of every already-published central-drive
 * department instance.
 *
 *   npx tsx scripts/backfill-application-fields.ts --dry-run
 *   npx tsx scripts/backfill-application-fields.ts
 *   npx tsx scripts/backfill-application-fields.ts --dry-run --database-url <url>
 *
 * Two passes:
 *
 * 1. **Convert.** Every master drive and every department instance whose JSON
 *    column holds a form but which has no rows yet gets rows parsed from that
 *    JSON by `parseLegacyApplicationFields` — the same parser the read path's
 *    legacy fallback uses, so the rows are exactly the form students already
 *    see. Unknown or duplicate keys are dropped and *reported*, never guessed
 *    at. The JSON column is left untouched: it is not deleted yet, and keeping
 *    it byte-for-byte means nothing is lost if a dropped key turns out to
 *    matter.
 *
 * 2. **Snapshot.** A published (or closed/archived) instance of a *central*
 *    drive that still inherits its form gets its own copy of the form it
 *    resolves to today — what `publishDepartmentDrive` now does at publish
 *    time. Without it, a later change to the master's default could reach
 *    students who already applied. Department-owned drives are skipped: their
 *    master *is* the department's form, and it freezes on first application.
 *
 * Idempotent: an owner that already has rows is skipped in both passes, so a
 * re-run after a partial failure writes only what is still missing. Each
 * owner is written in its own transaction.
 *
 * Read-only unless invoked without --dry-run.
 */
import { config } from 'dotenv';
// .env owns DATABASE_URL (written by the Neon CLI); .env.local holds the rest.
config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';
import {
  parseLegacyApplicationFields,
  resolveApplicationForm,
  type ApplicationFieldConfig,
} from '../features/drives/domain/application-form';

const DRY_RUN = process.argv.includes('--dry-run');

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

function toRows(fields: ApplicationFieldConfig[]) {
  return fields.map((field) => ({
    fieldKey: field.fieldKey,
    label: field.label,
    source: field.source,
    category: field.category,
    description: field.description,
    isRequired: field.isRequired,
    isEnabled: field.isEnabled,
    sortOrder: field.sortOrder,
    permission: field.permission,
  }));
}

const PUBLISHED_OR_LATER = new Set(['PUBLISHED', 'CLOSED', 'ARCHIVED']);

(async () => {
  const dbHost = DATABASE_URL.match(/@([^/]+)/)?.[1] ?? 'unknown';
  console.log(`\nDatabase: ${dbHost}`);
  console.log(DRY_RUN ? 'Mode:     DRY RUN (nothing will be written)\n' : 'Mode:     WRITE\n');

  // One read for everything: every drive with its row count, and each of its
  // instances with theirs. The data is small; round trips are what cost.
  const drives = await prisma.drive.findMany({
    select: {
      id: true,
      companyName: true,
      isCentralDrive: true,
      applicationFields: true,
      formFields: true,
      departmentConfigs: {
        select: {
          id: true,
          status: true,
          lockedAt: true,
          applicationFields: true,
          department: { select: { code: true } },
          formFields: true,
        },
      },
    },
  });

  type Write =
    | { owner: 'master'; id: string; label: string; fields: ApplicationFieldConfig[] }
    | { owner: 'department'; id: string; label: string; fields: ApplicationFieldConfig[] };

  const converts: Write[] = [];
  const snapshots: (Write & { origin: string })[] = [];
  const dropped: { owner: string; key: string; reason: string }[] = [];

  for (const drive of drives) {
    // Pass 1a — the master's own JSON.
    let masterFields: ApplicationFieldConfig[] = drive.formFields;
    if (drive.formFields.length === 0 && drive.applicationFields) {
      const parsed = parseLegacyApplicationFields(drive.applicationFields);
      parsed.dropped.forEach((d) =>
        dropped.push({ owner: `master ${drive.companyName} (${drive.id})`, ...d })
      );
      if (parsed.fields.length > 0) {
        converts.push({
          owner: 'master',
          id: drive.id,
          label: drive.companyName,
          fields: parsed.fields,
        });
        masterFields = parsed.fields;
      }
    }

    for (const instance of drive.departmentConfigs) {
      const label = `${drive.companyName} / ${instance.department.code}`;
      if (instance.formFields.length > 0) continue;

      // Pass 1b — the instance's own JSON.
      if (instance.applicationFields) {
        const parsed = parseLegacyApplicationFields(instance.applicationFields);
        parsed.dropped.forEach((d) =>
          dropped.push({ owner: `department ${label} (${instance.id})`, ...d })
        );
        if (parsed.fields.length > 0) {
          converts.push({ owner: 'department', id: instance.id, label, fields: parsed.fields });
          continue;
        }
      }

      // Pass 2 — snapshot what a published central instance inherits today.
      const published =
        PUBLISHED_OR_LATER.has(instance.status) || instance.lockedAt !== null;
      if (drive.isCentralDrive && published) {
        const resolved = resolveApplicationForm({
          departmentFields: [],
          departmentLegacyJson: null,
          masterFields,
          masterLegacyJson: null,
        });
        snapshots.push({
          owner: 'department',
          id: instance.id,
          label,
          fields: resolved.fields,
          // DEFAULT here means the catalog default form.
          origin: resolved.origin === 'MASTER' ? 'master form' : 'catalog default',
        });
      }
    }
  }

  console.log(`Drives scanned:                  ${drives.length}`);
  console.log(
    `Department instances scanned:    ${drives.reduce((n, d) => n + d.departmentConfigs.length, 0)}`
  );
  console.log(`Legacy JSON forms to convert:    ${converts.length}`);
  console.log(`Published instances to snapshot: ${snapshots.length}`);
  console.log(`Dropped keys:                    ${dropped.length}\n`);

  for (const write of converts) {
    console.log(`  convert  ${write.owner.padEnd(10)} ${write.label}: ${write.fields.length} field(s)`);
  }
  for (const write of snapshots) {
    console.log(
      `  snapshot department ${write.label}: ${write.fields.length} field(s) from ${write.origin}`
    );
  }
  for (const d of dropped) {
    console.log(`  DROPPED  ${d.owner}: "${d.key}" — ${d.reason}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — nothing written.\n');
    await prisma.$disconnect();
    return;
  }

  // One transaction, three round trips, however many owners: re-read which
  // owners already have rows (a concurrent save or an earlier run may have
  // written some since the scan), then insert the rest in one statement.
  // Round trips, not rows, are what cost on this database.
  const written = await prisma.$transaction(async (tx) => {
    const existing = await tx.driveApplicationField.findMany({
      distinct: ['driveId', 'driveDepartmentConfigId'],
      select: { driveId: true, driveDepartmentConfigId: true },
    });
    const has = new Set(
      existing.map((row) => row.driveId ?? row.driveDepartmentConfigId)
    );

    const pending = [...converts, ...snapshots].filter((write) => !has.has(write.id));
    const data = pending.flatMap((write) =>
      toRows(write.fields).map((row) => ({
        ...row,
        ...(write.owner === 'master'
          ? { driveId: write.id }
          : { driveDepartmentConfigId: write.id }),
      }))
    );

    if (data.length > 0) {
      await tx.driveApplicationField.createMany({ data });
    }
    return { owners: pending.length, rows: data.length };
  });

  console.log(
    `\nWrote ${written.rows} row(s) for ${written.owners} owner(s). Legacy JSON left untouched.\n`
  );
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
