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

/**
 * `WITHDRAWN` is retained on the read side only. Withdrawal was removed when
 * applications became final, but the enum value stays on the Prisma model so a
 * historical row still renders with its real outcome instead of crashing a
 * `Record<ApplicationStatus, …>` lookup. Nothing writes it any more.
 */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  IN_PROGRESS: "In Progress",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/**
 * The outcomes an admin may actually set. `WITHDRAWN` is excluded: an
 * application is final once submitted, so nothing writes that value any more —
 * it survives only so historical rows still read.
 */
export const WRITABLE_STATUSES = [
  "IN_PROGRESS",
  "SELECTED",
  "REJECTED",
] as const satisfies readonly ApplicationStatus[];

export type WritableApplicationStatus = (typeof WRITABLE_STATUSES)[number];

export function isWritableStatus(
  status: ApplicationStatus
): status is WritableApplicationStatus {
  return (WRITABLE_STATUSES as readonly ApplicationStatus[]).includes(status);
}

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

  // A historical withdrawn application is a closed record. Withdrawal no
  // longer exists, so there is nothing to revive it into — it stays read-only.
  if (currentStatus === "WITHDRAWN") {
    return {
      valid: false,
      error: "This application was withdrawn under the previous rules and can no longer be changed.",
    };
  }

  // A selection is final. Marking SELECTED records the student's placement;
  // a mistake is corrected by revoking that placement (with a reason), never
  // by quietly moving the application. The database refuses it too.
  if (currentStatus === "SELECTED") {
    return {
      valid: false,
      error:
        "A selection is final. If it was recorded by mistake, revoke the student's placement instead.",
    };
  }

  // Nothing may move an application into WITHDRAWN any more: an application is
  // final once submitted, for the student and the admin alike. The schema
  // already rejects the value; this keeps the pure rule honest on its own.
  if (nextStatus === "WITHDRAWN") {
    return {
      valid: false,
      error: "Applications are final and cannot be withdrawn.",
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
