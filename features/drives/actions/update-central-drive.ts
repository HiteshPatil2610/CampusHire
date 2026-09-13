"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import {
  updateCentralDriveSchema,
  type UpdateCentralDriveInput,
} from "../schemas/central-drive";
import { parsePackageFromDisplay } from "../utils/parse-package-display";

export interface UpdateCentralDriveResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing central drive.
 *
 * Authorization: SUPER_ADMIN only. Department-posted drives are rejected —
 * editing those stays with the owning department admin.
 */
export async function updateCentralDrive(
  driveId: string,
  input: UpdateCentralDriveInput
): Promise<UpdateCentralDriveResult> {
  try {
    await requireSuperAdmin();

    const existing = await prisma.drive.findUnique({ where: { id: driveId } });

    if (!existing) {
      return { success: false, error: "Drive not found" };
    }

    if (!existing.isCentralDrive) {
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

    const portalUrl = data.externalApplyUrl || null;

    await prisma.drive.update({
      where: { id: driveId },
      data: {
        companyName: data.companyName,
        roleName: data.roleName,
        jobDescriptionText: data.jobDescriptionText || null,
        packageOffered: parsePackageFromDisplay(data.packageDisplay),
        packageDisplay: data.packageDisplay,
        driveDate: new Date(data.driveDate),
        applicationDeadline: new Date(data.applicationDeadline),
        applyMethod: portalUrl ? "EXTERNAL" : "IN_APP",
        externalApplyUrl: portalUrl,
        minCGPA: data.minCGPA,
        maxActiveBacklogs: data.maxActiveBacklogs,
        eligibleDepartments: JSON.stringify(departments.map((d) => d.id)),
        venue: data.venue ?? null,
        reportingTime: data.reportingTime ?? null,
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        pptLink: data.pptLink || null,
      },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        companyName: data.companyName,
        roleName: data.roleName,
        isCentralDrive: true,
        eligibleDepartmentCodes: departments.map((d) => d.code),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update central drive error:", error);
    return {
      success: false,
      error: "Failed to update central drive. Please try again.",
    };
  }
}
