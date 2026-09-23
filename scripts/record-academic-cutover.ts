/**
 * Record the annual academic cutover — for a cron, or by hand.
 *
 * Usage: npx tsx scripts/record-academic-cutover.ts <super-admin-email>
 *
 * Runs the same idempotent function the Super Admin dashboard calls on its
 * first visit after July 1 (features/students/domain/record-academic-cutover.ts).
 * Safe to run any number of times: a cycle already recorded writes nothing.
 * Year levels never depend on it — they are derived — so a cron that never
 * runs changes no student; it only leaves the ledger to the next visit.
 *
 * It then tells this cycle's final-year batch about the open drives they can
 * apply to. That part runs every time (it is what to re-run if the dashboard's
 * attempt failed) and is idempotent: a student is told about a drive once.
 */
import { config } from "dotenv";
import { resolve } from "path";

// Same env precedence as the other scripts: .env, then .env.local, both
// overriding the shell.
config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { prisma } from "@/lib/prisma";
import { recordAcademicCutover } from "@/features/students/domain/record-academic-cutover";
import { notifyNewlyEligibleDrivesForBatch } from "@/features/notifications/domain/newly-eligible-drives";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx scripts/record-academic-cutover.ts <super-admin-email>");
    process.exit(1);
  }

  // The record and its audit entry are attributed to a real Super Admin.
  const actor = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!actor || actor.role !== "SUPER_ADMIN") {
    console.error(`${email} is not a Super Admin.`);
    process.exit(1);
  }

  const result = await recordAcademicCutover(prisma, actor.id);
  if (result.recorded) {
    console.log(`Recorded cutover ${result.cycle.label}:`, result.counts);
  } else {
    console.log(`Cutover ${result.cycle.label} was already recorded at ${result.recordedAt.toISOString()} — nothing written.`);
  }

  const told = await notifyNewlyEligibleDrivesForBatch(result.cycle.finalYearPassout);
  console.log(
    `Final-year batch ${result.cycle.finalYearPassout}: ${told.students} students checked, ${told.notifications} new "New Drive Available" notifications.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
