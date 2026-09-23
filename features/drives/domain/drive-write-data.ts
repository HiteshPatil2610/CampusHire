import type { Prisma } from "@prisma/client";
import type { DriveFormData } from "../schemas/drive-form";
import { driveKindColumns } from "./drive-kind";
import type { DriveDates } from "./drive-window";

/**
 * Turning a validated drive form into the `Drive` column payload.
 *
 * Both kinds of drive are written from the same form, so they share one set
 * of content columns (`driveContentColumns`). What differs is only what the
 * kind itself decides: its origin (`driveKindColumns`), and whether it starts
 * as a released department drive with its own selection rounds or as a DRAFT
 * master whose rounds come from its pipeline.
 *
 * `packageOffered` stays a plain number here and Prisma widens it into the
 * `NUMERIC(10,2)` column; nothing in this file does arithmetic on money.
 */

/** Blank → null, so an emptied optional field clears its column. */
const orNull = (value: string | null | undefined) => (value ? value : null);

/** The columns every drive takes from the form, whoever posted it. */
function driveContentColumns(input: DriveFormData, dates: DriveDates) {
  return {
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl ?? null,
    roleName: input.roleName,
    packageOffered: input.packageOffered,
    packageDisplay: orNull(input.packageDisplay),
    jobDescriptionUrl: orNull(input.jobDescriptionUrl),
    jobDescriptionText: orNull(input.jobDescriptionText),
    requirements: orNull(input.requirements),
    skills: input.skills && input.skills.length > 0 ? JSON.stringify(input.skills) : null,
    applicationStartDate: dates.applicationStartDate,
    applicationDeadline: dates.applicationDeadline,
    nextStageDate: dates.nextStageDate,
    applyMethod: input.applyMethod,
    // A portal URL only means something when students apply there.
    externalApplyUrl: input.applyMethod === "EXTERNAL" ? orNull(input.externalApplyUrl) : null,
    minCGPA: input.minCGPA,
    maxActiveBacklogs: input.maxActiveBacklogs,
    pptLink: orNull(input.pptLink),
    venue: orNull(input.venue),
    reportingTime: orNull(input.reportingTime),
    contactPerson: orNull(input.contactPerson),
    contactPhone: orNull(input.contactPhone),
    // `applicationFields` is deliberately absent: the form is written to
    // `DriveApplicationField` rows by `writeMasterForm`, which dual-writes
    // this column. Writing it here too could leave the two disagreeing.
  } satisfies Partial<Prisma.DriveUncheckedCreateInput>;
}

/**
 * A department drive. `departmentId` is the caller's own department, resolved
 * server-side by the action — never taken from the request — and the origin
 * columns come from `driveKindColumns`, so nothing a form sends can make a
 * department drive central. `dates` are the instants `validateDriveDates`
 * produced from the submitted days.
 */
export function buildDepartmentDriveData(
  input: DriveFormData,
  departmentId: string,
  dates: DriveDates
): Omit<Prisma.DriveUncheckedCreateInput, "createdByUserId"> {
  return {
    ...driveKindColumns("DEPARTMENT", departmentId),
    ...driveContentColumns(input, dates),
    selectionRounds: JSON.stringify(input.selectionRounds ?? []),
  };
}

/**
 * A central (master) drive. It is composed and assigned before departments
 * release it, so it starts as a DRAFT; its selection rounds come from its
 * recruitment pipeline (the action adds them), so they are seeded empty here —
 * the column is NOT NULL.
 */
export function buildCentralDriveData(
  input: DriveFormData,
  dates: DriveDates
): Omit<Prisma.DriveUncheckedCreateInput, "createdByUserId"> {
  return {
    ...driveKindColumns("CENTRAL", null),
    lifecycleStatus: "DRAFT",
    selectionRounds: JSON.stringify([]),
    ...driveContentColumns(input, dates),
  };
}

/**
 * The create payloads minus the columns an edit must not touch.
 *
 * - `isCentralDrive` / `departmentId` — a drive never changes ownership or
 *   kind after creation, so an edit must not be able to reassign either.
 * - `selectionRounds` (central only) — a master's rounds come from its
 *   pipeline, so re-sending the seeded `[]` would wipe them.
 * - `lifecycleStatus` (central only) — an edit is not a lifecycle transition.
 *   Re-sending the seeded `DRAFT` would silently pull a released drive back.
 */
export function toDepartmentDriveUpdateData(
  input: DriveFormData,
  dates: DriveDates
): Prisma.DriveUncheckedUpdateInput {
  return {
    ...driveContentColumns(input, dates),
    selectionRounds: JSON.stringify(input.selectionRounds ?? []),
  };
}

export function toCentralDriveUpdateData(
  input: DriveFormData,
  dates: DriveDates
): Prisma.DriveUncheckedUpdateInput {
  return driveContentColumns(input, dates);
}
