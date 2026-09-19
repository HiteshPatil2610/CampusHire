"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { canTransitionDepartmentDrive } from "../domain/drive-lifecycle";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "../domain/resolve-department-drive";
import { targetedBatchYears } from "../domain/batch-targeting";
import { writeDepartmentForm } from "../domain/persist-application-form";
import { departmentDriveReadiness } from "../domain/department-drive-readiness";
import {
  ensureActivePipelineFrom,
  getActiveVersion,
} from "@/features/recruitment/domain/persist-pipeline";
import { initialDepartmentPipeline } from "@/features/recruitment/domain/master-pipeline";

const publishSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
});

export type PublishDepartmentDriveResult =
  | { success: true; notified: number }
  | { success: false; error: string };

/**
 * Release a department's instance of a drive to its students.
 *
 * This is the moment the drive becomes real for that department:
 *
 *  - `status` → PUBLISHED, which is what the student queries filter on
 *  - `publishedAt` / `publishedByUserId` record who released it and when
 *  - `lockedAt` freezes the application form, so what students answered can
 *    never be re-interpreted afterwards
 *  - the form students will get is snapshotted into this instance's own
 *    `DriveApplicationField` rows, so a later change to the master's default
 *    form can never reach a published department
 *  - eligible students in *this department only* are notified
 *
 * Nothing is published incomplete. `departmentDriveReadiness` — the same
 * function behind the wizard's step list — is run here on the stored,
 * resolved configuration: role and JD, valid dates and deadline, venue and
 * reporting time, a valid application form, a valid rule set, batch
 * targeting, a valid pipeline, the assignment and the lifecycle. Any issue
 * refuses the publish, listing every issue at once.
 *
 * Authorization: DEPT_ADMIN, and only for their own department's instance.
 * The department id comes from the session, never from the request, so there
 * is no way to publish another department's drive.
 */
export async function publishDepartmentDrive(
  input: z.infer<typeof publishSchema>
): Promise<PublishDepartmentDriveResult> {
  try {
    const { department, user } = await requireDepartmentAdmin();

    const validated = publishSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId } = validated.data;

    const instance = await prisma.driveDepartmentConfig.findUnique({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      include: { formFields: true, eligibilityRules: true },
    });

    if (!instance) {
      throw new AuthorizationError(
        "This drive is not assigned to your department."
      );
    }

    const transition = canTransitionDepartmentDrive(instance.status, "PUBLISHED");
    if (!transition.valid) {
      return { success: false, error: transition.error };
    }

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      include: { ...eligibleDepartmentLinksInclude, formFields: true, eligibilityRules: true },
    });

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    // An archived master has been withdrawn everywhere; publishing one
    // department's instance of it would release a drive that no longer exists.
    if (drive.lifecycleStatus === "ARCHIVED" || drive.lifecycleStatus === "CANCELLED") {
      return {
        success: false,
        error: `This drive has been ${drive.lifecycleStatus.toLowerCase()} by the Super Admin and can no longer be published.`,
      };
    }

    const now = new Date();

    // This department's version of the drive and the form its students will
    // answer, resolved exactly as the student pages resolve them.
    const resolved = resolveDepartmentDriveWithRules(drive, instance);
    const form = resolveDepartmentApplicationForm(drive, instance);

    // The stages applicants will go through: this department's pipeline if it
    // has one (an approved proposal), else the one publishing will create.
    const activePipeline = await getActiveVersion(prisma, instance.id);
    const initialPipeline = initialDepartmentPipeline(drive, instance);

    const readiness = departmentDriveReadiness({
      now,
      master: drive,
      assigned: drive.eligibleDepartmentLinks.some(
        (link) => link.departmentId === department.id
      ),
      instance,
      resolved,
      form: form.fields,
      pipelineStages: activePipeline?.stages ?? initialPipeline,
    });

    if (!readiness.ready) {
      return {
        success: false,
        error: `This drive cannot be published yet: ${readiness.issues.join(" ")}`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // An instance that inherits its form (from the master, legacy JSON, or
      // the catalog default) gets its own copy now. From here on the student
      // pages read this department's rows, whatever happens to the master.
      if (form.origin !== "DEPARTMENT") {
        await writeDepartmentForm(tx, instance.id, form.fields);
      }

      // The recruitment pipeline applicants will move through. If the
      // department configured one, it stands; otherwise version 1 is built
      // from the drive's selection rounds. From here on, a department admin
      // changes it only through a request the Super Admin approves.
      await ensureActivePipelineFrom(tx, instance.id, initialPipeline, user.id);

      await tx.driveDepartmentConfig.update({
        where: { id: instance.id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          publishedByUserId: user.id,
          lockedAt: now,
        },
      });
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        event: "department-drive-published",
        departmentCode: department.code,
        companyName: drive.companyName,
        // The role this department published, which may be its own override.
        roleName: resolved.roleName,
        applicationFormOrigin: form.origin,
        targetedBatches: targetedBatchYears(resolved.eligibilityRules),
        applicationFieldCount: form.fields.filter((field) => field.isEnabled).length,
      },
    });

    // Scoped to this department: publishing is a per-department act, so the
    // other departments running the same master drive are not announced here.
    const { notified } = await notifyEligibleStudentsOfDrive(drive, {
      departmentIds: [department.id],
    });

    revalidatePath("/admin-dashboard/drives");
    revalidatePath("/student-dashboard/drives");

    return { success: true, notified };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("Publish department drive error:", error);
    return {
      success: false,
      error: "Failed to publish the drive. Please try again.",
    };
  }
}
