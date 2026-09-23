"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyDriveUpdated } from "@/features/notifications/actions/notify-drive-lifecycle";
import {
  notifyDriveAssigned,
  notifyMasterDriveUpdated,
} from "@/features/notifications/producers/workflow-events";
import { AuditAction } from "@/lib/audit";
import {
  updateCentralDriveSchema,
  type UpdateCentralDriveInput,
} from "../schemas/central-drive";
import { isCentralDrive } from "../domain/drive-kind";
import { findLockedMasterFieldChanges } from "../domain/drive-lifecycle";
import { legacyMasterRules, ruleSetKey } from "../domain/eligibility-rules";
import { masterExtraRules } from "../domain/persist-eligibility-rules";
import { toCentralDriveUpdateData } from "../domain/drive-write-data";
import { startDayChanged, validateDriveDates } from "../domain/drive-window";
import {
  targetedBatchYears,
  unavailableBatchMessage,
  unavailableBatchYears,
  withTargetedBatchYears,
} from "../domain/batch-targeting";
import { getInstitutionBatchYears } from "@/features/students/queries/department-batch-years";
import {
  auditDriveWrite,
  updateDriveWithEligibility,
} from "../domain/persist-drive";

export interface UpdateCentralDriveResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing central (master) drive.
 *
 * Authorization: SUPER_ADMIN only. Department-posted drives are rejected —
 * editing those stays with the owning department admin.
 */
export async function updateCentralDrive(
  driveId: string,
  input: UpdateCentralDriveInput
): Promise<UpdateCentralDriveResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const existing = await prisma.drive.findUnique({ where: { id: driveId } });

    if (!existing) {
      return { success: false, error: "Drive not found" };
    }

    if (!isCentralDrive(existing)) {
      return {
        success: false,
        error: "This drive belongs to a department and cannot be edited here",
      };
    }

    const validated = updateCentralDriveSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const data = validated.data;

    // The window: the start may not be moved into the past; a start left as
    // it was is not re-judged.
    const window = validateDriveDates(data, {
      startNotBeforeToday: startDayChanged(data.applicationStartDate, existing.applicationStartDate),
    });
    if (!window.ok) {
      return { success: false, error: window.issues.map((issue) => issue.message).join(". ") };
    }
    const updateData = toCentralDriveUpdateData(data, window.dates);

    // The master's extra rules as they will be written. Eligible batches are
    // its BATCH_YEAR rule: a year must be one students hold, or one the drive
    // already targeted. Omitting both leaves the stored rules untouched.
    const stored = await prisma.driveEligibilityRule.findMany({ where: { driveId } });
    const storedExtras = masterExtraRules(stored);
    if (data.batchYears && data.batchYears.length > 0) {
      const present = (await getInstitutionBatchYears()).map((row) => row.year);
      const unknownBatches = unavailableBatchYears(data.batchYears, present, targetedBatchYears(storedExtras));
      if (unknownBatches.length > 0) {
        return { success: false, error: unavailableBatchMessage(unknownBatches) };
      }
    }
    const extras =
      data.eligibilityRules === undefined && data.batchYears === undefined
        ? undefined
        : withTargetedBatchYears(
            data.eligibilityRules ?? storedExtras,
            data.batchYears ?? targetedBatchYears(storedExtras) ?? []
          );

    // Once any department has released this drive, the fields describing the
    // opportunity are frozen. Changing the role, the eligibility bar or the
    // deadline now would silently alter an experience students have already
    // acted on — an applicant could become retroactively ineligible.
    const publishedCount = await prisma.driveDepartmentConfig.count({
      where: { driveId, status: { in: ["PUBLISHED", "CLOSED", "ARCHIVED"] } },
    });

    if (publishedCount > 0) {
      const changed: string[] = findLockedMasterFieldChanges(
        existing as unknown as Record<string, unknown>,
        updateData as unknown as Record<string, unknown>
      );

      // The master's extra default rules — its batches included — are frozen
      // for the same reason as its CGPA bar: a department inheriting them has
      // already judged applicants against them.
      if (extras !== undefined && ruleSetKey(storedExtras) !== ruleSetKey(extras)) {
        changed.push("eligibilityRules");
      }

      if (changed.length > 0) {
        return {
          success: false,
          error:
            `This drive is already live in ${publishedCount} department${publishedCount === 1 ? "" : "s"}. ` +
            `These fields can no longer change: ${changed.join(", ")}. ` +
            `No changes were saved.`,
        };
      }
    }

    const departments = await prisma.department.findMany({
      where: { id: { in: data.eligibleDepartments }, isActive: true },
      select: { id: true, code: true },
    });

    if (departments.length === 0) {
      return {
        success: false,
        error: "Select at least one active department for this drive",
      };
    }

    const outcome = await updateDriveWithEligibility(
      driveId,
      updateData,
      departments.map((d) => d.id),
      {
        legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs),
        extras,
      }
    );

    // Deselecting a department that already has applicants would orphan their
    // applications, so the whole edit is refused rather than partly applied.
    // The message names the departments to re-select.
    if (!outcome.ok) {
      const blockedCodes = await prisma.department.findMany({
        where: { id: { in: outcome.blocked.map((b) => b.departmentId) } },
        select: { code: true },
      });

      return {
        success: false,
        error:
          `Cannot remove ${blockedCodes.map((d) => d.code).join(", ")} — ` +
          `students there have already applied. Keep those departments selected, ` +
          `or unassign them individually once their applications are resolved. ` +
          `No changes were saved.`,
      };
    }

    await auditDriveWrite({
      action: AuditAction.UPDATE,
      driveId,
      kind: "CENTRAL",
      companyName: data.companyName,
      roleName: data.roleName,
      eligibleDepartmentCodes: departments.map((d) => d.code),
    });

    // Departments added by this edit have a drive to configure; every
    // department running it hears that the master changed; and where it is
    // already live, its students see an update.
    await notifyDriveAssigned({ driveId, actorId: superAdmin.id });
    await notifyMasterDriveUpdated({
      driveId,
      summary: `The placement office edited ${data.companyName} — ${data.roleName}.`,
    });
    if (publishedCount > 0) {
      await notifyDriveUpdated({
        driveId,
        summary: `Details of ${data.companyName} — ${data.roleName} were updated. Check the drive page for the latest.`,
        actorId: superAdmin.id,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Update central drive error:", error);
    return {
      success: false,
      error: "Failed to update central drive. Please try again.",
    };
  }
}
