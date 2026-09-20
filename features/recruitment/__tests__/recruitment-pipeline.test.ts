import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Configurable, versioned recruitment pipelines.
 *
 *  - Each department drive has its own pipeline of typed stages; nothing is
 *    hard-coded. Application first, Offer last, anything between.
 *  - A change is a new version; applications keep the stage they are in.
 *  - Before publishing, the department edits directly. After, it proposes;
 *    only the Super Admin (never the requester) approves or rejects.
 *  - Stage moves are checked on the server against the drive's own pipeline
 *    and recorded in history. Students only read.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driveDepartmentConfig: { findUnique: vi.fn(), update: vi.fn() },
    recruitmentPipelineVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    recruitmentStage: { findUnique: vi.fn() },
    applicationStageEvent: { create: vi.fn(async () => ({ id: "event-1" })) },
    pipelineChangeRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    driveApplication: { findUnique: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    studentPlacement: { create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: {
    CREATE: "CREATE", UPDATE: "UPDATE", REQUEST: "REQUEST", APPROVE: "APPROVE",
    REJECT: "REJECT", TRANSITION: "TRANSITION",
  },
  AuditEntityType: {
    DRIVE_APPLICATION: "DriveApplication",
    STUDENT_PLACEMENT: "StudentPlacement",
    RECRUITMENT_PIPELINE: "RecruitmentPipelineVersion",
    PIPELINE_CHANGE_REQUEST: "PipelineChangeRequest",
  },
}));

vi.mock("@/lib/notifications", () => ({
  deliverNotification: vi.fn(async () => ({ delivered: 1 })),
  deliverNotificationSafely: vi.fn(async () => ({ delivered: 1 })),
  departmentAdminRecipients: vi.fn(async () => []),
  superAdminRecipients: vi.fn(async () => []),
}));
vi.mock("@/features/notifications/producers/workflow-events", () => ({
  notifyPipelineChangeRequested: vi.fn(),
  notifyPipelineChangeReviewed: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/drives/queries/get-department-drive-eligible-students", () => ({
  getDepartmentDriveEligibleStudents: vi.fn(async () => ({
    totalStudents: 10, eligible: new Array(7).fill({}), ineligibleReasons: [], placedExcluded: 0,
  })),
}));

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLogInTransaction } from "@/lib/audit";
import {
  diffPipelines,
  inferStageType,
  legacyStageFor,
  pipelineFromRounds,
  pipelineKey,
  stageForLegacy,
  validatePipelineStages,
  validatePipelineTransition,
  type StageDefinition,
} from "../domain/pipeline";
import { createPipelineVersion } from "../domain/persist-pipeline";
import {
  proposePipelineChange,
  reviewPipelineChange,
  saveDraftPipeline,
  setPipelineAsSuperAdmin,
} from "../actions/manage-pipeline";
import { getDriveRecruitment } from "../queries/get-drive-recruitment";
import { updateApplicationStage } from "@/features/applications/actions/update-application-stage";

const DRIVE_ID = "drive-1";
const CSE = "dept-cse";

const stages = (...defs: [string, StageDefinition["stageType"], Partial<StageDefinition>?][]) =>
  defs.map(([name, stageType, extra]) => ({ name, stageType, ...extra }));

const TECH_PIPELINE = stages(
  ["Application", "APPLICATION"],
  ["Aptitude", "APTITUDE"],
  ["Technical Interview", "TECHNICAL_INTERVIEW"],
  ["HR Interview", "HR_INTERVIEW"],
  ["Offer", "OFFER"]
);

/** A stored version, as `getActiveVersion` returns it. */
function storedVersion(id: string, version: number, defs = TECH_PIPELINE, configId = "config-cse") {
  const validated = validatePipelineStages(defs);
  if (!validated.ok) throw new Error(validated.errors.join());
  return {
    id,
    version,
    status: "ACTIVE",
    driveDepartmentConfigId: configId,
    stages: validated.stages.map((stage) => ({ ...stage, id: `${id}-s${stage.sortOrder}`, pipelineVersionId: id })),
  };
}

/** A drive the department posted itself: it edits its pipeline until publishing. */
const OWN_DRIVE = { isCentralDrive: false, masterPipeline: null, selectionRounds: "[]" };
/** A Super Admin (master) drive: its stages change only through approval. */
const MASTER_DRIVE = {
  isCentralDrive: true,
  masterPipeline: JSON.stringify(TECH_PIPELINE),
  selectionRounds: JSON.stringify(["Aptitude", "Technical Interview", "HR Interview"]),
};

const deptAdmin = (departmentId = CSE, userId = "admin-cse") => ({
  user: { id: userId },
  department: { id: departmentId, code: departmentId.toUpperCase() },
});

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );
  vi.mocked(prisma.recruitmentPipelineVersion.create).mockImplementation((async (args: {
    data: { version: number; stages: { create: unknown[] } };
  }) => ({ id: "rpv-new", version: args.data.version, stages: args.data.stages.create })) as never);
});

// ---------------------------------------------------------------------------
// Pipelines are configured, not hard-coded
// ---------------------------------------------------------------------------

describe("a pipeline is whatever the drive configures", () => {
  it.each([
    ["Aptitude → Technical → HR", TECH_PIPELINE],
    ["Group Discussion → Technical", stages(["Application", "APPLICATION"], ["GD", "GROUP_DISCUSSION"], ["Technical", "TECHNICAL_INTERVIEW"], ["Offer", "OFFER"])],
    ["Coding → Technical → HR", stages(["Application", "APPLICATION"], ["Coding Test", "CODING"], ["Technical", "TECHNICAL_INTERVIEW"], ["HR", "HR_INTERVIEW"], ["Offer", "OFFER"])],
    ["Direct interview", stages(["Application", "APPLICATION"], ["Direct Interview", "TECHNICAL_INTERVIEW"], ["Offer", "OFFER"])],
    ["every stage type", stages(
      ["Application", "APPLICATION"], ["A", "APTITUDE"], ["B", "CODING"], ["C", "GROUP_DISCUSSION"],
      ["D", "TECHNICAL_INTERVIEW"], ["E", "HR_INTERVIEW"], ["F", "MANAGERIAL_INTERVIEW"], ["G", "PRESENTATION"],
      ["H", "ASSESSMENT"], ["I", "CUSTOM"], ["Offer", "OFFER"])],
  ])("accepts %s", (_label, defs) => {
    const result = validatePipelineStages(defs);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stages.map((s) => s.sortOrder)).toEqual(defs.map((_, i) => i));
  });

  it.each([
    ["no Application first", stages(["Aptitude", "APTITUDE"], ["Offer", "OFFER"])],
    ["no Offer last", stages(["Application", "APPLICATION"], ["HR", "HR_INTERVIEW"])],
    ["two Offers", stages(["Application", "APPLICATION"], ["Offer", "OFFER"], ["Offer 2", "OFFER"])],
    ["a duplicate name", stages(["Application", "APPLICATION"], ["HR", "HR_INTERVIEW"], ["hr", "HR_INTERVIEW"], ["Offer", "OFFER"])],
    ["an unknown type", [{ name: "Application", stageType: "APPLICATION" }, { name: "X", stageType: "HACK" }, { name: "Offer", stageType: "OFFER" }]],
    ["a blank name", stages(["Application", "APPLICATION"], ["   ", "CUSTOM"], ["Offer", "OFFER"])],
    ["a single stage", stages(["Application", "APPLICATION"])],
  ])("refuses %s", (_label, defs) => {
    expect(validatePipelineStages(defs).ok).toBe(false);
  });

  it("keeps the bookends enabled and visible whatever is sent", () => {
    const result = validatePipelineStages([
      { name: "Application", stageType: "APPLICATION", isEnabled: false, visibleToStudents: false },
      { name: "Offer", stageType: "OFFER", isEnabled: false },
    ]);
    expect(result.ok && result.stages.every((s) => s.isEnabled && s.visibleToStudents)).toBe(true);
  });

  it("orders by position only — a client sortOrder is ignored", () => {
    const result = validatePipelineStages([
      { name: "Application", stageType: "APPLICATION", sortOrder: 9 },
      { name: "HR", stageType: "HR_INTERVIEW", sortOrder: 0 },
      { name: "Offer", stageType: "OFFER" },
    ]);
    expect(result.ok && result.stages.map((s) => [s.name, s.sortOrder])).toEqual([
      ["Application", 0], ["HR", 1], ["Offer", 2],
    ]);
  });

  it("builds a first pipeline from free-text rounds, typing what it recognises", () => {
    const built = pipelineFromRounds(["Aptitude Test", "Group Discussion", "Coding Round", "Technical Interview", "HR Interview", "Offer", "Application", "Campus walk"]);
    expect(built.map((s) => [s.name, s.stageType])).toEqual([
      ["Application", "APPLICATION"],
      ["Aptitude Test", "APTITUDE"],
      ["Group Discussion", "GROUP_DISCUSSION"],
      ["Coding Round", "CODING"],
      ["Technical Interview", "TECHNICAL_INTERVIEW"],
      ["HR Interview", "HR_INTERVIEW"],
      ["Campus walk", "CUSTOM"],
      ["Offer", "OFFER"],
    ]);
    expect(validatePipelineStages(built).ok).toBe(true);
    expect(inferStageType("Managerial round")).toBe("MANAGERIAL_INTERVIEW");
  });

  it("maps to the legacy four steps for screens that still read them", () => {
    expect(legacyStageFor("APPLICATION")).toBe("APPLIED");
    expect(legacyStageFor("GROUP_DISCUSSION")).toBe("APTITUDE");
    expect(legacyStageFor("HR_INTERVIEW")).toBe("INTERVIEW");
    expect(legacyStageFor("OFFER")).toBe("OFFER");
  });

  it("places pre-pipeline applications by their legacy stage, never defaulting to Offer", () => {
    const pipeline = validatePipelineStages(TECH_PIPELINE);
    if (!pipeline.ok) throw new Error();
    const at = (legacy: "APPLIED" | "APTITUDE" | "INTERVIEW" | "OFFER") => stageForLegacy(pipeline.stages, legacy).name;
    expect([at("APPLIED"), at("APTITUDE"), at("INTERVIEW"), at("OFFER")]).toEqual([
      "Application", "Aptitude", "Technical Interview", "Offer",
    ]);
    const bare = validatePipelineStages(stages(["Application", "APPLICATION"], ["Offer", "OFFER"]));
    if (!bare.ok) throw new Error();
    expect(stageForLegacy(bare.stages, "INTERVIEW").stageType).toBe("APPLICATION");
  });

  it("describes a change stage by stage for the audit log", () => {
    const next = stages(
      ["Application", "APPLICATION"], ["Coding", "CODING"], ["HR Interview", "HR_INTERVIEW"],
      ["Technical Interview", "TECHNICAL_INTERVIEW", { isEnabled: false }], ["Offer", "OFFER"]
    );
    const a = validatePipelineStages(TECH_PIPELINE);
    const b = validatePipelineStages(next);
    if (!a.ok || !b.ok) throw new Error();
    expect(diffPipelines(a.stages, b.stages)).toMatchObject({
      added: ["Coding"],
      removed: ["Aptitude"],
      deactivated: ["Technical Interview"],
      reordered: true,
    });
    expect(pipelineKey(a.stages)).not.toBe(pipelineKey(b.stages));
  });
});

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

describe("versioning", () => {
  it("supersedes the active version and creates the next one", async () => {
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue({ version: 3 } as never);
    const validated = validatePipelineStages(TECH_PIPELINE);
    if (!validated.ok) throw new Error();

    const created = await createPipelineVersion(prisma as never, "config-cse", validated.stages, {
      actorId: "u1", note: "test",
    });

    expect(prisma.recruitmentPipelineVersion.updateMany).toHaveBeenCalledWith({
      where: { driveDepartmentConfigId: "config-cse", status: "ACTIVE" },
      data: { status: "SUPERSEDED", supersededAt: expect.any(Date) },
    });
    expect(created.version).toBe(4);
    // The legacy rounds follow the pipeline.
    expect(prisma.driveDepartmentConfig.update).toHaveBeenCalledWith({
      where: { id: "config-cse" },
      data: { selectionRounds: JSON.stringify(["Aptitude", "Technical Interview", "HR Interview"]) },
    });
  });

  it("an application in an older version stays put, can take an outcome there, and joins the new version when moved", () => {
    const v1 = storedVersion("v1", 1);
    const v2 = storedVersion("v2", 2, stages(["Application", "APPLICATION"], ["Coding", "CODING"], ["Offer", "OFFER"]));
    const inV1 = v1.stages[2]; // Technical Interview, v1
    const base = { currentStatus: "IN_PROGRESS" as const, currentStage: inV1, activeVersionId: v2.id };

    // Reject where they stand, in v1.
    expect(validatePipelineTransition({ ...base, target: inV1, nextStatus: "REJECTED" }).valid).toBe(true);
    // Move into v2.
    expect(validatePipelineTransition({ ...base, target: v2.stages[1], nextStatus: "IN_PROGRESS" }).valid).toBe(true);
    // But not to another v1 stage — that version is history.
    expect(validatePipelineTransition({ ...base, target: v1.stages[3], nextStatus: "IN_PROGRESS" }).valid).toBe(false);
  });

  it("keeps the existing outcome rules", () => {
    const v = storedVersion("v1", 1);
    const base = { currentStage: v.stages[0], activeVersionId: v.id };
    expect(validatePipelineTransition({ ...base, currentStatus: "IN_PROGRESS", target: v.stages[2], nextStatus: "SELECTED" }).valid).toBe(false);
    expect(validatePipelineTransition({ ...base, currentStatus: "IN_PROGRESS", target: v.stages[4], nextStatus: "SELECTED" }).valid).toBe(true);
    expect(validatePipelineTransition({ ...base, currentStatus: "SELECTED", target: v.stages[2], nextStatus: "IN_PROGRESS" }).valid).toBe(false);
    expect(validatePipelineTransition({ ...base, currentStatus: "IN_PROGRESS", target: v.stages[2], nextStatus: "WITHDRAWN" }).valid).toBe(false);
    expect(
      validatePipelineTransition({ ...base, currentStatus: "IN_PROGRESS", target: { ...v.stages[2], isEnabled: false }, nextStatus: "IN_PROGRESS" }).valid
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Direct edits before publishing; proposals after
// ---------------------------------------------------------------------------

describe("department admin edits", () => {
  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(deptAdmin() as never);
  });

  it("before publishing, saves directly as a new version", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: null, status: "CONFIGURED", driveId: DRIVE_ID,
      selectionRounds: null, drive: OWN_DRIVE,
    } as never);
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue(null);

    const result = await saveDraftPipeline({ driveId: DRIVE_ID, stages: TECH_PIPELINE });

    expect(result.success).toBe(true);
    expect(prisma.recruitmentPipelineVersion.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "CREATE", entityType: "RecruitmentPipelineVersion",
    });
  });

  it("after publishing, cannot save directly — it must be proposed", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: new Date(), status: "PUBLISHED", driveId: DRIVE_ID,
      selectionRounds: null, drive: OWN_DRIVE,
    } as never);

    const result = await saveDraftPipeline({ driveId: DRIVE_ID, stages: TECH_PIPELINE });

    expect(result.success).toBe(false);
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
    expect(prisma.recruitmentPipelineVersion.updateMany).not.toHaveBeenCalled();
  });

  it("a proposal waits as PENDING and changes nothing", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: new Date(), status: "PUBLISHED", driveId: DRIVE_ID,
      selectionRounds: null, drive: OWN_DRIVE,
    } as never);
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue(storedVersion("v1", 1) as never);
    vi.mocked(prisma.pipelineChangeRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.pipelineChangeRequest.create).mockResolvedValue({ id: "req-1" } as never);

    const proposed = stages(["Application", "APPLICATION"], ["Coding", "CODING"], ["Offer", "OFFER"]);
    const result = await proposePipelineChange({ driveId: DRIVE_ID, stages: proposed, reason: "Company added a coding round" });

    expect(result).toEqual({ success: true, id: "req-1" });
    const [call] = vi.mocked(prisma.pipelineChangeRequest.create).mock.calls;
    expect((call[0] as { data: Record<string, unknown> }).data).toMatchObject({
      driveDepartmentConfigId: "config-cse",
      baseVersionId: "v1",
      requestedById: "admin-cse",
      reason: "Company added a coding round",
    });
    // Not active: no version written.
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
    expect(prisma.recruitmentPipelineVersion.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a second proposal while one is pending, one without a reason, and a no-op", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: new Date(), status: "PUBLISHED", driveId: DRIVE_ID,
      selectionRounds: null, drive: OWN_DRIVE,
    } as never);
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue(storedVersion("v1", 1) as never);
    const proposed = stages(["Application", "APPLICATION"], ["Coding", "CODING"], ["Offer", "OFFER"]);

    vi.mocked(prisma.pipelineChangeRequest.findFirst).mockResolvedValue({ id: "req-0" } as never);
    expect((await proposePipelineChange({ driveId: DRIVE_ID, stages: proposed, reason: "Another change" })).success).toBe(false);

    vi.mocked(prisma.pipelineChangeRequest.findFirst).mockResolvedValue(null);
    expect((await proposePipelineChange({ driveId: DRIVE_ID, stages: proposed, reason: "" })).success).toBe(false);
    expect((await proposePipelineChange({ driveId: DRIVE_ID, stages: TECH_PIPELINE, reason: "Nothing changes" })).success).toBe(false);

    expect(prisma.pipelineChangeRequest.create).not.toHaveBeenCalled();
  });

  it("a Super Admin drive's stages are never edited directly — not even before publishing", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: null, status: "CONFIGURED", driveId: DRIVE_ID,
      selectionRounds: null, drive: MASTER_DRIVE,
    } as never);

    const result = await saveDraftPipeline({ driveId: DRIVE_ID, stages: TECH_PIPELINE });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Propose a change/);
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
  });

  it("before publishing, a Super Admin drive takes a proposal against the master's stages", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: null, status: "CONFIGURED", driveId: DRIVE_ID,
      selectionRounds: null, drive: MASTER_DRIVE,
    } as never);
    // No pipeline of its own yet: version 1 is copied from the master first,
    // so the proposal has a base the approval can be checked against.
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recruitmentPipelineVersion.create).mockResolvedValue(storedVersion("v1", 1) as never);
    vi.mocked(prisma.pipelineChangeRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.pipelineChangeRequest.create).mockResolvedValue({ id: "req-9" } as never);

    const proposed = stages(["Application", "APPLICATION"], ["Group Discussion", "GROUP_DISCUSSION"], ["Offer", "OFFER"]);
    const result = await proposePipelineChange({ driveId: DRIVE_ID, stages: proposed, reason: "We run a GD first" });

    expect(result).toEqual({ success: true, id: "req-9" });
    const [created] = vi.mocked(prisma.recruitmentPipelineVersion.create).mock.calls;
    const versionData = (created[0] as { data: { stages: { create: { name: string }[] } } }).data;
    expect(versionData.stages.create.map((stage) => stage.name)).toEqual(
      TECH_PIPELINE.map((stage) => stage.name)
    );
    const [request] = vi.mocked(prisma.pipelineChangeRequest.create).mock.calls;
    expect((request[0] as { data: Record<string, unknown> }).data).toMatchObject({ baseVersionId: "v1" });
    // The inherited copy never becomes a rounds override on the instance.
    expect(prisma.driveDepartmentConfig.update).not.toHaveBeenCalled();
  });

  it("a cancelled drive takes no proposal", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: new Date(), status: "CANCELLED", driveId: DRIVE_ID,
      selectionRounds: null, drive: MASTER_DRIVE,
    } as never);

    const proposed = stages(["Application", "APPLICATION"], ["Coding", "CODING"], ["Offer", "OFFER"]);
    const result = await proposePipelineChange({ driveId: DRIVE_ID, stages: proposed, reason: "Anything at all" });

    expect(result.success).toBe(false);
    expect(prisma.pipelineChangeRequest.create).not.toHaveBeenCalled();
  });

  it("cannot touch another department's drive — the instance comes from the session", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(null);

    const result = await saveDraftPipeline({ driveId: DRIVE_ID, stages: TECH_PIPELINE });

    expect(result.success).toBe(false);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.findUnique).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({
      driveId_departmentId: { driveId: DRIVE_ID, departmentId: CSE },
    });
  });
});

// ---------------------------------------------------------------------------
// Super Admin review
// ---------------------------------------------------------------------------

describe("Super Admin review", () => {
  const pending = {
    id: "req-1",
    status: "PENDING",
    driveDepartmentConfigId: "config-cse",
    baseVersionId: "v1",
    requestedById: "admin-cse",
    proposedStages: JSON.stringify(stages(["Application", "APPLICATION"], ["Coding", "CODING"], ["Offer", "OFFER"])),
    departmentDrive: {
      id: "config-cse",
      driveId: DRIVE_ID,
      departmentId: CSE,
      department: { code: "CSE" },
      drive: { companyName: "Acme" },
    },
  };

  beforeEach(() => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "super-1" } as never);
    vi.mocked(prisma.pipelineChangeRequest.findUnique).mockResolvedValue(pending as never);
    vi.mocked(prisma.pipelineChangeRequest.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockImplementation((async (args: { orderBy?: unknown }) =>
      args.orderBy ? { version: 1 } : storedVersion("v1", 1)) as never);
  });

  it("approval creates the next version and marks the request approved", async () => {
    const result = await reviewPipelineChange({ requestId: "req-1", decision: "APPROVE" });

    expect(result).toEqual({ success: true, id: "rpv-new" });
    expect(prisma.recruitmentPipelineVersion.updateMany).toHaveBeenCalled();
    const [call] = vi.mocked(prisma.pipelineChangeRequest.updateMany).mock.calls;
    expect(call[0]).toMatchObject({
      where: { id: "req-1", status: "PENDING" },
      data: { status: "APPROVED", reviewedById: "super-1", resultingVersionId: "rpv-new" },
    });
  });

  it("rejection needs a reason and leaves the pipeline exactly as it was", async () => {
    expect((await reviewPipelineChange({ requestId: "req-1", decision: "REJECT" })).success).toBe(false);

    const result = await reviewPipelineChange({ requestId: "req-1", decision: "REJECT", note: "Not agreed with the company" });

    expect(result.success).toBe(true);
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
    expect(prisma.recruitmentPipelineVersion.updateMany).not.toHaveBeenCalled();
    const [call] = vi.mocked(prisma.pipelineChangeRequest.updateMany).mock.calls;
    expect(call[0]).toMatchObject({ data: { status: "REJECTED", reviewNote: "Not agreed with the company" } });
  });

  it("a department admin cannot approve — not even their own request", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));

    const result = await reviewPipelineChange({ requestId: "req-1", decision: "APPROVE" });

    expect(result.success).toBe(false);
    expect(prisma.pipelineChangeRequest.updateMany).not.toHaveBeenCalled();
  });

  it("nobody reviews their own request", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "admin-cse" } as never);

    const result = await reviewPipelineChange({ requestId: "req-1", decision: "APPROVE" });

    expect(result.success).toBe(false);
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
  });

  it("refuses to approve a proposal based on a superseded version", async () => {
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue(storedVersion("v2", 2) as never);

    const result = await reviewPipelineChange({ requestId: "req-1", decision: "APPROVE" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/changed since/);
    expect(prisma.recruitmentPipelineVersion.create).not.toHaveBeenCalled();
  });

  it("refuses a request already decided", async () => {
    vi.mocked(prisma.pipelineChangeRequest.findUnique).mockResolvedValue({ ...pending, status: "REJECTED" } as never);
    expect((await reviewPipelineChange({ requestId: "req-1", decision: "APPROVE" })).success).toBe(false);
  });

  it("can change a published pipeline directly, with a reason, audited", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", driveId: DRIVE_ID, department: { code: "CSE" },
    } as never);

    expect((await setPipelineAsSuperAdmin({ driveDepartmentConfigId: "config-cse", stages: TECH_PIPELINE, note: "" })).success).toBe(false);
    const result = await setPipelineAsSuperAdmin({
      driveDepartmentConfigId: "config-cse", stages: TECH_PIPELINE, note: "Company schedule change",
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      entityType: "RecruitmentPipelineVersion",
    });
  });
});

// ---------------------------------------------------------------------------
// Moving an application
// ---------------------------------------------------------------------------

describe("moving an application through the pipeline", () => {
  const active = storedVersion("v1", 1);
  const application = {
    id: "claaaaaaaaaaaaaaaaaaaaaaa",
    stage: "APPLIED",
    status: "IN_PROGRESS",
    currentStage: { id: active.stages[0].id, name: "Application", pipelineVersionId: "v1" },
    student: { id: "student-1", departmentId: CSE, userId: "user-1" },
    drive: {
      id: DRIVE_ID, companyName: "ABC", roleName: "SE", packageOffered: "8", packageDisplay: "8 LPA",
      departmentId: CSE, isCentralDrive: false,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
      departmentConfigs: [{ id: "config-cse", roleName: null }],
    },
  };
  const stageRow = (index: number, configId = "config-cse", versionId = "v1") => ({
    ...active.stages[index],
    pipelineVersionId: versionId,
    pipelineVersion: { driveDepartmentConfigId: configId, version: 1 },
  });

  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(deptAdmin() as never);
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(application as never);
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue({ id: "v1" } as never);
  });

  it("moves to a configured stage and records the history", async () => {
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(stageRow(2) as never);

    const result = await updateApplicationStage({
      applicationId: application.id, stageId: active.stages[2].id, status: "IN_PROGRESS", note: "Cleared aptitude",
    });

    expect(result.success).toBe(true);
    const [update] = vi.mocked(prisma.driveApplication.update).mock.calls;
    expect((update[0] as { data: Record<string, unknown> }).data).toMatchObject({
      currentStageId: active.stages[2].id,
      stage: "INTERVIEW",
      status: "IN_PROGRESS",
    });
    const [event] = vi.mocked(prisma.applicationStageEvent.create).mock.calls;
    expect((event[0] as { data: Record<string, unknown> }).data).toEqual({
      applicationId: application.id,
      pipelineVersionId: "v1",
      fromStageId: active.stages[0].id,
      toStageId: active.stages[2].id,
      fromStatus: "IN_PROGRESS",
      toStatus: "IN_PROGRESS",
      actorId: "admin-cse",
      note: "Cleared aptitude",
    });
  });

  it("refuses to move an application of a cancelled drive, leaving it as it was", async () => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue({
      ...application,
      drive: {
        ...application.drive,
        departmentConfigs: [{ id: "config-cse", roleName: null, status: "CANCELLED" }],
      },
    } as never);
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(stageRow(2) as never);

    const result = await updateApplicationStage({
      applicationId: application.id, stageId: active.stages[2].id, status: "IN_PROGRESS",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/cancelled/);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
    expect(prisma.applicationStageEvent.create).not.toHaveBeenCalled();
  });

  it("refuses a stage id that does not exist", async () => {
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(null);
    const result = await updateApplicationStage({ applicationId: application.id, stageId: "forged", status: "IN_PROGRESS" });
    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("refuses a stage of another department's (or another drive's) pipeline", async () => {
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(stageRow(2, "config-ece") as never);
    const result = await updateApplicationStage({ applicationId: application.id, stageId: active.stages[2].id, status: "IN_PROGRESS" });
    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("refuses an admin of another department", async () => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(deptAdmin("dept-ece", "admin-ece") as never);
    const result = await updateApplicationStage({ applicationId: application.id, stageId: active.stages[2].id, status: "IN_PROGRESS" });
    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("refuses a stage of a superseded version", async () => {
    vi.mocked(prisma.recruitmentPipelineVersion.findFirst).mockResolvedValue({ id: "v2" } as never);
    vi.mocked(prisma.recruitmentStage.findUnique).mockResolvedValue(stageRow(3) as never);
    const result = await updateApplicationStage({ applicationId: application.id, stageId: active.stages[3].id, status: "IN_PROGRESS" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

describe("counts derive from the configured stages", () => {
  it("counts per configured stage, including an older version's, without stage names in code", async () => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(deptAdmin() as never);
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-cse", lockedAt: new Date(), selectionRounds: null, drive: OWN_DRIVE,
    } as never);
    const v1 = { ...storedVersion("v1", 1), status: "SUPERSEDED", createdBy: null, createdAt: new Date(), note: null };
    const v2 = {
      ...storedVersion("v2", 2, stages(["Application", "APPLICATION"], ["Group Discussion", "GROUP_DISCUSSION"], ["Offer", "OFFER"])),
      createdBy: null, createdAt: new Date(), note: null,
    };
    vi.mocked(prisma.recruitmentPipelineVersion.findMany).mockResolvedValue([v2, v1] as never);
    vi.mocked(prisma.pipelineChangeRequest.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.studentPlacement.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.driveApplication.groupBy).mockResolvedValue([
      { currentStageId: v2.stages[1].id, status: "IN_PROGRESS", _count: { _all: 5 } },
      { currentStageId: v2.stages[0].id, status: "IN_PROGRESS", _count: { _all: 4 } },
      { currentStageId: v1.stages[2].id, status: "IN_PROGRESS", _count: { _all: 3 } },
      { currentStageId: v2.stages[2].id, status: "SELECTED", _count: { _all: 2 } },
      { currentStageId: v2.stages[1].id, status: "REJECTED", _count: { _all: 1 } },
    ] as never);

    const result = await getDriveRecruitment(DRIVE_ID);

    expect(result.counts).toMatchObject({ eligible: 7, applied: 15, shortlisted: 8, selected: 2, rejected: 1, placed: 2 });
    const byName = Object.fromEntries(result.counts.byStage.map((row) => [`${row.name}@v${row.version}`, row]));
    expect(byName["Group Discussion@v2"]).toMatchObject({ inProgress: 5, rejected: 1, active: true });
    expect(byName["Technical Interview@v1"]).toMatchObject({ inProgress: 3, active: false });
    expect(byName["Offer@v2"]).toMatchObject({ selected: 2 });
  });
});

// ---------------------------------------------------------------------------
// Integrity outside the actions
// ---------------------------------------------------------------------------

describe("what the database and the code guarantee", () => {
  const sql = readFileSync(
    join(process.cwd(), "prisma/migrations/20260924000000_recruitment_pipeline/migration.sql"),
    "utf8"
  );

  it("forbids self-review, a second pending request and edits to history", () => {
    expect(sql).toContain('"reviewedById" IS NULL OR "reviewedById" <> "requestedById"');
    expect(sql).toMatch(/UNIQUE INDEX "PipelineChangeRequest_one_pending"[\s\S]*WHERE "status" = 'PENDING'/);
    expect(sql).toMatch(/UNIQUE INDEX "RecruitmentPipelineVersion_one_active"[\s\S]*WHERE "status" = 'ACTIVE'/);
    expect(sql).toContain('BEFORE UPDATE ON "RecruitmentStage"');
    expect(sql).toContain('BEFORE UPDATE ON "ApplicationStageEvent"');
    expect(sql).toContain('OLD."currentStageId" IS NOT NULL');
  });

  it("students have no path that writes a stage", () => {
    for (const file of [
      "features/applications/actions/apply-to-drive.ts",
      "features/students/actions/profile-personal.ts",
      "features/students/actions/set-placement-opt-in.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/driveApplication\.update|applicationStageEvent\.create\(\{[^}]*fromStageId: [^n]/);
    }
    // updateApplicationStage is department-admin only.
    const action = readFileSync(join(process.cwd(), "features/applications/actions/update-application-stage.ts"), "utf8");
    expect(action).toContain("await requireDepartmentAdmin()");
  });
});
