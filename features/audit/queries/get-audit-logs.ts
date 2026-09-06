import { prisma } from "@/lib/prisma";
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

  // Build where clause from filters
  const where: any = {};

  if (action) {
    where.action = action;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (userId) {
    where.userId = userId;
  }

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  // Get total count
  const totalCount = await prisma.auditLog.count({ where });

  // Get paginated data with user details
  const logs = await prisma.auditLog.findMany({
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
  });

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
