"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireSuperAdmin } from "@/lib/auth";
import { recordAcademicCutover, type CutoverResult } from "../domain/record-academic-cutover";

/**
 * The Super Admin's hook into the annual cutover. Called when a Super Admin
 * opens their dashboard — CampusHire has no scheduler, so a due cutover is
 * recorded on the next visit, the same way time-based notifications are —
 * and safe to call on every visit: recording is idempotent.
 * `scripts/record-academic-cutover.ts` runs the same function from a cron.
 */
export async function ensureAcademicCutoverRecorded(): Promise<
  { success: true; result: CutoverResult } | { success: false; error: string }
> {
  try {
    const user = await requireSuperAdmin();
    return { success: true, result: await recordAcademicCutover(prisma, user.id) };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("Academic cutover error:", error);
    return { success: false, error: "Could not record the academic cutover." };
  }
}
