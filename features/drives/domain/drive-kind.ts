/**
 * The drive domain model, and how it maps onto the tables that already exist.
 *
 *   MASTER DRIVE          →  `Drive`
 *     ↓                       one row per opportunity. Owned by whoever posted
 *     ↓                       it: the Super Admin (central) or one department.
 *   DEPARTMENT INSTANCE   →  `DriveDepartmentConfig`
 *     ↓                       one row per (drive, department), unique on that
 *     ↓                       pair. What a department owns and configures.
 *   APPLICATION           →  `DriveApplication`
 *
 * `DriveEligibleDepartment` is the assignment edge: which departments a master
 * drive is open to. An instance row may not exist yet for an assigned
 * department — see `resolveDepartmentDrive`, which treats a missing instance as
 * "inherit everything from the master".
 *
 * **No table is renamed.** The existing schema already expresses this model;
 * the names below are the domain vocabulary laid over it, so that reading the
 * code does not require remembering that "config" means "instance".
 */

import type { Drive, DriveDepartmentConfig } from "@prisma/client";

/**
 * Who owns a master drive's content.
 *
 * - `CENTRAL`    — posted by the Super Admin, institution-wide, `departmentId`
 *                  is null. Department admins configure their own instance but
 *                  never the master row.
 * - `DEPARTMENT` — posted by one department admin and owned by that
 *                  department, which is also the only department it reaches.
 *
 * Persisted as the `Drive.isCentralDrive` boolean that already exists. This
 * type is the discriminant the application code branches on, so no caller has
 * to infer intent from a null `departmentId` — which is what
 * `getDriveDetail` got wrong for central drives.
 */
export type DriveKind = "CENTRAL" | "DEPARTMENT";

/** Minimal shape needed to classify a drive — anything Drive-like will do. */
export type DriveKindSource = Pick<Drive, "isCentralDrive">;

export function driveKindOf(drive: DriveKindSource): DriveKind {
  return drive.isCentralDrive ? "CENTRAL" : "DEPARTMENT";
}

export function isCentralDrive(drive: DriveKindSource): boolean {
  return driveKindOf(drive) === "CENTRAL";
}

export function isDepartmentDrive(drive: DriveKindSource): boolean {
  return driveKindOf(drive) === "DEPARTMENT";
}

/** The column values a given kind must be persisted with. */
export function driveKindColumns(
  kind: DriveKind,
  departmentId: string | null
): { isCentralDrive: boolean; departmentId: string | null } {
  return kind === "CENTRAL"
    ? { isCentralDrive: true, departmentId: null }
    : { isCentralDrive: false, departmentId };
}

/** A master drive paired with one department's instance, if it has one. */
export interface DepartmentDrivePair<TDrive extends Drive = Drive> {
  master: TDrive;
  instance: DriveDepartmentConfig | null;
}
