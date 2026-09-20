import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNotifications, getCategoryCounts } from "../queries/get-notifications";
import { markNotificationRead } from "../actions/mark-notification-read";
import { markAllNotificationsRead } from "../actions/mark-all-notifications-read";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * A user reaches their own notifications and nobody else's.
 *
 * The thing being tested is not that a returned list happens to be the right
 * user's — it is that the *query* is scoped, so the isolation survives
 * pagination and cannot be undone by a filter. A notification id from
 * somewhere else must therefore match nothing rather than be found and then
 * refused: these actions never load a notification to check who owns it,
 * because that is the shape of check that gets forgotten.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  })),
}));

/** A real cuid, because the actions validate the id's shape before using it. */
const NOTIFICATION_ID = "clzq1a2b3c4d5e6f7g8h9i0j";
const OTHER_ID = "clzq9z8y7x6w5v4u3t2s1r0q";

/** The first argument of a mock's first call, as a plain object. */
type QueryArg = { where?: Record<string, unknown>; skip?: number; take?: number; data?: Record<string, unknown> };
const firstArg = (fn: unknown, index = 0): QueryArg =>
  ((fn as { mock: { calls: unknown[][] } }).mock.calls[index]?.[0] ?? {}) as QueryArg;

const signedIn = () => {
  vi.mocked(auth).mockResolvedValue({ userId: "clerk123" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user123",
    clerkId: "clerk123",
    email: "test@test.com",
    role: "STUDENT",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
};

describe("Notification Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Get Notifications", () => {
    it("scopes the query to the given user", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(2 as never);
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

      await getNotifications("user123", { page: 1, pageSize: 25 });

      const call = firstArg(prisma.notification.findMany);
      expect(call.where).toMatchObject({ userId: "user123" });
      expect(call.skip).toBe(0);
      expect(call.take).toBe(25);
    });

    it("counts against the same scoped filter it pages over", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(0 as never);
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

      await getNotifications("user123", { page: 1, pageSize: 25 });

      // The total, the page and the unread badge must agree, or a user sees
      // "page 2 of 3" and an empty page.
      const paged = firstArg(prisma.notification.findMany).where;
      const counted = firstArg(prisma.notification.count).where;
      expect(counted).toEqual(paged);

      for (const call of vi.mocked(prisma.notification.count).mock.calls) {
        expect(call[0]?.where).toMatchObject({ userId: "user123" });
      }
    });

    it("hides notifications that have expired", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(0 as never);
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

      await getNotifications("user123", { page: 1, pageSize: 25 });

      const where = firstArg(prisma.notification.findMany).where as {
        OR?: unknown[];
      };
      expect(where.OR).toHaveLength(2);
      expect(where.OR).toContainEqual({ expiresAt: null });
    });

    it("returns whatever the scoped query returned, without a second filter", async () => {
      const own = [
        { id: NOTIFICATION_ID, userId: "user123", title: "Test 1", isRead: false },
        { id: OTHER_ID, userId: "user123", title: "Test 2", isRead: true },
      ];
      vi.mocked(prisma.notification.count).mockResolvedValue(2 as never);
      vi.mocked(prisma.notification.findMany).mockResolvedValue(own as never);

      const result = await getNotifications("user123", { page: 1, pageSize: 25 });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((n) => n.userId === "user123")).toBe(true);
    });

    it("scopes the category counts to the user too", async () => {
      vi.mocked(prisma.notification.groupBy).mockResolvedValue([] as never);

      await getCategoryCounts("user123");

      const where = firstArg(prisma.notification.groupBy).where;
      expect(where).toMatchObject({ userId: "user123", isRead: false });
    });
  });

  describe("Mark Notification as Read", () => {
    it("cannot mark another user's notification", async () => {
      signedIn();
      // Scoped by userId, so somebody else's id matches no row.
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);

      const result = await markNotificationRead(OTHER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Notification not found");
      }
    });

    it("carries the user's own id in the update's filter", async () => {
      signedIn();
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 } as never);

      const result = await markNotificationRead(NOTIFICATION_ID);

      expect(result.success).toBe(true);
      const call = firstArg(prisma.notification.updateMany);
      expect(call.where).toEqual({ id: NOTIFICATION_ID, userId: "user123" });
      expect(call.data).toMatchObject({ isRead: true });
      // It never loads the row first to decide: the filter is the check.
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("marks a notification unread again, and clears the read time with it", async () => {
      signedIn();
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 } as never);

      await markNotificationRead(NOTIFICATION_ID, false);

      const call = firstArg(prisma.notification.updateMany);
      expect(call.where).toEqual({ id: NOTIFICATION_ID, userId: "user123" });
      expect(call.data).toEqual({ isRead: false, readAt: null });
    });

    it("rejects an unauthenticated request", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      const result = await markNotificationRead(NOTIFICATION_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("signed in");
      }
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a malformed id before it reaches the database", async () => {
      signedIn();

      const result = await markNotificationRead("notif1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid notification ID");
      }
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("Mark All Notifications as Read", () => {
    it("only touches the user's own unread notifications", async () => {
      signedIn();
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 } as never);

      const result = await markAllNotificationsRead();

      expect(result.success).toBe(true);
      if (result.success) expect(result.count).toBe(5);

      const call = firstArg(prisma.notification.updateMany);
      expect(call.where).toMatchObject({ userId: "user123", isRead: false });
      expect(call.data).toMatchObject({ isRead: true });
    });

    it('means "all the ones you can see" — an expired one is left alone', async () => {
      signedIn();
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);

      await markAllNotificationsRead();

      const where = firstArg(prisma.notification.updateMany).where as {
        OR?: unknown[];
      };
      expect(where.OR).toContainEqual({ expiresAt: null });
    });

    it("rejects an unauthenticated request without writing anything", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      const result = await markAllNotificationsRead();

      expect(result.success).toBe(false);
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });
});
