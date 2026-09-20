"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireDepartmentAdmin,
  requireSuperAdmin,
} from "@/lib/auth";
import {
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import {
  isDepartmentDriveInactive,
  isDepartmentDriveLocked,
} from "@/features/drives/domain/drive-lifecycle";
import {
  diffPipelines,
  pipelineKey,
  validatePipelineStages,
  type NormalizedStage,
} from "../domain/pipeline";
import {
  createPipelineVersion,
  ensureActivePipelineFrom,
  getActiveVersion,
} from "../domain/persist-pipeline";
import { initialDepartmentPipeline } from "../domain/master-pipeline";
import {
  notifyPipelineChangeRequested,
  notifyPipelineChangeReviewed,
} from "@/features/notifications/producers/workflow-events";

export type PipelineActionResult =
  | { success: true; id: string }
  | { success: false; error: string; errors?: string[] };

function revalidateRecruitmentViews(driveId?: string) {
  if (driveId) revalidatePath(`/admin-dashboard/drives/${driveId}`);
  revalidatePath("/admin-dashboard/drives");
  revalidatePath("/super-admin-dashboard/pipeline-requests");
  revalidatePath("/student-dashboard/applications");
}

/** The calling department's own instance of a drive — from the session. */
async function ownInstance(driveId: string) {
  const { user, department } = await requireDepartmentAdmin();
  const instance = await prisma.driveDepartmentConfig.findUnique({
    where: { driveId_departmentId: { driveId, departmentId: department.id } },
    select: {
      id: true,
      lockedAt: true,
      status: true,
      driveId: true,
      selectionRounds: true,
      drive: { select: { isCentralDrive: true, masterPipeline: true, selectionRounds: true, companyName: true } },
    },
  });
  if (!instance) {
    // Not found and not yours read the same.
    throw new AuthorizationError("Drive not found in your department.");
  }
  return { user, department, instance };
}

/**
 * Whether a change to this department drive's stages needs the Super Admin.
 *
 * Always, for a Super Admin (master) drive: the Super Admin set its stages,
 * and a department proposes changes to them — before and after publishing.
 * For a drive the department posted itself, only once it is published.
 */
function pipelineChangeNeedsApproval(instance: {
  lockedAt: Date | null;
  drive: { isCentralDrive: boolean };
}): boolean {
  return instance.drive.isCentralDrive || isDepartmentDriveLocked(instance);
}

function stagesForAudit(stages: Pick<NormalizedStage, "name" | "stageType" | "isEnabled">[]) {
  return stages.map((stage) => `${stage.name} (${stage.stageType}${stage.isEnabled ? "" : ", inactive"})`);
}

function failure(error: unknown, fallback: string): PipelineActionResult {
  if (error instanceof AuthorizationError) return { success: false, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false, error: "Someone else changed this pipeline at the same time. Reload and try again." };
  }
  console.error(fallback, error);
  return { success: false, error: `${fallback} Please try again.` };
}

/**
 * A department admin edits their drive's pipeline directly — only while the
 * drive is not yet published. Nobody has applied, so this is ordinary
 * configuration. Each save is a new version.
 */
export async function saveDraftPipeline(input: {
  driveId: string;
  stages: unknown;
}): Promise<PipelineActionResult> {
  try {
    const { user, department, instance } = await ownInstance(String(input.driveId));

    if (pipelineChangeNeedsApproval(instance)) {
      return {
        success: false,
        error: instance.drive.isCentralDrive
          ? "The Super Admin set this drive's recruitment stages. Propose a change for their approval instead."
          : "This drive is published, so its pipeline can only change through a request the Super Admin approves.",
      };
    }

    const validated = validatePipelineStages(input.stages);
    if (!validated.ok) {
      return { success: false, error: "The pipeline is not valid.", errors: validated.errors };
    }

    const version = await prisma.$transaction(async (tx) => {
      const active = await getActiveVersion(tx, instance.id);
      if (active && pipelineKey(active.stages) === pipelineKey(validated.stages)) {
        return active;
      }

      const created = await createPipelineVersion(tx, instance.id, validated.stages, {
        actorId: user.id,
        note: "Edited by the department admin before publishing",
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: active ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: AuditEntityType.RECRUITMENT_PIPELINE,
          entityId: created.id,
          metadata: {
            driveId: instance.driveId,
            departmentCode: department.code,
            version: created.version,
            stages: stagesForAudit(validated.stages),
            changes: active ? diffPipelines(active.stages, validated.stages) : null,
          },
        },
        user.id
      );

      return created;
    });

    revalidateRecruitmentViews(instance.driveId);
    return { success: true, id: version.id };
  } catch (error) {
    return failure(error, "Failed to save the pipeline.");
  }
}

/**
 * A department admin proposes a change to a drive's pipeline — a published
 * drive's, or at any time a Super Admin drive's. It does not take effect: it
 * waits, PENDING, for the Super Admin.
 *
 * A Super Admin drive that has no pipeline of its own yet gets version 1 from
 * the master's stages first, so the proposal has a base to be judged against.
 */
export async function proposePipelineChange(input: {
  driveId: string;
  stages: unknown;
  reason: string;
}): Promise<PipelineActionResult> {
  try {
    const { user, department, instance } = await ownInstance(String(input.driveId));

    if (isDepartmentDriveInactive(instance.status)) {
      return {
        success: false,
        error: `This drive is ${instance.status.toLowerCase()}; its pipeline no longer changes.`,
      };
    }

    if (!(pipelineChangeNeedsApproval(instance))) {
      return {
        success: false,
        error: "This drive is not published yet — edit its pipeline directly instead.",
      };
    }

    const reason = String(input.reason ?? "").trim();
    if (reason.length < 5 || reason.length > 1000) {
      return { success: false, error: "Give a reason of 5–1000 characters for the change." };
    }

    const validated = validatePipelineStages(input.stages);
    if (!validated.ok) {
      return { success: false, error: "The proposed pipeline is not valid.", errors: validated.errors };
    }

    const request = await prisma.$transaction(async (tx) => {
      const active = instance.drive.isCentralDrive
        ? await ensureActivePipelineFrom(
            tx,
            instance.id,
            initialDepartmentPipeline(instance.drive, instance),
            user.id
          )
        : await getActiveVersion(tx, instance.id);
      if (!active) {
        throw new Error("no active pipeline");
      }
      if (pipelineKey(active.stages) === pipelineKey(validated.stages)) {
        return null;
      }

      const pending = await tx.pipelineChangeRequest.findFirst({
        where: { driveDepartmentConfigId: instance.id, status: "PENDING" },
        select: { id: true },
      });
      if (pending) return "pending" as const;

      const created = await tx.pipelineChangeRequest.create({
        data: {
          driveDepartmentConfigId: instance.id,
          baseVersionId: active.id,
          proposedStages: JSON.stringify(validated.stages),
          reason,
          requestedById: user.id,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.REQUEST,
          entityType: AuditEntityType.PIPELINE_CHANGE_REQUEST,
          entityId: created.id,
          metadata: {
            driveId: instance.driveId,
            departmentCode: department.code,
            baseVersion: active.version,
            reason,
            changes: diffPipelines(active.stages, validated.stages),
          },
        },
        user.id
      );

      return created;
    });

    if (request === null) {
      return { success: false, error: "The proposal is the same as the current pipeline." };
    }
    if (request === "pending") {
      return {
        success: false,
        error: "A change to this pipeline is already waiting for the Super Admin.",
      };
    }

    // The Super Admins decide it, so they are told it is waiting.
    await notifyPipelineChangeRequested({
      requestId: request.id,
      driveId: instance.driveId,
      departmentCode: department.code,
      companyName: instance.drive.companyName,
    });

    revalidateRecruitmentViews(instance.driveId);
    return { success: true, id: request.id };
  } catch (error) {
    if (error instanceof Error && error.message === "no active pipeline") {
      return { success: false, error: "This drive has no pipeline yet." };
    }
    return failure(error, "Failed to submit the proposal.");
  }
}

/**
 * The Super Admin approves or rejects a proposed change. Approval creates the
 * next version and makes it active; rejection leaves the pipeline exactly as
 * it was. Nobody reviews their own request (checked here and by a CHECK).
 */
export async function reviewPipelineChange(input: {
  requestId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}): Promise<PipelineActionResult> {
  try {
    const reviewer = await requireSuperAdmin();

    if (input.decision !== "APPROVE" && input.decision !== "REJECT") {
      return { success: false, error: "Choose approve or reject." };
    }
    const note = String(input.note ?? "").trim().slice(0, 1000);
    if (input.decision === "REJECT" && note.length < 5) {
      return { success: false, error: "Say why the change is rejected (at least 5 characters)." };
    }

    const request = await prisma.pipelineChangeRequest.findUnique({
      where: { id: String(input.requestId) },
      include: {
        departmentDrive: {
          select: {
            id: true,
            driveId: true,
            departmentId: true,
            department: { select: { code: true } },
            drive: { select: { companyName: true } },
          },
        },
      },
    });

    if (!request) return { success: false, error: "Request not found." };
    if (request.status !== "PENDING") {
      return { success: false, error: "This request has already been decided." };
    }
    if (request.requestedById === reviewer.id) {
      return { success: false, error: "A request cannot be reviewed by the person who made it." };
    }

    const reviewedAt = new Date();

    if (input.decision === "REJECT") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.pipelineChangeRequest.updateMany({
          where: { id: request.id, status: "PENDING" },
          data: { status: "REJECTED", reviewedById: reviewer.id, reviewedAt, reviewNote: note },
        });
        if (updated.count === 0) throw new Error("already decided");

        await createAuditLogInTransaction(
          tx,
          {
            action: AuditAction.REJECT,
            entityType: AuditEntityType.PIPELINE_CHANGE_REQUEST,
            entityId: request.id,
            metadata: {
              driveId: request.departmentDrive.driveId,
              departmentCode: request.departmentDrive.department.code,
              note,
            },
          },
          reviewer.id
        );
      });

      await notifyPipelineChangeReviewed({
        requestId: request.id,
        driveId: request.departmentDrive.driveId,
        departmentId: request.departmentDrive.departmentId,
        companyName: request.departmentDrive.drive.companyName,
        approved: false,
        note,
      });

      revalidateRecruitmentViews(request.departmentDrive.driveId);
      return { success: true, id: request.id };
    }

    // Re-validate what is about to become the live pipeline — never trust
    // what was stored as a proposal.
    const validated = validatePipelineStages(JSON.parse(request.proposedStages));
    if (!validated.ok) {
      return { success: false, error: "The proposed pipeline is no longer valid.", errors: validated.errors };
    }

    const version = await prisma.$transaction(async (tx) => {
      const active = await getActiveVersion(tx, request.driveDepartmentConfigId);
      if (!active || active.id !== request.baseVersionId) {
        throw new Error("stale");
      }

      const created = await createPipelineVersion(tx, request.driveDepartmentConfigId, validated.stages, {
        actorId: reviewer.id,
        note: `Approved change request ${request.id}`,
      });

      const updated = await tx.pipelineChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: reviewer.id,
          reviewedAt,
          reviewNote: note || null,
          resultingVersionId: created.id,
        },
      });
      if (updated.count === 0) throw new Error("already decided");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.APPROVE,
          entityType: AuditEntityType.PIPELINE_CHANGE_REQUEST,
          entityId: request.id,
          metadata: {
            driveId: request.departmentDrive.driveId,
            departmentCode: request.departmentDrive.department.code,
            fromVersion: active.version,
            toVersion: created.version,
            changes: diffPipelines(active.stages, validated.stages),
            note: note || null,
          },
        },
        reviewer.id
      );

      return created;
    });

    await notifyPipelineChangeReviewed({
      requestId: request.id,
      driveId: request.departmentDrive.driveId,
      departmentId: request.departmentDrive.departmentId,
      companyName: request.departmentDrive.drive.companyName,
      approved: true,
      note: note || null,
    });

    revalidateRecruitmentViews(request.departmentDrive.driveId);
    return { success: true, id: version.id };
  } catch (error) {
    if (error instanceof Error && error.message === "stale") {
      return {
        success: false,
        error:
          "The pipeline has changed since this was proposed. Reject it and ask the department to propose again.",
      };
    }
    if (error instanceof Error && error.message === "already decided") {
      return { success: false, error: "This request has already been decided." };
    }
    return failure(error, "Failed to review the request.");
  }
}

/**
 * The Super Admin changes a department drive's pipeline directly — published
 * or not — as a new version, audited. Any pending department request against
 * the old version will then be refused as stale on approval.
 */
export async function setPipelineAsSuperAdmin(input: {
  driveDepartmentConfigId: string;
  stages: unknown;
  note: string;
}): Promise<PipelineActionResult> {
  try {
    const user = await requireSuperAdmin();

    const note = String(input.note ?? "").trim();
    if (note.length < 5) {
      return { success: false, error: "Say why the pipeline is changing (at least 5 characters)." };
    }

    const validated = validatePipelineStages(input.stages);
    if (!validated.ok) {
      return { success: false, error: "The pipeline is not valid.", errors: validated.errors };
    }

    const instance = await prisma.driveDepartmentConfig.findUnique({
      where: { id: String(input.driveDepartmentConfigId) },
      select: { id: true, driveId: true, department: { select: { code: true } } },
    });
    if (!instance) return { success: false, error: "Department drive not found." };

    const version = await prisma.$transaction(async (tx) => {
      const active = await getActiveVersion(tx, instance.id);
      const created = await createPipelineVersion(tx, instance.id, validated.stages, {
        actorId: user.id,
        note: `Set by the Super Admin: ${note}`,
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: active ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: AuditEntityType.RECRUITMENT_PIPELINE,
          entityId: created.id,
          metadata: {
            driveId: instance.driveId,
            departmentCode: instance.department.code,
            version: created.version,
            note,
            changes: active ? diffPipelines(active.stages, validated.stages) : null,
          },
        },
        user.id
      );
      return created;
    });

    revalidateRecruitmentViews(instance.driveId);
    return { success: true, id: version.id };
  } catch (error) {
    return failure(error, "Failed to set the pipeline.");
  }
}
