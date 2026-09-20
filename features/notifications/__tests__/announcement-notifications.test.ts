import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The notifications an announcement generates.
 *
 * The announcement is the record; the notifications only point at it. Who
 * gets one is decided from the announcement's own targeting, so it matches
 * who can open it — and an announcement archived before its fan-out ran
 * notifies nobody.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: { findUnique: vi.fn() },
    student: { findMany: vi.fn() },
    departmentAdmin: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    notificationDispatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { NOTIFY: "NOTIFY", NOTIFY_FAILED: "NOTIFY_FAILED", RETRY: "RETRY" },
  AuditEntityType: { NOTIFICATION_DISPATCH: "NotificationDispatch" },
}));

import { prisma } from "@/lib/prisma";
import { fanOutAnnouncement, notifyAnnouncementPublished } from "../producers/announcement-events";
import { primeDeliveryMocks } from "./delivery-test-helpers";

const CSE = "dept-cse";

const announcement = (overrides: object = {}) => ({
  id: "ann-1",
  title: "Pre-placement talk",
  content: "Acme is visiting on Friday.",
  audience: "STUDENTS",
  departmentId: CSE,
  batchYears: [] as number[],
  priority: "INFO",
  expiresAt: null,
  status: "PUBLISHED",
  authorId: "admin-cse",
  department: { code: "CSE" },
  author: { name: "CSE Admin", email: "cse@example.com", role: "DEPT_ADMIN" },
  ...overrides,
});

const rows = () =>
  vi
    .mocked(prisma.notification.createMany)
    .mock.calls.flatMap(
      (call) => (call[0] as { data: Record<string, unknown>[] }).data
    );

beforeEach(() => {
  vi.clearAllMocks();
  primeDeliveryMocks(prisma as never);
  vi.mocked(prisma.student.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValue([] as never);
});

describe("who an announcement notifies", () => {
  it("notifies the students of its department, and nobody else", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(announcement() as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      { userId: "user-s1" },
      { userId: "user-s2" },
    ] as never);
    // The Super Admins are told a department published something.
    vi.mocked(prisma.user.findMany).mockImplementation((async (args: unknown) => {
      const where = (args as { where: { id?: { in?: string[] }; role: string } }).where;
      if (where.role === "SUPER_ADMIN" && !where.id) return [];
      return (where.id?.in ?? []).map((id) => ({ id, notificationPreference: null }));
    }) as never);

    const delivered = await fanOutAnnouncement("ann-1", "dispatch-1");

    expect(delivered).toBe(2);
    const query = vi.mocked(prisma.student.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(query.where).toMatchObject({ departmentId: CSE, isPending: false });
    expect(rows().map((row) => row.userId)).toEqual(["user-s1", "user-s2"]);
    expect(rows()[0]).toMatchObject({
      event: "ANNOUNCEMENT",
      category: "ANNOUNCEMENT",
      dedupeKey: "announcement:ann-1",
      actionUrl: "/student-dashboard/announcements/ann-1",
    });
  });

  it("narrows to the batches it targets", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(
      announcement({ batchYears: [2026] }) as never
    );

    await fanOutAnnouncement("ann-1", "dispatch-1");

    const query = vi.mocked(prisma.student.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(query.where).toMatchObject({ batchYear: { in: [2026] } });
  });

  it("reaches every department when it is institution-wide", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(
      announcement({ departmentId: null, department: null }) as never
    );

    await fanOutAnnouncement("ann-1", "dispatch-1");

    const query = vi.mocked(prisma.student.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(query.where.departmentId).toBeUndefined();
  });

  it("notifies admins, not students, when it is addressed to admins", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(
      announcement({ audience: "ADMINS" }) as never
    );
    vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValue([
      { userId: "admin-cse" },
    ] as never);

    await fanOutAnnouncement("ann-1", "dispatch-1");

    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(rows()[0]).toMatchObject({
      userId: "admin-cse",
      actionUrl: "/admin-dashboard/announcements/ann-1",
    });
  });

  it("carries the announcement's priority and expiry onto its notifications", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(
      announcement({ priority: "URGENT", expiresAt }) as never
    );
    vi.mocked(prisma.student.findMany).mockResolvedValue([{ userId: "user-s1" }] as never);

    await fanOutAnnouncement("ann-1", "dispatch-1");

    expect(rows()[0]).toMatchObject({ priority: "URGENT", expiresAt });
  });

  it("notifies nobody for an announcement that was archived first", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(
      announcement({ status: "ARCHIVED" }) as never
    );

    expect(await fanOutAnnouncement("ann-1", "dispatch-1")).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("notifies nobody for an announcement that no longer exists", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(null as never);

    expect(await fanOutAnnouncement("ann-1", "dispatch-1")).toBe(0);
  });
});

describe("publishing an announcement twice", () => {
  it("is one fan-out, keyed by the announcement", async () => {
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(announcement() as never);

    await notifyAnnouncementPublished({ announcementId: "ann-1", actorId: "admin-cse" });

    const dispatch = vi.mocked(prisma.notificationDispatch.create).mock.calls[0][0] as {
      data: { key: string; payload: string };
    };
    expect(dispatch.data.key).toBe("announcement:ann-1");
    expect(JSON.parse(dispatch.data.payload)).toEqual({ announcementId: "ann-1" });
  });
});
