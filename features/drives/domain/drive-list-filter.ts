import type { MasterDriveStatus } from "@prisma/client";

/**
 * Filtering the Super Admin's list of central drives.
 *
 * Pure and in memory: the whole (capped) list is already loaded, so a filter
 * is a function over it rather than another query. Filters narrow what the
 * caller was already allowed to see — they can never widen it.
 *
 * "Published / closed / cancelled" is the *master* drive's lifecycle; a drive
 * that is live in one department and still configuring in another is found by
 * the department filter plus the department status.
 */

export interface DriveFilterInput {
  /** Matches the company or the role. */
  search: string;
  status: MasterDriveStatus | "";
  /** A department the drive is assigned to. */
  departmentId: string;
  /** ISO dates (YYYY-MM-DD), inclusive, on the next stage date. */
  from: string;
  to: string;
}

export const EMPTY_DRIVE_FILTER: DriveFilterInput = {
  search: "",
  status: "",
  departmentId: "",
  from: "",
  to: "",
};

export interface FilterableDrive {
  companyName: string;
  roleName: string;
  lifecycleStatus: MasterDriveStatus;
  nextStageDate: Date;
  eligibleDepartmentLinks: { departmentId: string }[];
}

const day = (value: string, end: boolean): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(time) ? null : time;
};

export function driveFilterActive(filter: DriveFilterInput): boolean {
  return Boolean(
    filter.search.trim() || filter.status || filter.departmentId || filter.from || filter.to
  );
}

export function filterDrives<T extends FilterableDrive>(drives: T[], filter: DriveFilterInput): T[] {
  const term = filter.search.trim().toLowerCase();
  const from = day(filter.from, false);
  const to = day(filter.to, true);

  return drives.filter((drive) => {
    if (
      term &&
      !drive.companyName.toLowerCase().includes(term) &&
      !drive.roleName.toLowerCase().includes(term)
    ) {
      return false;
    }
    if (filter.status && drive.lifecycleStatus !== filter.status) return false;
    if (
      filter.departmentId &&
      !drive.eligibleDepartmentLinks.some((link) => link.departmentId === filter.departmentId)
    ) {
      return false;
    }

    const driveTime = new Date(drive.nextStageDate).getTime();
    if (from !== null && driveTime < from) return false;
    if (to !== null && driveTime > to) return false;
    return true;
  });
}
