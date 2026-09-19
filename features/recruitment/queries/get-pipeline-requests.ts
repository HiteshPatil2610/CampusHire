"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { diffPipelines, type NormalizedStage } from "../domain/pipeline";

export interface PipelineRequestView {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  driveId: string;
  companyName: string;
  roleName: string;
  departmentCode: string;
  requestedBy: string;
  reason: string;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  /** The base version is still the active one — approval is possible. */
  current: boolean;
  baseVersion: number;
  baseStages: { name: string; stageType: string; isEnabled: boolean }[];
  proposedStages: { name: string; stageType: string; isEnabled: boolean }[];
  changes: ReturnType<typeof diffPipelines>;
}

/**
 * Pipeline change requests for the Super Admin: pending first, then the most
 * recent decisions, each with the current and proposed stages and what
 * changed. Authorization: SUPER_ADMIN.
 */
export async function getPipelineRequests(): Promise<PipelineRequestView[]> {
  await requireSuperAdmin();

  const rows = await prisma.pipelineChangeRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      baseVersion: { include: { stages: { orderBy: { sortOrder: "asc" } } } },
      departmentDrive: {
        select: {
          driveId: true,
          roleName: true,
          department: { select: { code: true } },
          drive: { select: { companyName: true, roleName: true } },
          pipelineVersions: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      },
    },
  });

  // PENDING sorts first by the enum's declaration order.
  return rows.map((row) => {
    const proposed = JSON.parse(row.proposedStages) as NormalizedStage[];
    return {
      id: row.id,
      status: row.status,
      driveId: row.departmentDrive.driveId,
      companyName: row.departmentDrive.drive.companyName,
      roleName: row.departmentDrive.roleName ?? row.departmentDrive.drive.roleName,
      departmentCode: row.departmentDrive.department.code,
      requestedBy: row.requestedBy.name ?? row.requestedBy.email,
      reason: row.reason,
      createdAt: row.createdAt,
      reviewedBy: row.reviewedBy ? row.reviewedBy.name ?? row.reviewedBy.email : null,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      current: row.departmentDrive.pipelineVersions[0]?.id === row.baseVersionId,
      baseVersion: row.baseVersion.version,
      baseStages: row.baseVersion.stages.map((s) => ({ name: s.name, stageType: s.stageType, isEnabled: s.isEnabled })),
      proposedStages: proposed.map((s) => ({ name: s.name, stageType: s.stageType, isEnabled: s.isEnabled })),
      changes: diffPipelines(row.baseVersion.stages, proposed.map((s) => ({ ...s, scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : null }))),
    };
  });
}
