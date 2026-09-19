"use server";

import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import {
  updateApplicationStageSchema,
  type UpdateApplicationStageInput,
} from "../schemas/application";
import { moveApplication } from "../domain/move-application";

export type UpdateApplicationStageResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Advance a student's application through the selection process.
 *
 * This is the write path for one application's `stage` and `status` (the bulk
 * action moves many through the same `moveApplication`). Both columns are
 * owned by the department admin running the drive — a student can see their
 * progress but can never move it.
 *
 * **Selecting places the student.** Marking an application SELECTED creates
 * the student's `StudentPlacement` in the same transaction — company, the
 * role as this department ran it, and package — which permanently excludes
 * them from new drives. A selection is final afterwards (here, and by a
 * database trigger); a mistake is corrected by revoking the placement.
 * The student's other applications are left exactly as they are.
 *
 * **Stages come from the drive's pipeline.** The target is a stage id, and
 * the server checks it belongs to *this* department's instance of *this*
 * drive, to its active pipeline version (or is the stage the application is
 * already in), and that the move is allowed — a client cannot name a stage of
 * another drive, another department, or an old version. Every move is
 * recorded in `ApplicationStageEvent` with the version it happened under.
 *
 * Authorization: department admin, scoped to a drive they run and to an
 * applicant from their own department (central drives are shared across
 * departments, so the applicant scope is checked separately from the drive).
 */
export async function updateApplicationStage(
  input: UpdateApplicationStageInput
): Promise<UpdateApplicationStageResult> {
  try {
    const actor = await requireDepartmentAdmin();

    const validated = updateApplicationStageSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid request",
      };
    }

    return await moveApplication(actor, validated.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("updateApplicationStage error:", error);
    return { success: false, error: "Failed to update the application." };
  }
}
