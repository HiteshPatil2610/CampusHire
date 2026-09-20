import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Writing, publishing and archiving announcements.
 *
 * The rule under test: a department admin's announcement is their own
 * department's, to its students, whatever the request says — scope comes
 * from the session, never from the client. Publishing is the only thing
 * that notifies, and it notifies once.
 */

vi.mock("@/lib/prisma", () => {
  const tx = {
    announcement: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notification: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      announcement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      department: { findUnique: vi.fn() },
      departmentAdmin: { findUnique: vi.fn() },
      notification: { updateMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAnyRole: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { CREATE: "CREATE", UPDATE: "UPDATE", PUBLISH: "PUBLISH", ARCHIVE: "ARCHIVE" },
  AuditEntityType: { ANNOUNCEMENT: "Announcement" },
}));

vi.mock("@/lib/blob", () => ({
  isAnnouncementAttachmentUrl: (url: string) =>
    url.startsWith("https://x.public.blob.vercel-storage.com/announcements/"),
  uploadAnnouncementAttachment: vi.fn(),
}));

vi.mock("@/features/notifications/producers/announcement-events", () => ({
  notifyAnnouncementPublished: vi.fn(async () => ({ notified: 12 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireAnyRole } from "@/lib/auth";
import { createAuditLogInTransaction } from "@/lib/audit";
import { notifyAnnouncementPublished } from "@/features/notifications/producers/announcement-events";
import {
  archiveAnnouncement,
  publishAnnouncement,
  saveAnnouncement,
} from "../actions/manage-announcement";

const CSE = "dept-cse";
const IT = "dept-it";
const tx = (prisma as unknown as { __tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> }).__tx;

const asDeptAdmin = () => {
  vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-cse", role: "DEPT_ADMIN" } as never);
  vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({
    departmentId: CSE,
    department: { isActive: true },
  } as never);
};

const asSuperAdmin = () => {
  vi.mocked(requireAnyRole).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" } as never);
};

const created = () => tx.announcement.create.mock.calls[0][0] as { data: Record<string, unknown> };

const draft = {
  title: "Pre-placement talk",
  content: "Acme is visiting on Friday.",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.announcement.create.mockResolvedValue({ id: "ann-1", status: "DRAFT", title: draft.title } as never);
  tx.announcement.updateMany.mockResolvedValue({ count: 1 } as never);
  tx.notification.updateMany.mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: CSE } as never);
});

describe("a department admin writes for their own department only", () => {
  it("ignores a department id from the client and uses the session's", async () => {
    asDeptAdmin();

    const result = await saveAnnouncement({ ...draft, departmentId: IT } as never);

    expect(result.success).toBe(true);
    expect(created().data).toMatchObject({ departmentId: CSE, audience: "STUDENTS" });
  });

  it("cannot address admins or the whole institution", async () => {
    asDeptAdmin();

    await saveAnnouncement({ ...draft, audience: "EVERYONE" } as never);

    expect(created().data).toMatchObject({ audience: "STUDENTS", departmentId: CSE });
  });

  it("cannot use the urgent priority, which ignores preferences", async () => {
    asDeptAdmin();

    await saveAnnouncement({ ...draft, priority: "URGENT" } as never);

    expect(created().data).toMatchObject({ priority: "WARNING" });
  });

  it("cannot edit another department's announcement", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-2",
      departmentId: IT,
      status: "PUBLISHED",
    } as never);

    const result = await saveAnnouncement({ ...draft, id: "ann-2" } as never);

    // Not found and not yours read the same.
    expect(result).toEqual({ success: false, error: "Announcement not found." });
    expect(tx.announcement.update).not.toHaveBeenCalled();
  });

  it("cannot publish another department's announcement", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-2",
      departmentId: IT,
      status: "DRAFT",
      expiresAt: null,
    } as never);

    const result = await publishAnnouncement({ id: "ann-2" });

    expect(result).toEqual({ success: false, error: "Announcement not found." });
    expect(notifyAnnouncementPublished).not.toHaveBeenCalled();
  });
});

describe("the Super Admin writes at any scope", () => {
  it("keeps an institution-wide announcement institution-wide", async () => {
    asSuperAdmin();

    await saveAnnouncement({ ...draft, departmentId: null, audience: "EVERYONE", priority: "URGENT" } as never);

    expect(created().data).toMatchObject({
      departmentId: null,
      audience: "EVERYONE",
      priority: "URGENT",
    });
  });

  it("refuses a department that does not exist", async () => {
    asSuperAdmin();
    vi.mocked(prisma.department.findUnique).mockResolvedValue(null as never);

    const result = await saveAnnouncement({ ...draft, departmentId: "nope" } as never);

    expect(result).toEqual({ success: false, error: "Department not found." });
  });
});

describe("a draft notifies nobody; publishing notifies once", () => {
  it("creates a draft without any notification", async () => {
    asDeptAdmin();

    await saveAnnouncement(draft as never);

    expect(created().data).toMatchObject({ status: "DRAFT" });
    expect(notifyAnnouncementPublished).not.toHaveBeenCalled();
  });

  it("publishes now and hands the fan-out the announcement", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      departmentId: CSE,
      status: "DRAFT",
      title: draft.title,
      audience: "STUDENTS",
      batchYears: [],
      priority: "INFO",
      expiresAt: null,
    } as never);

    const result = await publishAnnouncement({ id: "ann-1" });

    expect(result.success).toBe(true);
    expect(tx.announcement.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "ann-1", status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });
    expect(notifyAnnouncementPublished).toHaveBeenCalledWith({
      announcementId: "ann-1",
      actorId: "admin-cse",
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "PUBLISH",
    });
  });

  it("schedules a future one and notifies nobody yet", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      departmentId: CSE,
      status: "DRAFT",
      title: draft.title,
      audience: "STUDENTS",
      batchYears: [],
      priority: "INFO",
      expiresAt: null,
    } as never);

    const result = await publishAnnouncement({
      id: "ann-1",
      publishAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.success).toBe(true);
    expect(tx.announcement.updateMany.mock.calls[0][0]).toMatchObject({
      data: { status: "SCHEDULED" },
    });
    expect(notifyAnnouncementPublished).not.toHaveBeenCalled();
  });

  it("refuses to publish one that is already published", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      departmentId: CSE,
      status: "PUBLISHED",
      expiresAt: null,
    } as never);

    const result = await publishAnnouncement({ id: "ann-1" });

    expect(result).toEqual({ success: false, error: "This announcement is already published." });
    expect(notifyAnnouncementPublished).not.toHaveBeenCalled();
  });

  it("does not let a published announcement's audience change under its readers", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      departmentId: CSE,
      status: "PUBLISHED",
      batchYears: [],
    } as never);
    tx.announcement.update.mockResolvedValue({
      id: "ann-1",
      title: "x",
      status: "PUBLISHED",
      audience: "STUDENTS",
      departmentId: CSE,
      batchYears: [],
      priority: "INFO",
    } as never);

    await saveAnnouncement({ ...draft, id: "ann-1", batchYears: [2027] } as never);

    const data = tx.announcement.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.title).toBe(draft.title);
    expect(data.data.batchYears).toBeUndefined();
    expect(data.data.audience).toBeUndefined();
  });
});

describe("attachments", () => {
  it("refuses a link that was not uploaded here", async () => {
    asDeptAdmin();

    const result = await saveAnnouncement({
      ...draft,
      attachmentUrl: "https://evil.example.com/thing.pdf",
      attachmentName: "thing.pdf",
    } as never);

    expect(result).toEqual({ success: false, error: "That attachment was not uploaded here." });
  });

  it("accepts one from the app's own store", async () => {
    asDeptAdmin();

    const result = await saveAnnouncement({
      ...draft,
      attachmentUrl: "https://x.public.blob.vercel-storage.com/announcements/admin/1.pdf",
      attachmentName: "schedule.pdf",
    } as never);

    expect(result.success).toBe(true);
  });
});

describe("archiving", () => {
  it("archives and stops its notifications pointing at it", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      departmentId: CSE,
      status: "PUBLISHED",
      title: draft.title,
    } as never);

    const result = await archiveAnnouncement({ id: "ann-1" });

    expect(result.success).toBe(true);
    expect(tx.announcement.updateMany.mock.calls[0][0]).toMatchObject({
      data: { status: "ARCHIVED", archivedById: "admin-cse" },
    });
    expect(tx.notification.updateMany.mock.calls[0][0]).toMatchObject({
      where: { resourceType: "Announcement", resourceId: "ann-1" },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "ARCHIVE",
    });
  });

  it("cannot archive another department's announcement", async () => {
    asDeptAdmin();
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-2",
      departmentId: IT,
      status: "PUBLISHED",
    } as never);

    const result = await archiveAnnouncement({ id: "ann-2" });

    expect(result).toEqual({ success: false, error: "Announcement not found." });
  });
});
