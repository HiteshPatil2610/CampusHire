import { describe, it, expect, vi, beforeEach } from "vitest";
import { indiaDay } from "../domain/drive-window";

/**
 * Department scoping on drive mutations.
 *
 * The rule under test: a DEPT_ADMIN's drive reaches their own department and
 * nothing else, and that is decided by the session rather than the request.
 * Reaching several departments is the Super Admin's central-drive flow.
 *
 * These are regression tests for a real hole — `createDrive` and `updateDrive`
 * used to pass the client's `eligibleDepartments` array straight through to
 * `setEligibleDepartments`, so a crafted Server Action payload could put one
 * department's drive in front of another department's students. The UI locked
 * only the admin's own checkbox, which is not an access control.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    // Eligible-batch options: the batches students hold.
    student: {
      groupBy: vi.fn(async () => [{ expectedPassoutYear: 2026, _count: { _all: 40 } }]),
    },
    // A department's own drive gets its pipeline when posted.
    driveDepartmentConfig: { findMany: vi.fn(async () => []) },
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

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
  getActiveDepartmentAdmin: vi.fn(),
}));

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

// Stub the assignment writers so the test can assert exactly which department
// IDs were persisted. These are what the create/update paths now go through —
// department assignment owns both the eligibility edge and the instance.
vi.mock("../domain/department-assignment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/department-assignment")>()),
  ensureDepartmentsAssigned: vi.fn(async () => ({
    assigned: [],
    alreadyAssigned: [],
  })),
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

// Every department drive here already has an active recruitment pipeline.
beforeEach(() => withActivePipeline(prisma));
import { requireDepartmentAdmin, requireSuperAdmin } from "@/lib/auth";
import {
  ensureDepartmentsAssigned,
  reconcileDepartmentAssignments,
} from "../domain/department-assignment";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";
import { createDrive } from "../actions/create-drive";
import { updateDrive } from "../actions/update-drive";
import { createCentralDrive } from "../actions/create-central-drive";

const DEPT_A = "dept-a";
const DEPT_B = "dept-b";
const DEPT_C = "dept-c";

const adminOfA = {
  user: { id: "user-admin-a", role: "DEPT_ADMIN" as const },
  admin: { id: "admin-a", userId: "user-admin-a", departmentId: DEPT_A },
  department: { id: DEPT_A, name: "Computer Engineering", code: "CS", isActive: true },
};

const superAdmin = { id: "user-super", role: "SUPER_ADMIN" as const };

/** Dates far enough out to satisfy "deadline in the future, before drive date". */
const deadline = new Date(Date.now() + 7 * 864e5).toISOString();
const nextStageDate = new Date(Date.now() + 14 * 864e5).toISOString();
/** Applications open today — the earliest a new drive may start. */
const startDay = indiaDay(new Date());

const baseDriveInput = {
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  packageOffered: 12,
  selectionRounds: ["Aptitude", "Technical"],
  batchYears: ["2026"],
  nextStageDate,
  applicationStartDate: startDay,
  applicationDeadline: deadline,
  applyMethod: "IN_APP" as const,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  eligibleDepartments: [DEPT_A],
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
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOfA as never);
  vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as never);

  // Run the callback against a transaction client exposing the same writers.
  // `$transaction` is overloaded, so the mock is reached through an untyped
  // handle rather than fighting the overload set in a test.
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        drive: prisma.drive,
        driveEligibilityRule: prisma.driveEligibilityRule,
        driveDepartmentConfig: prisma.driveDepartmentConfig,
      })
  );

  vi.mocked(prisma.drive.create).mockResolvedValue({
    ...existingDriveOfA,
    roleName: "Software Engineer",
  } as never);
  vi.mocked(prisma.drive.update).mockResolvedValue(existingDriveOfA as never);
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(existingDriveOfA as never);
});

// ---------------------------------------------------------------------------
// The pure rule
// ---------------------------------------------------------------------------

describe("resolveDeptAdminEligibleDepartments", () => {
  it("returns the session department when the client agrees", () => {
    expect(resolveDeptAdminEligibleDepartments([DEPT_A], DEPT_A)).toEqual({
      ok: true,
      eligibleDepartments: [DEPT_A],
    });
  });

  it("returns the session department when the client sends nothing", () => {
    expect(resolveDeptAdminEligibleDepartments(undefined, DEPT_A)).toEqual({
      ok: true,
      eligibleDepartments: [DEPT_A],
    });
    expect(resolveDeptAdminEligibleDepartments([], DEPT_A)).toEqual({
      ok: true,
      eligibleDepartments: [DEPT_A],
    });
  });

  it("collapses a duplicated own-department id", () => {
    expect(
      resolveDeptAdminEligibleDepartments([DEPT_A, DEPT_A], DEPT_A)
    ).toEqual({ ok: true, eligibleDepartments: [DEPT_A] });
  });

  it("rejects a foreign department id", () => {
    const result = resolveDeptAdminEligibleDepartments([DEPT_B], DEPT_A);
    expect(result.ok).toBe(false);
  });

  it("rejects own + foreign, rather than silently narrowing to own", () => {
    const result = resolveDeptAdminEligibleDepartments([DEPT_A, DEPT_B], DEPT_A);
    expect(result.ok).toBe(false);
  });

  it("rejects when the caller has no department", () => {
    expect(resolveDeptAdminEligibleDepartments([DEPT_A], "").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDrive
// ---------------------------------------------------------------------------

describe("createDrive — department scope", () => {
  it("admin of A cannot target department B", async () => {
    const result = await createDrive({
      ...baseDriveInput,
      eligibleDepartments: [DEPT_B],
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
    expect(ensureDepartmentsAssigned).not.toHaveBeenCalled();
    expect(reconcileDepartmentAssignments).not.toHaveBeenCalled();
  });

  it("admin of A cannot smuggle B alongside their own department", async () => {
    const result = await createDrive({
      ...baseDriveInput,
      eligibleDepartments: [DEPT_A, DEPT_B, DEPT_C],
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
    expect(ensureDepartmentsAssigned).not.toHaveBeenCalled();
    expect(reconcileDepartmentAssignments).not.toHaveBeenCalled();
  });

  it("admin of A can create a drive for department A", async () => {
    const result = await createDrive(baseDriveInput);

    expect(result.success).toBe(true);
    expect(ensureDepartmentsAssigned).toHaveBeenCalledWith(
      expect.anything(),
      "drive-1",
      [DEPT_A],
      expect.anything()
    );
  });

  it("writes the session department even when the client omits it", async () => {
    // The zod schema requires a non-empty array, so the realistic attack is a
    // wrong value rather than a missing one — this pins that the persisted
    // value comes from the session either way.
    const result = await createDrive(baseDriveInput);

    expect(result.success).toBe(true);
    const [, , written] = vi.mocked(ensureDepartmentsAssigned).mock.calls[0];
    expect(written).toEqual([DEPT_A]);
    expect(prisma.drive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ departmentId: DEPT_A }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateDrive
// ---------------------------------------------------------------------------

describe("updateDrive — department scope", () => {
  it("admin of A cannot widen their own drive to department B", async () => {
    const result = await updateDrive("drive-1", {
      ...baseDriveInput,
      eligibleDepartments: [DEPT_A, DEPT_B],
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
    expect(ensureDepartmentsAssigned).not.toHaveBeenCalled();
    expect(reconcileDepartmentAssignments).not.toHaveBeenCalled();
  });

  it("admin of A cannot edit a drive owned by department B", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...existingDriveOfA,
      departmentId: DEPT_B,
    } as never);

    const result = await updateDrive("drive-1", baseDriveInput);

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("admin of A cannot edit a central drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...existingDriveOfA,
      departmentId: null,
      isCentralDrive: true,
    } as never);

    const result = await updateDrive("drive-1", baseDriveInput);

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("admin of A can update their own drive", async () => {
    const result = await updateDrive("drive-1", baseDriveInput);

    expect(result.success).toBe(true);
    // The update path reconciles rather than blindly assigning, so a removal
    // blocked by existing applications can be refused before anything is
    // written.
    expect(reconcileDepartmentAssignments).toHaveBeenCalledWith(
      expect.anything(),
      "drive-1",
      [DEPT_A],
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// Super admin retains global reach
// ---------------------------------------------------------------------------

describe("createCentralDrive — super admin global access", () => {
  const centralInput = {
    companyName: "Globex",
    roleName: "Analyst",
    packageDisplay: "12 LPA",
    minCGPA: 6,
    maxActiveBacklogs: 0,
    nextStageDate,
    applicationStartDate: startDay,
    applicationDeadline: deadline,
    eligibleDepartments: [DEPT_A, DEPT_B, DEPT_C],
  };

  it("can target many departments at once", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: DEPT_A, code: "CS" },
      { id: DEPT_B, code: "ME" },
      { id: DEPT_C, code: "EE" },
    ] as never);

    const result = await createCentralDrive(centralInput);

    expect(result.success).toBe(true);
    expect(ensureDepartmentsAssigned).toHaveBeenCalledWith(
      expect.anything(),
      "drive-1",
      [DEPT_A, DEPT_B, DEPT_C],
      expect.anything()
    );
  });

  it("forces the drive to be central and department-less", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: DEPT_A, code: "CS" },
    ] as never);

    await createCentralDrive({ ...centralInput, eligibleDepartments: [DEPT_A] });

    expect(prisma.drive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departmentId: null,
          isCentralDrive: true,
          createdByUserId: superAdmin.id,
        }),
      })
    );
  });

  it("drops a department that does not exist or is inactive", async () => {
    // Only A comes back from the active-department lookup.
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: DEPT_A, code: "CS" },
    ] as never);

    await createCentralDrive(centralInput);

    expect(ensureDepartmentsAssigned).toHaveBeenCalledWith(
      expect.anything(),
      "drive-1",
      [DEPT_A],
      expect.anything()
    );
  });

  it("is refused for a non-super-admin caller", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new Error("This action requires SUPER_ADMIN role.")
    );

    const result = await createCentralDrive(centralInput);

    expect(result.success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — drive origin (Item 16) and eligible batches (Item 9)
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

describe("drive origin is decided by the server", () => {
  it("11. a department-created drive is department-owned, never central, authored by the caller", async () => {
    const result = await createDrive(baseDriveInput);

    expect(result.success).toBe(true);
    expect(prisma.drive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCentralDrive: false,
          departmentId: DEPT_A,
          createdByUserId: adminOfA.user.id,
        }),
      })
    );
  });

  it("12. a Super-Admin-created drive is central, department-less, authored by the Super Admin", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([{ id: DEPT_A, code: "CS" }] as never);

    await createCentralDrive({
      companyName: "Globex",
      roleName: "Analyst",
      packageDisplay: "12 LPA",
      minCGPA: 6,
      maxActiveBacklogs: 0,
      applicationStartDate: startDay,
      applicationDeadline: deadline,
      nextStageDate,
      eligibleDepartments: [DEPT_A],
    });

    expect(prisma.drive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCentralDrive: true,
          departmentId: null,
          createdByUserId: superAdmin.id,
        }),
      })
    );
  });

  it("13. a department admin cannot make their drive central, or another department's, through the request", async () => {
    const forged = {
      ...baseDriveInput,
      isCentralDrive: true,
      departmentId: DEPT_B,
      createdByUserId: "someone-else",
    };

    const result = await createDrive(forged as typeof baseDriveInput);

    expect(result.success).toBe(true);
    const [args] = vi.mocked(prisma.drive.create).mock.calls[0];
    expect((args as { data: Record<string, unknown> }).data).toMatchObject({
      isCentralDrive: false,
      departmentId: DEPT_A,
      createdByUserId: adminOfA.user.id,
    });
  });

  it("13. an edit never rewrites origin or owner, whatever the request carries", async () => {
    const forged = { ...baseDriveInput, isCentralDrive: true, departmentId: DEPT_B };

    const result = await updateDrive("drive-1", forged as typeof baseDriveInput);

    expect(result.success).toBe(true);
    const [args] = vi.mocked(prisma.drive.update).mock.calls[0];
    const data = (args as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
  });

  it("13. a department admin cannot edit a central drive, or another department's drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValueOnce({
      ...existingDriveOfA,
      departmentId: null,
      isCentralDrive: true,
    } as never);
    expect((await updateDrive("drive-1", baseDriveInput)).success).toBe(false);

    vi.mocked(prisma.drive.findUnique).mockResolvedValueOnce({
      ...existingDriveOfA,
      departmentId: DEPT_B,
    } as never);
    expect((await updateDrive("drive-1", baseDriveInput)).success).toBe(false);

    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});

describe("eligible batches come from the student database", () => {
  it("9. multiple eligible batches are stored as the drive's one BATCH_YEAR rule", async () => {
    vi.mocked(prisma.student.groupBy).mockResolvedValueOnce([
      { expectedPassoutYear: 2026, _count: { _all: 40 } },
      { expectedPassoutYear: 2027, _count: { _all: 55 } },
    ] as never);

    const result = await createDrive({ ...baseDriveInput, batchYears: ["2027", "2026"] });

    expect(result.success).toBe(true);
    expect(writtenBatchRule()).toEqual(["2026", "2027"]);
  });

  it("9. the options are the batches of the caller's own department", async () => {
    await createDrive(baseDriveInput);

    expect(prisma.student.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId: DEPT_A }) })
    );
  });

  it("10. a department drive with no eligible batch is refused", async () => {
    const result = await createDrive({ ...baseDriveInput, batchYears: [] });

    expect(result.success).toBe(false);
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("refuses a batch no student is in — years are never typed in", async () => {
    const result = await createDrive({ ...baseDriveInput, batchYears: ["2026", "2031"] });

    expect(result).toEqual({ success: false, error: expect.stringContaining("2031") });
    expect(prisma.drive.create).not.toHaveBeenCalled();
  });

  it("keeps a batch the drive already targets, even if no student is in it any more", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...existingDriveOfA,
      eligibilityRules: [{ ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: ["2025"] }],
    } as never);

    const result = await updateDrive("drive-1", { ...baseDriveInput, batchYears: ["2025", "2026"] });

    expect(result.success).toBe(true);
  });

  it("a central drive's batches are checked against the whole institution", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([{ id: DEPT_A, code: "CS" }] as never);

    await createCentralDrive({
      companyName: "Globex",
      roleName: "Analyst",
      packageDisplay: "12 LPA",
      minCGPA: 6,
      maxActiveBacklogs: 0,
      applicationStartDate: startDay,
      applicationDeadline: deadline,
      nextStageDate,
      eligibleDepartments: [DEPT_A],
      batchYears: ["2026"],
    });

    const [args] = vi.mocked(prisma.student.groupBy).mock.calls[0];
    expect((args as { where: Record<string, unknown> }).where).not.toHaveProperty("departmentId");
    expect(writtenBatchRule()).toEqual(["2026"]);
  });
});