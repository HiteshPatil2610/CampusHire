import type { Drive } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications";
import type { HasEligibleDepartmentLinks } from "@/features/drives/utils/eligible-departments";
import { formatPackage } from "@/features/drives/utils/format-package";
import { runNotificationDispatch } from "../domain/dispatch";
import { loadDriveForAudience, resolveDriveAudience } from "../domain/drive-recipients";

/**
 * Tell the students who can actually apply that a drive is open to them.
 *
 * This is the only place students hear about a new drive, and it runs only
 * when a department's drive is published (`publishDepartmentDrive`, or a
 * department posting its own drive, which is published at once). Creating or
 * assigning a master drive notifies no student.
 *
 * Recipients come from `resolveDriveAudience` — the same evaluator the drive
 * list, drive page and `applyToDrive` use, per department — so a student is
 * never told about a drive the listing would then hide from them.
 *
 * A fan-out, keyed per drive and department set: publishing twice, or
 * retrying, notifies nobody twice. Failures are recorded on the dispatch and
 * never fail the publish that triggered them.
 */
export async function notifyEligibleStudentsOfDrive(
  drive: Drive & HasEligibleDepartmentLinks,
  /**
   * Restrict the fan-out to specific departments. Publishing is a
   * per-department act, so releasing a central drive in one department must
   * not announce it to the others still configuring theirs.
   */
  options: { departmentIds?: string[]; triggeredById?: string } = {}
): Promise<{ notified: number }> {
  const scope = options.departmentIds ? [...new Set(options.departmentIds)].sort() : null;
  const outcome = await runNotificationDispatch(
    {
      key: `drive-published:${drive.id}:${scope ? scope.join(",") : "all"}`,
      event: "DRIVE_PUBLISHED",
      payload: { driveId: drive.id, departmentIds: scope },
      departmentId: scope?.length === 1 ? scope[0] : null,
      triggeredById: options.triggeredById ?? null,
    },
    ({ dispatchId }) => fanOutDrivePublished(drive, scope ?? undefined, dispatchId)
  );
  return { notified: outcome.delivered };
}

/** The fan-out itself; also what a retry runs, with the drive reloaded. */
export async function fanOutDrivePublished(
  drive: Drive & HasEligibleDepartmentLinks,
  departmentIds: string[] | undefined,
  dispatchId: string
): Promise<number> {
  const audience = await resolveDriveAudience(drive, departmentIds);
  const packageText = formatPackage(drive);
  let delivered = 0;

  // One delivery per department: each has its own role title and deadline,
  // and the notification expires when that department's applications close.
  for (const [departmentId, resolved] of audience.resolvedByDepartment) {
    const recipients = audience.eligible
      .filter((student) => student.departmentId === departmentId)
      .map((student) => ({ userId: student.userId }));
    if (recipients.length === 0) continue;

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients,
      content: {
        title: "New Drive Available",
        message: `${drive.companyName} is hiring for ${resolved.roleName} · ${packageText}`,
        actionUrl: `/student-dashboard/drives/${drive.id}`,
      },
      dedupeKey: `drive-published:${drive.id}`,
      resourceType: "Drive",
      resourceId: drive.id,
      expiresAt: resolved.applicationDeadline,
      dispatchId,
    });
    delivered += result.delivered;
  }

  // A student with no academic record can never be eligible for anything, so
  // a new drive is the moment that gap costs them something. At most one
  // nudge per student per week, by key.
  if (audience.missingAcademic.length > 0) {
    await deliverNotification(prisma, {
      event: "PROFILE_INCOMPLETE",
      role: "STUDENT",
      recipients: audience.missingAcademic,
      content: {
        title: "Complete Your Profile",
        message: "Add your academic details to become eligible for placement drives.",
        actionUrl: "/student-dashboard/profile",
      },
      dedupeKey: `profile-incomplete:week-${Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}`,
      resourceType: "Profile",
    });
  }

  return delivered;
}

/** Retry entry point: everything is resolved again from the ids. */
export async function retryDrivePublished(
  payload: { driveId?: unknown; departmentIds?: unknown },
  dispatchId: string
): Promise<number> {
  const drive = await loadDriveForAudience(String(payload.driveId));
  if (!drive) return 0;
  const departmentIds = Array.isArray(payload.departmentIds)
    ? payload.departmentIds.map(String)
    : undefined;
  return fanOutDrivePublished(drive, departmentIds, dispatchId);
}
