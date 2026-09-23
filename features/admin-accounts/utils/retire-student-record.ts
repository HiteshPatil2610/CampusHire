import type { AccessRequestStatus, Prisma } from "@prisma/client";

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
 * referenced by drive reports, so the record is only retired when it carries
 * no applications; otherwise the caller is told to resolve it deliberately.
 * A `StudentPlacement` cascades the same way and is the placement history
 * itself — an off-campus placement can exist with no application at all — so
 * a record holding any placement (active or revoked) is refused too.
 * A `StudentDrop` is the same kind of history (and `Restrict` in the
 * database), so a record with any drop — undone ones included — is refused.
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
  /** Placement records, revoked ones included — they are history too. */
  placementCount?: number;
  /** Drop records, undone ones included. */
  dropCount?: number;
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

  if ((input.placementCount ?? 0) > 0) {
    return {
      action: "refuse",
      reason:
        `Student record has ${input.placementCount} placement record(s). ` +
        `Deleting it would cascade and destroy that placement history. ` +
        `Resolve manually before promoting this account.`,
    };
  }

  if ((input.dropCount ?? 0) > 0) {
    return {
      action: "refuse",
      reason:
        `Student record has ${input.dropCount} drop record(s). ` +
        `That academic history cannot be deleted. ` +
        `Resolve manually before promoting this account.`,
    };
  }

  return {
    action: "delete",
    reason: "Student record carries no applications, placements or drops and can be retired.",
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
  prisma: Prisma.TransactionClient,
  userId: string
): Promise<RetirementResult> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      rollNumber: true,
      _count: { select: { applications: true, placements: true, drops: true } },
    },
  });

  const decision = decideStudentRetirement({
    hasStudentRecord: Boolean(student),
    applicationCount: student?._count.applications ?? 0,
    placementCount: student?._count.placements ?? 0,
    dropCount: student?._count.drops ?? 0,
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

// ============================================================================
// Waiting list
// ============================================================================

/**
 * Someone can be promoted while their self-registration is still sitting in a
 * department admin's queue. They have no `Student` row yet — approving is what
 * creates one — so retirement above finds nothing to do, and the request stays
 * PENDING: the admin still sees them on the waiting list, and approving then
 * creates a `Student` row for somebody who is now an admin. That is exactly how
 * two admins ended up in the COMP roster.
 *
 * The request is deleted rather than given a terminal status, because neither
 * existing status is true and one of them is actively harmful:
 * `REJECTED` makes `registration.ts` refuse to let them register ever again if
 * they are later demoted back to STUDENT, and `APPROVED` would claim an admin
 * approved a student record that was never created. The audit log is where the
 * trail belongs, and the callers write one.
 */
export type WithdrawalDecision =
  | { action: "none"; reason: string }
  | { action: "withdraw"; reason: string };

/** Pure so the rule is testable without a database. */
export function decideAccessRequestWithdrawal(input: {
  hasRequest: boolean;
  status: AccessRequestStatus | null;
}): WithdrawalDecision {
  if (!input.hasRequest) {
    return { action: "none", reason: "Account has no access request." };
  }

  if (input.status !== "PENDING") {
    return {
      action: "none",
      reason: `Access request is already ${input.status?.toLowerCase()} and is not on the waiting list.`,
    };
  }

  return {
    action: "withdraw",
    reason: "Access request was still on the waiting list.",
  };
}

export type WithdrawalResult = WithdrawalDecision & { applied: boolean };

/** Apply {@link decideAccessRequestWithdrawal} for one user. */
export async function withdrawPendingAccessRequest(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<WithdrawalResult> {
  const request = await tx.studentAccessRequest.findUnique({
    where: { userId },
    select: { id: true, status: true, email: true },
  });

  const decision = decideAccessRequestWithdrawal({
    hasRequest: Boolean(request),
    status: request?.status ?? null,
  });

  if (decision.action !== "withdraw" || !request) {
    return { ...decision, applied: false };
  }

  await tx.studentAccessRequest.delete({ where: { id: request.id } });

  return {
    ...decision,
    reason: `Removed ${request.email} from the waiting list.`,
    applied: true,
  };
}

/**
 * Everything that has to stop being true when an account stops being a
 * student: the roster row, and the place in the approval queue.
 *
 * Retirement runs first, because it is the half that can refuse — a student
 * record with application history must be resolved deliberately, and when it
 * refuses the promotion is aborted, so the waiting list must not be touched
 * either.
 */
export async function retireStudentAccess(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ retirement: RetirementResult; withdrawal: WithdrawalResult }> {
  const retirement = await retireStudentRecord(tx, userId);

  if (retirement.action === "refuse") {
    return {
      retirement,
      withdrawal: {
        action: "none",
        reason: "Skipped — the student record could not be retired.",
        applied: false,
      },
    };
  }

  return { retirement, withdrawal: await withdrawPendingAccessRequest(tx, userId) };
}
