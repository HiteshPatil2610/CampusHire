import type { PrismaClient } from "@prisma/client";

/**
 * Promoting a student account to an admin role leaves its `Student` row
 * behind unless something removes it.
 *
 * Nothing in the schema stops a `User` from holding both a `Student` and a
 * `DepartmentAdmin` relation, so a promoted account keeps appearing in the
 * department roster, in `totalStudents`, and in the placement-rate
 * denominator — the admin is counted as one of the students they administer.
 *
 * A `DriveApplication` cascades on `Student` delete, so removing the row
 * would also destroy that person's application history. That history is
 * referenced by drive reports and is the source of truth for placement, so
 * the record is only retired when it carries no applications; otherwise the
 * caller is told to resolve it deliberately.
 */

export type RetirementDecision =
  | { action: "none"; reason: string }
  | { action: "delete"; reason: string }
  | { action: "refuse"; reason: string };

/**
 * Decide what to do with a promoted user's student record.
 *
 * Pure so the rule is testable without a database, per the testing standard
 * in `code-standards.md`.
 */
export function decideStudentRetirement(input: {
  hasStudentRecord: boolean;
  applicationCount: number;
}): RetirementDecision {
  if (!input.hasStudentRecord) {
    return { action: "none", reason: "Account has no student record." };
  }

  if (input.applicationCount > 0) {
    return {
      action: "refuse",
      reason:
        `Student record has ${input.applicationCount} drive application(s). ` +
        `Deleting it would cascade and destroy that application history. ` +
        `Resolve manually before promoting this account.`,
    };
  }

  return {
    action: "delete",
    reason: "Student record carries no applications and can be retired.",
  };
}

export type RetirementResult = RetirementDecision & { applied: boolean };

/**
 * Apply {@link decideStudentRetirement} for one user.
 *
 * Returns without writing when there is nothing to do or when the record must
 * not be touched — the caller decides whether a refusal aborts the promotion.
 */
export async function retireStudentRecord(
  prisma: PrismaClient,
  userId: string
): Promise<RetirementResult> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true, rollNumber: true, _count: { select: { applications: true } } },
  });

  const decision = decideStudentRetirement({
    hasStudentRecord: Boolean(student),
    applicationCount: student?._count.applications ?? 0,
  });

  if (decision.action !== "delete" || !student) {
    return { ...decision, applied: false };
  }

  // Cascades to academic, skills, projects, experiences, certifications and
  // semester marks — all of which describe a student this person no longer is.
  await prisma.student.delete({ where: { id: student.id } });

  return {
    ...decision,
    reason: `Retired student record ${student.rollNumber}.`,
    applied: true,
  };
}
