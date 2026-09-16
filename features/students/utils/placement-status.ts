import type { Prisma, Student } from "@prisma/client";

/**
 * Placement is never stored on the Student row.
 *
 * It is derived from the applications a student actually holds: a student is
 * placed once a department admin marks one of their applications SELECTED.
 * Every screen — dept-admin roster, dept dashboard, super-admin reports,
 * department matrix — resolves it through this module, so "Placed" can never
 * mean two different things in two different panels again.
 *
 * The previous `Student.placementStatus` text column was written by nothing
 * and read with three different casings, which made every Placed count
 * silently zero.
 */

/** A student's participation and outcome, as shown on rosters and KPI cards. */
export type PlacementState = "PENDING" | "OPTED_OUT" | "PLACED" | "ELIGIBLE";

/**
 * Prisma filter matching students who hold at least one SELECTED application.
 * Use inside a `where` alongside the caller's own department scoping.
 */
export const PLACED_STUDENT_FILTER = {
  applications: { some: { status: "SELECTED" } },
} satisfies Prisma.StudentWhereInput;

/** Inverse of {@link PLACED_STUDENT_FILTER}. */
export const UNPLACED_STUDENT_FILTER = {
  applications: { none: { status: "SELECTED" } },
} satisfies Prisma.StudentWhereInput;

/**
 * The minimum shape needed to resolve a student's placement state. Callers
 * supply it by selecting a `_count` of SELECTED applications, or by passing
 * `isPlaced` directly when they already know.
 */
export interface PlacementInput {
  isPending: Student["isPending"];
  optedIn: Student["optedIn"];
  isPlaced: boolean;
}

/**
 * Resolve a student's placement state.
 *
 * Order matters: a student who has not registered yet is PENDING regardless
 * of anything else, and a placed student is reported as PLACED even if they
 * later opted out, because the offer is a fact and the opt-out is a choice.
 */
export function resolvePlacementState(input: PlacementInput): PlacementState {
  if (input.isPending) return "PENDING";
  if (input.isPlaced) return "PLACED";
  if (!input.optedIn) return "OPTED_OUT";
  return "ELIGIBLE";
}

/** Human-readable label and badge class for each state. */
export const PLACEMENT_STATE_BADGES: Record<
  PlacementState,
  { text: string; className: string }
> = {
  PENDING: { text: "Pending Registration", className: "badge-amber" },
  PLACED: { text: "Placed", className: "badge-green" },
  OPTED_OUT: { text: "Opted Out", className: "badge-gray" },
  ELIGIBLE: { text: "Eligible", className: "badge-purple" },
};
