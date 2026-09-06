import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
  action: string;           // Action type (CREATE, UPDATE, DELETE, etc.)
  entityType: string;       // Resource type (Department, Drive, etc.)
  entityId?: string;        // Resource identifier (optional for bulk operations)
  metadata?: Record<string, any>; // Additional context (will be JSON stringified)
  ipAddress?: string;       // Client IP address (optional)
  userAgent?: string;       // Client user agent (optional)
}

/**
 * Standard action types for consistency
 */
export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  ACTIVATE: "ACTIVATE",
  DEACTIVATE: "DEACTIVATE",
  ASSIGN: "ASSIGN",
  UNASSIGN: "UNASSIGN",
  APPLY: "APPLY",
  IMPORT: "IMPORT",
  ROLE_CHANGE: "ROLE_CHANGE",
} as const;

/**
 * Standard entity types for consistency
 */
export const AuditEntityType = {
  DEPARTMENT: "Department",
  DEPARTMENT_ADMIN: "DepartmentAdmin",
  USER: "User",
  DRIVE: "Drive",
  DRIVE_APPLICATION: "DriveApplication",
  STUDENT: "Student",
  BULK_IMPORT: "BulkImport",
} as const;

/**
 * Create an audit log entry
 * 
 * This is the centralized audit logging function used throughout CampusHire.
 * It resolves the actor server-side from the authenticated session and creates
 * an immutable audit record in the database.
 * 
 * @param input - Audit log data
 * @returns Promise that resolves when audit log is created
 * 
 * @example
 * ```typescript
 * await createAuditLog({
 *   action: AuditAction.CREATE,
 *   entityType: AuditEntityType.DEPARTMENT,
 *   entityId: department.id,
 *   metadata: { name: department.name, code: department.code },
 * });
 * ```
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    // Resolve authenticated user server-side (never trust client)
    const user = await getCurrentUser();
    
    if (!user) {
      console.error("Cannot create audit log: No authenticated user");
      return;
    }

    // Serialize metadata to JSON if provided
    const metadataString = input.metadata
      ? JSON.stringify(sanitizeMetadata(input.metadata))
      : null;

    // Create audit log record
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        metadata: metadataString,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit failure shouldn't break business operations
    console.error("Failed to create audit log:", error);
    // In production, this should be logged to an error tracking service
  }
}

/**
 * Create an audit log within an existing Prisma transaction
 * 
 * Use this version when creating audit logs within a transaction to ensure
 * atomicity between the business operation and the audit record.
 * 
 * @param tx - Prisma transaction client
 * @param input - Audit log data
 * @param userId - User ID (must be provided since we can't call getCurrentUser in transaction)
 */
export async function createAuditLogInTransaction(
  tx: any, // Prisma transaction client
  input: CreateAuditLogInput,
  userId: string
): Promise<void> {
  const metadataString = input.metadata
    ? JSON.stringify(sanitizeMetadata(input.metadata))
    : null;

  await tx.auditLog.create({
    data: {
      userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      metadata: metadataString,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    },
  });
}

/**
 * Sanitize metadata to remove sensitive information
 * 
 * This function removes or masks sensitive data before storing metadata
 * in audit logs. It ensures we never log passwords, tokens, or credentials.
 * 
 * @param metadata - Raw metadata object
 * @returns Sanitized metadata object
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  // List of sensitive field names to exclude
  const sensitiveFields = [
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "secret",
    "apiKey",
    "credential",
    "otp",
    "verificationCode",
    "sessionId",
    "clerkId", // Clerk ID is internal, not needed in audit logs
  ];

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    // Skip sensitive fields
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Helper to get audit log metadata for field changes
 * 
 * @param changedFields - Array of field names that were changed
 * @returns Metadata object with changed fields
 */
export function getChangeMetadata(changedFields: string[]): Record<string, any> {
  return {
    changedFields,
    changeCount: changedFields.length,
  };
}
