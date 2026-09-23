"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyIfDepartmentDriveReady } from "@/features/notifications/producers/department-readiness";
import {
  driveDepartmentConfigSchema,
  type DriveDepartmentConfigInput,
} from "../schemas/drive-department-config";
import {
  DEPARTMENT_EDITABLE_FIELD_LABELS,
  findLockedInstanceFieldChanges,
  findLockedOverrideAttempts,
  isDepartmentDriveInactive,
  isDepartmentDriveLocked,
} from "../domain/drive-lifecycle";
import { checkStoredWindow } from "../domain/drive-window";
import {
  targetedBatchYears,
  unavailableBatchMessage,
  unavailableBatchYears,
} from "../domain/batch-targeting";
import { getDepartmentBatchYears } from "@/features/students/queries/department-batch-years";
import { toInstanceOverrideColumns } from "../domain/department-overrides";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDrive,
} from "../domain/resolve-department-drive";
import { applicationFormKey, enabledFields } from "../domain/application-form";
import { writeDepartmentForm } from "../domain/persist-application-form";
import {
  describeRule,
  legacyColumnsFromRules,
  ruleSetKey,
  withLegacyRules,
} from "../domain/eligibility-rules";
import { writeDepartmentRules } from "../domain/persist-eligibility-rules";

export interface SaveDriveDepartmentConfigResult {
  success: boolean;
  error?: string;
}

/**
 * Save the calling department's version of a central drive: its content
 * overrides (role, JD, requirements, skills, dates, selection rounds,
 * eligibility), its application form, and its logistics.
 *
 * **Isolation.** Everything is written to one row, keyed by
 * `(driveId, <caller's department>)`, and the department comes from the
 * session, never the request. Two departments running the same master drive
 * can therefore never overwrite each other, and this action has no path to
 * the master `Drive` row at all — a department admin can override a master
 * value for their own students, but never change it.
 *
 * **Locking.** Once the instance is published, the content overrides and the
 * application form are frozen — students have read and applied against them.
 * A submitted change to any of those is refused outright, naming the fields,
 * rather than silently dropped. Logistics stay editable.
 */
export async function saveDriveDepartmentConfig(
  input: DriveDepartmentConfigInput
): Promise<SaveDriveDepartmentConfigResult> {
  try {
    const { department } = await requireDepartmentAdmin();

    const validated = driveDepartmentConfigSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, fields, overrides, eligibilityRules, ...logistics } =
      validated.data;

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      include: {
        formFields: true,
        eligibleDepartmentLinks: {
          where: { departmentId: department.id },
          select: { departmentId: true },
        },
      },
    });

    if (!drive || !drive.isCentralDrive) {
      return { success: false, error: "Central drive not found" };
    }

    if (drive.eligibleDepartmentLinks.length === 0) {
      return {
        success: false,
        error: "This drive is not open to your department",
      };
    }

    const existing = await prisma.driveDepartmentConfig.findUnique({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      include: { eligibilityRules: true, formFields: true },
    });

    // A cancelled or archived drive is history: nothing about it changes.
    if (existing && isDepartmentDriveInactive(existing.status)) {
      return {
        success: false,
        error: `This drive is ${existing.status.toLowerCase()}, so its configuration can no longer change.`,
      };
    }

    const locked = existing !== null && isDepartmentDriveLocked(existing);

    // Selection rounds are the recruitment pipeline's to set. Once a pipeline
    // exists, a rounds override here would let the displayed rounds drift
    // from the stages applicants actually move through — and, after
    // publishing, bypass the Super Admin's approval.
    if (overrides?.selectionRounds !== undefined && existing) {
      const pipelines = await prisma.recruitmentPipelineVersion.count({
        where: { driveDepartmentConfigId: existing.id, status: "ACTIVE" },
      });
      if (pipelines > 0) {
        return {
          success: false,
          error:
            "Selection rounds are managed by the drive's recruitment pipeline. Change them there.",
        };
      }
    }

    // Eligible batches (the department's BATCH_YEAR rule): only batches this
    // department's students are in, or ones this drive already targeted here
    // or on the master.
    if (eligibilityRules !== undefined) {
      const selected = targetedBatchYears(eligibilityRules) ?? [];
      if (selected.length > 0) {
        const masterRules = await prisma.driveEligibilityRule.findMany({
          where: { driveId },
          select: { ruleType: true, operator: true, numberValue: true, listValue: true },
        });
        const present = (await getDepartmentBatchYears(department.id)).map((row) => row.year);
        const unknownBatches = unavailableBatchYears(selected, present, [
          ...(targetedBatchYears(existing?.eligibilityRules ?? []) ?? []),
          ...(targetedBatchYears(masterRules) ?? []),
        ]);
        if (unknownBatches.length > 0) {
          return { success: false, error: unavailableBatchMessage(unknownBatches) };
        }
      }
    }

    const overrideColumns = toInstanceOverrideColumns(overrides);

    // The Super Admin decides which master fields a department may override.
    // Enforced here, against the stored permission — whatever the form showed.
    // Clearing an override (back to the master's value) is always allowed.
    const notPermitted = findLockedOverrideAttempts(
      drive.departmentEditableFields,
      existing as unknown as Record<string, unknown> | null,
      overrideColumns as unknown as Record<string, unknown>
    );
    if (notPermitted.length > 0) {
      return {
        success: false,
        error:
          `The Super Admin has locked these fields for departments: ${notPermitted
            .map((field) => DEPARTMENT_EDITABLE_FIELD_LABELS[field])
            .join(", ")}. No changes were saved.`,
      };
    }

    if (locked) {
      // Compare against the form this department's students actually get —
      // its own rows, or whatever it inherits — so resubmitting an unchanged
      // form alongside a venue change is not mistaken for an edit. Only what a
      // student sees counts (enabled fields, order, label, required,
      // permission); see `applicationFormKey`.
      const formChanged =
        fields !== undefined &&
        applicationFormKey(fields) !==
          applicationFormKey(resolveDepartmentApplicationForm(drive, existing).fields);

      // A published rule set is frozen: applicants were judged against it.
      // Compared as a set (order and list-item case ignored), and against the
      // legacy columns too, so a pre-backfill instance compares correctly.
      const rulesChanged =
        eligibilityRules !== undefined &&
        ruleSetKey(eligibilityRules) !==
          ruleSetKey(
            withLegacyRules(existing.eligibilityRules, {
              minCGPA: existing.minCGPA,
              maxActiveBacklogs: existing.maxActiveBacklogs,
            })
          );

      const changed = [
        ...(formChanged ? ["applicationFields"] : []),
        ...(rulesChanged ? ["eligibilityRules"] : []),
        ...findLockedInstanceFieldChanges(
          existing as unknown as Record<string, unknown>,
          overrideColumns as unknown as Record<string, unknown>
        ),
      ];

      if (changed.length > 0) {
        return {
          success: false,
          error:
            `This drive is published, so these can no longer change: ${changed.join(", ")}. ` +
            `Students have already applied against them. Logistics can still be updated. ` +
            `No changes were saved.`,
        };
      }
    } else {
      // The department's dates, resolved against the master, must still make
      // sense together. Checked on the *resolved* values because an override
      // on one date has to agree with the inherited value of the other.
      const proposed = resolveDepartmentDrive(drive, {
        ...(existing ?? {}),
        ...overrideColumns,
      });

      const windowIssues = checkStoredWindow(proposed);
      if (windowIssues.length > 0) {
        return {
          success: false,
          error: windowIssues.map((issue) => issue.message).join(". "),
        };
      }
    }

    // Logistics stay editable after publication (a room changes, a coordinator
    // swaps). See `EDITABLE_AFTER_PUBLISH_FIELDS` in domain/drive-lifecycle.ts.
    const logisticsData = {
      venue: logistics.venue || null,
      reportingTime: logistics.reportingTime || null,
      coordinatorName: logistics.coordinatorName || null,
      coordinatorPhone: logistics.coordinatorPhone || null,
      coordinatorEmail: logistics.coordinatorEmail || null,
      seatingAllocation: logistics.seatingAllocation || null,
      pptLink: logistics.pptLink || null,
      specialInstructions: logistics.specialInstructions || null,
    };

    // A new rule set also rewrites the legacy override columns, so the two
    // cannot disagree while both exist: no CGPA rule here → NULL → inherit.
    const writeRules = !locked && eligibilityRules !== undefined;
    const ruleMirrors = writeRules ? legacyColumnsFromRules(eligibilityRules) : {};

    const contentData = locked ? {} : { ...overrideColumns, ...ruleMirrors };
    const writeForm = !locked && fields !== undefined;

    // The instance, its rule set and its form are written together or not at
    // all. The form goes to `DriveApplicationField` rows; `writeDepartmentForm`
    // dual-writes the legacy `applicationFields` JSON alongside.
    await prisma.$transaction(async (tx) => {
      const instance = await tx.driveDepartmentConfig.upsert({
        where: {
          driveId_departmentId: { driveId, departmentId: department.id },
        },
        create: {
          driveId,
          departmentId: department.id,
          ...logisticsData,
          ...overrideColumns,
          ...ruleMirrors,
          // Saving a configuration is what moves an instance off ASSIGNED.
          status: "CONFIGURED",
        },
        update: {
          ...logisticsData,
          ...contentData,
          // A published, closed or archived instance keeps its status — saving
          // logistics is not a lifecycle transition backwards.
          ...(existing?.status === "ASSIGNED" ? { status: "CONFIGURED" as const } : {}),
        },
      });

      if (writeRules) {
        await writeDepartmentRules(tx, instance.id, eligibilityRules);
      }
      if (writeForm) {
        await writeDepartmentForm(tx, instance.id, fields);
      }
    });

    const shown = writeForm ? enabledFields(fields) : [];

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: drive.companyName,
        departmentCode: department.code,
        scope: "department-config",
        // The form as saved on this call, if it was.
        ...(writeForm
          ? {
              applicationForm: shown.map(
                (field) =>
                  `${field.fieldKey}${field.isRequired ? "*" : ""}` +
                  (field.permission === "EDITABLE" ? " (editable)" : "")
              ),
            }
          : {}),
        // Which master values this department set or cleared on this save.
        overridesTouched: locked ? [] : Object.keys(overrideColumns),
        // The rule set as a readable list, so the audit log shows exactly
        // which bar this department set.
        ...(writeRules
          ? { eligibilityRules: eligibilityRules.map((rule) => describeRule(rule)) }
          : {}),
      },
    });

    // A configuration that became complete is worth telling: the admins can
    // publish, and the Super Admins see the department is done.
    await notifyIfDepartmentDriveReady({
      driveId,
      departmentId: department.id,
      departmentCode: department.code,
    });

    revalidatePath("/admin-dashboard/drives");
    revalidatePath("/student-dashboard/drives");

    return { success: true };
  } catch (error) {
    console.error("Save drive department config error:", error);
    return {
      success: false,
      error: "Failed to save configuration. Please try again.",
    };
  }
}
