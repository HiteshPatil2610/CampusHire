import { prisma } from "@/lib/prisma";

/**
 * Centralized Notification Service
 * 
 * This module provides a reusable notification creation service for CampusHire.
 * All notifications MUST be created server-side using this service.
 * 
 * Key principles:
 * 1. Recipient is ALWAYS resolved server-side (never from client input)
 * 2. Timestamps are server-generated (never from client input)
 * 3. Notification type is server-controlled (never arbitrary client values)
 * 4. Content is sanitized before storage
 * 5. Errors are logged but don't break critical operations
 */

/**
 * Standard notification types
 */
export const NotificationType = {
  APPLICATION: "APPLICATION",  // Student application events
  DRIVE: "DRIVE",             // Drive-related events
  PROFILE: "PROFILE",         // Profile-related reminders
  ADMIN: "ADMIN",             // Administrative events
  SYSTEM: "SYSTEM",           // System-wide messages
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  userId: string;           // Recipient (from trusted server state)
  type: NotificationType;   // Notification category
  title: string;            // Short notification title
  message: string;          // Full notification message
  resourceType?: string;    // Optional: type of related resource (Drive, Application, etc.)
  resourceId?: string;      // Optional: ID of related resource
}

/**
 * Create a notification
 * 
 * This is the centralized notification creation function used throughout CampusHire.
 * It validates the recipient server-side and creates an in-app notification record.
 * 
 * IMPORTANT SECURITY RULES:
 * - userId must come from authenticated session or trusted database query
 * - NEVER pass client-provided userId
 * - NEVER pass client-provided timestamps
 * 
 * @param input - Notification data
 * @returns Promise that resolves when notification is created
 * 
 * @example
 * ```typescript
 * // CORRECT: Recipient from authenticated session
 * const auth = await requireStudent();
 * await createNotification({
 *   userId: auth.user.id,
 *   type: NotificationType.APPLICATION,
 *   title: "Application Submitted",
 *   message: "You successfully applied to Google - SDE",
 *   resourceType: "Drive",
 *   resourceId: drive.id,
 * });
 * 
 * // WRONG: Never use client-provided userId
 * await createNotification({
 *   userId: clientProvidedUserId, // ❌ VULNERABLE
 *   ...
 * });
 * ```
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    // Verify user exists (security check)
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!user) {
      console.error(`Cannot create notification: User not found (${input.userId})`);
      return;
    }

    // Sanitize title and message
    const title = sanitizeText(input.title);
    const message = sanitizeText(input.message);

    // Create notification
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title,
        message,
        resourceType: input.resourceType || null,
        resourceId: input.resourceId || null,
        isRead: false,
      },
    });

  } catch (error) {
    // Log error but don't throw - notification failure shouldn't break operations
    console.error("Failed to create notification:", error);
    // In production, this should be logged to an error tracking service
  }
}

/**
 * Create a notification within an existing Prisma transaction
 * 
 * Use this version when creating notifications within a transaction to ensure
 * atomicity between the business operation and the notification.
 * 
 * @param tx - Prisma transaction client
 * @param input - Notification data
 * @param userId - User ID (must be provided since we validate separately)
 */
export async function createNotificationInTransaction(
  tx: any, // Prisma transaction client
  input: CreateNotificationInput
): Promise<void> {
  const title = sanitizeText(input.title);
  const message = sanitizeText(input.message);

  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title,
      message,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      isRead: false,
    },
  });
}

/**
 * Sanitize text content before storing in notifications
 * 
 * Removes excessive whitespace and limits length
 * 
 * @param text - Raw text content
 * @returns Sanitized text
 */
function sanitizeText(text: string): string {
  // Trim whitespace
  let sanitized = text.trim();
  
  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, " ");
  
  // Limit title to 200 characters
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + "...";
  }
  
  return sanitized;
}

/**
 * Helper to create application submission notification
 * Convenience wrapper for common notification pattern
 * 
 * @param userId - Student user ID
 * @param companyName - Company name
 * @param roleName - Role name
 * @param driveId - Drive ID
 */
export async function createApplicationSubmittedNotification(
  userId: string,
  companyName: string,
  roleName: string,
  driveId: string
): Promise<void> {
  await createNotification({
    userId,
    type: NotificationType.APPLICATION,
    title: "Application Submitted",
    message: `You successfully applied to ${companyName} - ${roleName}`,
    resourceType: "Drive",
    resourceId: driveId,
  });
}

/**
 * Helper to create profile incomplete notification
 * Convenience wrapper for common notification pattern
 * 
 * @param userId - Student user ID
 * @param missingSection - Section name that needs completion
 */
export async function createProfileIncompleteNotification(
  userId: string,
  missingSection: string
): Promise<void> {
  await createNotification({
    userId,
    type: NotificationType.PROFILE,
    title: "Complete Your Profile",
    message: `Add ${missingSection} details to apply to drives`,
    resourceType: "Profile",
    resourceId: userId,
  });
}

/**
 * Helper to create new drive notification
 * Convenience wrapper for common notification pattern
 * 
 * @param userId - Student user ID
 * @param companyName - Company name
 * @param roleName - Role name
 * @param driveId - Drive ID
 */
export async function createNewDriveNotification(
  userId: string,
  companyName: string,
  roleName: string,
  driveId: string
): Promise<void> {
  await createNotification({
    userId,
    type: NotificationType.DRIVE,
    title: "New Drive Available",
    message: `${companyName} is hiring for ${roleName}`,
    resourceType: "Drive",
    resourceId: driveId,
  });
}
