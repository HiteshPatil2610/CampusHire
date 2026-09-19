import type { DepartmentDriveStatus } from "@prisma/client";

/**
 * Which "My Drives" bucket a department drive belongs in.
 *
 *   ASSIGNED         assigned by the Super Admin, nothing saved yet
 *   CONFIGURING      draft in progress, not yet publishable
 *   READY_TO_PUBLISH every step complete, not yet published
 *   ACTIVE           published and still taking applications
 *   CLOSED           closed by the department, or cancelled
 *   COMPLETED        archived, or published and past its deadline
 *
 * One function, so the filter chips and their counts can never disagree.
 * Pure: readiness and the deadline come from the server's resolved data.
 */
export type DepartmentDriveBucket =
  | "ASSIGNED"
  | "CONFIGURING"
  | "READY_TO_PUBLISH"
  | "ACTIVE"
  | "CLOSED"
  | "COMPLETED";

export const DEPARTMENT_DRIVE_BUCKETS: { id: DepartmentDriveBucket; label: string }[] = [
  { id: "ASSIGNED", label: "Assigned" },
  { id: "CONFIGURING", label: "Configuring" },
  { id: "READY_TO_PUBLISH", label: "Ready to Publish" },
  { id: "ACTIVE", label: "Active" },
  { id: "CLOSED", label: "Closed" },
  { id: "COMPLETED", label: "Completed" },
];

export function departmentDriveBucket(input: {
  status: DepartmentDriveStatus | null;
  /** The server's publish-readiness for this drive. */
  ready: boolean;
  /** Whether the resolved application deadline is still in the future. */
  deadlineOpen: boolean;
}): DepartmentDriveBucket {
  switch (input.status) {
    case "CANCELLED":
    case "CLOSED":
      return "CLOSED";
    case "ARCHIVED":
      return "COMPLETED";
    case "PUBLISHED":
      return input.deadlineOpen ? "ACTIVE" : "COMPLETED";
    case "CONFIGURED":
      return input.ready ? "READY_TO_PUBLISH" : "CONFIGURING";
    case "ASSIGNED":
    case null:
    default:
      // An assigned drive that is already complete (a master with every
      // detail filled in) can be published without a save.
      return input.ready ? "READY_TO_PUBLISH" : "ASSIGNED";
  }
}
