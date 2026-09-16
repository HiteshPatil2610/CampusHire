import type { ApplicationStage, ApplicationStatus } from "@prisma/client";

/**
 * Selection stages in the order a candidate moves through them.
 *
 * A stage never moves backwards on its own — an admin can correct a mistake
 * by setting an earlier stage explicitly, but `isStageAdvance` is what the UI
 * uses to decide whether to show a "move forward" affordance.
 */
export const STAGE_SEQUENCE: readonly ApplicationStage[] = [
  "APPLIED",
  "APTITUDE",
  "INTERVIEW",
  "OFFER",
] as const;

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: "Applied",
  APTITUDE: "Aptitude",
  INTERVIEW: "Interview",
  OFFER: "Offer",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  IN_PROGRESS: "In Progress",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/** Position of a stage in {@link STAGE_SEQUENCE}. */
export function stageIndex(stage: ApplicationStage): number {
  return STAGE_SEQUENCE.indexOf(stage);
}

/** True when `next` sits after `current` in the selection sequence. */
export function isStageAdvance(
  current: ApplicationStage,
  next: ApplicationStage
): boolean {
  return stageIndex(next) > stageIndex(current);
}

/**
 * Statuses that close an application. Once an application is closed the
 * student's progress track stops moving — a rejected candidate does not keep
 * advancing through stages.
 */
export const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Validate a stage/status transition requested by a department admin.
 *
 * Kept as a pure function so the rules are unit-testable without a database
 * or a Clerk session, per the testing standard.
 */
export function validateStageTransition(params: {
  currentStage: ApplicationStage;
  currentStatus: ApplicationStatus;
  nextStage: ApplicationStage;
  nextStatus: ApplicationStatus;
}): { valid: true } | { valid: false; error: string } {
  const { currentStage, currentStatus, nextStage, nextStatus } = params;

  // A withdrawn application belongs to the student's decision, not the
  // admin's — an admin can never revive or re-stage one.
  if (currentStatus === "WITHDRAWN") {
    return {
      valid: false,
      error: "This application was withdrawn by the student and cannot be changed.",
    };
  }

  // An admin cannot mark an application withdrawn on the student's behalf.
  if (nextStatus === "WITHDRAWN") {
    return {
      valid: false,
      error: "Only the student can withdraw an application.",
    };
  }

  // A selected candidate sits at the OFFER stage by definition.
  if (nextStatus === "SELECTED" && nextStage !== "OFFER") {
    return {
      valid: false,
      error: "A selected candidate must be at the Offer stage.",
    };
  }

  if (currentStage === nextStage && currentStatus === nextStatus) {
    return { valid: false, error: "No change to apply." };
  }

  return { valid: true };
}
