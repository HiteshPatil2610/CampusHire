import { describe, it, expect, vi, beforeEach } from "vitest";
import { endOfIndiaDay, indiaDay } from "../domain/drive-window";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Unit 4 — the Master Drive → Department Drive workflow.
 *
 * Super Admin edit permissions (LOCKED / EDITABLE, enforced on the server),
 * the master recruitment pipeline, step completion and publish validation
 * (one function for both), the student preview built by the student
 * resolver, cancellation, and the controlled deadline extension.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    driveDepartmentConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    department: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
    recruitmentPipelineVersion: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    driveApplication: { findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    driveApplicationSnapshot: { update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
  requireAnyRole: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: {
    CREATE: "CREATE", UPDATE: "UPDATE", CANCEL: "CANCEL", EXTEND_DEADLINE: "EXTEND_DEADLINE",
  },
  AuditEntityType: { DRIVE: "Drive", RECRUITMENT_PIPELINE: "RecruitmentPipelineVersion" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/notifications/actions/notify-drive-lifecycle", () => ({
  notifyDriveCancelled: vi.fn(async () => ({ notified: 3 })),
  notifyDeadlineExtended: vi.fn(async () => ({ notified: 5 })),
}));

vi.mock("../domain/persist-drive", () => ({
  createDriveWithEligibility: vi.fn(async (data: { companyName: string; roleName: string }) => ({
    id: "drive-new",
    ...data,
  })),
  auditDriveWrite: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireAnyRole, requireDepartmentAdmin, requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLogInTransaction } from "@/lib/audit";
import {
  notifyDeadlineExtended,
  notifyDriveCancelled,
} from "@/features/notifications/actions/notify-drive-lifecycle";
import { createDriveWithEligibility } from "../domain/persist-drive";
import {
  canTransitionDepartmentDrive,
  canTransitionMaster,
  findLockedOverrideAttempts,
  normalizeEditableFields,
} from "../domain/drive-lifecycle";
import {
  departmentDriveReadiness,
  type ReadinessInput,
} from "../domain/department-drive-readiness";
import { buildStudentDriveView, STUDENT_VIEW_INSTANCE_INCLUDE } from "../domain/student-drive-view";
import {
  initialDepartmentPipeline,
  masterPipelineStages,
} from "@/features/recruitment/domain/master-pipeline";
import { catalogField } from "../domain/application-form";
import { postDrive } from "../actions/drive-form-actions";
import {
  extendDepartmentDriveDeadline,
  saveMasterPipeline,
  setDepartmentEditPermissions,
} from "../actions/manage-master-drive";
import {
  cancelDepartmentDrive,
  cancelDepartmentDriveAsSuperAdmin,
  cancelMasterDrive,
} from "../actions/cancel-drive";
import { getDepartmentDrivePreview } from "../queries/get-department-drive-preview";

const DRIVE_ID = "drive-1";
const CSE = "dept-cse";
const IT = "dept-it";
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

const superAdmin = { id: "user-super" };
const cseAdmin = {
  user: { id: "user-cse" },
  department: { id: CSE, code: "CSE", name: "Computer" },
};

const TECH_STAGES = [
  { name: "Application", stageType: "APPLICATION" },
  { name: "Aptitude", stageType: "APTITUDE" },
  { name: "Technical Interview", stageType: "TECHNICAL_INTERVIEW" },
  { name: "Offer", stageType: "OFFER" },
];

/** A master drive as Prisma returns it. */
const masterDrive = (extra: Record<string, unknown> = {}) => ({
  id: DRIVE_ID,
  departmentId: null,
  createdByUserId: "user-super",
  isCentralDrive: true,
  lifecycleStatus: "PUBLISHED",
  companyName: "Acme",
  companyLogoUrl: null,
  roleName: "Software Engineer",
  jobDescriptionUrl: null,
  jobDescriptionText: "Build services",
  requirements: "Java",
  skills: JSON.stringify(["Java"]),
  packageOffered: "12.00",
  packageDisplay: "12 LPA",
  selectionRounds: JSON.stringify(["Aptitude", "Technical Interview"]),
  masterPipeline: JSON.stringify(TECH_STAGES),
  departmentEditableFields: ["roleName"],
  nextStageDate: inDays(20),
  applicationStartDate: new Date("2026-01-01T00:00:00Z"),
  applicationDeadline: inDays(10),
  applyMethod: "IN_APP",
  externalApplyUrl: null,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  venue: null,
  reportingTime: null,
  contactPerson: null,
  contactPhone: null,
  pptLink: null,
  applicationFields: null,
  cancelledAt: null,
  cancelledById: null,
  cancellationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  eligibilityRules: [],
  eligibleDepartmentLinks: [{ departmentId: CSE }],
  ...extra,
});

/** A department instance as Prisma returns it. */
const instanceRow = (extra: Record<string, unknown> = {}) => ({
  id: "config-cse",
  driveId: DRIVE_ID,
  departmentId: CSE,
  status: "CONFIGURED",
  assignedAt: new Date(),
  publishedAt: null,
  publishedByUserId: null,
  lockedAt: null,
  cancelledAt: null,
  cancelledById: null,
  cancellationReason: null,
  roleName: null,
  jobDescriptionText: null,
  requirements: null,
  skills: null,
  nextStageDate: null,
  applicationDeadline: null,
  selectionRounds: null,
  minCGPA: null,
  maxActiveBacklogs: null,
  venue: "Main Hall",
  reportingTime: "09:00",
  coordinatorName: null,
  coordinatorPhone: null,
  coordinatorEmail: null,
  seatingAllocation: null,
  pptLink: null,
  specialInstructions: null,
  applicationFields: null,
  createdAt: new Date(),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  eligibilityRules: [
    { ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: ["2027"] },
  ],
  formFields: [],
  department: { code: "CSE" },
  drive: { companyName: "Acme" },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );
  vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as never);
  vi.mocked(requireDepartmentAdmin).mockResolvedValue(cseAdmin as never);
  vi.mocked(prisma.drive.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.driveDepartmentConfig.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([]);
  vi.mocked(prisma.student.findMany).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Admin edit permissions
// ---------------------------------------------------------------------------

describe("admin edit permissions: LOCKED unless the Super Admin opened a field", () => {
  it("only accepts known fields, once each, in a fixed order", () => {
    expect(normalizeEditableFields(["skills", "roleName", "roleName", "minCGPA", "venue"])).toEqual([
      "roleName",
      "skills",
    ]);
    expect(normalizeEditableFields("roleName")).toEqual([]);
  });

  it("finds an override of a locked field, but not a clear or an unchanged value", () => {
    const current = { roleName: "Old role", skills: null };
    expect(findLockedOverrideAttempts(["skills"], current, { roleName: "New role" })).toEqual(["roleName"]);
    // Clearing back to the master's value is always allowed.
    expect(findLockedOverrideAttempts([], current, { roleName: null })).toEqual([]);
    // Resubmitting what is stored is not an edit.
    expect(findLockedOverrideAttempts([], current, { roleName: "Old role" })).toEqual([]);
    // An opened field may change freely.
    expect(findLockedOverrideAttempts(["roleName"], current, { roleName: "New role" })).toEqual([]);
  });

  it("only the Super Admin sets them", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));

    const result = await setDepartmentEditPermissions({ driveId: DRIVE_ID, editableFields: ["roleName"] });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("refuses a field that is not a master content field", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(masterDrive() as never);

    const result = await setDepartmentEditPermissions({
      driveId: DRIVE_ID,
      editableFields: ["minCGPA"] as never,
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("locking a field clears unpublished departments' overrides of it, audited", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(
      masterDrive({ departmentEditableFields: ["roleName", "skills"] }) as never
    );
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      instanceRow({ roleName: "CSE role" }),
      instanceRow({ id: "config-it", roleName: null, department: { code: "IT" } }),
    ] as never);

    const result = await setDepartmentEditPermissions({ driveId: DRIVE_ID, editableFields: ["skills"] });

    expect(result.success).toBe(true);
    expect(prisma.drive.update).toHaveBeenCalledWith({
      where: { id: DRIVE_ID },
      data: { departmentEditableFields: ["skills"] },
    });
    // Only unpublished instances are even considered.
    expect(vi.mocked(prisma.driveDepartmentConfig.findMany).mock.calls[0][0]).toMatchObject({
      where: { driveId: DRIVE_ID, lockedAt: null },
    });
    // CSE had overridden the role: cleared. IT had not: untouched.
    expect(prisma.driveDepartmentConfig.update).toHaveBeenCalledTimes(1);
    expect(prisma.driveDepartmentConfig.update).toHaveBeenCalledWith({
      where: { id: "config-cse" },
      data: { roleName: null },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      metadata: { before: ["roleName", "skills"], after: ["skills"], overridesCleared: ["CSE: roleName"] },
    });
  });
});

// ---------------------------------------------------------------------------
// The master recruitment pipeline
// ---------------------------------------------------------------------------

describe("the master recruitment pipeline", () => {
  it("is what a department drive starts from, and falls back to the rounds", () => {
    const withStages = initialDepartmentPipeline(masterDrive() as never, null);
    expect(withStages.map((stage) => stage.name)).toEqual(TECH_STAGES.map((stage) => stage.name));

    const legacy = initialDepartmentPipeline(
      { masterPipeline: null, selectionRounds: JSON.stringify(["HR"]) },
      { selectionRounds: JSON.stringify(["GD", "HR"]) }
    );
    // No master stages: this department's own legacy rounds, as before.
    expect(legacy.map((stage) => stage.name)).toEqual(["Application", "GD", "HR", "Offer"]);
  });

  it("never trusts a stored value it cannot validate", () => {
    const stages = masterPipelineStages({
      masterPipeline: JSON.stringify([{ name: "Offer", stageType: "OFFER" }]),
      selectionRounds: JSON.stringify(["Aptitude"]),
    });
    expect(stages.map((stage) => stage.name)).toEqual(["Application", "Aptitude", "Offer"]);
  });

  it("is saved by the Super Admin and followed only by unpublished, unchanged department drives", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(masterDrive() as never);
    const version = (id: string, names: string[]) => ({
      id,
      version: 1,
      stages: names.map((name, index) => ({
        name,
        stageType: index === 0 ? "APPLICATION" : index === names.length - 1 ? "OFFER" : "APTITUDE",
        isEnabled: true,
        visibleToStudents: true,
        description: null,
        instructions: null,
        location: null,
        scheduledAt: null,
        sortOrder: index,
      })),
    });
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      // Still exactly the master's stages: follows.
      {
        id: "config-cse",
        department: { code: "CSE" },
        pipelineVersions: [
          { ...version("v-cse", []), stages: masterPipelineStages(masterDrive() as never) },
        ],
      },
      // Diverged through an approved proposal: keeps its own.
      { id: "config-it", department: { code: "IT" }, pipelineVersions: [version("v-it", ["Application", "GD", "Offer"])] },
      // No version yet: will be built from the master when needed.
      { id: "config-me", department: { code: "ME" }, pipelineVersions: [] },
    ] as never);
    vi.mocked(prisma.recruitmentPipelineVersion.create).mockResolvedValue({ id: "v-new", version: 2 } as never);

    const next = [...TECH_STAGES.slice(0, 3), { name: "HR Interview", stageType: "HR_INTERVIEW" }, TECH_STAGES[3]];
    const result = await saveMasterPipeline({ driveId: DRIVE_ID, stages: next });

    expect(result.success).toBe(true);
    const driveUpdate = vi.mocked(prisma.drive.update).mock.calls[0][0] as unknown as { data: Record<string, string> };
    expect(JSON.parse(driveUpdate.data.masterPipeline).map((stage: { name: string }) => stage.name)).toContain("HR Interview");
    expect(JSON.parse(driveUpdate.data.selectionRounds)).toEqual(["Aptitude", "Technical Interview", "HR Interview"]);
    // Unpublished department drives only, by query.
    expect(vi.mocked(prisma.driveDepartmentConfig.findMany).mock.calls[0][0]).toMatchObject({
      where: { lockedAt: null, status: { in: ["ASSIGNED", "CONFIGURED"] } },
    });
    // CSE followed; IT and ME did not get a version.
    expect(prisma.recruitmentPipelineVersion.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.recruitmentPipelineVersion.create).mock.calls[0][0]).toMatchObject({
      data: { driveDepartmentConfigId: "config-cse" },
    });
  });

  it("refuses an invalid pipeline and a department admin", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(masterDrive() as never);
    const invalid = await saveMasterPipeline({ driveId: DRIVE_ID, stages: [{ name: "Offer", stageType: "OFFER" }] });
    expect(invalid.success).toBe(false);

    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    const forbidden = await saveMasterPipeline({ driveId: DRIVE_ID, stages: TECH_STAGES });
    expect(forbidden.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Creating a master drive
// ---------------------------------------------------------------------------

describe("creating a master drive", () => {
  const input = {
    companyName: "Acme",
    roleName: "SE",
    packageOffered: 12,
    packageDisplay: "12 LPA",
    minCGPA: 7,
    maxActiveBacklogs: 0,
    // Form input: days. A new drive may open today.
    applicationStartDate: indiaDay(new Date()),
    applicationDeadline: indiaDay(inDays(10)),
    nextStageDate: indiaDay(inDays(20)),
    applyMethod: "IN_APP" as const,
    departmentScope: { mode: "SELECTED" as const, departmentIds: [CSE] },
  };

  beforeEach(() => {
    // The one posting action decides the drive's kind from the session.
    vi.mocked(requireAnyRole).mockResolvedValue({ ...superAdmin, role: "SUPER_ADMIN" } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([{ id: CSE, code: "CSE" }] as never);
  });

  it("stores the permissions, the pipeline, and assigns only the selected departments", async () => {
    const result = await postDrive({
      ...input,
      departmentEditableFields: ["skills", "roleName"],
      recruitmentStages: TECH_STAGES,
    });

    expect(result.success).toBe(true);
    const [data, departments] = vi.mocked(createDriveWithEligibility).mock.calls[0];
    expect(data).toMatchObject({
      departmentEditableFields: ["roleName", "skills"],
      lifecycleStatus: "DRAFT",
      selectionRounds: JSON.stringify(["Aptitude", "Technical Interview"]),
    });
    expect(JSON.parse((data as { masterPipeline: string }).masterPipeline)).toHaveLength(4);
    expect(departments).toEqual([CSE]);
  });

  it("locks every field unless the Super Admin opens it", async () => {
    await postDrive(input);
    const [data] = vi.mocked(createDriveWithEligibility).mock.calls[0];
    expect(data).toMatchObject({ departmentEditableFields: [] });
  });

  it("refuses an invalid pipeline, writing nothing", async () => {
    const result = await postDrive({
      ...input,
      recruitmentStages: [{ name: "Offer", stageType: "OFFER" }],
    });
    expect(result.success).toBe(false);
    expect(createDriveWithEligibility).not.toHaveBeenCalled();
  });

  it("does not take student application fields — each department sets its own", async () => {
    const result = await postDrive({ ...input, applicationFields: '[{"key":"name"}]' });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toHaveProperty("applicationFields");
    expect(createDriveWithEligibility).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Completion status and publish validation
// ---------------------------------------------------------------------------

describe("step completion and publish validation", () => {
  const form = [catalogField("name", { isRequired: true, isEnabled: true, sortOrder: 0 })];
  const ready = (): ReadinessInput => ({
    now: new Date(),
    master: { lifecycleStatus: "PUBLISHED", jobDescriptionUrl: null },
    assigned: true,
    instance: { status: "CONFIGURED", lockedAt: null, venue: "Hall", reportingTime: "09:00" },
    resolved: {
      roleName: "SE",
      jobDescriptionText: "JD",
      nextStageDate: inDays(20),
      applicationStartDate: new Date("2026-01-01T00:00:00Z"),
      applicationDeadline: inDays(10),
      eligibilityRules: [
        { ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: ["2027"] },
      ],
    },
    form,
    pipelineStages: TECH_STAGES,
  });

  it("a complete configuration is ready to publish", () => {
    const readiness = departmentDriveReadiness(ready());
    expect(readiness.ready).toBe(true);
    expect(readiness.issues).toEqual([]);
    expect(readiness.resumeAt).toBe("publish");
  });

  it("reports each gap at its step and resumes at the first incomplete one", () => {
    const input = ready();
    input.instance = { ...input.instance!, venue: null };
    input.resolved = { ...input.resolved, eligibilityRules: [] };
    const readiness = departmentDriveReadiness(input);

    expect(readiness.ready).toBe(false);
    expect(readiness.resumeAt).toBe("details");
    const byStep = Object.fromEntries(readiness.steps.map((step) => [step.id, step]));
    expect(byStep.details.issues).toEqual(["Set the venue."]);
    expect(byStep.batches.complete).toBe(false);
    expect(byStep.fields.complete).toBe(true);
    expect(byStep.preview.complete).toBe(false);
  });

  it("checks dates, the form, the rules and the pipeline", () => {
    const input = ready();
    input.resolved = {
      ...input.resolved,
      applicationStartDate: new Date("2026-01-01T00:00:00Z"),
      applicationDeadline: inDays(-1),
      eligibilityRules: [
        ...input.resolved.eligibilityRules,
        { ruleType: "CGPA", operator: "GTE", numberValue: 42, listValue: [] },
      ],
    };
    input.form = [];
    input.pipelineStages = [{ name: "Offer", stageType: "OFFER" }];
    const issues = departmentDriveReadiness(input).issues.join(" ");

    expect(issues).toMatch(/application end date has already passed/);
    expect(issues).toMatch(/at least one application field/);
    expect(issues).toMatch(/CGPA/);
    expect(issues).toMatch(/Recruitment stages/);
  });

  it("refuses an unassigned, already-published, cancelled or archived drive", () => {
    const unassigned = ready();
    unassigned.assigned = false;
    expect(departmentDriveReadiness(unassigned).ready).toBe(false);

    const published = ready();
    published.instance = { ...published.instance!, status: "PUBLISHED", lockedAt: new Date() };
    const result = departmentDriveReadiness(published);
    expect(result.ready).toBe(false);
    expect(result.published).toBe(true);

    const cancelled = ready();
    cancelled.master = { ...cancelled.master, lifecycleStatus: "CANCELLED" };
    expect(departmentDriveReadiness(cancelled).issues.join(" ")).toMatch(/cancelled/);
  });

  it("the publish action runs this same check — not the client's checklist", () => {
    const source = readFileSync(join(__dirname, "../actions/publish-department-drive.ts"), "utf8");
    expect(source).toMatch(/departmentDriveReadiness\(/);
    expect(source).toMatch(/if \(!readiness\.ready\)/);
  });
});

// ---------------------------------------------------------------------------
// The student preview
// ---------------------------------------------------------------------------

describe("final student preview", () => {
  it("is built by the student drive view, from the saved rows, with the same include", async () => {
    const instance = instanceRow({
      roleName: "Backend Engineer",
      specialInstructions: "Carry ID",
      pipelineVersions: [
        {
          stages: [
            { name: "Application", scheduledAt: null, location: null, instructions: null },
            { name: "Coding", scheduledAt: null, location: "Lab 3", instructions: null },
          ],
        },
      ],
    });
    const master = masterDrive({ departmentConfigs: [instance], formFields: [] }) as ReturnType<typeof masterDrive> & {
      departmentConfigs: unknown[];
      formFields: unknown[];
    };
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(master as never);

    const preview = await getDepartmentDrivePreview(DRIVE_ID);

    // The same builder the student page uses gives the same answer.
    const { departmentConfigs, formFields, ...rest } = master;
    void departmentConfigs;
    const student = buildStudentDriveView(rest as never, formFields as never, instance as never);
    expect(preview.roleName).toBe(student.resolved.roleName);
    expect(preview.roleName).toBe("Backend Engineer");
    expect(preview.recruitmentStages).toEqual(student.recruitmentStages);
    expect(preview.applicationFields.map((field) => field.fieldKey)).toEqual(
      student.applicationForm.filter((field) => field.isEnabled).map((field) => field.fieldKey)
    );
    expect(preview.batches).toEqual(["2027"]);
    expect(preview.logistics.specialInstructions).toBe("Carry ID");

    // Loaded for the caller's department only, with the student page's include.
    const [call] = vi.mocked(prisma.drive.findUnique).mock.calls;
    expect(call[0]).toMatchObject({
      include: {
        departmentConfigs: { where: { departmentId: CSE }, include: STUDENT_VIEW_INSTANCE_INCLUDE },
      },
    });
    const studentPage = readFileSync(join(__dirname, "../queries/get-drive-detail.ts"), "utf8");
    expect(studentPage).toMatch(/include: STUDENT_VIEW_INSTANCE_INCLUDE/);
    expect(studentPage).toMatch(/buildStudentDriveView\(/);
  });

  it("before a pipeline exists, shows the stages publishing will create", () => {
    const view = buildStudentDriveView(
      masterDrive() as never,
      [],
      instanceRow({ pipelineVersions: [] }) as never
    );
    expect(view.recruitmentStages.map((stage) => stage.name)).toEqual(TECH_STAGES.map((stage) => stage.name));
  });

  it("is refused for a drive not assigned to the caller's department", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(masterDrive({ departmentConfigs: [], formFields: [] }) as never);
    await expect(getDepartmentDrivePreview(DRIVE_ID)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

describe("cancellation", () => {
  it("follows the lifecycle: from any live state, then only to archived", () => {
    for (const from of ["ASSIGNED", "CONFIGURED", "PUBLISHED", "CLOSED"] as const) {
      expect(canTransitionDepartmentDrive(from, "CANCELLED").valid).toBe(true);
    }
    expect(canTransitionDepartmentDrive("ARCHIVED", "CANCELLED").valid).toBe(false);
    expect(canTransitionDepartmentDrive("CANCELLED", "PUBLISHED").valid).toBe(false);
    expect(canTransitionDepartmentDrive("CANCELLED", "ARCHIVED").valid).toBe(true);
    expect(canTransitionMaster("PUBLISHED", "CANCELLED").valid).toBe(true);
    expect(canTransitionMaster("CANCELLED", "PUBLISHED").valid).toBe(false);
  });

  it("a department admin cancels their own department's drive: recorded, audited, applicants told, nothing deleted", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instanceRow({ status: "PUBLISHED", lockedAt: new Date() }) as never
    );

    const result = await cancelDepartmentDrive({
      driveId: DRIVE_ID,
      reason: "Company withdrew the role",
      // Not in the schema: the department is the session's.
      departmentId: IT,
    } as never);

    expect(result).toEqual({ success: true, cancelled: 1, notified: 3 });
    expect(vi.mocked(prisma.driveDepartmentConfig.findUnique).mock.calls[0][0]).toMatchObject({
      where: { driveId_departmentId: { driveId: DRIVE_ID, departmentId: CSE } },
    });
    expect(vi.mocked(prisma.driveDepartmentConfig.updateMany).mock.calls[0][0]).toMatchObject({
      where: { id: "config-cse", status: "PUBLISHED" },
      data: { status: "CANCELLED", cancelledById: "user-cse", cancellationReason: "Company withdrew the role" },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "CANCEL",
      metadata: { fromStatus: "PUBLISHED", reason: "Company withdrew the role", cancelledBy: "DEPT_ADMIN" },
    });
    expect(notifyDriveCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ departmentIds: [CSE], notifyDepartmentAdmins: false })
    );
    // Applications and their snapshots are history: never touched.
    expect(prisma.driveApplication.delete).not.toHaveBeenCalled();
    expect(prisma.driveApplication.deleteMany).not.toHaveBeenCalled();
    expect(prisma.driveApplicationSnapshot.update).not.toHaveBeenCalled();
    expect(prisma.driveApplicationSnapshot.updateMany).not.toHaveBeenCalled();
  });

  it("needs a reason, and refuses an already-cancelled drive", async () => {
    expect((await cancelDepartmentDrive({ driveId: DRIVE_ID, reason: "no" })).success).toBe(false);

    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instanceRow({ status: "CANCELLED" }) as never
    );
    expect((await cancelDepartmentDrive({ driveId: DRIVE_ID, reason: "Company withdrew" })).success).toBe(false);
    expect(prisma.driveDepartmentConfig.updateMany).not.toHaveBeenCalled();
  });

  it("the Super Admin cancels one department's drive, and that department's admins are told", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instanceRow({ departmentId: IT, department: { code: "IT" } }) as never
    );

    const result = await cancelDepartmentDriveAsSuperAdmin({
      driveId: DRIVE_ID,
      departmentId: IT,
      reason: "Not running in IT this year",
    });

    expect(result.success).toBe(true);
    expect(notifyDriveCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ departmentIds: [IT], notifyDepartmentAdmins: true })
    );
  });

  it("a department admin cannot use the Super Admin's cancellation", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    const result = await cancelMasterDrive({ driveId: DRIVE_ID, reason: "Company withdrew" });
    expect(result.success).toBe(false);
    expect(prisma.drive.updateMany).not.toHaveBeenCalled();
  });

  it("cancelling a master drive cancels every live department drive of it", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(masterDrive() as never);
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      { id: "config-cse", departmentId: CSE, status: "PUBLISHED", department: { code: "CSE" } },
      { id: "config-it", departmentId: IT, status: "ASSIGNED", department: { code: "IT" } },
    ] as never);

    const result = await cancelMasterDrive({ driveId: DRIVE_ID, reason: "Company withdrew the role" });

    expect(result).toEqual({ success: true, cancelled: 2, notified: 3 });
    expect(vi.mocked(prisma.drive.updateMany).mock.calls[0][0]).toMatchObject({
      where: { id: DRIVE_ID, lifecycleStatus: "PUBLISHED" },
      data: { lifecycleStatus: "CANCELLED", cancelledById: "user-super" },
    });
    // Already cancelled or archived instances are left as they are.
    expect(vi.mocked(prisma.driveDepartmentConfig.findMany).mock.calls[0][0]).toMatchObject({
      where: { status: { in: ["ASSIGNED", "CONFIGURED", "PUBLISHED", "CLOSED"] } },
    });
    expect(vi.mocked(prisma.driveDepartmentConfig.updateMany).mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["config-cse", "config-it"] } },
      data: { status: "CANCELLED" },
    });
    expect(notifyDriveCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ departmentIds: [CSE, IT] })
    );
  });

  it("new applications, the student listing and stage moves all exclude a cancelled drive", () => {
    const apply = readFileSync(join(__dirname, "../../applications/actions/apply-to-drive.ts"), "utf8");
    expect(apply).toMatch(/instance\.status !== "PUBLISHED"/);
    expect(apply).toMatch(/lifecycleStatus === "CANCELLED"/);
    const listing = readFileSync(join(__dirname, "../queries/get-eligible-drives.ts"), "utf8");
    expect(listing).toMatch(/status: "PUBLISHED"/);
    expect(listing).toMatch(/notIn: \["ARCHIVED", "CANCELLED"\]/);
  });
});

// ---------------------------------------------------------------------------
// Controlled deadline extension
// ---------------------------------------------------------------------------

describe("deadline extension", () => {
  const published = () =>
    masterDrive({
      departmentConfigs: [instanceRow({ status: "PUBLISHED", lockedAt: new Date() })],
    });

  beforeEach(() => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(published() as never);
  });

  it("is Super Admin only", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    const result = await extendDepartmentDriveDeadline({
      driveId: DRIVE_ID, departmentId: CSE, newDeadline: inDays(12).toISOString(), reason: "Company asked",
    });
    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.updateMany).not.toHaveBeenCalled();
  });

  it("extends later only, into the future, before the drive date", async () => {
    const attempt = (days: number) =>
      extendDepartmentDriveDeadline({
        driveId: DRIVE_ID, departmentId: CSE, newDeadline: inDays(days).toISOString(), reason: "Company asked",
      });

    expect((await attempt(5)).success).toBe(false); // earlier than the current +10
    expect((await attempt(25)).success).toBe(false); // after the +20 drive date
    expect(prisma.driveDepartmentConfig.updateMany).not.toHaveBeenCalled();
  });

  it("only for a published department drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(
      masterDrive({ departmentConfigs: [instanceRow({ status: "CONFIGURED" })] }) as never
    );
    const result = await extendDepartmentDriveDeadline({
      driveId: DRIVE_ID, departmentId: CSE, newDeadline: inDays(12).toISOString(), reason: "Company asked",
    });
    expect(result.success).toBe(false);
  });

  it("writes the department's deadline, audits old and new, notifies, and leaves snapshots alone", async () => {
    const drive = published();
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive as never);
    // The new deadline closes at the end of its India day, like every application end.
    const newDeadline = endOfIndiaDay(indiaDay(inDays(12)));
    const result = await extendDepartmentDriveDeadline({
      driveId: DRIVE_ID, departmentId: CSE, newDeadline: indiaDay(inDays(12)), reason: "Company asked for more time",
    });

    expect(result.success).toBe(true);
    const [update] = vi.mocked(prisma.driveDepartmentConfig.updateMany).mock.calls;
    expect(update[0]).toMatchObject({
      where: { id: "config-cse", status: "PUBLISHED" },
      data: { applicationDeadline: newDeadline },
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "EXTEND_DEADLINE",
      metadata: {
        departmentCode: "CSE",
        oldDeadline: drive.applicationDeadline.toISOString(),
        newDeadline: newDeadline.toISOString(),
        reason: "Company asked for more time",
      },
    });
    expect(notifyDeadlineExtended).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: CSE, newDeadline })
    );
    expect(prisma.driveApplicationSnapshot.update).not.toHaveBeenCalled();
    expect(prisma.driveApplicationSnapshot.updateMany).not.toHaveBeenCalled();
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});
