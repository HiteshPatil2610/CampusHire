import { describe, it, expect, vi, beforeEach } from "vitest";
import { indiaDay } from "../domain/drive-window";

/**
 * Who may post what through the one drive form — the server side of the
 * Phase 4 test matrix (Item 10), plus the department scoping it grew out of.
 *
 *   Super Admin      → a central drive: all departments, a selection, or one.
 *   Department admin → a drive for their own department only; no other
 *                      department, no "all", no central origin.
 *   Student          → refused.
 *
 * Every request here goes straight to the server actions (`postDrive` /
 * `saveDrive`), as a crafted Server Action call would — no form in between.
 * The origin (`isCentralDrive`, `departmentId`, author) comes from the session.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    // Eligible-batch options: the batches students hold.
    student: {
      groupBy: vi.fn(async () => [{ expectedPassoutYear: 2026, _count: { _all: 40 } }]),
    },
    // A department's own drive gets its pipeline when posted.
    driveDepartmentConfig: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    department: { findMany: vi.fn() },
    driveEligibilityRule: { deleteMany: vi.fn(), createMany: vi.fn() },
    // Recruitment pipeline models (see pipeline-fixtures.ts).
    recruitmentPipelineVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    recruitmentStage: { findUnique: vi.fn() },
    applicationStageEvent: { create: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthenticationError extends Error {}
  class AuthorizationError extends Error {}
  return {
    requireAnyRole: vi.fn(),
    requireDepartmentAdmin: vi.fn(),
    requireSuperAdmin: vi.fn(),
    getActiveDepartmentAdmin: vi.fn(),
    AuthenticationError,
    AuthorizationError,
  };
});

vi.mock("@/features/settings/queries/get-settings", () => ({
  getInstitutionSettings: vi.fn(async () => ({
    institutionName: "CampusHire",
    seasonStart: null,
    seasonEnd: null,
    enforceSeasonWindow: false,
    defaultMinCGPA: null,
    defaultMaxBacklogs: null,
    defaultPipelineStages: null,
    updatedAt: new Date(0),
    updatedByName: null,
  })),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: { CREATE: "CREATE", UPDATE: "UPDATE" },
  AuditEntityType: { DRIVE: "Drive" },
}));

vi.mock("@/features/notifications/actions/notify-eligible-students-of-drive", () => ({
  notifyEligibleStudentsOfDrive: vi.fn(),
}));
vi.mock("@/features/notifications/actions/notify-drive-lifecycle", () => ({
  notifyDriveUpdated: vi.fn(),
}));
vi.mock("@/features/notifications/producers/workflow-events", () => ({
  notifyDriveAssigned: vi.fn(),
  notifyMasterDriveUpdated: vi.fn(),
}));

// Stub the assignment writers so the test can assert exactly which department
// IDs were persisted — department assignment owns both the eligibility edge
// and the instance.
vi.mock("../domain/department-assignment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/department-assignment")>()),
  ensureDepartmentsAssigned: vi.fn(async () => ({ assigned: [], alreadyAssigned: [] })),
  reconcileDepartmentAssignments: vi.fn(async () => ({
    assigned: [],
    alreadyAssigned: [],
    removed: [],
    blocked: [],
  })),
  findBlockedRemovals: vi.fn(async () => []),
}));

import { prisma } from "@/lib/prisma";
import { withActivePipeline } from "@/features/recruitment/__tests__/pipeline-fixtures";
import {
  AuthorizationError,
  requireAnyRole,
  requireDepartmentAdmin,
  requireSuperAdmin,
} from "@/lib/auth";
import {
  ensureDepartmentsAssigned,
  reconcileDepartmentAssignments,
} from "../domain/department-assignment";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";
import { checkDriveFormForRole, resolveCentralDepartmentIds } from "../domain/drive-form-rules";
import { postDrive, saveDrive } from "../actions/drive-form-actions";
import type { DriveFormInput } from "../schemas/drive-form";

const DEPT_A = "dept-a";
const DEPT_B = "dept-b";
const DEPT_C = "dept-c";

const adminOfA = {
  user: { id: "user-admin-a", role: "DEPT_ADMIN" as const },
  admin: { id: "admin-a", userId: "user-admin-a", departmentId: DEPT_A },
  department: { id: DEPT_A, name: "Computer Engineering", code: "CS", isActive: true },
};

const superAdmin = { id: "user-super", role: "SUPER_ADMIN" as const };
const student = { id: "user-student", role: "STUDENT" as const };

/** Sign in as one of the three roles, as the session would report it. */
function signInAs(role: "SUPER_ADMIN" | "DEPT_ADMIN" | "STUDENT") {
  if (role === "STUDENT") {
    vi.mocked(requireAnyRole).mockRejectedValue(
      new AuthorizationError("This action requires one of the following roles: SUPER_ADMIN, DEPT_ADMIN. You have STUDENT role.")
    );
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(new AuthorizationError("Department admin only"));
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Super Admin only"));
    return;
  }
  vi.mocked(requireAnyRole).mockResolvedValue((role === "SUPER_ADMIN" ? superAdmin : adminOfA.user) as never);
}

/** Dates far enough out to satisfy the window rules. */
const deadline = indiaDay(new Date(Date.now() + 7 * 864e5));
const nextStageDate = indiaDay(new Date(Date.now() + 14 * 864e5));
/** Applications open today — the earliest a new drive may start. */
const startDay = indiaDay(new Date());

/** What the form sends for any role. */
const sharedInput = {
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  packageOffered: 12,
  batchYears: ["2026"],
  applicationStartDate: startDay,
  applicationDeadline: deadline,
  nextStageDate,
  applyMethod: "IN_APP" as const,
  minCGPA: 7,
  maxActiveBacklogs: 0,
};

/** A department admin's submission. */
const departmentInput: DriveFormInput = {
  ...sharedInput,
  selectionRounds: ["Aptitude", "Technical"],
};

/** A Super Admin's submission. */
const centralInput: DriveFormInput = {
  ...sharedInput,
  companyName: "Globex",
  departmentScope: { mode: "ALL" },
};

const existingDriveOfA = {
  id: "drive-1",
  departmentId: DEPT_A,
  isCentralDrive: false,
  companyName: "Acme Corp",
  // Unchanged by the edits below: rounds belong to the recruitment pipeline.
  selectionRounds: JSON.stringify(["Aptitude", "Technical"]),
  applicationStartDate: new Date("2026-01-01T00:00:00Z"),
  eligibilityRules: [],
  formFields: [],
  _count: { applications: 0 },
};

const existingCentral = {
  ...existingDriveOfA,
  id: "drive-central",
  departmentId: null,
  isCentralDrive: true,
  selectionRounds: "[]",
};

const ACTIVE_DEPARTMENTS = [
  { id: DEPT_A, code: "CS" },
  { id: DEPT_B, code: "ME" },
  { id: DEPT_C, code: "EE" },
];

/** The department IDs the create path assigned the drive to. */
const assignedDepartments = () => vi.mocked(ensureDepartmentsAssigned).mock.calls[0]?.[2];
/** The Drive columns the create path wrote. */
const writtenDrive = () =>
  (vi.mocked(prisma.drive.create).mock.calls[0][0] as { data: Record<string, unknown> }).data;

beforeEach(() => {
  vi.clearAllMocks();
  withActivePipeline(prisma);

  signInAs("DEPT_ADMIN");
  vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOfA as never);
  vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as never);

  // Run the callback against a transaction client exposing the same writers.
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        drive: prisma.drive,
        driveEligibilityRule: prisma.driveEligibilityRule,
        driveDepartmentConfig: prisma.driveDepartmentConfig,
      })
  );

  vi.mocked(prisma.drive.create).mockResolvedValue({ ...existingDriveOfA, roleName: "Software Engineer" } as never);
  vi.mocked(prisma.drive.update).mockResolvedValue(existingDriveOfA as never);
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(existingDriveOfA as never);
  // Only the active departments a query asks for come back, as Prisma would.
  vi.mocked(prisma.department.findMany).mockImplementation((async (args?: {
    where?: { id?: { in?: string[] } };
  }) => {
    const wanted = args?.where?.id?.in;
    return wanted ? ACTIVE_DEPARTMENTS.filter((dept) => wanted.includes(dept.id)) : ACTIVE_DEPARTMENTS;
  }) as never);
});

// ---------------------------------------------------------------------------
// The pure rules
// ---------------------------------------------------------------------------

describe("resolveDeptAdminEligibleDepartments", () => {
  it("returns the session department when the client agrees or sends nothing", () => {
    expect(resolveDeptAdminEligibleDepartments([DEPT_A], DEPT_A)).toEqual({ ok: true, eligibleDepartments: [DEPT_A] });
    expect(resolveDeptAdminEligibleDepartments(undefined, DEPT_A)).toEqual({ ok: true, eligibleDepartments: [DEPT_A] });
    expect(resolveDeptAdminEligibleDepartments([DEPT_A, DEPT_A], DEPT_A)).toEqual({
      ok: true,
      eligibleDepartments: [DEPT_A],
    });
  });

  it("rejects a foreign department, alone or next to its own, and a caller with none", () => {
    expect(resolveDeptAdminEligibleDepartments([DEPT_B], DEPT_A).ok).toBe(false);
    expect(resolveDeptAdminEligibleDepartments([DEPT_A, DEPT_B], DEPT_A).ok).toBe(false);
    expect(resolveDeptAdminEligibleDepartments([DEPT_A], "").ok).toBe(false);
  });
});

describe("checkDriveFormForRole — what each role may send", () => {
  const parsedDepartment = { ...departmentInput, batchYears: ["2026"] } as Parameters<typeof checkDriveFormForRole>[0];
  const parsedCentral = { ...centralInput, batchYears: [] } as Parameters<typeof checkDriveFormForRole>[0];

  it("lets each role send its own fields", () => {
    expect(checkDriveFormForRole(parsedDepartment, "DEPARTMENT_ADMIN", DEPT_A).ok).toBe(true);
    expect(checkDriveFormForRole(parsedCentral, "SUPER_ADMIN").ok).toBe(true);
  });

  it("refuses a department admin's department choice other than their own, and All", () => {
    for (const departmentScope of [
      { mode: "ALL" as const },
      { mode: "SELECTED" as const, departmentIds: [DEPT_B] },
      { mode: "SELECTED" as const, departmentIds: [DEPT_A, DEPT_B] },
    ]) {
      const result = checkDriveFormForRole({ ...parsedDepartment, departmentScope }, "DEPARTMENT_ADMIN", DEPT_A);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors).toHaveProperty("departmentScope");
    }
    expect(
      checkDriveFormForRole(
        { ...parsedDepartment, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A] } },
        "DEPARTMENT_ADMIN",
        DEPT_A
      ).ok
    ).toBe(true);
  });

  it("refuses the Super Admin's settings from a department admin", () => {
    expect(
      checkDriveFormForRole({ ...parsedDepartment, departmentEditableFields: ["roleName"] }, "DEPARTMENT_ADMIN", DEPT_A).ok
    ).toBe(false);
    expect(checkDriveFormForRole({ ...parsedDepartment, recruitmentStages: [] }, "DEPARTMENT_ADMIN", DEPT_A).ok).toBe(
      false
    );
  });

  it("requires batches and rounds from a department admin, not from the Super Admin", () => {
    expect(checkDriveFormForRole({ ...parsedDepartment, batchYears: [] }, "DEPARTMENT_ADMIN", DEPT_A).ok).toBe(false);
    expect(checkDriveFormForRole({ ...parsedDepartment, selectionRounds: [] }, "DEPARTMENT_ADMIN", DEPT_A).ok).toBe(
      false
    );
    expect(checkDriveFormForRole({ ...parsedCentral, batchYears: [] }, "SUPER_ADMIN").ok).toBe(true);
  });

  it("refuses rounds and an application form on a central drive", () => {
    expect(checkDriveFormForRole({ ...parsedCentral, selectionRounds: ["HR"] }, "SUPER_ADMIN").ok).toBe(false);
    expect(checkDriveFormForRole({ ...parsedCentral, applicationFields: "[]" }, "SUPER_ADMIN").ok).toBe(false);
  });
});

describe("resolveCentralDepartmentIds", () => {
  const active = [DEPT_A, DEPT_B, DEPT_C];

  it("All — and an omitted scope — is every active department", () => {
    expect(resolveCentralDepartmentIds({ mode: "ALL" }, active)).toEqual(active);
    expect(resolveCentralDepartmentIds(undefined, active)).toEqual(active);
  });

  it("a selection keeps only active departments, once each", () => {
    expect(
      resolveCentralDepartmentIds({ mode: "SELECTED", departmentIds: [DEPT_B, "gone", DEPT_B] }, active)
    ).toEqual([DEPT_B]);
  });
});

// ---------------------------------------------------------------------------
// Super Admin
// ---------------------------------------------------------------------------

describe("Super Admin posting through the drive form", () => {
  beforeEach(() => signInAs("SUPER_ADMIN"));

  it("creates a central drive for all departments", async () => {
    const result = await postDrive(centralInput);

    expect(result.success).toBe(true);
    expect(assignedDepartments()).toEqual([DEPT_A, DEPT_B, DEPT_C]);
    expect(writtenDrive()).toMatchObject({
      isCentralDrive: true,
      departmentId: null,
      createdByUserId: superAdmin.id,
      lifecycleStatus: "DRAFT",
    });
  });

  it("treats an omitted department choice as All departments", async () => {
    const { departmentScope: _scope, ...withoutScope } = centralInput;
    const result = await postDrive(withoutScope);

    expect(result.success).toBe(true);
    expect(assignedDepartments()).toEqual([DEPT_A, DEPT_B, DEPT_C]);
  });

  it("creates a drive for one specific department — still a central drive", async () => {
    const result = await postDrive({ ...centralInput, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_B] } });

    expect(result.success).toBe(true);
    expect(assignedDepartments()).toEqual([DEPT_B]);
    // Posted by the Super Admin, so central — never owned by the department.
    expect(writtenDrive()).toMatchObject({ isCentralDrive: true, departmentId: null });
  });

  it("creates a drive for several selected departments", async () => {
    await postDrive({ ...centralInput, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A, DEPT_C] } });

    expect(assignedDepartments()).toEqual([DEPT_A, DEPT_C]);
  });

  it("drops a department that does not exist or is inactive, and refuses when none is left", async () => {
    await postDrive({ ...centralInput, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A, "dept-gone"] } });
    expect(assignedDepartments()).toEqual([DEPT_A]);

    vi.clearAllMocks();
    signInAs("SUPER_ADMIN");
    vi.mocked(prisma.department.findMany).mockResolvedValue([] as never);
    const result = await postDrive({ ...centralInput, departmentScope: { mode: "SELECTED", departmentIds: ["dept-gone"] } });
    expect(result).toMatchObject({ success: false, fieldErrors: { departmentScope: expect.any(String) } });
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("refuses a department drive's fields on a central drive", async () => {
    const result = await postDrive({ ...centralInput, selectionRounds: ["HR"] });

    expect(result.success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("cannot edit a department's own drive", async () => {
    const result = await saveDrive("drive-1", centralInput);

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("edits a central drive without rewriting its origin", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(existingCentral as never);

    const result = await saveDrive("drive-central", { ...centralInput, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A] } });

    expect(result.success).toBe(true);
    const [args] = vi.mocked(prisma.drive.update).mock.calls[0];
    const data = (args as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
    expect(data).not.toHaveProperty("lifecycleStatus");
    expect(vi.mocked(reconcileDepartmentAssignments).mock.calls[0][2]).toEqual([DEPT_A]);
  });
});

// ---------------------------------------------------------------------------
// Department admin
// ---------------------------------------------------------------------------

describe("department admin posting through the drive form", () => {
  it("creates a drive for their own department — department-owned, not central, authored by them", async () => {
    const result = await postDrive(departmentInput);

    expect(result.success).toBe(true);
    expect(assignedDepartments()).toEqual([DEPT_A]);
    expect(writtenDrive()).toMatchObject({
      isCentralDrive: false,
      departmentId: DEPT_A,
      createdByUserId: adminOfA.user.id,
    });
  });

  it("naming their own department changes nothing", async () => {
    const result = await postDrive({ ...departmentInput, departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A] } });

    expect(result.success).toBe(true);
    expect(assignedDepartments()).toEqual([DEPT_A]);
  });

  it("cannot post to another department", async () => {
    for (const departmentScope of [
      { mode: "SELECTED" as const, departmentIds: [DEPT_B] },
      { mode: "SELECTED" as const, departmentIds: [DEPT_A, DEPT_B, DEPT_C] },
      { mode: "ALL" as const },
    ]) {
      const result = await postDrive({ ...departmentInput, departmentScope });
      expect(result).toMatchObject({ success: false, fieldErrors: { departmentScope: expect.any(String) } });
    }
    expect(prisma.drive.create).not.toHaveBeenCalled();
    expect(ensureDepartmentsAssigned).not.toHaveBeenCalled();
  });

  it("cannot make the drive central, another department's, or someone else's", async () => {
    for (const forged of [
      { isCentralDrive: true },
      { departmentId: DEPT_B },
      { createdByUserId: "someone-else" },
      { lifecycleStatus: "PUBLISHED" },
      // The pre-Phase-4 field: no longer part of the form at all.
      { eligibleDepartments: [DEPT_B] },
    ]) {
      const result = await postDrive({ ...departmentInput, ...forged } as DriveFormInput);
      expect(result.success).toBe(false);
    }
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("cannot set the Super Admin's edit permissions or recruitment stages", async () => {
    expect((await postDrive({ ...departmentInput, departmentEditableFields: ["roleName"] })).success).toBe(false);
    expect((await postDrive({ ...departmentInput, recruitmentStages: [] })).success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("can update their own drive; the edit never rewrites origin or owner", async () => {
    const result = await saveDrive("drive-1", departmentInput);

    expect(result.success).toBe(true);
    // Reconciled rather than blindly assigned, so a removal blocked by
    // existing applications could be refused before anything is written.
    expect(vi.mocked(reconcileDepartmentAssignments).mock.calls[0][2]).toEqual([DEPT_A]);
    const [args] = vi.mocked(prisma.drive.update).mock.calls[0];
    const data = (args as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
  });

  it("cannot widen their drive to another department on edit", async () => {
    const result = await saveDrive("drive-1", {
      ...departmentInput,
      departmentScope: { mode: "SELECTED", departmentIds: [DEPT_A, DEPT_B] },
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("cannot edit another department's drive or a central drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValueOnce({ ...existingDriveOfA, departmentId: DEPT_B } as never);
    expect((await saveDrive("drive-1", departmentInput)).success).toBe(false);

    vi.mocked(prisma.drive.findUnique).mockResolvedValueOnce(existingCentral as never);
    expect((await saveDrive("drive-central", departmentInput)).success).toBe(false);

    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

describe("a student", () => {
  beforeEach(() => signInAs("STUDENT"));

  it("cannot post a drive of either kind", async () => {
    for (const input of [departmentInput, centralInput]) {
      const result = await postDrive(input);
      expect(result).toMatchObject({ success: false, error: expect.stringContaining("STUDENT") });
    }
    expect(prisma.drive.create).not.toHaveBeenCalled();
    expect(prisma.drive.findUnique).not.toHaveBeenCalled();
  });

  it("cannot edit a drive", async () => {
    const result = await saveDrive("drive-1", departmentInput);

    expect(result.success).toBe(false);
    expect(prisma.drive.findUnique).not.toHaveBeenCalled();
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Eligible batches (Item 9) through the unified actions
// ---------------------------------------------------------------------------

/** The BATCH_YEAR rule written for the drive, or null when none was. */
function writtenBatchRule(): string[] | null {
  for (const [args] of vi.mocked(prisma.driveEligibilityRule.createMany).mock.calls) {
    const rows = (args as { data: { ruleType: string; listValue: string[] }[] }).data;
    const batch = rows.find((row) => row.ruleType === "BATCH_YEAR");
    if (batch) return batch.listValue;
  }
  return null;
}

describe("eligible batches come from the student database", () => {
  it("multiple eligible batches are stored as the drive's one BATCH_YEAR rule", async () => {
    vi.mocked(prisma.student.groupBy).mockResolvedValueOnce([
      { expectedPassoutYear: 2026, _count: { _all: 40 } },
      { expectedPassoutYear: 2027, _count: { _all: 55 } },
    ] as never);

    const result = await postDrive({ ...departmentInput, batchYears: ["2027", "2026"] });

    expect(result.success).toBe(true);
    expect(writtenBatchRule()).toEqual(["2026", "2027"]);
  });

  it("a department's options are the batches of its own students", async () => {
    await postDrive(departmentInput);

    expect(prisma.student.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId: DEPT_A }) })
    );
  });

  it("a department drive with no eligible batch is refused", async () => {
    const result = await postDrive({ ...departmentInput, batchYears: [] });

    expect(result).toMatchObject({ success: false, fieldErrors: { batchYears: expect.any(String) } });
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("refuses a batch no student is in — years are never typed in", async () => {
    const result = await postDrive({ ...departmentInput, batchYears: ["2026", "2031"] });

    expect(result).toMatchObject({ success: false, error: expect.stringContaining("2031") });
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("keeps a batch the drive already targets, even if no student is in it any more", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...existingDriveOfA,
      eligibilityRules: [{ ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: ["2025"] }],
    } as never);

    const result = await saveDrive("drive-1", { ...departmentInput, batchYears: ["2025", "2026"] });

    expect(result.success).toBe(true);
  });

  it("a central drive's batches are optional and checked against the whole institution", async () => {
    signInAs("SUPER_ADMIN");

    expect((await postDrive({ ...centralInput, batchYears: [] })).success).toBe(true);

    vi.clearAllMocks();
    signInAs("SUPER_ADMIN");
    await postDrive({ ...centralInput, batchYears: ["2026"] });

    const [args] = vi.mocked(prisma.student.groupBy).mock.calls[0];
    expect((args as { where: Record<string, unknown> }).where).not.toHaveProperty("departmentId");
    expect(writtenBatchRule()).toEqual(["2026"]);
  });
});
