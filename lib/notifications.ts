import type {
  NotificationEvent,
  NotificationPriority,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  eventDefinition,
  isEventForRole,
  isSuppressedByPreference,
  safeActionUrl,
} from "@/features/notifications/domain/events";

/**
 * The notification service: the one writer of `Notification` rows.
 *
 * Every producer — a drive published, an application moved, an announcement,
 * a Super Admin alert — names an event and hands over recipients it resolved
 * from the database. This function then decides everything else, the same way
 * for every caller:
 *
 * 1. Category, legacy type and default priority come from the event registry
 *    (`features/notifications/domain/events.ts`), never from the caller.
 * 2. Every recipient must exist and hold the role the caller says they have,
 *    and that role must be one the event is defined for. A student event can
 *    never land in an admin's centre, and an id that is not a user of that
 *    role is dropped.
 * 3. Muted events are skipped, unless the event is mandatory or URGENT.
 * 4. The row is keyed by (userId, dedupeKey): delivering the same event again
 *    — a retried fan-out, a double-clicked action, a refreshed page — writes
 *    nothing. With `collapse`, it refreshes the one row instead (daily
 *    digests such as "3 new applications today").
 * 5. The link is an in-app path or nothing (the database checks this too).
 *
 * Pass a transaction client to make a notification part of the change that
 * caused it.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface NotificationContent {
  title: string;
  message: string;
  actionUrl?: string | null;
}

export interface NotificationRecipient extends Partial<NotificationContent> {
  userId: string;
}

export interface DeliverNotificationInput {
  event: NotificationEvent;
  /** The role every recipient must hold. */
  role: Role;
  recipients: NotificationRecipient[];
  /** Default content; a recipient's own title/message/actionUrl wins. */
  content: NotificationContent;
  /** The event's identity. Unique per recipient. */
  dedupeKey: string;
  resourceType?: string | null;
  resourceId?: string | null;
  /** Overrides the registry default. URGENT only for announcements and alerts. */
  priority?: NotificationPriority;
  expiresAt?: Date | null;
  dispatchId?: string | null;
  /** Replace an earlier notification with the same key instead of skipping. */
  collapse?: boolean;
}

/** Events that may be raised to URGENT, which bypasses every preference. */
const MAY_BE_URGENT: readonly NotificationEvent[] = ["ANNOUNCEMENT", "SYSTEM_ALERT"];

/** Recipients above this are written in chunks, to keep statements bounded. */
const CHUNK = 1000;

export async function deliverNotification(
  db: Db,
  input: DeliverNotificationInput
): Promise<{ delivered: number }> {
  if (!isEventForRole(input.event, input.role)) {
    // A producer bug, not a runtime condition: refuse loudly.
    throw new Error(`Notification ${input.event} is not defined for ${input.role}`);
  }

  const userIds = [...new Set(input.recipients.map((recipient) => recipient.userId).filter(Boolean))];
  if (userIds.length === 0) return { delivered: 0 };

  const definition = eventDefinition(input.event);
  const priority =
    input.priority && (input.priority !== "URGENT" || MAY_BE_URGENT.includes(input.event))
      ? input.priority
      : definition.priority;

  // Recipients are re-read here, whatever the caller resolved: only real
  // users of the stated role, with their preferences.
  const users = await db.user.findMany({
    where: { id: { in: userIds }, role: input.role },
    select: { id: true, notificationPreference: { select: { mutedEvents: true } } },
  });
  const allowed = new Set(
    users
      .filter(
        (user) =>
          !isSuppressedByPreference(
            input.event,
            priority,
            user.notificationPreference?.mutedEvents ?? []
          )
      )
      .map((user) => user.id)
  );

  const byUser = new Map(input.recipients.map((recipient) => [recipient.userId, recipient]));
  const rows: Prisma.NotificationCreateManyInput[] = [];
  for (const userId of userIds) {
    if (!allowed.has(userId)) continue;
    const own = byUser.get(userId);
    rows.push({
      userId,
      type: definition.legacyType,
      event: input.event,
      category: definition.category,
      priority,
      title: clean(own?.title ?? input.content.title, 200),
      message: clean(own?.message ?? input.content.message, 1000),
      actionUrl: safeActionUrl(own?.actionUrl ?? input.content.actionUrl),
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      expiresAt: input.expiresAt ?? null,
      dedupeKey: clean(input.dedupeKey, 300),
      dispatchId: input.dispatchId ?? null,
    });
  }
  if (rows.length === 0) return { delivered: 0 };

  if (input.collapse) {
    // Small audiences only (a department's admins): one upsert each.
    for (const row of rows) {
      const { userId, dedupeKey, ...content } = row;
      await db.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: dedupeKey! } },
        create: row,
        update: { ...content, isRead: false, readAt: null, createdAt: new Date() },
      });
    }
    return { delivered: rows.length };
  }

  let delivered = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const result = await db.notification.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    delivered += result.count;
  }
  return { delivered };
}

/**
 * Deliver without letting a failure escape: for notifications that follow a
 * change that has already been committed and must not be reported as failed
 * because a notification could not be written. Fan-outs to many people go
 * through `runNotificationDispatch` instead, which records the failure.
 */
export async function deliverNotificationSafely(
  input: DeliverNotificationInput
): Promise<{ delivered: number }> {
  try {
    return await deliverNotification(prisma, input);
  } catch (error) {
    console.error(`deliverNotification(${input.event}) failed:`, error);
    return { delivered: 0 };
  }
}

/** Every Super Admin, optionally without the one who caused the event. */
export async function superAdminRecipients(exceptUserId?: string): Promise<NotificationRecipient[]> {
  const admins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
  return admins.map((admin) => ({ userId: admin.id }));
}

/** A department's admins, optionally without the one who caused the event. */
export async function departmentAdminRecipients(
  departmentId: string,
  exceptUserId?: string
): Promise<NotificationRecipient[]> {
  const admins = await prisma.departmentAdmin.findMany({
    // A disabled admin no longer runs the department, so they are not told
    // about its work either.
    where: { departmentId, status: "ACTIVE", ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
    select: { userId: true },
  });
  return admins.map((admin) => ({ userId: admin.userId }));
}

function clean(text: string, max: number): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}
