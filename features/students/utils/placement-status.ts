import type { Prisma, Student } from "@prisma/client";

/**
 * Placement is never a flag on the Student row.
 *
 * A student is placed while they hold at least one `StudentPlacement` that
 * has not been revoked. Placements are explicit records — company, role,
 * package, date, who recorded it — created when a department admin marks an
 * application SELECTED (in the same transaction) or records an off-campus
 * offer, and corrected only by revoking them with a reason. Every screen —
 * dept-admin roster, dept dashboard, super-admin reports, department matrix,
 * and the eligibility evaluator — resolves "placed" through this module, so
 * it can never mean two different things in two places.
 *
 * The previous `Student.placementStatus` text column was written by nothing
 * and read with three different casings, which made every Placed count
 * silently zero. Deriving from SELECTED applications fixed that, but could
 * not say where or when a student was placed, or record an offer made
 * outside CampusHire.
 */

/** A placement that counts: not revoked. */
export const ACTIVE_PLACEMENT_WHERE = {
  revokedAt: null,
} satisfies Prisma.StudentPlacementWhereInput;

/**
 * Include for the eligibility subject: a student's active placements, ids
 * only. `toEligibilitySubject` requires it, so a caller that forgot to load
 * placement does not compile.
 */
export const ACTIVE_PLACEMENTS_SELECT = {
  where: ACTIVE_PLACEMENT_WHERE,
  select: { id: true, revokedAt: true },
} as const;

/** A student's participation and outcome, as shown on rosters and KPI cards. */
export type PlacementState = "PENDING" | "OPTED_OUT" | "PLACED" | "ELIGIBLE";

/**
 * Prisma filter matching students who hold at least one SELECTED application.
 * Use inside a `where` alongside the caller's own department scoping.
 */
export const PLACED_STUDENT_FILTER = {
  placements: { some: ACTIVE_PLACEMENT_WHERE },
} satisfies Prisma.StudentWhereInput;

/** Inverse of {@link PLACED_STUDENT_FILTER}. */
export const UNPLACED_STUDENT_FILTER = {
  placements: { none: ACTIVE_PLACEMENT_WHERE },
} satisfies Prisma.StudentWhereInput;

/**
 * The same test as SQL, for raw queries: `<alias>` is the Student row's
 * alias. Kept here so the raw reports cannot drift from the Prisma filters.
 */
export function placedStudentSql(alias: string): string {
  return `EXISTS (SELECT 1 FROM "StudentPlacement" sp WHERE sp."studentId" = ${alias}."id" AND sp."revokedAt" IS NULL)`;
}

/**
 * The minimum shape needed to resolve a student's placement state. Callers
 * supply `isPlaced` from their active placements (`ACTIVE_PLACEMENTS_SELECT`).
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
