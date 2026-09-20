import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The department admin's "remind eligible students".
 *
 * It is the existing notification machinery: the same audience as the publish
 * announcement (the evaluator, this department, placement exclusion), the same
 * per-student key as the automatic closing-soon reminder, one fan-out per drive
 * per day. Students who already applied are never reminded.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { driveDepartmentConfig: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async () => undefined),
  AuditAction: { REMIND: "REMIND" },
  AuditEntityType: { DRIVE: "Drive" },
}));
vi.mock("@/lib/notifications", () => ({ deliverNotification: vi.fn(async () => ({ delivered: 2 })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../domain/dispatch", () => ({ runNotificationDispatch: vi.fn() }));
vi.mock("../domain/drive-recipients", () => ({
  loadDriveForAudience: vi.fn(),
  resolveDriveAudience: vi.fn(),
  applicantRecipients: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { deliverNotification } from "@/lib/notifications";
import { runNotificationDispatch } from "../domain/dispatch";
import { applicantRecipients, loadDriveForAudience, resolveDriveAudience } from "../domain/drive-recipients";
import { fanOutDeadlineReminder, sendDeadlineReminder } from "../actions/send-deadline-reminder";

const CSE = "dept-cse";
const future = new Date(Date.now() + 2 * 86_400_000);

const instance = (overrides: object = {}) => ({
  status: "PUBLISHED",
  applicationDeadline: future,
  drive: { companyName: "Acme", lifecycleStatus: "PUBLISHED", applicationDeadline: future },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDepartmentAdmin).mockResolvedValue({
    user: { id: "admin-cse" },
    department: { id: CSE, code: "CSE" },
  } as never);
  vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(instance() as never);
  vi.mocked(runNotificationDispatch).mockResolvedValue({ status: "SENT", delivered: 2, dispatchId: "x" });
});

describe("who can send one", () => {
  it("refuses a drive the department does not run, as not found", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(null as never);

    const result = await sendDeadlineReminder({ driveId: "d1" });

    expect(result).toEqual({ success: false, error: "Drive not found in your department." });
    expect(runNotificationDispatch).not.toHaveBeenCalled();
  });

  it("looks the instance up by the session's department, never a request's", async () => {
    await sendDeadlineReminder({ driveId: "d1" });

    expect(vi.mocked(prisma.driveDepartmentConfig.findUnique).mock.calls[0][0]).toMatchObject({
      where: { driveId_departmentId: { driveId: "d1", departmentId: CSE } },
    });
  });

  it("refuses a drive that is not published", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance({ status: "CONFIGURED" }) as never
    );

    expect((await sendDeadlineReminder({ driveId: "d1" })).success).toBe(false);
    expect(runNotificationDispatch).not.toHaveBeenCalled();
  });

  it("refuses a cancelled drive", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance({ drive: { companyName: "Acme", lifecycleStatus: "CANCELLED", applicationDeadline: future } }) as never
    );

    expect((await sendDeadlineReminder({ driveId: "d1" })).success).toBe(false);
  });

  it("refuses once applications have closed", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance({ applicationDeadline: new Date(Date.now() - 1000) }) as never
    );

    const result = await sendDeadlineReminder({ driveId: "d1" });

    expect(result).toEqual({ success: false, error: "Applications for this drive have closed." });
  });
});

describe("how it is sent", () => {
  it("is a keyed fan-out, at most once a day per drive and department", async () => {
    await sendDeadlineReminder({ driveId: "d1" });

    const spec = vi.mocked(runNotificationDispatch).mock.calls[0][0];
    expect(spec.key).toMatch(/^deadline-nudge:d1:dept-cse:\d{4}-\d{2}-\d{2}$/);
    expect(spec.event).toBe("DRIVE_DEADLINE");
    expect(spec.payload).toEqual({ kind: "reminder", driveId: "d1", departmentId: CSE });
  });

  it("says so when today's reminder already went out", async () => {
    vi.mocked(runNotificationDispatch).mockResolvedValue({ status: "SKIPPED", delivered: 0, dispatchId: null });

    const result = await sendDeadlineReminder({ driveId: "d1" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("already went out today");
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("reports a failure instead of claiming it was sent", async () => {
    vi.mocked(runNotificationDispatch).mockResolvedValue({ status: "FAILED", delivered: 0, dispatchId: "x" });

    const result = await sendDeadlineReminder({ driveId: "d1" });

    expect(result.success).toBe(false);
  });

  it("is audited with the drive, the department and how many were told", async () => {
    await sendDeadlineReminder({ driveId: "d1" });

    expect(vi.mocked(createAuditLog).mock.calls[0][0]).toMatchObject({
      action: "REMIND",
      entityId: "d1",
      metadata: { departmentCode: "CSE", notified: 2 },
    });
  });
});

describe("who it reaches", () => {
  const drive = { id: "d1", companyName: "Acme" };

  beforeEach(() => {
    vi.mocked(loadDriveForAudience).mockResolvedValue(drive as never);
    vi.mocked(resolveDriveAudience).mockResolvedValue({
      eligible: [
        { userId: "u1", departmentId: CSE, roleName: "SDE" },
        { userId: "u2", departmentId: CSE, roleName: "SDE" },
        { userId: "u3", departmentId: CSE, roleName: "SDE" },
      ],
      missingAcademic: [],
      resolvedByDepartment: new Map([[CSE, { roleName: "SDE", applicationDeadline: future }]]),
    } as never);
    vi.mocked(applicantRecipients).mockResolvedValue([{ userId: "u2", departmentId: CSE }] as never);
  });

  it("takes the audience from the shared evaluator, for this department only", async () => {
    await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1");

    expect(resolveDriveAudience).toHaveBeenCalledWith(drive, [CSE]);
    expect(applicantRecipients).toHaveBeenCalledWith("d1", [CSE]);
  });

  it("leaves out students who already applied", async () => {
    await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1");

    const call = vi.mocked(deliverNotification).mock.calls[0][1];
    expect(call.recipients).toEqual([{ userId: "u1" }, { userId: "u3" }]);
    expect(call.role).toBe("STUDENT");
  });

  it("shares the automatic reminder's key, so nobody is reminded twice", async () => {
    await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1");

    expect(vi.mocked(deliverNotification).mock.calls[0][1].dedupeKey).toBe(
      `deadline-reminder:d1:${future.toISOString()}`
    );
  });

  it("expires with the deadline", async () => {
    await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1");

    expect(vi.mocked(deliverNotification).mock.calls[0][1].expiresAt).toEqual(future);
  });

  it("notifies nobody once the deadline has passed by the time it runs", async () => {
    vi.mocked(resolveDriveAudience).mockResolvedValue({
      eligible: [{ userId: "u1", departmentId: CSE, roleName: "SDE" }],
      missingAcademic: [],
      resolvedByDepartment: new Map([[CSE, { roleName: "SDE", applicationDeadline: new Date(Date.now() - 1000) }]]),
    } as never);

    expect(await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1")).toBe(0);
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  it("notifies nobody when the department has not published it", async () => {
    vi.mocked(resolveDriveAudience).mockResolvedValue({
      eligible: [],
      missingAcademic: [],
      resolvedByDepartment: new Map(),
    } as never);

    expect(await fanOutDeadlineReminder({ driveId: "d1", departmentId: CSE }, "dispatch-1")).toBe(0);
  });
});
