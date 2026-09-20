import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The fan-out record: idempotency, delivery state and retry.
 *
 * A fan-out runs once per key. One that fails is recorded with its error and
 * alerts the Super Admins; one that was abandoned mid-run can be claimed
 * again; one that succeeded is never re-run.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationDispatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: { count: vi.fn(async () => 3) },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { NOTIFY: "NOTIFY", NOTIFY_FAILED: "NOTIFY_FAILED", RETRY: "RETRY" },
  AuditEntityType: { NOTIFICATION_DISPATCH: "NotificationDispatch" },
}));

vi.mock("@/lib/notifications", () => ({
  deliverNotificationSafely: vi.fn(async () => ({ delivered: 1 })),
  superAdminRecipients: vi.fn(async () => [{ userId: "super-1" }]),
}));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLogInTransaction } from "@/lib/audit";
import { deliverNotificationSafely } from "@/lib/notifications";
import { runNotificationDispatch, STALE_AFTER_MS } from "../domain/dispatch";

/** What Prisma throws when the dispatch key is already taken. */
const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.0",
  });

const spec = {
  key: "drive-published:d1:cse",
  event: "DRIVE_PUBLISHED" as const,
  payload: { driveId: "d1", departmentIds: ["cse"] },
  triggeredById: "admin-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notificationDispatch.create).mockResolvedValue({
    id: "dispatch-1",
    attempts: 1,
  } as never);
  vi.mocked(prisma.notificationDispatch.update).mockResolvedValue({} as never);
  vi.mocked(prisma.notification.count).mockResolvedValue(3 as never);
});

describe("a fan-out runs once per key", () => {
  it("records the dispatch, runs it and marks it sent", async () => {
    const run = vi.fn(async () => 3);

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome).toEqual({ status: "SENT", delivered: 3, dispatchId: "dispatch-1" });
    expect(run).toHaveBeenCalledWith({ dispatchId: "dispatch-1" });
    expect(vi.mocked(prisma.notificationDispatch.update).mock.calls[0][0]).toMatchObject({
      where: { id: "dispatch-1" },
      data: { status: "SENT", recipientCount: 3 },
    });
    // The generated notifications are audited, with who caused them.
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "NOTIFY",
      entityType: "NotificationDispatch",
    });
  });

  it("does nothing when the same key already succeeded", async () => {
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(uniqueViolation());
    vi.mocked(prisma.notificationDispatch.findUnique).mockResolvedValue({
      id: "dispatch-1",
      status: "SENT",
      attempts: 1,
      updatedAt: new Date(),
    } as never);
    const run = vi.fn(async () => 3);

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome.status).toBe("SKIPPED");
    expect(run).not.toHaveBeenCalled();
  });

  it("does nothing while another attempt is still running", async () => {
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(uniqueViolation());
    vi.mocked(prisma.notificationDispatch.findUnique).mockResolvedValue({
      id: "dispatch-1",
      status: "PENDING",
      attempts: 1,
      updatedAt: new Date(),
    } as never);
    const run = vi.fn(async () => 3);

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome.status).toBe("SKIPPED");
    expect(run).not.toHaveBeenCalled();
  });

  it("claims one that was abandoned mid-run, and counts the attempt", async () => {
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(uniqueViolation());
    vi.mocked(prisma.notificationDispatch.findUnique).mockResolvedValue({
      id: "dispatch-1",
      status: "PENDING",
      attempts: 1,
      updatedAt: new Date(Date.now() - STALE_AFTER_MS - 1000),
    } as never);
    vi.mocked(prisma.notificationDispatch.updateMany).mockResolvedValue({ count: 1 } as never);
    const run = vi.fn(async () => 2);

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome.status).toBe("SENT");
    expect(vi.mocked(prisma.notificationDispatch.updateMany).mock.calls[0][0]).toMatchObject({
      data: { status: "RETRYING", attempts: { increment: 1 } },
    });
    // A claim that another process won first would have matched nothing.
    expect(vi.mocked(prisma.notificationDispatch.updateMany).mock.calls[0][0]).toMatchObject({
      where: { id: "dispatch-1", status: "PENDING" },
    });
  });

  it("does not run when another process wins the claim", async () => {
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(uniqueViolation());
    vi.mocked(prisma.notificationDispatch.findUnique).mockResolvedValue({
      id: "dispatch-1",
      status: "FAILED",
      attempts: 2,
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.notificationDispatch.updateMany).mockResolvedValue({ count: 0 } as never);
    const run = vi.fn(async () => 1);

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome.status).toBe("SKIPPED");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("a failed fan-out is recorded, not hidden", () => {
  it("marks it failed with the error, audits it and alerts the Super Admins", async () => {
    const run = vi.fn(async () => {
      throw new Error("database unreachable");
    });

    const outcome = await runNotificationDispatch(spec, run);

    expect(outcome).toEqual({ status: "FAILED", delivered: 0, dispatchId: "dispatch-1" });
    expect(vi.mocked(prisma.notificationDispatch.update).mock.calls[0][0]).toMatchObject({
      data: { status: "FAILED", lastError: "database unreachable" },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "NOTIFY_FAILED",
    });
    expect(vi.mocked(deliverNotificationSafely).mock.calls[0][0]).toMatchObject({
      event: "SYSTEM_ALERT",
      role: "SUPER_ADMIN",
      dedupeKey: "dispatch-failed:dispatch-1:1",
    });
  });

  it("never fails the change that triggered it", async () => {
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(new Error("no table"));

    const outcome = await runNotificationDispatch(spec, vi.fn(async () => 1));

    expect(outcome).toEqual({ status: "FAILED", delivered: 0, dispatchId: null });
  });
});
