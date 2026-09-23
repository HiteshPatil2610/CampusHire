import { Prisma, type PrismaClient } from "@prisma/client";
import { createAuditLogInTransaction, AuditAction, AuditEntityType } from "@/lib/audit";
import { academicCycle, type AcademicCycle } from "./academic-year";

/**
 * Record the annual cutover for the academic cycle `now` falls in — once.
 *
 * Promotion itself needs no write: year levels are derived from the expected
 * passout year and the cycle, so from July 1 every student already reads at
 * their new level. What this records is the institution's ledger of that
 * transition — the cycle, when it was first observed and by whom, and how
 * many students crossed into GRADUATED, 4th and 3rd year — with an audit
 * entry.
 *
 * Idempotent in the database, not by convention: the cycle is the primary
 * key, so a second run (a double click, two Super Admins at once, a cron
 * retry) inserts nothing — the unique violation rolls back its transaction,
 * audit entry included — and reports the existing record. Nothing is ever
 * promoted twice because nothing is ever promoted by a write at all.
 *
 * Callers authorize first; `actorId` is the Super Admin the record and the
 * audit entry are attributed to.
 */

export type CutoverResult =
  | { recorded: true; cycle: AcademicCycle; counts: CutoverCounts }
  | { recorded: false; cycle: AcademicCycle; recordedAt: Date };

export interface CutoverCounts {
  graduatedCount: number;
  fourthYearCount: number;
  thirdYearCount: number;
}

type Db = Pick<PrismaClient, "academicCycleCutover" | "student" | "$transaction">;

export async function recordAcademicCutover(
  db: Db,
  actorId: string,
  now: Date = new Date()
): Promise<CutoverResult> {
  const cycle = academicCycle(now);

  const existing = await db.academicCycleCutover.findUnique({
    where: { academicYear: cycle.label },
    select: { recordedAt: true },
  });
  if (existing) return { recorded: false, cycle, recordedAt: existing.recordedAt };

  // Who stands where as the cycle turns: the batch that has just passed out,
  // this cycle's final year, and the year below it.
  const final = cycle.finalYearPassout;
  const [graduatedCount, fourthYearCount, thirdYearCount] = await Promise.all([
    db.student.count({ where: { expectedPassoutYear: final - 1 } }),
    db.student.count({ where: { expectedPassoutYear: final } }),
    db.student.count({ where: { expectedPassoutYear: final + 1 } }),
  ]);
  const counts = { graduatedCount, fourthYearCount, thirdYearCount };

  try {
    await db.$transaction(async (tx) => {
      await tx.academicCycleCutover.create({
        data: {
          academicYear: cycle.label,
          finalYearPassout: final,
          effectiveFrom: cycle.startsAt,
          recordedAt: now,
          recordedById: actorId,
          ...counts,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.CUTOVER,
          entityType: AuditEntityType.ACADEMIC_CUTOVER,
          entityId: cycle.label,
          metadata: {
            academicYear: cycle.label,
            effectiveFrom: cycle.startsAt.toISOString(),
            graduatedPassoutYear: final - 1,
            fourthYearPassoutYear: final,
            thirdYearPassoutYear: final + 1,
            ...counts,
          },
        },
        actorId
      );
    });
  } catch (error) {
    // Recorded by a concurrent run between the read and the write.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await db.academicCycleCutover.findUnique({
        where: { academicYear: cycle.label },
        select: { recordedAt: true },
      });
      return { recorded: false, cycle, recordedAt: row?.recordedAt ?? now };
    }
    throw error;
  }

  return { recorded: true, cycle, counts };
}
