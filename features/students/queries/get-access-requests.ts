import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import type { AccessRequestStatus } from "@prisma/client";

/**
 * Self-registration requests awaiting a decision, scoped to the calling
 * admin's own department.
 *
 * These are people who signed up but whose email matched no imported student
 * record — see `registration-match.ts`. They have no `Student` row yet, which
 * is why they cannot be read from the roster.
 */
export async function getAccessRequests(
  status: AccessRequestStatus = "PENDING"
) {
  const { department } = await requireDepartmentAdmin();

  const requests = await prisma.studentAccessRequest.findMany({
    where: {
      // CRITICAL: an admin only ever sees requests for their own department.
      departmentId: department.id,
      status,
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { email: true, createdAt: true } },
      reviewedBy: { select: { email: true, name: true } },
    },
  });

  // Which requests name an MIS number already on this department's roster,
  // unclaimed: approving those links the account to that record rather than
  // creating a new one. One query for the whole queue.
  const misNumbers = requests
    .map((request) => request.misNumber)
    .filter((mis): mis is string => mis !== null);
  const onRoster = new Set(
    misNumbers.length === 0
      ? []
      : (
          await prisma.student.findMany({
            where: { departmentId: department.id, userId: null, misNumber: { in: misNumbers } },
            select: { misNumber: true },
          })
        ).map((student) => student.misNumber)
  );

  return requests.map((request) => ({
    ...request,
    rosterMatch: request.misNumber !== null && onRoster.has(request.misNumber),
  }));
}

/** Badge count for the pending queue. */
export async function getPendingAccessRequestCount(): Promise<number> {
  const { department } = await requireDepartmentAdmin();

  return prisma.studentAccessRequest.count({
    where: { departmentId: department.id, status: "PENDING" },
  });
}
