"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/audit";
import { notifyDriveAssigned } from "@/features/notifications/producers/workflow-events";
import {
  createCentralDriveSchema,
  type CreateCentralDriveInput,
} from "../schemas/central-drive";
import { buildCentralDriveData } from "../domain/drive-write-data";
import { validateDriveDates } from "../domain/drive-window";
import {
  unavailableBatchMessage,
  unavailableBatchYears,
  withTargetedBatchYears,
} from "../domain/batch-targeting";
import { getInstitutionBatchYears } from "@/features/students/queries/department-batch-years";
import { checkNextStageDateInSeason } from "@/features/settings/domain/season-window";
import { getInstitutionSettings } from "@/features/settings/queries/get-settings";
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

    // The application window, decided here on the server: a new drive may
    // start today but not before, and must end after it starts.
    const window = validateDriveDates(data, { startNotBeforeToday: true });
    if (!window.ok) {
      return { success: false, error: window.issues.map((issue) => issue.message).join(". ") };
    }

    // Eligible batches: only batches students across the institution are in.
    if (data.batchYears && data.batchYears.length > 0) {
      const present = (await getInstitutionBatchYears()).map((row) => row.year);
      const unknownBatches = unavailableBatchYears(data.batchYears, present);
      if (unknownBatches.length > 0) {
        return { success: false, error: unavailableBatchMessage(unknownBatches) };
      }
    }

    // The placement season, when the institution enforces one. Checked as the
    // drive is written, never retroactively: changing the season later does
    // not invalidate drives that already exist.
    const season = checkNextStageDateInSeason(window.dates.nextStageDate, await getInstitutionSettings());
    if (!season.ok) {
      return { success: false, error: season.error! };
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
        ...buildCentralDriveData(data, window.dates),
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
        // The eligible batches are the master's BATCH_YEAR rule.
        extras: withTargetedBatchYears(data.eligibilityRules ?? [], data.batchYears ?? []),
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
    // it, to that department only, once its admin has configured it. Only the
    // departments' admins (and the other Super Admins) are told now.
    await notifyDriveAssigned({ driveId: drive.id, actorId: superAdmin.id });

    return { success: true, driveId: drive.id };
  } catch (error) {
    console.error("Create central drive error:", error);
    return {
      success: false,
      error: "Failed to create central drive. Please try again.",
    };
  }
}
