import type { Drive, DriveDepartmentConfig } from "@prisma/client";
import type { HasEligibleDepartmentLinks } from "../utils/eligible-departments";

/**
 * Collapse a master drive and one department's instance into the single shape
 * every student- and admin-facing component reads.
 *
 *   MASTER DRIVE  +  DEPARTMENT INSTANCE  →  ResolvedDepartmentDrive
 *
 * A central drive is authored once by the Super Admin but runs separately in
 * each eligible department: venue, coordinator and required application fields
 * belong to the department admin and are visible only to that department's
 * students. Resolving here keeps every downstream consumer — cards, the detail
 * page, the apply flow — working on a plain Drive-like object while still
 * showing department-specific values.
 *
 * **The resolved shape is deliberately flat and identical to what the previous
 * `applyDepartmentConfig` returned**, because six components read it directly
 * (`drive-card`, `drives-grid`, `dashboard-drive-card`, `apply-section`,
 * `application-review-modal`, `ineligible-drive-page`). Changing it would mean
 * changing all of them; it is the stable contract at this boundary.
 *
 * Resolution rule: an instance value wins when it is set, otherwise the
 * master's value is inherited. A missing instance row means "inherit
 * everything" — which is the state every assigned department is in until its
 * admin saves a configuration for the first time.
 */

/** The three fields that exist only on an instance, with no master fallback. */
export interface DepartmentOnlyFields {
  seatingAllocation: string | null;
  specialInstructions: string | null;
  coordinatorEmail: string | null;
}

export type ResolvedDepartmentDrive<TDrive extends Drive = Drive> = TDrive &
  DepartmentOnlyFields;

/**
 * Historical alias. The student-facing queries and components named this type
 * before the domain layer existed; kept so their imports keep reading
 * naturally.
 */
export type DriveForStudent<TDrive extends Drive = Drive> =
  ResolvedDepartmentDrive<TDrive>;

export function resolveDepartmentDrive<
  TDrive extends Drive & HasEligibleDepartmentLinks,
>(
  master: TDrive,
  instance: DriveDepartmentConfig | null | undefined
): ResolvedDepartmentDrive<TDrive> {
  if (!instance) {
    return {
      ...master,
      seatingAllocation: null,
      specialInstructions: null,
      coordinatorEmail: null,
    };
  }

  return {
    ...master,
    // `??` rather than `||`: an instance that deliberately stores an empty
    // string is still an answer, and must not fall back to the master's value.
    venue: instance.venue ?? master.venue,
    reportingTime: instance.reportingTime ?? master.reportingTime,
    contactPerson: instance.coordinatorName ?? master.contactPerson,
    contactPhone: instance.coordinatorPhone ?? master.contactPhone,
    pptLink: instance.pptLink ?? master.pptLink,
    applicationFields: instance.applicationFields ?? master.applicationFields,
    seatingAllocation: instance.seatingAllocation,
    specialInstructions: instance.specialInstructions,
    coordinatorEmail: instance.coordinatorEmail,
  };
}

/**
 * Resolve a page of master drives against the instances belonging to one
 * department, given the instance rows already fetched for them.
 */
export function resolveDepartmentDrives<
  TDrive extends Drive & HasEligibleDepartmentLinks,
>(
  masters: TDrive[],
  instances: DriveDepartmentConfig[]
): ResolvedDepartmentDrive<TDrive>[] {
  const byDriveId = new Map(
    instances.map((instance) => [instance.driveId, instance])
  );

  return masters.map((master) =>
    resolveDepartmentDrive(master, byDriveId.get(master.id))
  );
}
