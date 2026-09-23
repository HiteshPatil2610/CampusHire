import type { Drive } from '@prisma/client';
import { getDriveStatus } from '@/features/drives/utils/drive-status';

export type DriveCatalogFilter =
  | 'all'
  | 'open'
  | 'applied'
  | 'upcoming'
  | 'closed';

export const DRIVE_FILTER_LABELS: Record<DriveCatalogFilter, string> = {
  all: 'All drives',
  open: 'Open',
  applied: 'Applied',
  upcoming: 'Upcoming',
  closed: 'Closed',
};

export function parseDriveCatalogFilter(
  value: string | undefined
): DriveCatalogFilter {
  if (
    value === 'all' ||
    value === 'open' ||
    value === 'applied' ||
    value === 'upcoming' ||
    value === 'closed'
  ) {
    return value;
  }
  return 'open';
}

export function filterDriveCatalog(
  drives: Drive[],
  filter: DriveCatalogFilter,
  appliedDriveIds: Set<string>
): Drive[] {
  const now = new Date();

  switch (filter) {
    case 'open':
      return drives.filter(
        (drive) => getDriveStatus(drive) === 'open'
      );
    case 'applied':
      return drives.filter((drive) => appliedDriveIds.has(drive.id));
    case 'upcoming':
      // Applications have not opened yet.
      return drives.filter((drive) => getDriveStatus(drive) === 'upcoming');
    case 'closed':
      return drives.filter(
        (drive) => getDriveStatus(drive) === 'closed'
      );
    default:
      return drives;
  }
}
