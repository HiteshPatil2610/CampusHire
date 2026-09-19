"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/audit";
import {
  createCentralDriveSchema,
  type CreateCentralDriveInput,
} from "../schemas/central-drive";
import { buildCentralDriveData } from "../domain/drive-write-data";
import { assertDeadlineInFuture } from "../domain/drive-window";
import { legacyMasterRules } from "../domain/eligibility-rules";
import { normalizeEditableFields } from "../domain/drive-lifecycle";
import { roundsOf, validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import { serializeMasterPipeline } from "@/features/recruitment/domain/master-pipeline";
import {
  auditDriveWrite,
  createDriveWithEligibility,
} from "../domain/persist-drive";

export interface CreateCentralDriveResult {
  success: boolean;
  driveId?: string;
  error?: string;
}

/**
 * Create an institution-wide central (master) drive.
 *
 * Authorization: SUPER_ADMIN only. `departmentId` and `isCentralDrive` are set
 * from the domain's `driveKindColumns` and never read from the client.
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

    const deadline = assertDeadlineInFuture(
      new Date(data.applicationDeadline)
    );
    if (!deadline.ok) {
      return { success: false, error: deadline.error };
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

    const eligibleDepartmentIds = departments.map((d) => d.id);

    // The master pipeline, if the Super Admin configured one: validated here,
    // never stored as sent. Its rounds become the master's selection rounds.
    let pipelineColumns = {};
    if (data.recruitmentStages !== undefined) {
      const pipeline = validatePipelineStages(data.recruitmentStages);
      if (!pipeline.ok) {
        return {
          success: false,
          error: `Recruitment stages: ${pipeline.errors.join("; ")}`,
        };
      }
      pipelineColumns = {
        masterPipeline: serializeMasterPipeline(pipeline.stages),
        selectionRounds: JSON.stringify(roundsOf(pipeline.stages)),
      };
    }

    const drive = await createDriveWithEligibility(
      {
        ...buildCentralDriveData(data),
        ...pipelineColumns,
        // Locked unless the Super Admin opened it to departments.
        departmentEditableFields: normalizeEditableFields(data.departmentEditableFields),
        createdByUserId: superAdmin.id,
      },
      eligibleDepartmentIds,
      // Master defaults every department inherits unless it sets its own rule
      // of the same type.
      {
        legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs),
        extras: data.eligibilityRules,
      }
    );

    await auditDriveWrite({
      action: AuditAction.CREATE,
      driveId: drive.id,
      kind: "CENTRAL",
      companyName: drive.companyName,
      roleName: drive.roleName,
      eligibleDepartmentCodes: departments.map((d) => d.code),
    });

    // No student notification here, deliberately. A new central drive is a
    // DRAFT whose department instances are all ASSIGNED — invisible to
    // students. Each department's `publishDepartmentDrive` is what announces
    // it, to that department only, once its admin has configured it.

    return { success: true, driveId: drive.id };
  } catch (error) {
    console.error("Create central drive error:", error);
    return {
      success: false,
      error: "Failed to create central drive. Please try again.",
    };
  }
}
