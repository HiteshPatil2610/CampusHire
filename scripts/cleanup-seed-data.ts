/**
 * Remove the performance-test seed data (scripts/seed-perf-data.ts) — and only
 * that. Seed data is identified exactly as the seeder marks it:
 *
 *   students      email ends with "@seed.test"
 *   drives        companyName starts with "[seed]"
 *   departments   code starts with "SD"   (removed only once empty)
 *
 * Everything else is real and is never matched by any delete below.
 *
 * Usage:
 *   npx tsx scripts/cleanup-seed-data.ts --database-url <url>            dry run
 *   npx tsx scripts/cleanup-seed-data.ts --database-url <url> --execute  delete
 *
 * A dry run performs the whole cleanup inside a transaction and rolls it back,
 * so it reports exactly what a real run would do (including any constraint that
 * would refuse it). Both modes run in ONE transaction: any failure, or any
 * change to a real record's count, aborts and leaves the database untouched.
 * Without --database-url the script uses DATABASE_URL from .env, i.e. production.
 *
 * Order matters: the database protects history with NO ACTION / RESTRICT
 * foreign keys, so children go before parents.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { PrismaClient, type Prisma } from "@prisma/client";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const urlIndex = args.indexOf("--database-url");
const url = urlIndex !== -1 ? args[urlIndex + 1] : undefined;

const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

const seedStudent: Prisma.StudentWhereInput = { email: { endsWith: "@seed.test" } };
const seedDrive: Prisma.DriveWhereInput = { companyName: { startsWith: "[seed]" } };
const seedDept: Prisma.DepartmentWhereInput = { code: { startsWith: "SD" } };

class Abort extends Error {}
const ROLLBACK = "__dry_run_rollback__";

/** Counts of everything that is NOT seed data — these must not change. */
async function realCounts(tx: Prisma.TransactionClient) {
  return {
    students: await tx.student.count({ where: { NOT: seedStudent } }),
    drives: await tx.drive.count({ where: { NOT: seedDrive } }),
    departments: await tx.department.count({ where: { NOT: seedDept } }),
    users: await tx.user.count(),
    audit: await tx.auditLog.count(),
    // A real student's own profile records must survive.
    realStudentAcademics: await tx.studentAcademic.count({ where: { student: { NOT: seedStudent } } }),
  };
}

async function main() {
  const host = new URL(url ?? process.env.DATABASE_URL ?? "postgres://unknown/").hostname;
  console.log(`\n${execute ? "EXECUTING" : "DRY RUN"} against ${host}\n`);

  const summary: Record<string, number> = {};

  try {
    await prisma.$transaction(
      async (tx) => {
        const before = await realCounts(tx);

        // Anything real that still points at seed data is reported, then
        // deleted with the seed record it belongs to (a real student's
        // application to a seed drive cannot outlive that drive).
        summary.realStudentApplicationsOnSeedDrives = await tx.driveApplication.count({
          where: { drive: seedDrive, student: { NOT: seedStudent } },
        });

        // 1. Placements tied to a seed student or a seed drive.
        summary.placements = (
          await tx.studentPlacement.deleteMany({
            where: { OR: [{ student: seedStudent }, { drive: seedDrive }] },
          })
        ).count;

        // 2. Applications (their snapshots and stage events cascade).
        summary.applications = (
          await tx.driveApplication.deleteMany({
            where: { OR: [{ drive: seedDrive }, { student: seedStudent }] },
          })
        ).count;

        // 3. Drives (department drives, pipelines, stages, rules and form
        //    fields cascade).
        summary.drives = (await tx.drive.deleteMany({ where: seedDrive })).count;

        // 4. Students (academics, skills, projects… cascade).
        summary.students = (await tx.student.deleteMany({ where: seedStudent })).count;

        // 5. Seed departments, only if nothing at all still refers to them.
        const emptyDepts = await tx.department.findMany({
          where: seedDept,
          select: {
            id: true,
            code: true,
            _count: { select: { students: true, admins: true, driveConfigs: true } },
          },
        });
        const blocked = emptyDepts.filter(
          (dept) => dept._count.students + dept._count.admins + dept._count.driveConfigs > 0
        );
        if (blocked.length > 0) {
          throw new Abort(
            `Seed departments still in use, refusing to remove them: ${blocked
              .map((dept) => dept.code)
              .join(", ")}`
          );
        }
        summary.departments = (
          await tx.department.deleteMany({ where: { id: { in: emptyDepts.map((dept) => dept.id) } } })
        ).count;

        // Nothing real may have changed.
        const after = await realCounts(tx);
        for (const key of Object.keys(before) as (keyof typeof before)[]) {
          if (before[key] !== after[key]) {
            throw new Abort(`A real record count changed (${key}: ${before[key]} → ${after[key]}). Aborting.`);
          }
        }

        // Nothing seeded may remain.
        const remaining = {
          students: await tx.student.count({ where: seedStudent }),
          drives: await tx.drive.count({ where: seedDrive }),
          departments: await tx.department.count({ where: seedDept }),
          applicationsOnSeedDrives: await tx.driveApplication.count({ where: { drive: seedDrive } }),
        };
        if (Object.values(remaining).some((count) => count > 0)) {
          throw new Abort(`Seed data remains: ${JSON.stringify(remaining)}`);
        }

        console.log("Real records before → after (must match):");
        console.log(JSON.stringify({ before, after }, null, 2));
        console.log("\nDeleted:");
        console.log(JSON.stringify(summary, null, 2));

        if (!execute) throw new Error(ROLLBACK);
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
    console.log("\nCommitted. Seed data removed.");
  } catch (error) {
    if (error instanceof Error && error.message === ROLLBACK) {
      console.log("\nDry run complete — everything above was rolled back. Nothing changed.");
    } else if (error instanceof Abort) {
      console.error(`\nABORTED, nothing changed: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.error("\nFAILED, nothing changed:", error);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
