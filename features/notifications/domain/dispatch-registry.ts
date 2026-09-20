import type { NotificationEvent } from "@prisma/client";
import { retryDrivePublished } from "../actions/notify-eligible-students-of-drive";
import {
  fanOutDriveCancelled,
  fanOutDeadlineExtended,
  fanOutDriveUpdated,
} from "../actions/notify-drive-lifecycle";
import { fanOutAnnouncement } from "../producers/announcement-events";

/**
 * How a failed fan-out is run again.
 *
 * A dispatch stores only ids, so a retry resolves the drive, the department
 * and the recipients from the database as they are *now* — never from
 * whatever was in memory when it first failed. Per-recipient dedupe keys
 * mean a retry fills the gaps and writes nothing that already arrived.
 *
 * An event with no entry here cannot be retried; the Super Admin sees why.
 */

export type DispatchRetry = (
  payload: Record<string, unknown>,
  dispatchId: string
) => Promise<number>;

export const DISPATCH_RETRIES: Partial<Record<NotificationEvent, DispatchRetry>> = {
  DRIVE_PUBLISHED: (payload, dispatchId) => retryDrivePublished(payload, dispatchId),
  DRIVE_CANCELLED: (payload, dispatchId) =>
    fanOutDriveCancelled(
      {
        driveId: String(payload.driveId),
        departmentIds: Array.isArray(payload.departmentIds) ? payload.departmentIds.map(String) : [],
        companyName: String(payload.companyName ?? "the company"),
        reason: String(payload.reason ?? ""),
        notifyDepartmentAdmins: payload.notifyDepartmentAdmins === true,
      },
      dispatchId
    ),
  DRIVE_DEADLINE: (payload, dispatchId) =>
    fanOutDeadlineExtended(
      {
        driveId: String(payload.driveId),
        companyName: String(payload.companyName ?? "the company"),
        roleName: String(payload.roleName ?? "the role"),
        newDeadline: String(payload.newDeadline),
        departmentId: String(payload.departmentId),
      },
      dispatchId
    ),
  DRIVE_UPDATED: (payload, dispatchId) =>
    fanOutDriveUpdated(
      {
        driveId: String(payload.driveId),
        summary: String(payload.summary ?? "This drive was updated."),
        departmentIds: Array.isArray(payload.departmentIds) ? payload.departmentIds.map(String) : null,
        day: String(payload.day ?? ""),
        hash: String(payload.hash ?? ""),
      },
      dispatchId
    ),
  ANNOUNCEMENT: (payload, dispatchId) => fanOutAnnouncement(String(payload.announcementId), dispatchId),
};

export function canRetryDispatch(event: NotificationEvent): boolean {
  return DISPATCH_RETRIES[event] !== undefined;
}
