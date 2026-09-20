import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `deliverNotification` — the one writer of notifications.
 *
 * What is asserted here is what every producer then inherits: the event
 * registry decides the category and priority, a notification can only reach
 * a user who holds the role the event is defined for, a muted event is
 * skipped unless it is mandatory or urgent, and the same event delivered
 * twice writes one row.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), upsert: vi.fn() },
    departmentAdmin: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  deliverNotification,
  deliverNotificationSafely,
  departmentAdminRecipients,
  superAdminRecipients,
} from "@/lib/notifications";

const users = (
  rows: { id: string; muted?: string[] }[]
) =>
  vi.mocked(prisma.user.findMany).mockImplementation((async (args: unknown) => {
    const where = (args as { where: { id: { in: string[] }; role: string } }).where;
    return rows
      .filter((row) => where.id.in.includes(row.id))
      .map((row) => ({
        id: row.id,
        notificationPreference: row.muted ? { mutedEvents: row.muted } : null,
      }));
  }) as never);

const written = () =>
  (vi.mocked(prisma.notification.createMany).mock.calls[0]?.[0] as
    | { data: Record<string, unknown>[] }
    | undefined)?.data ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notification.createMany).mockImplementation((async (args: unknown) => ({
    count: ((args as { data: unknown[] }).data ?? []).length,
  })) as never);
});

describe("the event registry decides the notification, not the caller", () => {
  it("writes the event's category, priority and legacy type", async () => {
    users([{ id: "u1" }]);

    const result = await deliverNotification(prisma, {
      event: "APPLICATION_SELECTED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "Selected", message: "You were selected", actionUrl: "/student-dashboard" },
      dedupeKey: "stage-event:1",
    });

    expect(result).toEqual({ delivered: 1 });
    expect(written()[0]).toMatchObject({
      userId: "u1",
      event: "APPLICATION_SELECTED",
      category: "RECRUITMENT",
      priority: "SUCCESS",
      type: "APPLICATION",
      dedupeKey: "stage-event:1",
      actionUrl: "/student-dashboard",
    });
  });

  it("refuses to deliver an event to a role it is not defined for", async () => {
    users([{ id: "u1" }]);

    await expect(
      deliverNotification(prisma, {
        event: "PIPELINE_CHANGE_REQUESTED", // Super Admin only
        role: "STUDENT",
        recipients: [{ userId: "u1" }],
        content: { title: "x", message: "y" },
        dedupeKey: "k",
      })
    ).rejects.toThrow(/not defined for STUDENT/);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("drops a recipient who does not hold that role", async () => {
    // The query is by id AND role, so an admin's id passed as a student
    // simply does not come back.
    users([{ id: "student-1" }]);

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "student-1" }, { userId: "admin-1" }],
      content: { title: "New drive", message: "Acme" },
      dedupeKey: "drive-published:d1",
    });

    expect(result.delivered).toBe(1);
    expect(written().map((row) => row.userId)).toEqual(["student-1"]);
  });

  it("keeps a link only when it is an in-app path", async () => {
    users([{ id: "u1" }]);

    await deliverNotification(prisma, {
      event: "ANNOUNCEMENT",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "t", message: "m", actionUrl: "https://example.com/phish" },
      dedupeKey: "announcement:a1",
    });

    expect(written()[0]).toMatchObject({ actionUrl: null });
  });

  it("lets a recipient have their own message, for a per-department fan-out", async () => {
    users([{ id: "u1" }, { id: "u2" }]);

    await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "u1", message: "Acme is hiring for SDE" }, { userId: "u2" }],
      content: { title: "New drive", message: "Acme is hiring" },
      dedupeKey: "drive-published:d1",
    });

    expect(written().map((row) => row.message)).toEqual([
      "Acme is hiring for SDE",
      "Acme is hiring",
    ]);
  });
});

describe("preferences", () => {
  it("skips an event the recipient muted", async () => {
    users([{ id: "u1", muted: ["DRIVE_PUBLISHED"] }, { id: "u2" }]);

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }, { userId: "u2" }],
      content: { title: "New drive", message: "Acme" },
      dedupeKey: "drive-published:d1",
    });

    expect(result.delivered).toBe(1);
    expect(written().map((row) => row.userId)).toEqual(["u2"]);
  });

  it("delivers a mandatory event even to someone who tried to mute it", async () => {
    users([{ id: "u1", muted: ["APPLICATION_REJECTED"] }]);

    const result = await deliverNotification(prisma, {
      event: "APPLICATION_REJECTED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "Not selected", message: "…" },
      dedupeKey: "stage-event:2",
    });

    expect(result.delivered).toBe(1);
  });

  it("delivers an urgent announcement even to someone who muted announcements", async () => {
    users([{ id: "u1", muted: ["ANNOUNCEMENT"] }]);

    const result = await deliverNotification(prisma, {
      event: "ANNOUNCEMENT",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "Campus closed", message: "…" },
      priority: "URGENT",
      dedupeKey: "announcement:a1",
    });

    expect(result.delivered).toBe(1);
    expect(written()[0]).toMatchObject({ priority: "URGENT" });
  });

  it("does not let an ordinary event be raised to URGENT to bypass a mute", async () => {
    users([{ id: "u1", muted: ["DRIVE_PUBLISHED"] }]);

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "New drive", message: "Acme" },
      priority: "URGENT",
      dedupeKey: "drive-published:d1",
    });

    expect(result.delivered).toBe(0);
  });
});

describe("idempotency", () => {
  it("writes with the dedupe key and skips duplicates", async () => {
    users([{ id: "u1" }]);

    await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "New drive", message: "Acme" },
      dedupeKey: "drive-published:d1",
    });

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: { dedupeKey: string }[];
      skipDuplicates: boolean;
    };
    expect(call.skipDuplicates).toBe(true);
    expect(call.data[0].dedupeKey).toBe("drive-published:d1");
  });

  it("reports what the database actually inserted, not what it was offered", async () => {
    users([{ id: "u1" }, { id: "u2" }]);
    // Both already had this notification: the unique index drops them.
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: "u1" }, { userId: "u2" }],
      content: { title: "New drive", message: "Acme" },
      dedupeKey: "drive-published:d1",
    });

    expect(result.delivered).toBe(0);
  });

  it("refreshes one row instead of skipping, for a daily digest", async () => {
    users([{ id: "admin-1" }]);
    vi.mocked(prisma.notification.upsert).mockResolvedValue({} as never);

    await deliverNotification(prisma, {
      event: "NEW_APPLICATIONS",
      role: "DEPT_ADMIN",
      recipients: [{ userId: "admin-1" }],
      content: { title: "New applications", message: "3 applications today" },
      dedupeKey: "new-applications:d1:2026-09-20",
      collapse: true,
    });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    const upsert = vi.mocked(prisma.notification.upsert).mock.calls[0][0] as {
      where: { userId_dedupeKey: { userId: string; dedupeKey: string } };
      update: { isRead: boolean };
    };
    expect(upsert.where.userId_dedupeKey).toEqual({
      userId: "admin-1",
      dedupeKey: "new-applications:d1:2026-09-20",
    });
    expect(upsert.update.isRead).toBe(false);
  });

  it("delivers nothing when there is nobody to deliver to", async () => {
    users([]);

    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [],
      content: { title: "New drive", message: "Acme" },
      dedupeKey: "drive-published:d1",
    });

    expect(result).toEqual({ delivered: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("recipient resolution", () => {
  it("takes a department's admins from the database, by department", async () => {
    vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValue([
      { userId: "admin-cse" },
    ] as never);

    const recipients = await departmentAdminRecipients("dept-cse", "admin-self");

    expect(recipients).toEqual([{ userId: "admin-cse" }]);
    expect(vi.mocked(prisma.departmentAdmin.findMany).mock.calls[0][0]).toMatchObject({
      where: { departmentId: "dept-cse", userId: { not: "admin-self" } },
    });
  });

  it("takes the Super Admins by role, and can leave out the actor", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "super-2" }] as never);

    const recipients = await superAdminRecipients("super-1");

    expect(recipients).toEqual([{ userId: "super-2" }]);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { role: "SUPER_ADMIN", id: { not: "super-1" } },
    });
  });

  it("swallows a delivery failure when the change has already happened", async () => {
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("database down"));

    const result = await deliverNotificationSafely({
      event: "ACCOUNT_UPDATE",
      role: "STUDENT",
      recipients: [{ userId: "u1" }],
      content: { title: "Approved", message: "…" },
      dedupeKey: "access-decided:1",
    });

    expect(result).toEqual({ delivered: 0 });
  });
});
