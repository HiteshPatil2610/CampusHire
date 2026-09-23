"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireSuperAdmin } from "@/lib/auth";
import { recordAcademicCutover, type CutoverResult } from "../domain/record-academic-cutover";
import { notifyNewlyEligibleDrivesForBatch } from "@/features/notifications/domain/newly-eligible-drives";

/**
 * The Super Admin's hook into the annual cutover. Called when a Super Admin
 * opens their dashboard — CampusHire has no scheduler, so a due cutover is
 * recorded on the next visit, the same way time-based notifications are —
 * and safe to call on every visit: recording is idempotent.
 * `scripts/record-academic-cutover.ts` runs the same function from a cron.
 *
 * When this visit is the one that records the new cycle, the batch that has
 * just become final year is told about every open drive it can now apply to
 * (owner's decision, 2026-09-24) — once per drive, by the shared dedupe key.
 * Best-effort: a failed fan-out never fails the dashboard; the cron script
 * can run it again safely.
 */
export async function ensureAcademicCutoverRecorded(): Promise<
  { success: true; result: CutoverResult } | { success: false; error: string }
> {
  try {
    const user = await requireSuperAdmin();
    const result = await recordAcademicCutover(prisma, user.id);

    if (result.recorded) {
      try {
        await notifyNewlyEligibleDrivesForBatch(result.cycle.finalYearPassout);
      } catch (error) {
        console.error("New final-year batch notification failed:", error);
      }
    }

    return { success: true, result };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("Academic cutover error:", error);
    return { success: false, error: "Could not record the academic cutover." };
  }
}
