import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Master Drive → Department Drive assignment.
 *
 *   SUPER_ADMIN creates a Master Drive (DRAFT)
 *     → selects departments
 *     → one Department Drive instance per department, at ASSIGNED
 *     → that department's admin configures and later publishes it
 *
 * Both halves of an assignment — the eligibility edge
 * (`DriveEligibleDepartment`) and the instance (`DriveDepartmentConfig`) — are
 * the same fact and are written together in one transaction. These tests pin
 * that, the idempotency, the application-protection on removal, and the
 * authorization boundary.
 */

vi.mock("@/lib/prisma", () => {
  const tx = {
    drive: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    driveDepartmentConfig: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    driveEligibleDepartment: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    driveApplication: { count: vi.fn() },
  };

  return {
    prisma: {
      ...tx,
      department: { findMany: vi.fn(), findUnique: vi.fn() },
      student: { groupBy: vi.fn() },
      $transaction: vi.fn(),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
  requireDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: { ASSIGN: "ASSIGN", UNASSIGN: "UNASSIGN" },
  AuditEntityType: { DRIVE: "Drive" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { assignDriveToDepartments } from "../actions/assign-drive-departments";
import { unassignDriveDepartment } from "../actions/unassign-drive-department";
import {
  ensureDepartmentsAssigned,
  removeDepartmentAssignment,
  reconcileDepartmentAssignments,
  findBlockedRemovals,
} from "../domain/department-assignment";

const DRIVE_ID = "drive-1";
const DEPT_A = "dept-a";
const DEPT_B = "dept-b";
const DEPT_C = "dept-c";

/** The mocked transaction client the domain functions receive. */
const tx = (prisma as unknown as { __tx: Record<string, never> })
  .__tx as unknown as {
  driveDepartmentConfig: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  driveEligibleDepartment: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  driveApplication: { count: ReturnType<typeof vi.fn> };
};

const centralDrive = {
  id: DRIVE_ID,
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  isCentralDrive: true,
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireSuperAdmin).mockResolvedValue({
    id: "user-super",
    role: "SUPER_ADMIN",
  } as never);

  // `$transaction` is overloaded, so the mock is reached through an untyped
  // handle rather than fighting the overload set in a test.
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (client: unknown) => unknown) => fn(tx)
  );

  vi.mocked(prisma.drive.findUnique).mockResolvedValue(centralDrive as never);

  // Honour the `where: { id: { in: [...] } }` filter the action passes, so
  // "which departments are real and active" is answered per call rather than
  // returning the whole catalogue every time.
  const ALL_DEPARTMENTS = [
    { id: DEPT_A, code: "CS" },
    { id: DEPT_B, code: "ME" },
    { id: DEPT_C, code: "EE" },
  ];
  vi.mocked(prisma.department.findMany).mockImplementation((async (
    args?: { where?: { id?: { in?: string[] } } }
  ) => {
    const requested = args?.where?.id?.in;
    return requested
      ? ALL_DEPARTMENTS.filter((d) => requested.includes(d.id))
      : ALL_DEPARTMENTS;
  }) as never);
  vi.mocked(prisma.department.findUnique).mockResolvedValue({
    id: DEPT_A,
    code: "CS",
  } as never);

  tx.driveDepartmentConfig.findMany.mockResolvedValue([]);
  tx.driveDepartmentConfig.createMany.mockResolvedValue({ count: 0 });
  tx.driveDepartmentConfig.deleteMany.mockResolvedValue({ count: 1 });
  tx.driveEligibleDepartment.findMany.mockResolvedValue([]);
  tx.driveEligibleDepartment.createMany.mockResolvedValue({ count: 0 });
  tx.driveEligibleDepartment.deleteMany.mockResolvedValue({ count: 1 });
  tx.driveApplication.count.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// The domain operation
// ---------------------------------------------------------------------------

describe("ensureDepartmentsAssigned", () => {
  it("creates both halves for a newly assigned department", async () => {
    const outcome = await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [
      DEPT_A,
    ]);

    expect(outcome.assigned).toEqual([DEPT_A]);
    expect(tx.driveDepartmentConfig.createMany).toHaveBeenCalledWith({
      data: [{ driveId: DRIVE_ID, departmentId: DEPT_A, status: "ASSIGNED" }],
      skipDuplicates: true,
    });
    expect(tx.driveEligibleDepartment.createMany).toHaveBeenCalledWith({
      data: [{ driveId: DRIVE_ID, departmentId: DEPT_A }],
      skipDuplicates: true,
    });
  });

  it("initializes every new instance at ASSIGNED", async () => {
    await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [DEPT_A, DEPT_B]);

    const [call] = tx.driveDepartmentConfig.createMany.mock.calls;
    for (const row of call[0].data) {
      expect(row.status).toBe("ASSIGNED");
    }
  });

  it("assigns multiple departments in one call", async () => {
    const outcome = await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [
      DEPT_A,
      DEPT_B,
      DEPT_C,
    ]);

    expect(outcome.assigned).toEqual([DEPT_A, DEPT_B, DEPT_C]);
    expect(tx.driveEligibleDepartment.createMany.mock.calls[0][0].data).toHaveLength(3);
  });

  it("is idempotent — an already-assigned department is not recreated", async () => {
    tx.driveDepartmentConfig.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
    ]);

    const outcome = await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [
      DEPT_A,
      DEPT_B,
    ]);

    expect(outcome.assigned).toEqual([DEPT_B]);
    expect(outcome.alreadyAssigned).toEqual([DEPT_A]);
    // Only the genuinely new instance is created — an existing one keeps its
    // status and whatever its admin configured.
    expect(tx.driveDepartmentConfig.createMany.mock.calls[0][0].data).toEqual([
      { driveId: DRIVE_ID, departmentId: DEPT_B, status: "ASSIGNED" },
    ]);
  });

  it("never touches an existing instance's row", async () => {
    tx.driveDepartmentConfig.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
    ]);

    await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [DEPT_A]);

    expect(tx.driveDepartmentConfig.createMany).not.toHaveBeenCalled();
    expect(tx.driveDepartmentConfig.deleteMany).not.toHaveBeenCalled();
  });

  it("collapses a duplicated department id in the request", async () => {
    await ensureDepartmentsAssigned(tx as never, DRIVE_ID, [
      DEPT_A,
      DEPT_A,
      DEPT_B,
    ]);

    expect(tx.driveEligibleDepartment.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("does nothing for an empty department list", async () => {
    const outcome = await ensureDepartmentsAssigned(tx as never, DRIVE_ID, []);

    expect(outcome).toEqual({ assigned: [], alreadyAssigned: [] });
    expect(tx.driveEligibleDepartment.createMany).not.toHaveBeenCalled();
  });

  it("can seed instances as PUBLISHED for a department's own drive", async () => {
    await ensureDepartmentsAssigned(
      tx as never,
      DRIVE_ID,
      [DEPT_A],
      "PUBLISHED"
    );

    expect(tx.driveDepartmentConfig.createMany.mock.calls[0][0].data[0].status).toBe(
      "PUBLISHED"
    );
  });
});

// ---------------------------------------------------------------------------
// Removal protection
// ---------------------------------------------------------------------------

describe("removeDepartmentAssignment", () => {
  it("removes both halves when the department has no applications", async () => {
    tx.driveApplication.count.mockResolvedValue(0);

    const result = await removeDepartmentAssignment(
      tx as never,
      DRIVE_ID,
      DEPT_A
    );

    expect(result).toEqual({ removed: true });
    expect(tx.driveDepartmentConfig.deleteMany).toHaveBeenCalledWith({
      where: { driveId: DRIVE_ID, departmentId: DEPT_A },
    });
    expect(tx.driveEligibleDepartment.deleteMany).toHaveBeenCalledWith({
      where: { driveId: DRIVE_ID, departmentId: DEPT_A },
    });
  });

  it("refuses and preserves history when applications exist", async () => {
    tx.driveApplication.count.mockResolvedValue(49);

    const result = await removeDepartmentAssignment(
      tx as never,
      DRIVE_ID,
      DEPT_A
    );

    expect(result).toEqual({ removed: false, applicationCount: 49 });
    expect(tx.driveDepartmentConfig.deleteMany).not.toHaveBeenCalled();
    expect(tx.driveEligibleDepartment.deleteMany).not.toHaveBeenCalled();
  });

  it("counts applications through the applicant's department", async () => {
    await removeDepartmentAssignment(tx as never, DRIVE_ID, DEPT_A);

    expect(tx.driveApplication.count).toHaveBeenCalledWith({
      where: { driveId: DRIVE_ID, student: { departmentId: DEPT_A } },
    });
  });
});

describe("reconcileDepartmentAssignments", () => {
  it("adds new departments and drops unconfigured ones", async () => {
    tx.driveEligibleDepartment.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
      { departmentId: DEPT_B },
    ]);
    tx.driveApplication.count.mockResolvedValue(0);

    const outcome = await reconcileDepartmentAssignments(
      tx as never,
      DRIVE_ID,
      [DEPT_A, DEPT_C]
    );

    expect(outcome.removed).toEqual([DEPT_B]);
    expect(outcome.blocked).toEqual([]);
    expect(outcome.assigned).toContain(DEPT_C);
  });

  it("keeps a department whose students have applied", async () => {
    tx.driveEligibleDepartment.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
      { departmentId: DEPT_B },
    ]);
    tx.driveApplication.count.mockResolvedValue(7);

    const outcome = await reconcileDepartmentAssignments(
      tx as never,
      DRIVE_ID,
      [DEPT_A]
    );

    expect(outcome.removed).toEqual([]);
    expect(outcome.blocked).toEqual([
      { departmentId: DEPT_B, applicationCount: 7 },
    ]);
  });
});

describe("findBlockedRemovals", () => {
  it("reports blocked removals before anything is written", async () => {
    tx.driveEligibleDepartment.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
      { departmentId: DEPT_B },
    ]);
    tx.driveApplication.count.mockResolvedValue(3);

    const blocked = await findBlockedRemovals(tx as never, DRIVE_ID, [DEPT_A]);

    expect(blocked).toEqual([{ departmentId: DEPT_B, applicationCount: 3 }]);
    expect(tx.driveDepartmentConfig.deleteMany).not.toHaveBeenCalled();
  });

  it("reports nothing when no department is being dropped", async () => {
    tx.driveEligibleDepartment.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
    ]);

    expect(
      await findBlockedRemovals(tx as never, DRIVE_ID, [DEPT_A, DEPT_B])
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The Super Admin action
// ---------------------------------------------------------------------------

describe("assignDriveToDepartments", () => {
  it("assigns a single department", async () => {
    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.assigned).toEqual([DEPT_A]);
  });

  it("assigns multiple departments at once", async () => {
    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A, DEPT_B, DEPT_C],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.assigned).toEqual([DEPT_A, DEPT_B, DEPT_C]);
    }
  });

  it("treats a duplicate assignment as a reported no-op", async () => {
    tx.driveDepartmentConfig.findMany.mockResolvedValue([
      { departmentId: DEPT_A },
    ]);

    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.assigned).toEqual([]);
      expect(result.alreadyAssigned).toEqual([DEPT_A]);
    }
  });

  it("runs the whole assignment in one transaction", async () => {
    await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A, DEPT_B],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("skips a department that does not exist or is inactive", async () => {
    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A, "dept-gone"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.assigned).toEqual([DEPT_A]);
      expect(result.skipped).toEqual(["dept-gone"]);
    }
  });

  it("refuses to assign a department-owned drive to other departments", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...centralDrive,
      isCentralDrive: false,
    } as never);

    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_B],
    });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when the drive does not exist", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(null as never);

    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A],
    });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("is refused for a department admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new Error("This action requires SUPER_ADMIN role. You have DEPT_ADMIN role.")
    );

    const result = await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A],
    });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("audits the assignment", async () => {
    await assignDriveToDepartments({
      driveId: DRIVE_ID,
      departmentIds: [DEPT_A, DEPT_B],
    });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ASSIGN",
        entityType: "Drive",
        entityId: DRIVE_ID,
        metadata: expect.objectContaining({
          assignedDepartmentCodes: ["CS", "ME"],
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// The Super Admin removal action
// ---------------------------------------------------------------------------

describe("unassignDriveDepartment", () => {
  it("removes an unconfigured department with no applications", async () => {
    tx.driveApplication.count.mockResolvedValue(0);

    const result = await unassignDriveDepartment({
      driveId: DRIVE_ID,
      departmentId: DEPT_A,
    });

    expect(result.success).toBe(true);
    expect(tx.driveDepartmentConfig.deleteMany).toHaveBeenCalled();
    expect(tx.driveEligibleDepartment.deleteMany).toHaveBeenCalled();
  });

  it("refuses removal when the department has applications", async () => {
    tx.driveApplication.count.mockResolvedValue(49);

    const result = await unassignDriveDepartment({
      driveId: DRIVE_ID,
      departmentId: DEPT_A,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.applicationCount).toBe(49);
      expect(result.error).toMatch(/CS/);
    }
    expect(tx.driveDepartmentConfig.deleteMany).not.toHaveBeenCalled();
  });

  it("does not audit a refused removal", async () => {
    tx.driveApplication.count.mockResolvedValue(5);

    await unassignDriveDepartment({
      driveId: DRIVE_ID,
      departmentId: DEPT_A,
    });

    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("audits a successful removal", async () => {
    tx.driveApplication.count.mockResolvedValue(0);

    await unassignDriveDepartment({
      driveId: DRIVE_ID,
      departmentId: DEPT_A,
    });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UNASSIGN",
        entityId: DRIVE_ID,
        metadata: expect.objectContaining({ unassignedDepartmentCode: "CS" }),
      })
    );
  });

  it("is refused for a department admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new Error("This action requires SUPER_ADMIN role.")
    );

    const result = await unassignDriveDepartment({
      driveId: DRIVE_ID,
      departmentId: DEPT_A,
    });

    expect(result.success).toBe(false);
    expect(tx.driveDepartmentConfig.deleteMany).not.toHaveBeenCalled();
  });
});
