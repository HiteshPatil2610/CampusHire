import {
  pipelineFromRounds,
  validatePipelineStages,
  type NormalizedStage,
  type StageDefinition,
} from "@/features/recruitment/domain/pipeline";

/**
 * The stages a new drive starts with.
 *
 * The institution's saved default when it has one and it is still valid;
 * otherwise the standard rounds, which is what CampusHire did before there
 * was a setting. Judged by the same validator that judges a real pipeline, so
 * a stored default can never be something a drive could not use.
 *
 * Pure.
 */

/** What a drive starts with when the institution has set nothing. */
export const STANDARD_ROUNDS = ["Aptitude Test", "Technical Interview", "HR Interview"];

export function institutionDefaultStages(stored: string | null | undefined): NormalizedStage[] {
  if (stored) {
    try {
      const parsed = validatePipelineStages(JSON.parse(stored));
      if (parsed.ok) return parsed.stages;
    } catch {
      // Unreadable: fall through to the standard rounds rather than fail.
    }
  }
  // The rounds always make a valid pipeline; this is the same path a drive
  // with no configured stages takes.
  const built = validatePipelineStages(pipelineFromRounds(STANDARD_ROUNDS) as StageDefinition[]);
  return built.ok ? built.stages : [];
}
