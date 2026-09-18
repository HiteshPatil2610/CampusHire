import type { DepartmentDriveStatus, Prisma } from "@prisma/client";

/**
 * Assigning a master drive to departments.
 *
 *   MASTER DRIVE  ──assign──▶  DEPARTMENT DRIVE (one per department)
 *
 * The assignment is recorded at two levels and they are the same fact:
 *
 *  - `DriveEligibleDepartment` — the edge the eligibility engine reads
 *  - `DriveDepartmentConfig`   — the instance the department admin owns
 *
 * Neither may exist without the other, so every function here writes both
 * inside the caller's transaction. Before this module the two were managed
 * separately: `setEligibleDepartments` replaced the edges wholesale with a
 * delete-and-recreate, which would have orphaned instances the moment they
 * started carrying state — and would have silently unassigned a department
 * whose students had already applied.
 *
 * Everything here is idempotent: assigning a department that is already
 * assigned is a no-op that reports itself, not an error and not a duplicate.
 */

export interface AssignmentOutcome {
  /** Departments that gained an assignment on this call. */
  assigned: string[];
  /** Departments that already had one — reported, not re-created. */
  alreadyAssigned: string[];
}

export interface UnassignmentBlock {
  departmentId: string;
  applicationCount: number;
}

export interface ReconcileOutcome extends AssignmentOutcome {
  /** Departments whose assignment was removed. */
  removed: string[];
  /**
   * Departments that were asked to be removed but kept, because their students
   * hold applications to this drive. Removing them would orphan real history.
   */
  blocked: UnassignmentBlock[];
}

/**
 * How many applications this drive holds from one department's students.
 *
 * This is the guard on every removal path. An application belongs to a
 * student, and a student belongs to a department, so the count is the join —
 * there is no `departmentId` on `DriveApplication` to read directly.
 */
export async function countDepartmentApplications(
  tx: Prisma.TransactionClient,
  driveId: string,
  departmentId: string
): Promise<number> {
  return tx.driveApplication.count({
    where: { driveId, student: { departmentId } },
  });
}

/**
 * Ensure each department is assigned to the drive, creating whichever half of
 * the pair is missing. Safe to call repeatedly with the same input.
 *
 * An existing instance is left completely untouched — its status and whatever
 * the department admin configured are theirs, and re-running an assignment
 * must not reset either.
 */
export async function ensureDepartmentsAssigned(
  tx: Prisma.TransactionClient,
  driveId: string,
  departmentIds: string[],
  /**
   * Status for instances created by this call. Defaults to `ASSIGNED`, which
   * is the Super Admin's assignment flow — the department has work to do.
   * A department posting its own drive is already its author, so that path
   * passes `PUBLISHED` and keeps behaving as it does today.
   */
  initialStatus: DepartmentDriveStatus = "ASSIGNED"
): Promise<AssignmentOutcome> {
  const unique = [...new Set(departmentIds)];

  if (unique.length === 0) {
    return { assigned: [], alreadyAssigned: [] };
  }

  const existing = await tx.driveDepartmentConfig.findMany({
    where: { driveId, departmentId: { in: unique } },
    select: { departmentId: true },
  });
  const existingIds = new Set(existing.map((row) => row.departmentId));

  const toCreate = unique.filter((id) => !existingIds.has(id));

  if (toCreate.length > 0) {
    await tx.driveDepartmentConfig.createMany({
      data: toCreate.map((departmentId) => ({
        driveId,
        departmentId,
        status: initialStatus,
      })),
      skipDuplicates: true,
    });
  }

  // The eligibility edge is ensured for the whole set, not just the newly
  // created instances: a row may exist on one side only if something wrote it
  // before this module owned the pair.
  await tx.driveEligibleDepartment.createMany({
    data: unique.map((departmentId) => ({ driveId, departmentId })),
    skipDuplicates: true,
  });

  return {
    assigned: toCreate,
    alreadyAssigned: unique.filter((id) => existingIds.has(id)),
  };
}

/**
 * Remove one department's assignment, refusing when its students hold
 * applications to the drive.
 *
 * Historical application data is never destroyed to satisfy an unassignment —
 * `DriveApplication.drive` is `onDelete: Restrict` for the same reason. A
 * department that has already taken applications stays assigned.
 */
export async function removeDepartmentAssignment(
  tx: Prisma.TransactionClient,
  driveId: string,
  departmentId: string
): Promise<{ removed: true } | { removed: false; applicationCount: number }> {
  const applicationCount = await countDepartmentApplications(
    tx,
    driveId,
    departmentId
  );

  if (applicationCount > 0) {
    return { removed: false, applicationCount };
  }

  await tx.driveDepartmentConfig.deleteMany({
    where: { driveId, departmentId },
  });
  await tx.driveEligibleDepartment.deleteMany({
    where: { driveId, departmentId },
  });

  return { removed: true };
}

/**
 * Bring a drive's assignments in line with a desired department set.
 *
 * Used by the drive create/update paths, which submit the full list every
 * time. Additions are made, removals are attempted, and any removal blocked by
 * existing applications is reported rather than forced — the caller decides
 * whether to surface that as a refusal or a warning.
 */
export async function reconcileDepartmentAssignments(
  tx: Prisma.TransactionClient,
  driveId: string,
  desiredDepartmentIds: string[],
  initialStatus: DepartmentDriveStatus = "ASSIGNED"
): Promise<ReconcileOutcome> {
  const desired = new Set(desiredDepartmentIds);

  const current = await tx.driveEligibleDepartment.findMany({
    where: { driveId },
    select: { departmentId: true },
  });

  const toRemove = current
    .map((row) => row.departmentId)
    .filter((id) => !desired.has(id));

  const removed: string[] = [];
  const blocked: UnassignmentBlock[] = [];

  for (const departmentId of toRemove) {
    const result = await removeDepartmentAssignment(tx, driveId, departmentId);

    if (result.removed) {
      removed.push(departmentId);
    } else {
      blocked.push({ departmentId, applicationCount: result.applicationCount });
    }
  }

  const added = await ensureDepartmentsAssigned(
    tx,
    driveId,
    [...desired],
    initialStatus
  );

  return { ...added, removed, blocked };
}

/**
 * Which departments cannot be dropped from a desired set, checked before any
 * write. Lets a caller refuse the whole operation up front instead of
 * discovering a blocked removal halfway through a transaction.
 */
export async function findBlockedRemovals(
  tx: Prisma.TransactionClient,
  driveId: string,
  desiredDepartmentIds: string[]
): Promise<UnassignmentBlock[]> {
  const desired = new Set(desiredDepartmentIds);

  const current = await tx.driveEligibleDepartment.findMany({
    where: { driveId },
    select: { departmentId: true },
  });

  const blocked: UnassignmentBlock[] = [];

  for (const { departmentId } of current) {
    if (desired.has(departmentId)) continue;

    const applicationCount = await countDepartmentApplications(
      tx,
      driveId,
      departmentId
    );

    if (applicationCount > 0) {
      blocked.push({ departmentId, applicationCount });
    }
  }

  return blocked;
}
