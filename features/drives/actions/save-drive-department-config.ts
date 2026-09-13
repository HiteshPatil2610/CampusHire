"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/parse-json-array";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { AVAILABLE_STUDENT_FIELDS } from "../data/application-fields-catalog";
import {
  driveDepartmentConfigSchema,
  type DriveDepartmentConfigInput,
} from "../schemas/drive-department-config";
import type { StoredApplicationField } from "../utils/application-fields";

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

    const drive = await prisma.drive.findUnique({ where: { id: driveId } });

    if (!drive || !drive.isCentralDrive) {
      return { success: false, error: "Central drive not found" };
    }

    if (!parseJsonArray(drive.eligibleDepartments).includes(department.id)) {
      return {
        success: false,
        error: "This drive is not open to your department",
      };
    }

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

    const data = {
      venue: logistics.venue,
      reportingTime: logistics.reportingTime,
      coordinatorName: logistics.coordinatorName || null,
      coordinatorPhone: logistics.coordinatorPhone || null,
      coordinatorEmail: logistics.coordinatorEmail || null,
      seatingAllocation: logistics.seatingAllocation || null,
      pptLink: logistics.pptLink || null,
      specialInstructions: logistics.specialInstructions || null,
      applicationFields: JSON.stringify(selected),
    };

    await prisma.driveDepartmentConfig.upsert({
      where: {
        driveId_departmentId: { driveId, departmentId: department.id },
      },
      create: { driveId, departmentId: department.id, ...data },
      update: data,
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
