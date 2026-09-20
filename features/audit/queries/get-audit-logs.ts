import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { GetAuditLogsInput } from "../schemas/audit";

/**
 * Get paginated audit logs with optional filters
 * 
 * Authorization: SUPER_ADMIN only (enforced by caller)
 * 
 * @param input - Query parameters with pagination and filters
 * @returns Paginated audit log results
 */
export async function getAuditLogs(input: GetAuditLogsInput) {
  const { page, pageSize, action, entityType, userId, startDate, endDate } =
    input;

  const skip = (page - 1) * pageSize;

  // Built as a typed filter, so a misspelled column is a compile error rather
  // than a clause Postgres quietly ignores — a filter that silently does
  // nothing is how a scoped query becomes an unscoped one.
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" }, // Newest first
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  // Transform data for response
  const data = logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    userEmail: log.user.email,
    userRole: log.user.role,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  }));

  return {
    data,
    page,
    pageSize,
    totalCount,
  };
}
