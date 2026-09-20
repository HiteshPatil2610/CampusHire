"use server";

import { getAuditLogs } from "../queries/get-audit-logs";
import { getAuditLogsSchema } from "../schemas/audit";
import { AuthenticationError, AuthorizationError, requireSuperAdmin } from "@/lib/auth";

/**
 * Server action to fetch audit logs (Super Admin only)
 * 
 * @param input - Query parameters with pagination and filters
 * @returns Paginated audit log results or error
 */
export async function getAuditLogsAction(input: {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string; // ISO string from client
  endDate?: string; // ISO string from client
}) {
  try {
    // Authorization: Super Admin only
    await requireSuperAdmin();

    // Convert date strings to Date objects
    const parsedInput = {
      page: input.page || 1,
      pageSize: input.pageSize || 25,
      action: input.action || undefined,
      entityType: input.entityType || undefined,
      userId: input.userId || undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    };

    // Validate input
    const validated = getAuditLogsSchema.parse(parsedInput);

    // Fetch audit logs
    const result = await getAuditLogs(validated);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);

    // Recognised by type, not by matching the words in a message: the
    // previous test looked for "Super Admin" and `requireRole` writes
    // "SUPER_ADMIN", so a refusal read as an unexplained failure.
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return {
        success: false,
        error: "You don't have permission to view audit logs.",
      };
    }

    return {
      success: false,
      error: "Failed to load audit logs. Please try again.",
    };
  }
}
