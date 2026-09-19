/**
 * Give every department drive its first recruitment pipeline, and put every
 * existing application on a stage of it.
 *
 *   npx tsx scripts/backfill-recruitment-pipelines.ts --dry-run
 *   npx tsx scripts/backfill-recruitment-pipelines.ts
 *   npx tsx scripts/backfill-recruitment-pipelines.ts --dry-run --database-url <url>
 *
 * 1. **Pipelines.** A department drive with no pipeline gets version 1 from its
 *    selection rounds (its own override, else the master's): Application →
 *    rounds → Offer, each round typed by `inferStageType` (unrecognised names
 *    are CUSTOM). The same function the app uses on publish.
 * 2. **Applications.** An application with no stage is placed by its legacy
 *    four-step stage (`stageForLegacy`) in its own department's pipeline, and
 *    gets one history event saying so (actor: none, note: the mapping). Its
 *    legacy `stage` and `status` are not changed.
 *
 * Idempotent: drives with a pipeline and applications with a stage are
 * skipped, so a re-run writes only what is missing. Everything is written in
 * one transaction with a handful of batched statements — round trips, not
 * rows, are what cost on this database.
 *
 * Read-only unless invoked without --dry-run.
 */
import { config } from 'dotenv';
// .env owns DATABASE_URL (written by the Neon CLI); .env.local holds the rest.
config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  pipelineFromRounds,
  stageForLegacy,
  validatePipelineStages,
  type NormalizedStage,
} from '../features/recruitment/domain/pipeline';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 1000;

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
const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '')}`;

const parseRounds = (raw: string | null): string[] | null => {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : null;
  } catch {
    return null;
  }
};

(async () => {
  const dbHost = DATABASE_URL.match(/@([^/]+)/)?.[1] ?? 'unknown';
  console.log(`\nDatabase: ${dbHost}`);
  console.log(DRY_RUN ? 'Mode:     DRY RUN (nothing will be written)\n' : 'Mode:     WRITE\n');

  const [instances, unmapped] = await Promise.all([
    prisma.driveDepartmentConfig.findMany({
      select: {
        id: true,
        driveId: true,
        departmentId: true,
        selectionRounds: true,
        drive: { select: { selectionRounds: true, companyName: true } },
        department: { select: { code: true } },
        pipelineVersions: {
          where: { status: 'ACTIVE' },
          include: { stages: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.driveApplication.findMany({
      where: { currentStageId: null },
      select: { id: true, driveId: true, stage: true, status: true, student: { select: { departmentId: true } } },
    }),
  ]);

  // 1. Pipelines to create.
  type Planned = { versionId: string; instanceId: string; stages: (NormalizedStage & { id: string })[] };
  const planned: Planned[] = [];
  const stagesByInstance = new Map<string, { id: string; versionId: string; stages: (NormalizedStage & { id: string })[] }>();
  const typeCounts = new Map<string, number>();

  for (const instance of instances) {
    const active = instance.pipelineVersions[0];
    if (active) {
      stagesByInstance.set(`${instance.driveId}:${instance.departmentId}`, {
        id: instance.id,
        versionId: active.id,
        stages: active.stages as unknown as (NormalizedStage & { id: string })[],
      });
      continue;
    }
    const rounds = parseRounds(instance.selectionRounds) ?? parseRounds(instance.drive.selectionRounds) ?? [];
    const validated = validatePipelineStages(pipelineFromRounds(rounds));
    if (!validated.ok) {
      console.log(`  SKIP ${instance.drive.companyName} / ${instance.department.code}: ${validated.errors.join('; ')}`);
      continue;
    }
    const versionId = newId('rpv');
    const stages = validated.stages.map((stage) => ({ ...stage, id: newId('rst') }));
    stages.forEach((stage) => typeCounts.set(stage.stageType, (typeCounts.get(stage.stageType) ?? 0) + 1));
    planned.push({ versionId, instanceId: instance.id, stages });
    stagesByInstance.set(`${instance.driveId}:${instance.departmentId}`, { id: instance.id, versionId, stages });
  }

  // 2. Applications to place.
  const placements: { applicationId: string; stageId: string; versionId: string; status: string; note: string }[] = [];
  let orphaned = 0;
  const byLegacy = new Map<string, number>();
  for (const application of unmapped) {
    const pipeline = stagesByInstance.get(`${application.driveId}:${application.student.departmentId}`);
    if (!pipeline) {
      orphaned += 1;
      continue;
    }
    const stage = stageForLegacy(pipeline.stages, application.stage);
    placements.push({
      applicationId: application.id,
      stageId: stage.id,
      versionId: pipeline.versionId,
      status: application.status,
      note: `Mapped from legacy stage ${application.stage}`,
    });
    const key = `${application.stage} → ${stage.stageType}`;
    byLegacy.set(key, (byLegacy.get(key) ?? 0) + 1);
  }

  console.log(`Department drives:                ${instances.length}`);
  console.log(`  …already with a pipeline:       ${instances.length - planned.length}`);
  console.log(`  …pipelines to create:           ${planned.length}`);
  console.log(`Stages to create, by type:        ${[...typeCounts].map(([t, n]) => `${t} ${n}`).join(', ') || '—'}`);
  console.log(`Applications without a stage:    ${unmapped.length}`);
  console.log(`  …to place:                      ${placements.length}`);
  console.log(`  …no department drive (skipped): ${orphaned}`);
  for (const [key, n] of byLegacy) console.log(`    ${key}: ${n}`);

  if (DRY_RUN) {
    console.log('\nDry run — nothing written.\n');
    await prisma.$disconnect();
    return;
  }

  // Ids are generated here, and the placement UPDATE is built from them. They
  // are checked to be plain identifiers before going anywhere near SQL.
  const safe = /^[A-Za-z0-9_]+$/;
  for (const p of placements) {
    if (!safe.test(p.applicationId) || !safe.test(p.stageId)) throw new Error(`unsafe id: ${p.applicationId}`);
  }

  await prisma.$transaction(
    async (tx) => {
      if (planned.length > 0) {
        await tx.recruitmentPipelineVersion.createMany({
          data: planned.map((p) => ({
            id: p.versionId,
            driveDepartmentConfigId: p.instanceId,
            version: 1,
            status: 'ACTIVE' as const,
            note: "Initial pipeline from the drive's selection rounds (backfill)",
          })),
        });
        const stages = planned.flatMap((p) =>
          p.stages.map((stage) => ({
            id: stage.id,
            pipelineVersionId: p.versionId,
            name: stage.name,
            stageType: stage.stageType,
            sortOrder: stage.sortOrder,
            description: stage.description,
            instructions: stage.instructions,
            visibleToStudents: stage.visibleToStudents,
            scheduledAt: stage.scheduledAt,
            location: stage.location,
            isEnabled: stage.isEnabled,
          }))
        );
        await tx.recruitmentStage.createMany({ data: stages });
      }

      for (let start = 0; start < placements.length; start += BATCH) {
        const batch = placements.slice(start, start + BATCH);
        const values = batch.map((p) => `('${p.applicationId}', '${p.stageId}')`).join(', ');
        // Only where still unmapped, so a concurrent move is never overwritten.
        await tx.$executeRawUnsafe(
          `UPDATE "DriveApplication" AS a SET "currentStageId" = v.stage
             FROM (VALUES ${values}) AS v(id, stage)
            WHERE a."id" = v.id AND a."currentStageId" IS NULL`
        );
        await tx.applicationStageEvent.createMany({
          data: batch.map((p) => ({
            applicationId: p.applicationId,
            pipelineVersionId: p.versionId,
            fromStageId: null,
            toStageId: p.stageId,
            fromStatus: null,
            toStatus: p.status as 'IN_PROGRESS' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN',
            actorId: null,
            note: p.note,
          })),
        });
      }
    },
    { timeout: 120_000 }
  );

  console.log(`\nCreated ${planned.length} pipeline(s); placed ${placements.length} application(s).\n`);
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
