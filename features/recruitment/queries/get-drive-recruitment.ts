"use server";

import type { ApplicationStatus, RecruitmentStageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";
import { ACTIVE_PLACEMENT_WHERE } from "@/features/students/utils/placement-status";
import { isDepartmentDriveLocked } from "@/features/drives/domain/drive-lifecycle";
import { getDepartmentDriveEligibleStudents } from "@/features/drives/queries/get-department-drive-eligible-students";
import { initialDepartmentPipeline } from "../domain/master-pipeline";

export interface PipelineStageView {
  id: string;
  name: string;
  stageType: RecruitmentStageType;
  sortOrder: number;
  description: string | null;
  instructions: string | null;
  visibleToStudents: boolean;
  scheduledAt: Date | null;
  location: string | null;
  isEnabled: boolean;
}

export interface StageCount {
  stageId: string | null;
  name: string;
  stageType: RecruitmentStageType | null;
  /** Version the stage belongs to; null for applications not yet mapped. */
  version: number | null;
  active: boolean;
  inProgress: number;
  selected: number;
  rejected: number;
}

export interface DriveRecruitment {
  departmentDriveId: string;
  locked: boolean;
  /**
   * Whether a change goes to the Super Admin: always for a Super Admin
   * drive, and for a department's own drive once published. The server
   * decides the same way (manage-pipeline.ts).
   */
  requiresApproval: boolean;
  /** Set when there is no version yet: the stages the drive will start with. */
  plannedStages: PipelineStageView[] | null;
  activeVersion: { id: string; version: number; stages: PipelineStageView[] } | null;
  versions: { id: string; version: number; status: string; note: string | null; createdAt: Date; createdBy: string | null }[];
  requests: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reason: string;
    createdAt: Date;
    requestedBy: string;
    reviewedAt: Date | null;
    reviewNote: string | null;
    proposedStages: PipelineStageView[];
  }[];
  counts: {
    eligible: number;
    applied: number;
    /** In progress and past the Application stage. */
    shortlisted: number;
    selected: number;
    rejected: number;
    placed: number;
    byStage: StageCount[];
  };
}

/**
 * The calling department's recruitment for one drive: its pipeline (active
 * version and history), its change requests, and counts derived from the
 * configured stages — nothing hard-coded, so a drive with a Group Discussion
 * round counts a Group Discussion round.
 *
 * Authorization: DEPT_ADMIN; the department and its instance come from the
 * session. Counts cover this department's applicants only.
 */
export async function getDriveRecruitment(driveId: string): Promise<DriveRecruitment> {
  const { department } = await requireDepartmentAdmin();

  const instance = await prisma.driveDepartmentConfig.findUnique({
    where: { driveId_departmentId: { driveId, departmentId: department.id } },
    select: {
      id: true,
      lockedAt: true,
      selectionRounds: true,
      drive: { select: { isCentralDrive: true, masterPipeline: true, selectionRounds: true } },
    },
  });
  if (!instance) throw new AuthorizationError("Drive not found in your department.");

  const ownApplicants = { driveId, student: { departmentId: department.id } };

  const [versions, requests, grouped, placed, eligibility] = await Promise.all([
    prisma.recruitmentPipelineVersion.findMany({
      where: { driveDepartmentConfigId: instance.id },
      orderBy: { version: "desc" },
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.pipelineChangeRequest.findMany({
      where: { driveDepartmentConfigId: instance.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { requestedBy: { select: { name: true, email: true } } },
    }),
    prisma.driveApplication.groupBy({
      by: ["currentStageId", "status"],
      where: ownApplicants,
      _count: { _all: true },
    }),
    prisma.studentPlacement.count({
      where: { driveId, ...ACTIVE_PLACEMENT_WHERE, student: { departmentId: department.id } },
    }),
    getDepartmentDriveEligibleStudents(driveId),
  ]);

  const active = versions.find((version) => version.status === "ACTIVE") ?? null;
  const stageById = new Map(
    versions.flatMap((version) =>
      version.stages.map((stage) => [stage.id, { ...stage, version: version.version, active: version.id === active?.id }])
    )
  );

  // Every stage of the active version, in order — including empty ones — then
  // any older-version stage that still holds applicants, then unmapped.
  const counts = new Map<string | null, StageCount>();
  for (const stage of active?.stages ?? []) {
    counts.set(stage.id, {
      stageId: stage.id, name: stage.name, stageType: stage.stageType,
      version: active!.version, active: true, inProgress: 0, selected: 0, rejected: 0,
    });
  }

  const bump = (entry: StageCount, status: ApplicationStatus, n: number) => {
    if (status === "SELECTED") entry.selected += n;
    else if (status === "REJECTED") entry.rejected += n;
    else if (status === "IN_PROGRESS") entry.inProgress += n;
  };

  let applied = 0;
  let shortlisted = 0;
  let selected = 0;
  let rejected = 0;

  for (const row of grouped) {
    const n = row._count._all;
    applied += n;
    if (row.status === "SELECTED") selected += n;
    if (row.status === "REJECTED") rejected += n;

    const stage = row.currentStageId ? stageById.get(row.currentStageId) : undefined;
    if (row.status === "IN_PROGRESS" && stage && stage.stageType !== "APPLICATION") shortlisted += n;

    const key = row.currentStageId ?? null;
    let entry = counts.get(key);
    if (!entry) {
      entry = stage
        ? { stageId: stage.id, name: stage.name, stageType: stage.stageType, version: stage.version,
            active: stage.active, inProgress: 0, selected: 0, rejected: 0 }
        : { stageId: null, name: "Not yet mapped", stageType: null, version: null,
            active: false, inProgress: 0, selected: 0, rejected: 0 };
      counts.set(key, entry);
    }
    bump(entry, row.status, n);
  }

  const toView = (stage: PipelineStageView): PipelineStageView => ({
    id: stage.id, name: stage.name, stageType: stage.stageType, sortOrder: stage.sortOrder,
    description: stage.description, instructions: stage.instructions,
    visibleToStudents: stage.visibleToStudents, scheduledAt: stage.scheduledAt,
    location: stage.location, isEnabled: stage.isEnabled,
  });

  const plannedStages = active
    ? null
    : initialDepartmentPipeline(instance.drive, instance).map((stage, index) => ({
        ...stage,
        id: `planned-${index}`,
      }));

  return {
    departmentDriveId: instance.id,
    locked: isDepartmentDriveLocked(instance),
    requiresApproval: instance.drive.isCentralDrive || isDepartmentDriveLocked(instance),
    plannedStages,
    activeVersion: active ? { id: active.id, version: active.version, stages: active.stages.map(toView) } : null,
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      note: version.note,
      createdAt: version.createdAt,
      createdBy: version.createdBy ? version.createdBy.name ?? version.createdBy.email : null,
    })),
    requests: requests.map((request) => ({
      id: request.id,
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
      requestedBy: request.requestedBy.name ?? request.requestedBy.email,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      proposedStages: (JSON.parse(request.proposedStages) as PipelineStageView[]).map((stage, index) => ({
        ...stage,
        id: `proposed-${index}`,
        scheduledAt: stage.scheduledAt ? new Date(stage.scheduledAt) : null,
      })),
    })),
    counts: {
      eligible: eligibility.eligible.length,
      applied,
      shortlisted,
      selected,
      rejected,
      placed,
      byStage: [...counts.values()],
    },
  };
}
