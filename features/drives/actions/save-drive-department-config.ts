"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { AVAILABLE_STUDENT_FIELDS } from "../data/application-fields-catalog";
import {
  driveDepartmentConfigSchema,
  type DriveDepartmentConfigInput,
} from "../schemas/drive-department-config";
import type { StoredApplicationField } from "../utils/application-fields";
import { isDepartmentDriveLocked } from "../domain/drive-lifecycle";

export interface SaveDriveDepartmentConfigResult {
  success: boolean;
  error?: string;
}

/**
 * Save the calling department's logistics and required application fields for
 * a central drive.
 *
 * The configuration is keyed by (driveId, departmentId), so two departments
 * running the same central drive never overwrite each other and each one's
 * students only ever see their own department's setup.
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

    const { driveId, fields, ...logistics } = validated.data;

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      include: {
        eligibleDepartmentLinks: { where: { departmentId: department.id }, select: { departmentId: true } },
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

    // The department's own instance decides what may still be written. A
    // published instance is locked: students have read it and applied against
    // it, so the application form can no longer change. Enforced here, on the
    // server — a disabled input is not a lock.
    const existing = await prisma.driveDepartmentConfig.findUnique({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      select: { id: true, status: true, lockedAt: true, applicationFields: true },
    });

    const locked = existing !== null && isDepartmentDriveLocked(existing);

    // Only catalog keys are accepted, so a client cannot inject arbitrary
    // fields into what students are asked to submit.
    const selected: StoredApplicationField[] = [];
    for (const { key, required } of fields) {
      const entry = AVAILABLE_STUDENT_FIELDS.find((item) => item.key === key);
      if (!entry) continue;

      selected.push({
        key: entry.key,
        label: entry.label,
        source: entry.source,
        category: entry.category,
        icon: entry.icon,
        description: entry.description,
        required,
        enabled: true,
      });
    }

    const serializedFields = JSON.stringify(selected);

    // Once locked, a submitted change to the application form is refused
    // outright rather than silently dropped — an admin who thinks they edited
    // the form must be told they did not.
    if (locked && serializedFields !== (existing?.applicationFields ?? null)) {
      return {
        success: false,
        error:
          "This drive is published. The application form is locked because students have already applied against it — logistics can still be updated.",
      };
    }

    // Logistics stay editable after publication (a room changes, a coordinator
    // swaps); the application form does not. See
    // `EDITABLE_AFTER_PUBLISH_FIELDS` in domain/drive-lifecycle.ts.
    const logisticsData = {
      venue: logistics.venue,
      reportingTime: logistics.reportingTime,
      coordinatorName: logistics.coordinatorName || null,
      coordinatorPhone: logistics.coordinatorPhone || null,
      coordinatorEmail: logistics.coordinatorEmail || null,
      seatingAllocation: logistics.seatingAllocation || null,
      pptLink: logistics.pptLink || null,
      specialInstructions: logistics.specialInstructions || null,
    };

    const data = locked
      ? logisticsData
      : { ...logisticsData, applicationFields: serializedFields };

    await prisma.driveDepartmentConfig.upsert({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      create: {
        driveId,
        departmentId: department.id,
        ...logisticsData,
        applicationFields: serializedFields,
        // Saving a configuration is what moves an instance off ASSIGNED.
        status: "CONFIGURED",
      },
      update: {
        ...data,
        // A published, closed or archived instance keeps its status — saving
        // logistics is not a lifecycle transition backwards.
        ...(existing?.status === "ASSIGNED" ? { status: "CONFIGURED" as const } : {}),
      },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: drive.companyName,
        departmentCode: department.code,
        scope: "department-config",
        fieldCount: selected.length,
        mandatoryFieldCount: selected.filter((field) => field.required).length,
      },
    });

    revalidatePath("/admin-dashboard/drives");

    return { success: true };
  } catch (error) {
    console.error("Save drive department config error:", error);
    return {
      success: false,
      error: "Failed to save configuration. Please try again.",
    };
  }
}
