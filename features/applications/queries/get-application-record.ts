"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireAuth } from "@/lib/auth";
import {
  readApplicationRecord,
  type ApplicationRecord,
} from "../utils/application-snapshot";

/**
 * The historical record of one application — its snapshot, or the legacy
 * inline columns for an application that predates snapshots.
 *
 * Authorization, all decided on the server from the session:
 *  - STUDENT: their own application only
 *  - DEPT_ADMIN: an applicant from their own department, on a drive their
 *    department owns or runs (the same scope as `updateApplicationStage`)
 *  - SUPER_ADMIN: any application
 *
 * Read-only. There is no write path for a snapshot after submission.
 */
export async function getApplicationRecord(
  applicationId: string
): Promise<ApplicationRecord> {
  const user = await requireAuth();

  const application = await prisma.driveApplication.findUnique({
    where: { id: applicationId },
    select: {
      snapshotCgpa: true,
      snapshotBacklogs: true,
      submittedDetails: true,
      consentAcceptedAt: true,
      snapshot: true,
      student: { select: { userId: true, departmentId: true } },
      drive: {
        select: {
          departmentId: true,
          isCentralDrive: true,
          eligibleDepartmentLinks: { select: { departmentId: true } },
        },
      },
    },
  });

  // Not found and not allowed read the same, so ids cannot be probed.
  const denied = new AuthorizationError("Application not found");
  if (!application) throw denied;

  if (user.role === "STUDENT") {
    if (application.student.userId !== user.id) throw denied;
  } else if (user.role === "DEPT_ADMIN") {
    const admin = await prisma.departmentAdmin.findUnique({
      where: { userId: user.id },
      select: { departmentId: true },
    });
    const departmentId = admin?.departmentId;
    const runsDrive =
      application.drive.departmentId === departmentId ||
      (application.drive.isCentralDrive &&
        application.drive.eligibleDepartmentLinks.some(
          (link) => link.departmentId === departmentId
        ));
    if (!departmentId || application.student.departmentId !== departmentId || !runsDrive) {
      throw denied;
    }
  } else if (user.role !== "SUPER_ADMIN") {
    throw denied;
  }

  return readApplicationRecord(application);
}
