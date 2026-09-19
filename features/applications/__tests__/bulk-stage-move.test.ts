import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Unit 6 — bulk stage moves: validation before applying, per-application
 * results with every failure reported, department scoping whatever ids the
 * client sends, and one audit entry for the operation.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driveApplication: { findMany: vi.fn() },
    recruitmentStage: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: { TRANSITION: "TRANSITION" },
  AuditEntityType: { DRIVE: "Drive" },
}));

vi.mock("../domain/move-application", () => ({
  moveApplication: vi.fn(),
  revalidateApplicationViews: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { moveApplication } from "../domain/move-application";
import {
  bulkUpdateApplicationStage,
  validateBulkStageMove,
} from "../actions/bulk-update-application-stage";
import { MAX_BULK_MOVES } from "../domain/bulk-limits";

const DRIVE_ID = "drive-1";
const CSE = "dept-cse";
const admin = {
  user: { id: "user-admin" },
  department: { id: CSE, code: "CSE" },
};

const app = (id: string, name: string) => ({
  id,
  student: { name, rollNumber: `R-${id}` },
});

const input = (ids: string[], extra: object = {}) => ({
  driveId: DRIVE_ID,
  applicationIds: ids,
  stageId: "stage-tech",
  status: "IN_PROGRESS" as const,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDepartmentAdmin).mockResolvedValue(admin as never);
  vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue({ name: "Technical" } as never);
  vi.mocked(moveApplication).mockResolvedValue({ success: true });
});

describe("bulk stage move", () => {
  it("judges each application through the same function a single move uses", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha"), app("a2", "Ravi")] as never);

    const result = await bulkUpdateApplicationStage(input(["a1", "a2"], { note: "Cleared aptitude" }));

    expect(result).toMatchObject({ success: true, dryRun: false, moved: 2, failed: 0 });
    expect(moveApplication).toHaveBeenCalledTimes(2);
    expect(moveApplication).toHaveBeenCalledWith(
      admin,
      { applicationId: "a1", stageId: "stage-tech", status: "IN_PROGRESS", note: "Cleared aptitude" },
      { dryRun: false, revalidate: false }
    );
  });

  it("dry run checks everything and writes nothing", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha")] as never);

    const result = await validateBulkStageMove(input(["a1"]));

    expect(result).toMatchObject({ success: true, dryRun: true, moved: 1 });
    expect(moveApplication).toHaveBeenCalledWith(admin, expect.anything(), { dryRun: true, revalidate: false });
    // No audit entry and no revalidation for a check.
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("reports every failure with its reason — a partial failure is never hidden", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
      app("a1", "Asha"),
      app("a2", "Ravi"),
      app("a3", "Meera"),
    ] as never);
    vi.mocked(moveApplication)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "A selection is final." })
      .mockRejectedValueOnce(new Error("database went away"));

    const result = await bulkUpdateApplicationStage(input(["a1", "a2", "a3"]));

    expect(result).toMatchObject({ success: true, moved: 1, failed: 2 });
    if (!result.success) return;
    expect(result.outcomes.map((outcome) => [outcome.studentName, outcome.ok, outcome.error])).toEqual([
      ["Asha", true, undefined],
      ["Ravi", false, "A selection is final."],
      ["Meera", false, "Something went wrong moving this application."],
    ]);
  });

  it("an id that is not this department's or this drive's is 'not found' and never reaches a move", async () => {
    // Only a1 comes back from the department-and-drive scoped lookup.
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha")] as never);

    const result = await bulkUpdateApplicationStage(input(["a1", "other-dept-app"]));

    const [call] = vi.mocked(prisma.driveApplication.findMany).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({
      id: { in: ["a1", "other-dept-app"] },
      driveId: DRIVE_ID,
      student: { departmentId: CSE },
    });
    expect(moveApplication).toHaveBeenCalledTimes(1);
    if (!result.success) throw new Error("expected success");
    expect(result.outcomes.find((outcome) => outcome.applicationId === "other-dept-app")).toMatchObject({
      ok: false,
      error: "Application not found.",
    });
  });

  it("takes the department from the session, never from the request", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha")] as never);

    await bulkUpdateApplicationStage({ ...input(["a1"]), departmentId: "dept-it" } as never);

    const [call] = vi.mocked(prisma.driveApplication.findMany).mock.calls;
    expect((call[0] as { where: { student: unknown } }).where.student).toEqual({ departmentId: CSE });
  });

  it("audits the whole operation once, with counts and the failures", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha"), app("a2", "Ravi")] as never);
    vi.mocked(moveApplication)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "No change to apply." });

    await bulkUpdateApplicationStage(input(["a1", "a2"]));

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createAuditLog).mock.calls[0][0]).toMatchObject({
      action: "TRANSITION",
      entityType: "Drive",
      entityId: DRIVE_ID,
      metadata: {
        event: "bulk-stage-move",
        departmentCode: "CSE",
        toStage: "Technical",
        requested: 2,
        moved: 1,
        failed: 1,
        failures: ["R-a2: No change to apply."],
      },
    });
  });

  it("refuses SELECTED (a placement is made one student at a time), an empty batch and an oversized one", async () => {
    expect((await bulkUpdateApplicationStage(input(["a1"], { status: "SELECTED" }))).success).toBe(false);
    expect((await bulkUpdateApplicationStage(input([]))).success).toBe(false);
    const tooMany = Array.from({ length: MAX_BULK_MOVES + 1 }, (_, index) => `a${index}`);
    expect((await bulkUpdateApplicationStage(input(tooMany))).success).toBe(false);
    expect(moveApplication).not.toHaveBeenCalled();
  });

  it("counts a repeated id once", async () => {
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([app("a1", "Asha")] as never);
    await bulkUpdateApplicationStage(input(["a1", "a1", "a1"]));
    expect(moveApplication).toHaveBeenCalledTimes(1);
  });

  it("is department admin only", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(new AuthorizationError("This action requires DEPT_ADMIN role."));

    const result = await bulkUpdateApplicationStage(input(["a1"]));

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.findMany).not.toHaveBeenCalled();
    expect(moveApplication).not.toHaveBeenCalled();
  });

  it("the single move and the bulk move share one implementation", () => {
    const single = readFileSync(join(__dirname, "../actions/update-application-stage.ts"), "utf8");
    const bulk = readFileSync(join(__dirname, "../actions/bulk-update-application-stage.ts"), "utf8");
    expect(single).toMatch(/moveApplication\(/);
    expect(bulk).toMatch(/moveApplication\(/);
    // No second copy of the transition rules.
    expect(single).not.toMatch(/validatePipelineTransition/);
    expect(bulk).not.toMatch(/validatePipelineTransition/);
  });
});

describe("the workspace UI never hard-codes a pipeline", () => {
  it("names no universal stage and offers the configured ones", () => {
    const source = readFileSync(
      join(__dirname, "../components/drive-applications-workspace.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/["'`](Aptitude|Technical|HR|Offer)["'`]/);
    expect(source).toMatch(/stages\.map\(/);
  });

  it("selecting is confirmed before a student is placed", () => {
    const control = readFileSync(join(__dirname, "../components/application-stage-control.tsx"), "utf8");
    expect(control).toMatch(/PlacementConfirmDialog/);
    expect(control).toMatch(/if \(draftStatus === "SELECTED"\)/);
  });
});
