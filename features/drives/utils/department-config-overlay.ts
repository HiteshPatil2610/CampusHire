import type { Drive, DriveDepartmentConfig } from "@prisma/client";

/**
 * A central drive as one department's students see it.
 *
 * The Super Admin owns the drive record; each department admin owns the
 * logistics and required application fields for their own students. Overlaying
 * here keeps every downstream consumer (cards, detail page, apply flow) working
 * on a plain Drive shape while still showing department-specific values.
 */
export type DriveForStudent = Drive & {
  seatingAllocation: string | null;
  specialInstructions: string | null;
  coordinatorEmail: string | null;
};

export function applyDepartmentConfig(
  drive: Drive,
  config: DriveDepartmentConfig | null | undefined
): DriveForStudent {
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
