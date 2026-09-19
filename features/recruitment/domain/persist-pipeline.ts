import { Prisma } from "@prisma/client";
import {
  pipelineFromRounds,
  roundsOf,
  validatePipelineStages,
  type NormalizedStage,
} from "./pipeline";

/**
 * Writing pipeline versions. Every write goes through `createPipelineVersion`,
 * inside the caller's transaction: it supersedes the active version, creates
 * the next one with its stages, and mirrors the stage names into the
 * instance's legacy `selectionRounds`, so the old display keeps matching.
 */

type Tx = Prisma.TransactionClient;

export const ACTIVE_VERSION_INCLUDE = {
  stages: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.RecruitmentPipelineVersionInclude;

export async function getActiveVersion(tx: Tx, driveDepartmentConfigId: string) {
  return tx.recruitmentPipelineVersion.findFirst({
    where: { driveDepartmentConfigId, status: "ACTIVE" },
    include: ACTIVE_VERSION_INCLUDE,
  });
}

export async function createPipelineVersion(
  tx: Tx,
  driveDepartmentConfigId: string,
  stages: NormalizedStage[],
  options: {
    actorId: string | null;
    note: string;
    /** False when the stages were built from the rounds themselves. */
    mirrorRounds?: boolean;
  }
) {
  const now = new Date();
  const latest = await tx.recruitmentPipelineVersion.findFirst({
    where: { driveDepartmentConfigId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await tx.recruitmentPipelineVersion.updateMany({
    where: { driveDepartmentConfigId, status: "ACTIVE" },
    data: { status: "SUPERSEDED", supersededAt: now },
  });

  const version = await tx.recruitmentPipelineVersion.create({
    data: {
      driveDepartmentConfigId,
      version: (latest?.version ?? 0) + 1,
      status: "ACTIVE",
      note: options.note,
      createdById: options.actorId,
      stages: {
        create: stages.map((stage) => ({
          name: stage.name,
          stageType: stage.stageType,
          sortOrder: stage.sortOrder,
          description: stage.description,
          instructions: stage.instructions,
          visibleToStudents: stage.visibleToStudents,
          scheduledAt: stage.scheduledAt,
          location: stage.location,
          isEnabled: stage.isEnabled,
        })),
      },
    },
    include: ACTIVE_VERSION_INCLUDE,
  });

  // The legacy display list follows the pipeline — the pipeline is the
  // source of truth for recruitment rounds from here on.
  if (options.mirrorRounds !== false) {
    await tx.driveDepartmentConfig.update({
      where: { id: driveDepartmentConfigId },
      data: { selectionRounds: JSON.stringify(roundsOf(stages)) },
    });
  }

  return version;
}

/**
 * The active version, creating version 1 from the drive's selection rounds if
 * the department drive has none yet (first publish, a department-owned drive
 * being posted, or an application arriving before the backfill ran).
 */
export async function ensureActivePipeline(
  tx: Tx,
  driveDepartmentConfigId: string,
  rounds: string[],
  actorId: string | null
) {
  const existing = await getActiveVersion(tx, driveDepartmentConfigId);
  if (existing) return existing;

  const validated = validatePipelineStages(pipelineFromRounds(rounds));
  if (!validated.ok) {
    // Unreachable: pipelineFromRounds always yields a valid pipeline.
    throw new Error(`Could not build a pipeline: ${validated.errors.join("; ")}`);
  }

  return createPipelineVersion(tx, driveDepartmentConfigId, validated.stages, {
    actorId,
    note: "Initial pipeline from the drive's selection rounds",
    // Built from the rounds it would mirror — writing them back would turn
    // an inherited value into a department override.
    mirrorRounds: false,
  });
}

/**
 * The active version, creating version 1 from the given stages if the
 * department drive has none yet — the master's pipeline for a Super Admin
 * drive (see `initialDepartmentPipeline`).
 */
export async function ensureActivePipelineFrom(
  tx: Tx,
  driveDepartmentConfigId: string,
  stages: NormalizedStage[],
  actorId: string | null,
  note = "Initial pipeline from the master drive"
) {
  const existing = await getActiveVersion(tx, driveDepartmentConfigId);
  if (existing) return existing;

  return createPipelineVersion(tx, driveDepartmentConfigId, stages, {
    actorId,
    note,
    // Inherited, not this department's choice: writing the names back into
    // the instance's rounds would turn them into an override.
    mirrorRounds: false,
  });
}
