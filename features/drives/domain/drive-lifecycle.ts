import type { DepartmentDriveStatus, MasterDriveStatus } from "@prisma/client";

/**
 * The drive lifecycle, as pure rules.
 *
 *   MASTER DRIVE      DRAFT → PUBLISHED → ARCHIVED
 *   DEPARTMENT DRIVE  ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED
 *
 * **Administrative CLOSED is not "the deadline passed."** Whether a drive is
 * open is still derived at read time from `applicationDeadline` via
 * `getDriveStatus()` and is never stored — that rule is untouched. CLOSED is a
 * separate, deliberate act: a department stopping intake early, or after the
 * fact. A drive can therefore be PUBLISHED with a passed deadline (derived
 * closed), or CLOSED while its deadline is still in the future. Both states
 * mean "no new applications", for different reasons.
 *
 * Kept free of Prisma and Clerk so the rules are unit-testable on their own.
 */

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const MASTER_TRANSITIONS: Record<MasterDriveStatus, MasterDriveStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  // Terminal. Re-opening an archived drive would resurrect it underneath the
  // departments that already stopped running it.
  ARCHIVED: [],
};

const DEPARTMENT_TRANSITIONS: Record<
  DepartmentDriveStatus,
  DepartmentDriveStatus[]
> = {
  // A department may publish straight from ASSIGNED — configuration is
  // encouraged, not mandatory, and the publish action validates what it needs.
  ASSIGNED: ["CONFIGURED", "PUBLISHED", "ARCHIVED"],
  CONFIGURED: ["PUBLISHED", "ARCHIVED"],
  // Never back to CONFIGURED: the content is locked and students have seen it.
  PUBLISHED: ["CLOSED", "ARCHIVED"],
  ARCHIVED: [],
  CLOSED: ["ARCHIVED"],
};

export type TransitionCheck =
  | { valid: true }
  | { valid: false; error: string };

export function canTransitionMaster(
  from: MasterDriveStatus,
  to: MasterDriveStatus
): TransitionCheck {
  if (from === to) {
    return { valid: false, error: `This drive is already ${from.toLowerCase()}.` };
  }

  if (!MASTER_TRANSITIONS[from].includes(to)) {
    return {
      valid: false,
      error: `A ${from.toLowerCase()} master drive cannot become ${to.toLowerCase()}.`,
    };
  }

  return { valid: true };
}

export function canTransitionDepartmentDrive(
  from: DepartmentDriveStatus,
  to: DepartmentDriveStatus
): TransitionCheck {
  if (from === to) {
    return { valid: false, error: `This drive is already ${from.toLowerCase()}.` };
  }

  if (!DEPARTMENT_TRANSITIONS[from].includes(to)) {
    return {
      valid: false,
      error: `A ${from.toLowerCase()} department drive cannot become ${to.toLowerCase()}.`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

/**
 * A department instance is locked from the moment it is published.
 *
 * Read from `lockedAt` rather than from `status`, deliberately: an instance
 * that is later CLOSED or ARCHIVED stays locked, because students still
 * applied against that content and the record has to keep matching what they
 * were shown.
 */
export function isDepartmentDriveLocked(instance: {
  lockedAt: Date | null;
}): boolean {
  return instance.lockedAt !== null;
}

/**
 * Instance fields frozen once published.
 *
 * `applicationFields` is the application form itself — students have already
 * answered it, and a submitted application stores its answers by field key, so
 * changing the form after the fact would silently re-interpret history.
 */
export const LOCKED_DEPARTMENT_DRIVE_FIELDS = ["applicationFields"] as const;

/**
 * Instance fields that stay editable after publication, and why.
 *
 * These are operational logistics, not the offer: a room gets changed, a
 * coordinator swaps, a PPT link is added, an instruction is clarified. None of
 * them alters what a student applied *for*, so freezing them would force a
 * department to un-publish for a room change — and un-publishing is exactly
 * what the lock exists to prevent.
 */
export const EDITABLE_AFTER_PUBLISH_FIELDS = [
  "venue",
  "reportingTime",
  "coordinatorName",
  "coordinatorPhone",
  "coordinatorEmail",
  "seatingAllocation",
  "pptLink",
  "specialInstructions",
] as const;

export type EditableAfterPublishField =
  (typeof EDITABLE_AFTER_PUBLISH_FIELDS)[number];

/**
 * Master-drive fields frozen once *any* department has published it.
 *
 * These describe the opportunity itself — what the job is, who qualifies, and
 * by when. Changing one after a department released the drive would silently
 * alter an experience students have already acted on: an applicant could
 * become retroactively ineligible, or the role they applied for could change
 * underneath them.
 */
export const LOCKED_MASTER_FIELDS = [
  "roleName",
  "jobDescriptionText",
  "jobDescriptionUrl",
  "minCGPA",
  "maxActiveBacklogs",
  "applicationDeadline",
  "driveDate",
  "applyMethod",
  "externalApplyUrl",
  "packageOffered",
  "packageDisplay",
  "selectionRounds",
] as const;

export type LockedMasterField = (typeof LOCKED_MASTER_FIELDS)[number];

/**
 * Which locked master fields a proposed edit would actually change.
 *
 * Compared value by value rather than refusing every edit outright, so a
 * Super Admin can still correct a company logo or a venue default on a drive
 * some department has already published.
 */
export function findLockedMasterFieldChanges(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>
): LockedMasterField[] {
  return LOCKED_MASTER_FIELDS.filter((field) => {
    if (!(field in proposed)) return false;
    return !isSameValue(current[field], proposed[field]);
  });
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;

  // Dates compare by instant, not identity.
  if (a instanceof Date || b instanceof Date) {
    const left = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const right = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return left === right;
  }

  // `packageOffered` arrives as a Prisma Decimal on one side and a number on
  // the other; comparing their string forms avoids both float drift and a
  // false "changed" on every edit.
  if (typeof a === "object" && "toString" in (a as object)) {
    return String(a) === String(b);
  }

  return String(a) === String(b);
}
