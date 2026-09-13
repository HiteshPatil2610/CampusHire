"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { AVAILABLE_STUDENT_FIELDS } from "../data/application-fields-catalog";
import {
  centralDriveApplicationFieldsSchema,
  type CentralDriveApplicationFieldsInput,
} from "../schemas/central-drive";
import {
  parseApplicationFields,
  type StoredApplicationField,
} from "../utils/application-fields";

export interface UpdateCentralDriveApplicationFieldsResult {
  success: boolean;
  error?: string;
}

/**
 * Persist the enabled/disabled state of a central drive's application fields.
 *
 * Scoped deliberately narrow so the toggle panel can save on its own without
 * resubmitting the whole drive form. Each field's `required` flag is carried
 * over untouched — this panel only controls whether a field is collected.
 */
export async function updateCentralDriveApplicationFields(
  input: CentralDriveApplicationFieldsInput
): Promise<UpdateCentralDriveApplicationFieldsResult> {
  try {
    await requireSuperAdmin();

    const validated = centralDriveApplicationFieldsSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { driveId, fields } = validated.data;

    const drive = await prisma.drive.findUnique({ where: { id: driveId } });

    if (!drive) {
      return { success: false, error: "Drive not found" };
    }

    if (!drive.isCentralDrive) {
      return {
        success: false,
        error: "This drive belongs to a department and cannot be edited here",
      };
    }

    const existingByKey = new Map(
      parseApplicationFields(drive.applicationFields).map((field) => [
        field.key,
        field,
      ])
    );

    const updated: StoredApplicationField[] = [];

    for (const { fieldKey, isEnabled } of fields) {
      const existing = existingByKey.get(fieldKey);
      const catalogEntry = AVAILABLE_STUDENT_FIELDS.find(
        (entry) => entry.key === fieldKey
      );

      // Ignore keys that are neither already stored nor in the catalog, so a
      // client cannot inject arbitrary fields through this endpoint.
      if (!existing && !catalogEntry) {
        continue;
      }

      updated.push({
        key: fieldKey,
        label: existing?.label ?? catalogEntry?.label ?? fieldKey,
        source: existing?.source ?? catalogEntry?.source ?? "profile",
        category: existing?.category ?? catalogEntry?.category ?? "Other",
        icon: existing?.icon ?? catalogEntry?.icon ?? "",
        description: existing?.description ?? catalogEntry?.description,
        required: existing?.required ?? catalogEntry?.defaultRequired ?? false,
        enabled: isEnabled,
      });
    }

    await prisma.drive.update({
      where: { id: driveId },
      data: { applicationFields: JSON.stringify(updated) },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: drive.companyName,
        isCentralDrive: true,
        enabledFieldCount: updated.filter((field) => field.enabled).length,
        totalFieldCount: updated.length,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update central drive application fields error:", error);
    return {
      success: false,
      error: "Failed to save configuration. Please try again.",
    };
  }
}
