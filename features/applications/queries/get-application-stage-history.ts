"use server";

import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";

export interface StageHistoryEntry {
  id: string;
  at: Date;
  fromStage: string | null;
  toStage: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  /** Null for the backfill of applications from before pipelines. */
  actor: string | null;
  note: string | null;
  pipelineVersion: number;
}

/**
 * The stage history of one application, oldest first — every move, under the
 * pipeline version it happened in, who made it and why.
 *
 * Authorization: DEPT_ADMIN, and only for an application of one of their own
 * department's students. Anything else reads as not found, so application ids
 * cannot be probed.
 */
export async function getApplicationStageHistory(
  applicationId: string
): Promise<StageHistoryEntry[]> {
  const { department } = await requireDepartmentAdmin();

  const application = await prisma.driveApplication.findFirst({
    where: { id: String(applicationId), student: { departmentId: department.id } },
    select: { id: true },
  });
  if (!application) throw new AuthorizationError("Application not found.");

  const events = await prisma.applicationStageEvent.findMany({
    where: { applicationId: application.id },
    orderBy: { createdAt: "asc" },
    include: {
      fromStage: { select: { name: true } },
      toStage: { select: { name: true } },
      actor: { select: { name: true, email: true } },
      pipelineVersion: { select: { version: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    at: event.createdAt,
    fromStage: event.fromStage?.name ?? null,
    toStage: event.toStage.name,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    actor: event.actor ? event.actor.name ?? event.actor.email : null,
    note: event.note,
    pipelineVersion: event.pipelineVersion.version,
  }));
}
