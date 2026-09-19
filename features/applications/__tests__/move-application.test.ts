import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `moveApplication` itself — the one implementation behind single and bulk
 * moves. The dry run (a bulk move's validation pass) must judge exactly like
 * a real move and must write nothing.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driveApplication: { findUnique: vi.fn(), update: vi.fn() },
    recruitmentStage: { findUnique: vi.fn() },
    recruitmentPipelineVersion: { findFirst: vi.fn() },
    applicationStageEvent: { create: vi.fn() },
    studentPlacement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: { CREATE: "CREATE", TRANSITION: "TRANSITION" },
  AuditEntityType: { DRIVE_APPLICATION: "DriveApplication", STUDENT_PLACEMENT: "StudentPlacement" },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
  NotificationType: { APPLICATION: "APPLICATION" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { moveApplication } from "../domain/move-application";

const CSE = "dept-cse";
const actor = { user: { id: "u-cse" }, department: { id: CSE } };

const application = (extra: object = {}) => ({
  id: "app-1",
  stage: "APPLIED",
  status: "IN_PROGRESS",
  currentStage: { id: "st-app", name: "Application", pipelineVersionId: "v1" },
  student: { id: "s1", departmentId: CSE, userId: "user-s1" },
  drive: {
    id: "drive-1",
    companyName: "Acme",
    roleName: "SE",
    packageOffered: "12",
    packageDisplay: "12 LPA",
    departmentId: null,
    isCentralDrive: true,
    lifecycleStatus: "PUBLISHED",
    eligibleDepartmentLinks: [{ departmentId: CSE }],
    departmentConfigs: [{ id: "config-cse", roleName: null, status: "PUBLISHED" }],
  },
  ...extra,
});

const target = {
  id: "st-code",
  name: "Coding",
  stageType: "CODING",
  isEnabled: true,
  pipelineVersionId: "v1",
  pipelineVersion: { driveDepartmentConfigId: "config-cse", version: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(application() as never);
  vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(target as never);
  vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue({ id: "v1" } as never);
});

const move = { applicationId: "app-1", stageId: "st-code", status: "IN_PROGRESS" as const };

describe("moveApplication", () => {
  it("a real move writes the application, its history, the audit row and tells the student", async () => {
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => unknown) => fn(prisma)
    );

    const result = await moveApplication(actor, move);

    expect(result).toEqual({ success: true });
    expect(prisma.driveApplication.update).toHaveBeenCalledTimes(1);
    expect(prisma.applicationStageEvent.create).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("a dry run reaches the same verdict but writes and notifies nothing", async () => {
    const result = await moveApplication(actor, move, { dryRun: true });

    expect(result).toEqual({ success: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
    expect(prisma.applicationStageEvent.create).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("a dry run refuses what a real move would refuse", async () => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(
      application({ status: "SELECTED" }) as never
    );

    const dry = await moveApplication(actor, move, { dryRun: true });
    const real = await moveApplication(actor, move);

    expect(dry.success).toBe(false);
    expect(real).toEqual(dry);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("refuses an applicant of another department, in a dry run as in a real move", async () => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(
      application({ student: { id: "s2", departmentId: "dept-it", userId: null } }) as never
    );

    await expect(moveApplication(actor, move, { dryRun: true })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(moveApplication(actor, move)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("refuses a stage of another department's pipeline", async () => {
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue({
      ...target,
      pipelineVersion: { driveDepartmentConfigId: "config-it", version: 1 },
    } as never);

    const result = await moveApplication(actor, move, { dryRun: true });

    expect(result).toMatchObject({ success: false });
  });
});
