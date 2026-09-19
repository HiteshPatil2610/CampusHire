"use server";

import { z } from "zod";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { moveApplication, revalidateApplicationViews } from "../domain/move-application";
import { MAX_BULK_MOVES } from "../domain/bulk-limits";

/**
 * Move many applications of one drive to one stage.
 *
 * Two steps, both server-side, both through `moveApplication` — the same
 * checks a single move gets, so a batch is never more permissive than one
 * click:
 *
 *  1. `validateBulkStageMove` (dry run) judges every application and reports
 *     which would move and which would not, and why. Nothing is written.
 *  2. `bulkUpdateApplicationStage` applies the moves one application at a
 *     time, each in its own transaction. A failure on one never rolls back or
 *     blocks the others, and every failure is returned — nothing is silently
 *     skipped. One audit entry records the whole operation, on top of each
 *     move's own history and audit rows.
 *
 * SELECTED is refused here: it creates a permanent placement, so it is made
 * one student at a time, with its own confirmation.
 *
 * Authorization: DEPT_ADMIN. The department comes from the session; each
 * application must belong to one of this department's students and to the
 * named drive, whatever ids the client sends.
 */

const bulkSchema = z.object({
  driveId: z.string().min(1, "Drive is required").max(64),
  applicationIds: z
    .array(z.string().min(1).max(64))
    .min(1, "Select at least one application")
    .max(MAX_BULK_MOVES, `At most ${MAX_BULK_MOVES} applications at a time`),
  stageId: z.string().min(1, "Choose a stage").max(64),
  status: z.enum(["IN_PROGRESS", "REJECTED"]),
  note: z.string().trim().max(500, "Note too long").optional(),
});

export type BulkStageMoveInput = z.input<typeof bulkSchema>;

export interface BulkMoveOutcome {
  applicationId: string;
  studentName: string;
  rollNumber: string | null;
  ok: boolean;
  /** Why it did not move (or would not). */
  error?: string;
}

export type BulkStageMoveResult =
  | {
      success: true;
      dryRun: boolean;
      outcomes: BulkMoveOutcome[];
      moved: number;
      failed: number;
    }
  | { success: false; error: string };

async function run(input: BulkStageMoveInput, dryRun: boolean): Promise<BulkStageMoveResult> {
  try {
    const actor = await requireDepartmentAdmin();

    const validated = bulkSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid request" };
    }
    const { driveId, stageId, status, note } = validated.data;
    const applicationIds = [...new Set(validated.data.applicationIds)];

    // Names for the report, and proof each application is this department's
    // and this drive's. An id that is neither is reported as not found — the
    // same words for "missing" and "not yours", so ids cannot be probed.
    const rows = await prisma.driveApplication.findMany({
      where: {
        id: { in: applicationIds },
        driveId,
        student: { departmentId: actor.department.id },
      },
      select: { id: true, student: { select: { name: true, rollNumber: true } } },
    });
    const known = new Map(rows.map((row) => [row.id, row.student]));

    const outcomes: BulkMoveOutcome[] = [];
    for (const applicationId of applicationIds) {
      const student = known.get(applicationId);
      if (!student) {
        outcomes.push({
          applicationId,
          studentName: "Unknown application",
          rollNumber: null,
          ok: false,
          error: "Application not found.",
        });
        continue;
      }

      let result;
      try {
        result = await moveApplication(
          actor,
          { applicationId, stageId, status, note },
          { dryRun, revalidate: false }
        );
      } catch (error) {
        result = {
          success: false as const,
          error:
            error instanceof AuthorizationError
              ? error.message
              : "Something went wrong moving this application.",
        };
        if (!(error instanceof AuthorizationError)) console.error("bulk stage move error:", error);
      }

      outcomes.push({
        applicationId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        ok: result.success,
        error: result.success ? undefined : result.error,
      });
    }

    const moved = outcomes.filter((outcome) => outcome.ok).length;
    const failed = outcomes.length - moved;

    if (!dryRun) {
      const target = await prisma.recruitmentStage.findUnique({
        where: { id: stageId },
        select: { name: true },
      });
      await createAuditLog({
        action: AuditAction.TRANSITION,
        entityType: AuditEntityType.DRIVE,
        entityId: driveId,
        metadata: {
          event: "bulk-stage-move",
          departmentCode: actor.department.code,
          toStage: target?.name ?? null,
          toStatus: status,
          requested: outcomes.length,
          moved,
          failed,
          failures: outcomes
            .filter((outcome) => !outcome.ok)
            .slice(0, 20)
            .map((outcome) => `${outcome.rollNumber ?? outcome.studentName}: ${outcome.error}`),
          note: note || null,
        },
      });
      revalidateApplicationViews(driveId);
    }

    return { success: true, dryRun, outcomes, moved, failed };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("bulk stage move error:", error);
    return { success: false, error: "Failed to process the bulk move. Please try again." };
  }
}

/** Check a bulk move without changing anything. */
export async function validateBulkStageMove(input: BulkStageMoveInput): Promise<BulkStageMoveResult> {
  return run(input, true);
}

/** Apply a bulk move; returns every success and every failure. */
export async function bulkUpdateApplicationStage(input: BulkStageMoveInput): Promise<BulkStageMoveResult> {
  return run(input, false);
}
