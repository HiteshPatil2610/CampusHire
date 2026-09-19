import type {
  ApplicationStage,
  ApplicationStatus,
  RecruitmentStageType,
} from "@prisma/client";

/**
 * Recruitment pipelines.
 *
 * Each department drive (a `DriveDepartmentConfig` instance) runs its own
 * pipeline: an ordered list of typed stages, always starting with APPLICATION
 * and ending with OFFER. A pipeline is versioned — a version's stages never
 * change; a change is a new version, and exactly one version is ACTIVE. An
 * application points at the stage it is in, so a new version never rewrites
 * where anyone was or has been.
 *
 * Pure: no database, no session. Shared by the server actions, the admin
 * editor (which validates live with `validatePipelineStages`), the backfill
 * script and the tests.
 */

export type { RecruitmentStageType };

export const STAGE_TYPES: readonly RecruitmentStageType[] = [
  "APPLICATION",
  "APTITUDE",
  "CODING",
  "GROUP_DISCUSSION",
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "MANAGERIAL_INTERVIEW",
  "PRESENTATION",
  "ASSESSMENT",
  "OFFER",
  "CUSTOM",
] as const;

export const STAGE_TYPE_LABELS: Record<RecruitmentStageType, string> = {
  APPLICATION: "Application",
  APTITUDE: "Aptitude test",
  CODING: "Coding test",
  GROUP_DISCUSSION: "Group discussion",
  TECHNICAL_INTERVIEW: "Technical interview",
  HR_INTERVIEW: "HR interview",
  MANAGERIAL_INTERVIEW: "Managerial interview",
  PRESENTATION: "Presentation",
  ASSESSMENT: "Assessment",
  OFFER: "Offer",
  CUSTOM: "Custom",
};

/** A stage as authored — what a version is built from. */
export interface StageDefinition {
  name: string;
  stageType: RecruitmentStageType;
  description?: string | null;
  instructions?: string | null;
  visibleToStudents?: boolean;
  scheduledAt?: string | Date | null;
  location?: string | null;
  isEnabled?: boolean;
}

/** A stage as stored, in a version. */
export interface StoredStage extends Required<Omit<StageDefinition, "scheduledAt">> {
  id: string;
  pipelineVersionId: string;
  sortOrder: number;
  scheduledAt: Date | null;
}

export const PIPELINE_LIMITS = {
  minStages: 2,
  maxStages: 15,
  name: 80,
  description: 500,
  instructions: 2000,
  location: 200,
} as const;

export interface NormalizedStage {
  name: string;
  stageType: RecruitmentStageType;
  description: string | null;
  instructions: string | null;
  visibleToStudents: boolean;
  scheduledAt: Date | null;
  location: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

const clean = (value: unknown, max: number): string =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const cleanBlock = (value: unknown, max: number): string | null => {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, max) : null;
};

/**
 * Validate an authored pipeline and normalise it for storage. The array order
 * is the stage order; `sortOrder` is never taken from the client.
 *
 * Rules: 2–15 stages; exactly one APPLICATION, first; exactly one OFFER, last;
 * both always enabled; names present, unique (ignoring case); every type a
 * known stage type; valid dates.
 */
export function validatePipelineStages(
  input: unknown
): { ok: true; stages: NormalizedStage[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(input)) return { ok: false, errors: ["A pipeline is a list of stages"] };

  if (input.length < PIPELINE_LIMITS.minStages || input.length > PIPELINE_LIMITS.maxStages) {
    errors.push(`A pipeline has ${PIPELINE_LIMITS.minStages}–${PIPELINE_LIMITS.maxStages} stages`);
  }

  const stages: NormalizedStage[] = [];
  const names = new Set<string>();

  input.forEach((raw, index) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const stageType = entry.stageType as RecruitmentStageType;
    const name = clean(entry.name, PIPELINE_LIMITS.name);
    const at = `Stage ${index + 1}`;

    if (!STAGE_TYPES.includes(stageType)) {
      errors.push(`${at}: unknown stage type`);
      return;
    }
    if (!name) errors.push(`${at}: a stage needs a name`);
    const lower = name.toLowerCase();
    if (name && names.has(lower)) errors.push(`${at}: "${name}" appears twice`);
    names.add(lower);

    let scheduledAt: Date | null = null;
    if (entry.scheduledAt) {
      const date = new Date(entry.scheduledAt as string);
      if (Number.isNaN(date.getTime())) errors.push(`${at}: invalid schedule date`);
      else scheduledAt = date;
    }

    const bookend = stageType === "APPLICATION" || stageType === "OFFER";
    stages.push({
      name,
      stageType,
      description: cleanBlock(entry.description, PIPELINE_LIMITS.description),
      instructions: cleanBlock(entry.instructions, PIPELINE_LIMITS.instructions),
      visibleToStudents: bookend ? true : entry.visibleToStudents !== false,
      scheduledAt,
      location: clean(entry.location, PIPELINE_LIMITS.location) || null,
      // The first and last stages are how every application enters and ends.
      isEnabled: bookend ? true : entry.isEnabled !== false,
      sortOrder: index,
    });
  });

  const types = stages.map((stage) => stage.stageType);
  if (types.filter((type) => type === "APPLICATION").length !== 1 || types[0] !== "APPLICATION") {
    errors.push("A pipeline starts with exactly one Application stage");
  }
  if (types.filter((type) => type === "OFFER").length !== 1 || types[types.length - 1] !== "OFFER") {
    errors.push("A pipeline ends with exactly one Offer stage");
  }

  return errors.length > 0 ? { ok: false, errors: [...new Set(errors)] } : { ok: true, stages };
}

/**
 * Guess a stage's type from its name — used only to turn a drive's existing
 * free-text selection rounds into a first pipeline. Anything unrecognised is
 * CUSTOM (never guessed as an interview or a test).
 */
export function inferStageType(name: string): RecruitmentStageType {
  const text = name.toLowerCase();
  if (/\b(group discussion|gd)\b/.test(text)) return "GROUP_DISCUSSION";
  if (/\b(coding|programming|hackathon)\b/.test(text)) return "CODING";
  if (/\baptitude\b/.test(text)) return "APTITUDE";
  if (/\bhr\b|human resource/.test(text)) return "HR_INTERVIEW";
  if (/\bmanager(ial)?\b/.test(text)) return "MANAGERIAL_INTERVIEW";
  if (/\btechnical\b/.test(text)) return "TECHNICAL_INTERVIEW";
  if (/\b(presentation|ppt)\b/.test(text)) return "PRESENTATION";
  if (/\b(assessment|online test|test)\b/.test(text)) return "ASSESSMENT";
  if (/\binterview\b/.test(text)) return "TECHNICAL_INTERVIEW";
  if (/\boffer\b/.test(text)) return "OFFER";
  return "CUSTOM";
}

/** A first pipeline from a drive's selection rounds: Application → rounds → Offer. */
export function pipelineFromRounds(rounds: string[]): StageDefinition[] {
  const middle = rounds
    .map((round) => clean(round, PIPELINE_LIMITS.name))
    .filter(Boolean)
    .filter((round, index, all) => all.findIndex((other) => other.toLowerCase() === round.toLowerCase()) === index)
    // A round named after a bookend would clash with it by name.
    .filter((name) => !["application", "offer"].includes(name.toLowerCase()))
    .map((name) => ({ name, stageType: inferStageType(name) }))
    // Application and Offer are the bookends; a round literally called
    // "Offer" is not a second offer stage.
    .filter((stage) => stage.stageType !== "OFFER" && stage.stageType !== "APPLICATION")
    .slice(0, PIPELINE_LIMITS.maxStages - 2);

  return [
    { name: "Application", stageType: "APPLICATION" },
    ...middle,
    { name: "Offer", stageType: "OFFER" },
  ];
}

/** The rounds between the bookends, as the legacy `selectionRounds` list. */
export function roundsOf(stages: Pick<NormalizedStage, "name" | "stageType" | "isEnabled">[]): string[] {
  return stages
    .filter((stage) => stage.isEnabled && stage.stageType !== "APPLICATION" && stage.stageType !== "OFFER")
    .map((stage) => stage.name);
}

/**
 * The four-step legacy stage a pipeline stage corresponds to, dual-written to
 * `DriveApplication.stage` so screens and reports that still read it keep
 * working.
 */
export function legacyStageFor(stageType: RecruitmentStageType): ApplicationStage {
  switch (stageType) {
    case "APPLICATION":
      return "APPLIED";
    case "OFFER":
      return "OFFER";
    case "TECHNICAL_INTERVIEW":
    case "HR_INTERVIEW":
    case "MANAGERIAL_INTERVIEW":
      return "INTERVIEW";
    default:
      return "APTITUDE";
  }
}

/** A pipeline as one comparable string: what an applicant would go through. */
export function pipelineKey(
  stages: Pick<NormalizedStage, "name" | "stageType" | "isEnabled" | "visibleToStudents" | "description" | "instructions" | "location" | "scheduledAt">[]
): string {
  return JSON.stringify(
    stages.map((stage) => [
      stage.name,
      stage.stageType,
      stage.isEnabled,
      stage.visibleToStudents,
      stage.description ?? null,
      stage.instructions ?? null,
      stage.location ?? null,
      stage.scheduledAt ? new Date(stage.scheduledAt).toISOString() : null,
    ])
  );
}

/** What changed between two versions, by stage name — for the audit log. */
export function diffPipelines(
  before: Pick<NormalizedStage, "name" | "stageType" | "isEnabled" | "description" | "instructions" | "location" | "scheduledAt" | "visibleToStudents">[],
  after: Pick<NormalizedStage, "name" | "stageType" | "isEnabled" | "description" | "instructions" | "location" | "scheduledAt" | "visibleToStudents">[]
): { added: string[]; removed: string[]; edited: string[]; deactivated: string[]; reordered: boolean } {
  const key = (name: string) => name.toLowerCase();
  const beforeByName = new Map(before.map((stage) => [key(stage.name), stage]));
  const afterByName = new Map(after.map((stage) => [key(stage.name), stage]));

  const added = after.filter((stage) => !beforeByName.has(key(stage.name))).map((s) => s.name);
  const removed = before.filter((stage) => !afterByName.has(key(stage.name))).map((s) => s.name);
  const edited: string[] = [];
  const deactivated: string[] = [];
  for (const stage of after) {
    const old = beforeByName.get(key(stage.name));
    if (!old) continue;
    if (old.isEnabled && !stage.isEnabled) deactivated.push(stage.name);
    if (pipelineKey([old]) !== pipelineKey([{ ...stage, isEnabled: old.isEnabled }])) edited.push(stage.name);
  }
  const common = (list: typeof before) => list.map((s) => key(s.name)).filter((n) => beforeByName.has(n) && afterByName.has(n));
  const reordered = JSON.stringify(common(before)) !== JSON.stringify(common(after));

  return { added, removed, edited, deactivated, reordered };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export interface TransitionInput {
  currentStatus: ApplicationStatus;
  /** Null for an application from before pipelines, not yet mapped. */
  currentStage: { id: string; pipelineVersionId: string } | null;
  target: {
    id: string;
    pipelineVersionId: string;
    stageType: RecruitmentStageType;
    isEnabled: boolean;
  };
  activeVersionId: string;
  nextStatus: ApplicationStatus;
}

/**
 * Validate a move requested by a department admin.
 *
 * The target must be a stage of this drive's **active** version — or the
 * stage the application is already in (to set an outcome without moving,
 * e.g. rejecting an applicant still in an older version's stage). An
 * application in an older version joins the active version the moment it is
 * moved. Keeps every existing rule: a selection is final, withdrawn
 * applications are closed, nothing moves into WITHDRAWN, SELECTED only at an
 * Offer stage.
 */
export function validatePipelineTransition(
  input: TransitionInput
): { valid: true } | { valid: false; error: string } {
  const { currentStatus, currentStage, target, activeVersionId, nextStatus } = input;

  if (currentStatus === "WITHDRAWN") {
    return { valid: false, error: "This application was withdrawn under the previous rules and can no longer be changed." };
  }
  if (currentStatus === "SELECTED") {
    return {
      valid: false,
      error: "A selection is final. If it was recorded by mistake, revoke the student's placement instead.",
    };
  }
  if (nextStatus === "WITHDRAWN") {
    return { valid: false, error: "Applications are final and cannot be withdrawn." };
  }

  const stayingPut = currentStage?.id === target.id;
  if (!stayingPut && target.pipelineVersionId !== activeVersionId) {
    return { valid: false, error: "That stage is not part of this drive's current recruitment pipeline." };
  }
  if (!stayingPut && !target.isEnabled) {
    return { valid: false, error: "That stage is not active in this pipeline." };
  }
  if (nextStatus === "SELECTED" && target.stageType !== "OFFER") {
    return { valid: false, error: "A selected candidate must be at the Offer stage." };
  }
  if (stayingPut && nextStatus === currentStatus) {
    return { valid: false, error: "No change to apply." };
  }

  return { valid: true };
}

/**
 * Where an application from before pipelines sits in its drive's first
 * pipeline, from its legacy four-step stage: Applied → the Application stage,
 * Offer → the Offer stage, Aptitude → the first round that maps to Aptitude
 * (else the first round), Interview → the first round that maps to Interview
 * (else the last round). With no rounds at all, both fall back to Application
 * — never silently to Offer.
 */
export function stageForLegacy<T extends { stageType: RecruitmentStageType }>(
  stages: T[],
  legacy: ApplicationStage
): T {
  const first = stages[0];
  const offer = stages[stages.length - 1];
  const middle = stages.slice(1, -1);

  switch (legacy) {
    case "APPLIED":
      return first;
    case "OFFER":
      return offer;
    case "APTITUDE":
      return middle.find((stage) => legacyStageFor(stage.stageType) === "APTITUDE") ?? middle[0] ?? first;
    case "INTERVIEW":
      return (
        middle.find((stage) => legacyStageFor(stage.stageType) === "INTERVIEW") ??
        middle[middle.length - 1] ??
        first
      );
  }
}
