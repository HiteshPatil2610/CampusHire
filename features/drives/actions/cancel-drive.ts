"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DepartmentDriveStatus } from "@prisma/client";
import {
  AuthorizationError,
  requireDepartmentAdmin,
  requireSuperAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import {
  canTransitionDepartmentDrive,
  canTransitionMaster,
} from "../domain/drive-lifecycle";
import { isCentralDrive } from "../domain/drive-kind";
import { notifyDriveCancelled } from "@/features/notifications/actions/notify-drive-lifecycle";

/**
 * Cancelling a drive: it is not going to happen.
 *
 * A cancellation is a lifecycle transition (→ CANCELLED), never a deletion:
 *
 *  - no new applications — `applyToDrive` accepts PUBLISHED instances only
 *  - students who have not applied stop seeing it — every student listing
 *    shows PUBLISHED instances only
 *  - every application, its snapshot and its stage history stay exactly as
 *    they are; a student who applied still sees the drive, marked cancelled
 *  - applicants are notified (and department admins, when it was not their
 *    decision), and the cancellation is audited with who, when and why
 *
 * Who: the Super Admin, for a whole master drive or one department's drive of
 * it; a department admin, for their own department's drive only (the
 * department comes from the session).
 */

export type CancelDriveResult =
  | { success: true; cancelled: number; notified: number }
  | { success: false; error: string };

const reasonField = z
  .string()
  .trim()
  .min(5, "Give a reason of at least 5 characters")
  .max(1000, "Reason too long");

const departmentCancelSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  reason: reasonField,
});

const superAdminDepartmentCancelSchema = departmentCancelSchema.extend({
  departmentId: z.string().min(1, "Department is required"),
});

const masterCancelSchema = departmentCancelSchema;

function revalidateDriveViews() {
  revalidatePath("/super-admin-dashboard/drives");
  revalidatePath("/admin-dashboard/drives");
  revalidatePath("/student-dashboard/drives");
  revalidatePath("/student-dashboard/applications");
}

function fail(error: unknown, fallback: string): CancelDriveResult {
  if (error instanceof AuthorizationError) return { success: false, error: error.message };
  if (error instanceof Error && error.message === "changed") {
    return { success: false, error: "This drive changed while you were working. Reload and try again." };
  }
  console.error(fallback, error);
  return { success: false, error: `${fallback} Please try again.` };
}

/** Cancel one department's drive, inside the caller's checks. */
async function cancelInstance(params: {
  driveId: string;
  departmentId: string;
  reason: string;
  actorId: string;
  byDepartment: boolean;
}): Promise<CancelDriveResult> {
  const instance = await prisma.driveDepartmentConfig.findUnique({
    where: { driveId_departmentId: { driveId: params.driveId, departmentId: params.departmentId } },
    include: {
      department: { select: { code: true } },
      drive: { select: { companyName: true } },
    },
  });
  if (!instance) {
    throw new AuthorizationError("This drive is not assigned to that department.");
  }

  const transition = canTransitionDepartmentDrive(instance.status, "CANCELLED");
  if (!transition.valid) return { success: false, error: transition.error };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.driveDepartmentConfig.updateMany({
      // Guarded on the status just checked.
      where: { id: instance.id, status: instance.status },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: params.actorId,
        cancellationReason: params.reason,
      },
    });
    if (updated.count === 0) throw new Error("changed");

    await createAuditLogInTransaction(
      tx,
      {
        action: AuditAction.CANCEL,
        entityType: AuditEntityType.DRIVE,
        entityId: params.driveId,
        metadata: {
          scope: "department-drive",
          departmentCode: instance.department.code,
          companyName: instance.drive.companyName,
          fromStatus: instance.status,
          reason: params.reason,
          cancelledBy: params.byDepartment ? "DEPT_ADMIN" : "SUPER_ADMIN",
        },
      },
      params.actorId
    );
  });

  const { notified } = await notifyDriveCancelled({
    driveId: params.driveId,
    departmentIds: [params.departmentId],
    companyName: instance.drive.companyName,
    reason: params.reason,
    notifyDepartmentAdmins: !params.byDepartment,
    actorId: params.actorId,
  });

  revalidateDriveViews();
  return { success: true, cancelled: 1, notified };
}

/** A department admin cancels their own department's drive. */
export async function cancelDepartmentDrive(
  input: z.infer<typeof departmentCancelSchema>
): Promise<CancelDriveResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();
    const validated = departmentCancelSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    return await cancelInstance({
      driveId: validated.data.driveId,
      // From the session — never the request.
      departmentId: department.id,
      reason: validated.data.reason,
      actorId: user.id,
      byDepartment: true,
    });
  } catch (error) {
    return fail(error, "Failed to cancel the drive.");
  }
}

/** The Super Admin cancels one department's drive of a master drive. */
export async function cancelDepartmentDriveAsSuperAdmin(
  input: z.infer<typeof superAdminDepartmentCancelSchema>
): Promise<CancelDriveResult> {
  try {
    const superAdmin = await requireSuperAdmin();
    const validated = superAdminDepartmentCancelSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    return await cancelInstance({
      ...validated.data,
      actorId: superAdmin.id,
      byDepartment: false,
    });
  } catch (error) {
    return fail(error, "Failed to cancel the drive.");
  }
}

/**
 * The Super Admin cancels a master drive: the master and every department
 * drive of it that is still live (not already cancelled or archived).
 */
export async function cancelMasterDrive(
  input: z.infer<typeof masterCancelSchema>
): Promise<CancelDriveResult> {
  try {
    const superAdmin = await requireSuperAdmin();
    const validated = masterCancelSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { driveId, reason } = validated.data;

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      select: { id: true, companyName: true, isCentralDrive: true, departmentId: true, lifecycleStatus: true },
    });
    if (!drive || !isCentralDrive(drive)) {
      return { success: false, error: "Central drive not found" };
    }

    const transition = canTransitionMaster(drive.lifecycleStatus, "CANCELLED");
    if (!transition.valid) return { success: false, error: transition.error };

    const now = new Date();
    const live: DepartmentDriveStatus[] = ["ASSIGNED", "CONFIGURED", "PUBLISHED", "CLOSED"];

    const cancelledDepartments = await prisma.$transaction(async (tx) => {
      const updated = await tx.drive.updateMany({
        where: { id: drive.id, lifecycleStatus: drive.lifecycleStatus },
        data: {
          lifecycleStatus: "CANCELLED",
          cancelledAt: now,
          cancelledById: superAdmin.id,
          cancellationReason: reason,
        },
      });
      if (updated.count === 0) throw new Error("changed");

      const instances = await tx.driveDepartmentConfig.findMany({
        where: { driveId: drive.id, status: { in: live } },
        select: { id: true, departmentId: true, status: true, department: { select: { code: true } } },
      });

      await tx.driveDepartmentConfig.updateMany({
        where: { id: { in: instances.map((instance) => instance.id) } },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledById: superAdmin.id,
          cancellationReason: reason,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.CANCEL,
          entityType: AuditEntityType.DRIVE,
          entityId: drive.id,
          metadata: {
            scope: "master-drive",
            companyName: drive.companyName,
            fromStatus: drive.lifecycleStatus,
            reason,
            departmentDrivesCancelled: instances.map(
              (instance) => `${instance.department.code} (was ${instance.status.toLowerCase()})`
            ),
          },
        },
        superAdmin.id
      );

      return instances.map((instance) => instance.departmentId);
    });

    const { notified } = await notifyDriveCancelled({
      driveId: drive.id,
      departmentIds: cancelledDepartments,
      companyName: drive.companyName,
      reason,
      notifyDepartmentAdmins: true,
      actorId: superAdmin.id,
    });

    revalidateDriveViews();
    return { success: true, cancelled: cancelledDepartments.length, notified };
  } catch (error) {
    return fail(error, "Failed to cancel the drive.");
  }
}
