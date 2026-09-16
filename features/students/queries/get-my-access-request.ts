import { prisma } from "@/lib/prisma";

/**
 * The caller's own access request, if they have one.
 *
 * Scoped by userId, which the caller resolves from their session — a student
 * can only ever see their own request.
 */
export async function getMyAccessRequest(userId: string) {
  return prisma.studentAccessRequest.findUnique({
    where: { userId },
    include: { department: { select: { id: true, name: true, code: true } } },
  });
}
