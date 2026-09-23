import type { Prisma } from "@prisma/client";
import type { DriveInput } from "../schemas/drive";
import type { CreateCentralDriveInput } from "../schemas/central-drive";
import { parsePackageFromDisplay } from "../utils/parse-package-display";
import { driveKindColumns } from "./drive-kind";
import type { DriveDates } from "./drive-window";

/**
 * Turning validated form input into the `Drive` column payload.
 *
 * Each of these was written out twice — once in the create action and again,
 * character for character, in the update action. A field added to one and
 * forgotten in the other is exactly how `applicationFields` came to be
 * persisted by the department create path but not by the central one.
 *
 * `packageOffered` stays a plain number here and Prisma widens it into the
 * `NUMERIC(10,2)` column; nothing in this file does arithmetic on money.
 */

/**
 * A department drive. `departmentId` is the caller's own department, resolved
 * server-side by the action — never taken from the request — and the origin
 * columns come from `driveKindColumns`, so nothing a form sends can make a
 * department drive central. `dates` are the instants `validateDriveDates`
 * produced from the submitted days.
 */
export function buildDepartmentDriveData(
  input: DriveInput,
  departmentId: string,
  dates: DriveDates
): Prisma.DriveUncheckedCreateInput {
  return {
    ...driveKindColumns("DEPARTMENT", departmentId),
    companyName: input.companyName,
    roleName: input.roleName,
    companyLogoUrl: input.companyLogoUrl ?? null,
    jobDescriptionUrl: input.jobDescriptionUrl || null,
    packageOffered: input.packageOffered,
    packageDisplay: input.packageDisplay ?? null,
    selectionRounds: JSON.stringify(input.selectionRounds),
    applicationStartDate: dates.applicationStartDate,
    applicationDeadline: dates.applicationDeadline,
    nextStageDate: dates.nextStageDate,
    applyMethod: input.applyMethod,
    externalApplyUrl: input.externalApplyUrl || null,
    minCGPA: input.minCGPA,
    maxActiveBacklogs: input.maxActiveBacklogs,
    venue: input.venue ?? null,
    reportingTime: input.reportingTime ?? null,
    contactPerson: input.contactPerson ?? null,
    contactPhone: input.contactPhone ?? null,
    pptLink: input.pptLink ?? null,
    // `applicationFields` is deliberately absent: the form is written to
    // `DriveApplicationField` rows by `writeMasterForm`, which dual-writes
    // this column. Writing it here too could leave the two disagreeing.
  };
}

/**
 * A central (master) drive. Two values are derived rather than submitted:
 *
 * - `applyMethod` — a company portal URL means students register externally;
 *   without one they apply in-app like any department drive.
 * - `packageOffered` — parsed from the free-text CTC. `packageDisplay` stays
 *   what students actually see.
 *
 * `createdByUserId` is passed separately because it is only set on create;
 * an edit does not reassign authorship.
 */
export function buildCentralDriveData(
  input: CreateCentralDriveInput,
  dates: DriveDates
): Omit<Prisma.DriveUncheckedCreateInput, "createdByUserId"> {
  const portalUrl = input.externalApplyUrl || null;

  return {
    ...driveKindColumns("CENTRAL", null),
    // A master drive is composed and assigned before it is released. Nothing
    // gates student visibility on this yet — that lands with the lifecycle
    // phase — so today it is a recorded intent, not an access decision.
    lifecycleStatus: "DRAFT",
    // The modal does not collect selection rounds; they are configured after
    // creation. The column is NOT NULL, so it is seeded empty.
    selectionRounds: JSON.stringify([]),
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl ?? null,
    roleName: input.roleName,
    jobDescriptionText: input.jobDescriptionText || null,
    // Master defaults a department may override on its own instance.
    requirements: input.requirements || null,
    skills: input.skills && input.skills.length > 0 ? JSON.stringify(input.skills) : null,
    packageOffered: parsePackageFromDisplay(input.packageDisplay),
    packageDisplay: input.packageDisplay,
    applicationStartDate: dates.applicationStartDate,
    applicationDeadline: dates.applicationDeadline,
    nextStageDate: dates.nextStageDate,
    applyMethod: portalUrl ? "EXTERNAL" : "IN_APP",
    externalApplyUrl: portalUrl,
    minCGPA: input.minCGPA,
    maxActiveBacklogs: input.maxActiveBacklogs,
    venue: input.venue ?? null,
    reportingTime: input.reportingTime ?? null,
    contactPerson: input.contactPerson ?? null,
    contactPhone: input.contactPhone ?? null,
    pptLink: input.pptLink || null,
  };
}

/**
 * The create payloads minus the columns an edit must not touch.
 *
 * - `isCentralDrive` / `departmentId` — a drive never changes ownership or
 *   kind after creation, so an edit must not be able to reassign either.
 * - `selectionRounds` (central only) — the central modal does not collect it,
 *   so re-sending the seeded `[]` on every edit would wipe whatever was
 *   configured afterwards.
 * - `lifecycleStatus` (central only) — an edit is not a lifecycle transition.
 *   Re-sending the seeded `DRAFT` would silently pull a released drive back.
 */
export function toDepartmentDriveUpdateData(
  input: DriveInput,
  dates: DriveDates
): Prisma.DriveUncheckedUpdateInput {
  const { isCentralDrive, departmentId, ...rest } = buildDepartmentDriveData(
    input,
    // Discarded immediately below — ownership is never rewritten by an edit.
    "",
    dates
  );
  void isCentralDrive;
  void departmentId;
  return rest;
}

export function toCentralDriveUpdateData(
  input: CreateCentralDriveInput,
  dates: DriveDates
): Prisma.DriveUncheckedUpdateInput {
  const {
    isCentralDrive,
    departmentId,
    selectionRounds,
    lifecycleStatus,
    ...rest
  } = buildCentralDriveData(input, dates);
  void isCentralDrive;
  void departmentId;
  void selectionRounds;
  void lifecycleStatus;
  return rest;
}
