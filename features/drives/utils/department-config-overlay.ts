import type { Drive, DriveDepartmentConfig } from "@prisma/client";
import type { HasEligibleDepartmentLinks } from "./eligible-departments";

/**
 * A central drive as one department's students see it.
 *
 * The Super Admin owns the drive record; each department admin owns the
 * logistics and required application fields for their own students. Overlaying
 * here keeps every downstream consumer (cards, detail page, apply flow) working
 * on a plain Drive shape while still showing department-specific values.
 */
export type DriveForStudent<TDrive extends Drive = Drive> = TDrive & {
  seatingAllocation: string | null;
  specialInstructions: string | null;
  coordinatorEmail: string | null;
};

export function applyDepartmentConfig<TDrive extends Drive & HasEligibleDepartmentLinks>(
  drive: TDrive,
  config: DriveDepartmentConfig | null | undefined
): DriveForStudent<TDrive> {
  if (!config) {
    return {
      ...drive,
      seatingAllocation: null,
      specialInstructions: null,
      coordinatorEmail: null,
    };
  }

  return {
    ...drive,
    venue: config.venue ?? drive.venue,
    reportingTime: config.reportingTime ?? drive.reportingTime,
    contactPerson: config.coordinatorName ?? drive.contactPerson,
    contactPhone: config.coordinatorPhone ?? drive.contactPhone,
    pptLink: config.pptLink ?? drive.pptLink,
    applicationFields: config.applicationFields ?? drive.applicationFields,
    seatingAllocation: config.seatingAllocation,
    specialInstructions: config.specialInstructions,
    coordinatorEmail: config.coordinatorEmail,
  };
}
