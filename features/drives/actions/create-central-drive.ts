"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import {
  createCentralDriveSchema,
  type CreateCentralDriveInput,
} from "../schemas/central-drive";
import { parsePackageFromDisplay } from "../utils/parse-package-display";
import { setEligibleDepartments, withEligibleDepartmentLinks } from "../utils/eligible-departments";

export interface CreateCentralDriveResult {
  success: boolean;
  driveId?: string;
  error?: string;
}

/**
 * Create an institution-wide central drive.
 *
 * Authorization: SUPER_ADMIN only. departmentId and isCentralDrive are set
 * server-side and never read from the client.
 */
export async function createCentralDrive(
  input: CreateCentralDriveInput
): Promise<CreateCentralDriveResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = createCentralDriveSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const data = validated.data;

    const deadline = new Date(data.applicationDeadline);
    if (deadline <= new Date()) {
      return {
        success: false,
        error: "Application deadline must be in the future",
      };
    }

    // Only departments that actually exist and are active can be made eligible
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

    const eligibleDepartmentIds = departments.map((d) => d.id);

    const drive = await prisma.$transaction(async (tx) => {
      const created = await tx.drive.create({
        data: {
          departmentId: null,
          isCentralDrive: true,
          createdByUserId: superAdmin.id,
          companyName: data.companyName,
          companyLogoUrl: data.companyLogoUrl ?? null,
          roleName: data.roleName,
          jobDescriptionText: data.jobDescriptionText || null,
          packageOffered: parsePackageFromDisplay(data.packageDisplay),
          packageDisplay: data.packageDisplay,
          selectionRounds: JSON.stringify([]),
          driveDate: new Date(data.driveDate),
          applicationDeadline: deadline,
          // A company portal link means students register externally; without
          // one they apply in-app like any department drive.
          applyMethod: portalUrl ? "EXTERNAL" : "IN_APP",
          externalApplyUrl: portalUrl,
          minCGPA: data.minCGPA,
          maxActiveBacklogs: data.maxActiveBacklogs,
          venue: data.venue ?? null,
          reportingTime: data.reportingTime ?? null,
          contactPerson: data.contactPerson ?? null,
          contactPhone: data.contactPhone ?? null,
          pptLink: data.pptLink || null,
        },
      });
      await setEligibleDepartments(tx, created.id, eligibleDepartmentIds);
      return created;
    });

    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.DRIVE,
      entityId: drive.id,
      metadata: {
        companyName: drive.companyName,
        roleName: drive.roleName,
        isCentralDrive: true,
        eligibleDepartmentCodes: departments.map((d) => d.code),
      },
    });

    // Tell the students who can actually apply, across every eligible
    // department. Best-effort: never fails the drive creation.
    await notifyEligibleStudentsOfDrive(
      withEligibleDepartmentLinks(drive, eligibleDepartmentIds)
    );

    return { success: true, driveId: drive.id };
  } catch (error) {
    console.error("Create central drive error:", error);
    return {
      success: false,
      error: "Failed to create central drive. Please try again.",
    };
  }
}
