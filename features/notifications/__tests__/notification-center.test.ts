import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reading the notification centre: isolation, expiry, filters and the
 * read/unread state.
 *
 * A user sees their own notifications and nobody else's — the scoping is in
 * the query and in the update, not in the UI — and a notification that has
 * expired (a drive that closed, an archived announcement) is not shown or
 * counted.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCategoryCounts, getNotifications } from "../queries/get-notifications";
import { markNotificationRead } from "../actions/mark-notification-read";
import { markAllNotificationsRead } from "../actions/mark-all-notifications-read";
import { setNotificationPreference } from "../actions/set-notification-preference";
import { parseNotificationFilter } from "../schemas/notification";

const ME = "cm00000000000000000000000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1", role: "STUDENT" } as never);
  vi.mocked(prisma.notification.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 } as never);
});

describe("the list a user gets", () => {
  it("is scoped to them and excludes what has expired", async () => {
    await getNotifications("user-1", { page: 1, pageSize: 25 });

    const where = (vi.mocked(prisma.notification.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    }).where;
    expect(where.userId).toBe("user-1");
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: expect.anything() }]);
  });

  it("filters by category in the database, so the page count matches", async () => {
    await getNotifications("user-1", { page: 2, pageSize: 10, category: "RECRUITMENT" });

    const call = vi.mocked(prisma.notification.findMany).mock.calls[0][0] as {
      where: { category?: string };
      skip: number;
      take: number;
    };
    expect(call.where.category).toBe("RECRUITMENT");
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
  });

  it("filters by unread when asked", async () => {
    await getNotifications("user-1", { page: 1, pageSize: 25, isRead: false });

    const where = (vi.mocked(prisma.notification.findMany).mock.calls[0][0] as {
      where: { isRead?: boolean };
    }).where;
    expect(where.isRead).toBe(false);
  });

  it("counts unread per category for the tabs", async () => {
    vi.mocked(prisma.notification.groupBy).mockResolvedValue([
      { category: "DRIVE", _count: { _all: 2 } },
      { category: "SYSTEM", _count: { _all: 1 } },
    ] as never);

    expect(await getCategoryCounts("user-1")).toEqual({ DRIVE: 2, SYSTEM: 1 });
  });

  it("only accepts the filters it knows", () => {
    expect(parseNotificationFilter("recruitment")).toBe("RECRUITMENT");
    expect(parseNotificationFilter("unread")).toBe("unread");
    expect(parseNotificationFilter("../../etc/passwd")).toBe("all");
    expect(parseNotificationFilter(undefined)).toBe("all");
  });
});

describe("read and unread", () => {
  it("marks one read, scoped to the owner", async () => {
    const result = await markNotificationRead(ME);

    expect(result).toEqual({ success: true });
    const call = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as {
      where: { id: string; userId: string };
      data: { isRead: boolean; readAt: Date | null };
    };
    expect(call.where).toEqual({ id: ME, userId: "user-1" });
    expect(call.data.isRead).toBe(true);
    expect(call.data.readAt).toBeInstanceOf(Date);
  });

  it("marks one unread again, clearing when it was read", async () => {
    await markNotificationRead(ME, false);

    const call = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as {
      data: { isRead: boolean; readAt: Date | null };
    };
    expect(call.data).toEqual({ isRead: false, readAt: null });
  });

  it("reports not found for someone else's notification, rather than touching it", async () => {
    // Scoped by userId, so another user's id matches no rows.
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await markNotificationRead(ME);

    expect(result).toEqual({ success: false, error: "Notification not found" });
  });

  it("marks all read for the caller only, and not the expired ones", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 4 } as never);

    const result = await markAllNotificationsRead();

    expect(result).toEqual({ success: true, count: 4 });
    const call = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({ userId: "user-1", isRead: false });
    expect(call.where.OR).toBeDefined();
  });
});

describe("preferences", () => {
  it("lets a student mute an optional event", async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue({} as never);

    const result = await setNotificationPreference({ event: "DRIVE_PUBLISHED", enabled: false });

    expect(result).toEqual({ success: true, muted: ["DRIVE_PUBLISHED"] });
  });

  it("refuses to mute an outcome", async () => {
    const result = await setNotificationPreference({ event: "APPLICATION_SELECTED", enabled: false });

    expect(result).toEqual({ success: false, error: "This notification cannot be turned off." });
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it("refuses an event that belongs to another role", async () => {
    const result = await setNotificationPreference({ event: "APPLICATION_MILESTONE", enabled: false });

    expect(result).toEqual({ success: false, error: "This notification cannot be turned off." });
  });

  it("refuses an event that does not exist", async () => {
    const result = await setNotificationPreference({ event: "DROP TABLE", enabled: false });

    expect(result).toEqual({ success: false, error: "Unknown notification type." });
  });

  it("turns one back on", async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      mutedEvents: ["DRIVE_PUBLISHED", "ANNOUNCEMENT"],
    } as never);
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue({} as never);

    const result = await setNotificationPreference({ event: "DRIVE_PUBLISHED", enabled: true });

    expect(result).toEqual({ success: true, muted: ["ANNOUNCEMENT"] });
  });
});
