import { parseJsonArray } from "@/lib/parse-json-array";
import {
  pipelineFromRounds,
  validatePipelineStages,
  type NormalizedStage,
  type StageDefinition,
} from "./pipeline";

/**
 * The master drive's recruitment pipeline: the stages every department drive
 * of it starts from.
 *
 * Stored on the master as a JSON array (`Drive.masterPipeline`), set by the
 * Super Admin. It is a template, not a live pipeline — no application ever
 * points at it. A department drive gets its own versioned pipeline, copied
 * from this template, the first time it needs one (a proposal, or publishing);
 * from then on that copy changes only as new versions.
 *
 * A master without stored stages (every drive from before this existed, and a
 * department's own drive) is read as its selection rounds, exactly as
 * department pipelines were built until now.
 *
 * Pure.
 */

type MasterPipelineSource = {
  masterPipeline: string | null;
  selectionRounds: string;
};

/** The master's stages, normalised. Always a valid pipeline. */
export function masterPipelineStages(master: MasterPipelineSource): NormalizedStage[] {
  if (master.masterPipeline) {
    try {
      const stored = validatePipelineStages(JSON.parse(master.masterPipeline));
      if (stored.ok) return stored.stages;
    } catch {
      // Unparseable: fall through to the rounds, which always make a pipeline.
    }
  }
  return fromRounds(parseJsonArray(master.selectionRounds));
}

/**
 * What a department drive's first pipeline version is built from: the
 * master's stages when the Super Admin configured them; otherwise the rounds
 * this department sees (its own legacy rounds override, else the master's).
 */
export function initialDepartmentPipeline(
  master: MasterPipelineSource,
  instance: { selectionRounds: string | null } | null
): NormalizedStage[] {
  if (master.masterPipeline) return masterPipelineStages(master);
  return fromRounds(parseJsonArray(instance?.selectionRounds ?? master.selectionRounds));
}

/** The stored form of a validated master pipeline. */
export function serializeMasterPipeline(stages: NormalizedStage[]): string {
  return JSON.stringify(
    stages.map((stage) => ({
      name: stage.name,
      stageType: stage.stageType,
      description: stage.description,
      instructions: stage.instructions,
      visibleToStudents: stage.visibleToStudents,
      scheduledAt: stage.scheduledAt ? stage.scheduledAt.toISOString() : null,
      location: stage.location,
      isEnabled: stage.isEnabled,
    }))
  );
}

function fromRounds(rounds: string[]): NormalizedStage[] {
  const built = validatePipelineStages(pipelineFromRounds(rounds) as StageDefinition[]);
  if (!built.ok) {
    // Unreachable: pipelineFromRounds always yields a valid pipeline.
    throw new Error(`Could not build a pipeline: ${built.errors.join("; ")}`);
  }
  return built.stages;
}
