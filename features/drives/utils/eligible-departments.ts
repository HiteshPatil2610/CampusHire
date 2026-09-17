import type { Prisma } from "@prisma/client";

/**
 * Which departments a drive is open to — `DriveEligibleDepartment` rows, real
 * foreign keys instead of the JSON array in text that `Drive.eligibleDepartments`
 * used to be (dropped once every read and write path here was switched over).
 */

/** Prisma's relation-include shape for `{ eligibleDepartmentLinks: { select: { departmentId: true } } }`. */
export interface HasEligibleDepartmentLinks {
  eligibleDepartmentLinks: { departmentId: string }[];
}

/** The set of department IDs a drive is open to, read from the join table. */
export function eligibleDepartmentIdsOf(drive: HasEligibleDepartmentLinks): string[] {
  return drive.eligibleDepartmentLinks.map((link) => link.departmentId);
}

/**
 * Replace a drive's eligible-department rows wholesale rather than diffed,
 * since a drive's department list is always submitted in full by the
 * create/update forms.
 *
 * Should run inside the same transaction as the `Drive` create/update it
 * accompanies, so a failure on either side leaves neither half written.
 */
export async function setEligibleDepartments(
  tx: Prisma.TransactionClient,
  driveId: string,
  departmentIds: string[]
): Promise<void> {
  await tx.driveEligibleDepartment.deleteMany({ where: { driveId } });
  if (departmentIds.length > 0) {
    await tx.driveEligibleDepartment.createMany({
      data: departmentIds.map((departmentId) => ({ driveId, departmentId })),
      skipDuplicates: true,
    });
  }
}

export const eligibleDepartmentLinksInclude = {
  eligibleDepartmentLinks: { select: { departmentId: true } },
} satisfies Prisma.DriveInclude;

/**
 * Attach an already-known department ID list to a plain Drive row as the
 * relation shape eligibility helpers expect — for a write path that just
 * created/updated the drive and knows the IDs without a re-fetch.
 */
export function withEligibleDepartmentLinks<T>(
  drive: T,
  departmentIds: string[]
): T & HasEligibleDepartmentLinks {
  return {
    ...drive,
    eligibleDepartmentLinks: departmentIds.map((departmentId) => ({ departmentId })),
  };
}
