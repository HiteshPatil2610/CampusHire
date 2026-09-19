import type { DepartmentDriveStatus } from "@prisma/client";

/** One department's instance of a master drive, for the Super Admin's views. */
export interface DriveDeptStatusSummary {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  status: DepartmentDriveStatus;
}

/** What to load of each department instance to build the summary. */
export const DEPT_STATUS_SELECT = {
  select: {
    status: true,
    departmentId: true,
    department: { select: { code: true, name: true } },
  },
  orderBy: { department: { code: "asc" } },
} as const;

type InstanceRow = {
  status: DepartmentDriveStatus;
  departmentId: string;
  department: { code: string; name: string };
};

/**
 * The per-department status list and the counters derived from it. Both
 * central-drive queries build their rows here, so the list and the detail can
 * never count differently.
 */
export function summarizeDepartmentStatuses(instances: InstanceRow[]) {
  const deptStatusSummary: DriveDeptStatusSummary[] = instances.map((instance) => ({
    departmentId: instance.departmentId,
    departmentCode: instance.department.code,
    departmentName: instance.department.name,
    status: instance.status,
  }));
  const count = (...statuses: DepartmentDriveStatus[]) =>
    deptStatusSummary.filter((entry) => statuses.includes(entry.status)).length;

  return {
    deptStatusSummary,
    assignedCount: count("ASSIGNED"),
    configuredCount: count("CONFIGURED"),
    publishedCount: count("PUBLISHED"),
    closedCount: count("CLOSED", "CANCELLED", "ARCHIVED"),
  };
}
