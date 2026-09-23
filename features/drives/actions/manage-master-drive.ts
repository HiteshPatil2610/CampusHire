"use server";

import { revalidatePath } from "next/cache";
import { endOfIndiaDay, parseDay } from "../domain/drive-window";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import {
  DEPARTMENT_EDITABLE_FIELDS,
  normalizeEditableFields,
} from "../domain/drive-lifecycle";
import { isCentralDrive } from "../domain/drive-kind";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";
import { resolveDepartmentDriveWithRules } from "../domain/resolve-department-drive";
import {
  diffPipelines,
  pipelineKey,
  roundsOf,
  validatePipelineStages,
} from "@/features/recruitment/domain/pipeline";
import {
  masterPipelineStages,
  serializeMasterPipeline,
} from "@/features/recruitment/domain/master-pipeline";
import { createPipelineVersion } from "@/features/recruitment/domain/persist-pipeline";
import { notifyDeadlineExtended } from "@/features/notifications/actions/notify-drive-lifecycle";
import {
  notifyMasterDriveUpdated,
  remindDepartmentsToConfigure,
} from "@/features/notifications/producers/workflow-events";

/**
 * The Super Admin's controls over a master drive after it is created: which
 * fields departments may override, the master recruitment pipeline, and a
 * controlled deadline extension for a published department drive.
 *
 * Every action is SUPER_ADMIN only, works on central drives only, and writes
 * its audit row in the same transaction as the change.
 */

export type MasterDriveActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

function revalidateDriveViews() {
  revalidatePath("/super-admin-dashboard/drives");
  revalidatePath("/admin-dashboard/drives");
  revalidatePath("/student-dashboard/drives");
}

async function loadCentralDrive(driveId: string) {
  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  if (!drive || !isCentralDrive(drive)) return null;
  return drive;
}

const permissionsSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  editableFields: z.array(z.enum(DEPARTMENT_EDITABLE_FIELDS)).max(DEPARTMENT_EDITABLE_FIELDS.length),
});

/**
 * Set which master content fields departments may override.
 *
 * Locking a field that a department has already overridden clears that
 * override — but only on department drives that are not yet published. A
 * published department drive is frozen: its students applied against what
 * they saw, so its content is never rewritten by a permission change.
 */
export async function setDepartmentEditPermissions(
  input: z.infer<typeof permissionsSchema>
): Promise<MasterDriveActionResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = permissionsSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }

    const drive = await loadCentralDrive(validated.data.driveId);
    if (!drive) return { success: false, error: "Central drive not found" };
    if (drive.lifecycleStatus === "CANCELLED" || drive.lifecycleStatus === "ARCHIVED") {
      return { success: false, error: `This drive is ${drive.lifecycleStatus.toLowerCase()}.` };
    }

    const next = normalizeEditableFields(validated.data.editableFields);
    const before = normalizeEditableFields(drive.departmentEditableFields);
    const nowLocked = before.filter((field) => !next.includes(field));

    const cleared = await prisma.$transaction(async (tx) => {
      await tx.drive.update({
        where: { id: drive.id },
        data: { departmentEditableFields: next },
      });

      // Unpublished instances that overrode a field that is now locked go
      // back to the master's value.
      const clearedFor: string[] = [];
      if (nowLocked.length > 0) {
        const instances = await tx.driveDepartmentConfig.findMany({
          where: { driveId: drive.id, lockedAt: null },
          include: { department: { select: { code: true } } },
        });
        for (const instance of instances) {
          const overridden = nowLocked.filter(
            (field) => (instance as unknown as Record<string, unknown>)[field] !== null
          );
          if (overridden.length === 0) continue;
          await tx.driveDepartmentConfig.update({
            where: { id: instance.id },
            data: Object.fromEntries(overridden.map((field) => [field, null])),
          });
          clearedFor.push(`${instance.department.code}: ${overridden.join(", ")}`);
        }
      }

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.DRIVE,
          entityId: drive.id,
          metadata: {
            event: "department-edit-permissions-changed",
            companyName: drive.companyName,
            before,
            after: next,
            overridesCleared: clearedFor,
          },
        },
        superAdmin.id
      );

      return clearedFor;
    });

    await notifyMasterDriveUpdated({
      driveId: drive.id,
      summary: next.length > 0
        ? `Departments may now change: ${next.join(", ")}. Everything else follows the master drive.`
        : "Departments can no longer change any of the master drive's content.",
    });

    revalidateDriveViews();
    return {
      success: true,
      message:
        cleared.length > 0
          ? `Saved. Overrides of newly locked fields were cleared for ${cleared.length} unpublished department drive${cleared.length === 1 ? "" : "s"}.`
          : "Saved.",
    };
  } catch (error) {
    console.error("Set department edit permissions error:", error);
    return { success: false, error: "Failed to save the permissions. Please try again." };
  }
}

/**
 * Set the master recruitment pipeline.
 *
 * Department drives that have not been published and still run the master's
 * previous pipeline unchanged move to the new one (as their next version).
 * A department drive whose pipeline diverged through an approved proposal,
 * or that is already published, keeps its own — changing a live pipeline is
 * a per-department act (`setPipelineAsSuperAdmin`).
 */
export async function saveMasterPipeline(input: {
  driveId: string;
  stages: unknown;
}): Promise<MasterDriveActionResult & { errors?: string[] }> {
  try {
    const superAdmin = await requireSuperAdmin();

    const drive = await loadCentralDrive(String(input.driveId));
    if (!drive) return { success: false, error: "Central drive not found" };
    if (drive.lifecycleStatus === "CANCELLED" || drive.lifecycleStatus === "ARCHIVED") {
      return { success: false, error: `This drive is ${drive.lifecycleStatus.toLowerCase()}.` };
    }

    const validated = validatePipelineStages(input.stages);
    if (!validated.ok) {
      return { success: false, error: "The pipeline is not valid.", errors: validated.errors };
    }

    const previous = masterPipelineStages(drive);
    if (pipelineKey(previous) === pipelineKey(validated.stages) && drive.masterPipeline) {
      return { success: true, message: "No changes." };
    }

    const followed = await prisma.$transaction(async (tx) => {
      await tx.drive.update({
        where: { id: drive.id },
        data: {
          masterPipeline: serializeMasterPipeline(validated.stages),
          // The legacy rounds list follows the pipeline.
          selectionRounds: JSON.stringify(roundsOf(validated.stages)),
        },
      });

      const instances = await tx.driveDepartmentConfig.findMany({
        where: { driveId: drive.id, lockedAt: null, status: { in: ["ASSIGNED", "CONFIGURED"] } },
        include: {
          department: { select: { code: true } },
          pipelineVersions: {
            where: { status: "ACTIVE" },
            include: { stages: { orderBy: { sortOrder: "asc" } } },
          },
        },
      });

      const updated: string[] = [];
      for (const instance of instances) {
        const active = instance.pipelineVersions[0];
        // No version yet: it will be built from the master when needed.
        if (!active) continue;
        if (pipelineKey(active.stages) !== pipelineKey(previous)) continue;
        await createPipelineVersion(tx, instance.id, validated.stages, {
          actorId: superAdmin.id,
          note: "The Super Admin updated the master drive's pipeline",
          mirrorRounds: false,
        });
        updated.push(instance.department.code);
      }

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.DRIVE,
          entityId: drive.id,
          metadata: {
            event: "master-pipeline-changed",
            companyName: drive.companyName,
            changes: diffPipelines(previous, validated.stages),
            stages: validated.stages.map((stage) => `${stage.name} (${stage.stageType})`),
            departmentDrivesUpdated: updated,
          },
        },
        superAdmin.id
      );

      return updated;
    });

    await notifyMasterDriveUpdated({
      driveId: drive.id,
      summary:
        followed.length > 0
          ? `The master recruitment stages changed; unpublished department drives that followed them were updated (${followed.join(", ")}).`
          : "The master recruitment stages changed. Published department drives keep their own.",
    });

    revalidateDriveViews();
    return {
      success: true,
      message:
        followed.length > 0
          ? `Saved. Also applied to ${followed.join(", ")} (not yet published).`
          : "Saved.",
    };
  } catch (error) {
    console.error("Save master pipeline error:", error);
    return { success: false, error: "Failed to save the pipeline. Please try again." };
  }
}

const extendSchema = z.object({
  driveId: z.string().min(1, "Drive is required"),
  departmentId: z.string().min(1, "Department is required"),
  newDeadline: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid deadline"),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(1000),
});

/**
 * Extend the application deadline of one published department drive.
 *
 * Only later, never earlier (an earlier deadline would shut out students who
 * planned around the published one), only into the future, and still before
 * the next stage date. The department's deadline override is what changes; the
 * master and every other department are untouched.
 *
 * Submitted applications and their snapshots are not touched: each snapshot
 * records the deadline that applied when it was submitted, and that remains
 * true. The old and new deadline are audited, and the department's applicants
 * and eligible students are told.
 */
export async function extendDepartmentDriveDeadline(
  input: z.infer<typeof extendSchema>
): Promise<MasterDriveActionResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = extendSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { driveId, departmentId, reason } = validated.data;
    // A day extends to the end of that India day, like every application end.
    const newDay = parseDay(validated.data.newDeadline);
    if (!newDay) return { success: false, error: "Enter a valid deadline." };
    const newDeadline = endOfIndiaDay(newDay);

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      include: {
        ...eligibleDepartmentLinksInclude,
        eligibilityRules: true,
        departmentConfigs: {
          where: { departmentId },
          include: { eligibilityRules: true, department: { select: { code: true } } },
        },
      },
    });
    const instance = drive?.departmentConfigs[0];
    if (!drive || !isCentralDrive(drive) || !instance) {
      return { success: false, error: "This drive is not assigned to that department." };
    }
    if (drive.lifecycleStatus === "CANCELLED" || drive.lifecycleStatus === "ARCHIVED") {
      return { success: false, error: `This drive is ${drive.lifecycleStatus.toLowerCase()}.` };
    }
    if (instance.status !== "PUBLISHED") {
      return {
        success: false,
        error: `Only a published department drive's deadline is extended here (this one is ${instance.status.toLowerCase()}).`,
      };
    }

    const current = resolveDepartmentDriveWithRules(drive, instance);
    const now = new Date();

    if (newDeadline <= current.applicationDeadline) {
      return { success: false, error: "The new deadline must be later than the current one." };
    }
    if (newDeadline <= now) {
      return { success: false, error: "The new deadline must be in the future." };
    }
    if (newDeadline >= current.nextStageDate) {
      return { success: false, error: "The new deadline must be before the next stage date." };
    }

    await prisma.$transaction(async (tx) => {
      // Guarded on the value read above, so two extensions cannot interleave.
      const updated = await tx.driveDepartmentConfig.updateMany({
        where: { id: instance.id, status: "PUBLISHED", updatedAt: instance.updatedAt },
        data: { applicationDeadline: newDeadline },
      });
      if (updated.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.EXTEND_DEADLINE,
          entityType: AuditEntityType.DRIVE,
          entityId: drive.id,
          metadata: {
            companyName: drive.companyName,
            departmentCode: instance.department.code,
            oldDeadline: current.applicationDeadline.toISOString(),
            newDeadline: newDeadline.toISOString(),
            reason,
          },
        },
        superAdmin.id
      );
    });

    // Applicants, the students the drive is now open to (the same evaluator
    // as every other path, resolved inside the fan-out against the saved
    // deadline) and the department's admins.
    const { notified } = await notifyDeadlineExtended({
      driveId: drive.id,
      companyName: drive.companyName,
      roleName: current.roleName,
      newDeadline,
      departmentId,
      actorId: superAdmin.id,
    });

    revalidateDriveViews();
    return { success: true, message: `Deadline extended. ${notified} student${notified === 1 ? "" : "s"} notified.` };
  } catch (error) {
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This drive changed while you were editing. Reload and try again." };
    }
    console.error("Extend department drive deadline error:", error);
    return { success: false, error: "Failed to extend the deadline. Please try again." };
  }
}

/**
 * Remind every department that has not published this drive yet (assigned
 * or configured) to finish it. Their admins get one reminder per day at
 * most, however often this is pressed.
 */
export async function remindDepartmentsAboutDrive(input: {
  driveId: string;
}): Promise<MasterDriveActionResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const drive = await loadCentralDrive(String(input.driveId));
    if (!drive) return { success: false, error: "Central drive not found" };
    if (drive.lifecycleStatus === "CANCELLED" || drive.lifecycleStatus === "ARCHIVED") {
      return { success: false, error: `This drive is ${drive.lifecycleStatus.toLowerCase()}.` };
    }

    const { departments, notified } = await remindDepartmentsToConfigure({
      driveId: drive.id,
      actorId: superAdmin.id,
    });
    if (departments === 0) {
      return { success: true, message: "Every department has already published this drive." };
    }

    await createAuditLogInTransaction(
      prisma,
      {
        action: AuditAction.REMIND,
        entityType: AuditEntityType.DRIVE,
        entityId: drive.id,
        metadata: { companyName: drive.companyName, departments, adminsNotified: notified },
      },
      superAdmin.id
    );

    return {
      success: true,
      message:
        notified > 0
          ? `Reminded ${departments} department${departments === 1 ? "" : "s"} (${notified} admin${notified === 1 ? "" : "s"}).`
          : "Those departments were already reminded today.",
    };
  } catch (error) {
    console.error("Remind departments error:", error);
    return { success: false, error: "Failed to send the reminder. Please try again." };
  }
}
