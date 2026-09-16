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

  return prisma.studentAccessRequest.findMany({
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
}

/** Badge count for the pending queue. */
export async function getPendingAccessRequestCount(): Promise<number> {
  const { department } = await requireDepartmentAdmin();

  return prisma.studentAccessRequest.count({
    where: { departmentId: department.id, status: "PENDING" },
  });
}
