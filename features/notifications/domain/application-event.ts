import type { NotificationEvent, RecruitmentStageType } from "@prisma/client";

/**
 * Which student event a move of their application is. Pure, so the mapping is
 * tested without a database.
 *
 * - SELECTED / REJECTED are the outcomes.
 * - Leaving the Application (screening) stage for any later stage is being
 *   shortlisted.
 * - Otherwise the target stage's type says whether it is a test or an
 *   interview; anything else (the Offer stage, a custom stage) is a plain
 *   stage change.
 */

const TEST_STAGES: readonly RecruitmentStageType[] = ["APTITUDE", "CODING", "ASSESSMENT", "PRESENTATION"];
const INTERVIEW_STAGES: readonly RecruitmentStageType[] = [
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "MANAGERIAL_INTERVIEW",
  "GROUP_DISCUSSION",
];

export function applicationMoveEvent(params: {
  fromStageType: RecruitmentStageType | null;
  toStageType: RecruitmentStageType;
  status: "IN_PROGRESS" | "SELECTED" | "REJECTED";
}): NotificationEvent {
  if (params.status === "SELECTED") return "APPLICATION_SELECTED";
  if (params.status === "REJECTED") return "APPLICATION_REJECTED";
  if (params.fromStageType === "APPLICATION" && params.toStageType !== "APPLICATION") {
    return "APPLICATION_SHORTLISTED";
  }
  if (TEST_STAGES.includes(params.toStageType)) return "APPLICATION_TEST";
  if (INTERVIEW_STAGES.includes(params.toStageType)) return "APPLICATION_INTERVIEW";
  return "APPLICATION_STAGE_CHANGED";
}

/** Application counts at which the Super Admin hears about a drive. */
export const APPLICATION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

/** The highest milestone a drive has reached, or null. */
export function reachedMilestone(total: number): number | null {
  let reached: number | null = null;
  for (const milestone of APPLICATION_MILESTONES) {
    if (total >= milestone) reached = milestone;
  }
  return reached;
}

/** Start of the current day in India, where the institution is. */
export function startOfIndianDay(now: Date = new Date()): { start: Date; key: string } {
  const offsetMs = 330 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const key = local.toISOString().slice(0, 10);
  const start = new Date(Date.parse(`${key}T00:00:00.000Z`) - offsetMs);
  return { start, key };
}
