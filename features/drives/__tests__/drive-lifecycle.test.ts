import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The drive lifecycle.
 *
 *   MASTER DRIVE      DRAFT → PUBLISHED → ARCHIVED
 *   DEPARTMENT DRIVE  ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED
 *
 * The distinction these tests defend: **administrative CLOSED is not "the
 * deadline passed"**. Open/closed by deadline stays derived at read time and is
 * never stored, so a drive can be PUBLISHED with an expired deadline, or CLOSED
 * while its deadline is still in the future.
 *
 * The other thing they defend is that locking is enforced on the server. A
 * disabled input is not a lock: these go straight at the actions.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn(), update: vi.fn() },
    driveDepartmentConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    department: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
  requireDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: { CREATE: "CREATE", UPDATE: "UPDATE" },
  AuditEntityType: { DRIVE: "Drive" },
}));

vi.mock("@/features/notifications/actions/notify-eligible-students-of-drive", () => ({
  notifyEligibleStudentsOfDrive: vi.fn(async () => ({ notified: 3 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireDepartmentAdmin } from "@/lib/auth";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import {
  canTransitionMaster,
  canTransitionDepartmentDrive,
  isDepartmentDriveLocked,
  findLockedMasterFieldChanges,
  LOCKED_MASTER_FIELDS,
  EDITABLE_AFTER_PUBLISH_FIELDS,
  LOCKED_DEPARTMENT_DRIVE_FIELDS,
} from "../domain/drive-lifecycle";
import { publishDepartmentDrive } from "../actions/publish-department-drive";
import { setDepartmentDriveStatus } from "../actions/set-department-drive-status";
import { setMasterDriveStatus } from "../actions/set-master-drive-status";
import { saveDriveDepartmentConfig } from "../actions/save-drive-department-config";
import { AVAILABLE_STUDENT_FIELDS } from "../data/application-fields-catalog";

const DRIVE_ID = "drive-1";
const DEPT_A = "dept-a";

const adminOfA = {
  user: { id: "user-admin-a" },
  admin: { id: "admin-a", departmentId: DEPT_A },
  department: { id: DEPT_A, name: "Computer", code: "CS", isActive: true },
};

const centralDrive = {
  id: DRIVE_ID,
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  isCentralDrive: true,
  lifecycleStatus: "DRAFT" as const,
  eligibleDepartmentLinks: [{ departmentId: DEPT_A }],
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOfA as never);
  vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "user-super" } as never);
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(centralDrive as never);
  vi.mocked(prisma.drive.update).mockResolvedValue({} as never);
  vi.mocked(prisma.driveDepartmentConfig.update).mockResolvedValue({} as never);
  vi.mocked(prisma.driveDepartmentConfig.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.driveDepartmentConfig.count).mockResolvedValue(1 as never);
  vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
    id: "config-1",
    status: "CONFIGURED",
    lockedAt: null,
    applicationFields: null,
  } as never);
});

// ---------------------------------------------------------------------------
// Transition rules
// ---------------------------------------------------------------------------

describe("master drive transitions", () => {
  it("allows DRAFT → PUBLISHED → ARCHIVED", () => {
    expect(canTransitionMaster("DRAFT", "PUBLISHED").valid).toBe(true);
    expect(canTransitionMaster("PUBLISHED", "ARCHIVED").valid).toBe(true);
    expect(canTransitionMaster("DRAFT", "ARCHIVED").valid).toBe(true);
  });

  it("refuses to move backwards or out of ARCHIVED", () => {
    expect(canTransitionMaster("PUBLISHED", "DRAFT").valid).toBe(false);
    expect(canTransitionMaster("ARCHIVED", "PUBLISHED").valid).toBe(false);
    expect(canTransitionMaster("ARCHIVED", "DRAFT").valid).toBe(false);
  });

  it("refuses a no-op transition", () => {
    expect(canTransitionMaster("DRAFT", "DRAFT").valid).toBe(false);
  });
});

describe("department drive transitions", () => {
  it("walks the happy path", () => {
    expect(canTransitionDepartmentDrive("ASSIGNED", "CONFIGURED").valid).toBe(true);
    expect(canTransitionDepartmentDrive("CONFIGURED", "PUBLISHED").valid).toBe(true);
    expect(canTransitionDepartmentDrive("PUBLISHED", "CLOSED").valid).toBe(true);
    expect(canTransitionDepartmentDrive("CLOSED", "ARCHIVED").valid).toBe(true);
  });

  it("allows publishing straight from ASSIGNED", () => {
    expect(canTransitionDepartmentDrive("ASSIGNED", "PUBLISHED").valid).toBe(true);
  });

  it("never un-publishes", () => {
    expect(canTransitionDepartmentDrive("PUBLISHED", "CONFIGURED").valid).toBe(false);
    expect(canTransitionDepartmentDrive("PUBLISHED", "ASSIGNED").valid).toBe(false);
    expect(canTransitionDepartmentDrive("CLOSED", "PUBLISHED").valid).toBe(false);
  });

  it("treats ARCHIVED as terminal", () => {
    expect(canTransitionDepartmentDrive("ARCHIVED", "PUBLISHED").valid).toBe(false);
    expect(canTransitionDepartmentDrive("ARCHIVED", "CLOSED").valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The lock contract
// ---------------------------------------------------------------------------

describe("locking contract", () => {
  it("locks from lockedAt, not from status", () => {
    // A CLOSED or ARCHIVED instance stays locked: students applied against
    // that content and the record must keep matching what they were shown.
    expect(isDepartmentDriveLocked({ lockedAt: new Date() })).toBe(true);
    expect(isDepartmentDriveLocked({ lockedAt: null })).toBe(false);
  });

  it("freezes the application form and nothing else on the instance", () => {
    expect(LOCKED_DEPARTMENT_DRIVE_FIELDS).toEqual(["applicationFields"]);
  });

  it("keeps logistics editable after publication", () => {
    // A room change must not require un-publishing.
    expect(EDITABLE_AFTER_PUBLISH_FIELDS).toContain("venue");
    expect(EDITABLE_AFTER_PUBLISH_FIELDS).toContain("reportingTime");
    expect(EDITABLE_AFTER_PUBLISH_FIELDS).toContain("coordinatorName");
    expect(EDITABLE_AFTER_PUBLISH_FIELDS).not.toContain("applicationFields");
  });

  it("freezes the fields that describe the opportunity on the master", () => {
    for (const field of [
      "roleName",
      "minCGPA",
      "maxActiveBacklogs",
      "applicationDeadline",
      "packageOffered",
    ]) {
      expect(LOCKED_MASTER_FIELDS).toContain(field);
    }
  });

  it("detects a changed locked master field", () => {
    const changed = findLockedMasterFieldChanges(
      { roleName: "Engineer", minCGPA: 7 },
      { roleName: "Senior Engineer", minCGPA: 7 }
    );

    expect(changed).toEqual(["roleName"]);
  });

  it("reports nothing when locked fields are resubmitted unchanged", () => {
    expect(
      findLockedMasterFieldChanges(
        { roleName: "Engineer", minCGPA: 7 },
        { roleName: "Engineer", minCGPA: 7 }
      )
    ).toEqual([]);
  });

  it("compares dates by instant, not identity", () => {
    const iso = "2026-11-01T00:00:00.000Z";
    expect(
      findLockedMasterFieldChanges(
        { applicationDeadline: new Date(iso) },
        { applicationDeadline: new Date(iso) }
      )
    ).toEqual([]);
  });

  it("does not report an unlocked field as a violation", () => {
    expect(
      findLockedMasterFieldChanges(
        { roleName: "Engineer", venue: "Hall A" },
        { roleName: "Engineer", venue: "Hall B" }
      )
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Publishing a department drive
// ---------------------------------------------------------------------------

describe("publishDepartmentDrive", () => {
  it("records when, who, and the lock", async () => {
    const result = await publishDepartmentDrive({ driveId: DRIVE_ID });

    expect(result.success).toBe(true);

    const [call] = vi.mocked(prisma.driveDepartmentConfig.update).mock.calls;
    const data = (call[0] as { data: Record<string, unknown> }).data;

    expect(data.status).toBe("PUBLISHED");
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.publishedByUserId).toBe("user-admin-a");
    expect(data.lockedAt).toBeInstanceOf(Date);
  });

  it("notifies only this department's students", async () => {
    await publishDepartmentDrive({ driveId: DRIVE_ID });

    expect(notifyEligibleStudentsOfDrive).toHaveBeenCalledWith(
      expect.anything(),
      { departmentIds: [DEPT_A] }
    );
  });

  it("refuses when the drive is not assigned to the caller's department", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      null as never
    );

    const result = await publishDepartmentDrive({ driveId: DRIVE_ID });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.update).not.toHaveBeenCalled();
  });

  it("refuses to publish an already-published instance", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-1",
      status: "PUBLISHED",
      lockedAt: new Date(),
      applicationFields: null,
    } as never);

    const result = await publishDepartmentDrive({ driveId: DRIVE_ID });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.update).not.toHaveBeenCalled();
  });

  it("is refused for a caller who is not a department admin", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(
      new Error("This action requires DEPT_ADMIN role.")
    );

    const result = await publishDepartmentDrive({ driveId: DRIVE_ID });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Administrative close is not deadline expiry
// ---------------------------------------------------------------------------

describe("setDepartmentDriveStatus", () => {
  beforeEach(() => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-1",
      status: "PUBLISHED",
      lockedAt: new Date(),
      applicationFields: null,
    } as never);
  });

  it("closes a published drive regardless of its deadline", async () => {
    const result = await setDepartmentDriveStatus({
      driveId: DRIVE_ID,
      status: "CLOSED",
    });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.update).mock.calls;
    expect((call[0] as { data: Record<string, unknown> }).data.status).toBe(
      "CLOSED"
    );
  });

  it("never clears the lock when closing", async () => {
    await setDepartmentDriveStatus({ driveId: DRIVE_ID, status: "CLOSED" });

    const [call] = vi.mocked(prisma.driveDepartmentConfig.update).mock.calls;
    const data = (call[0] as { data: Record<string, unknown> }).data;

    expect(data).not.toHaveProperty("lockedAt");
    expect(data).not.toHaveProperty("publishedAt");
  });

  it("refuses to close another department's instance", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      null as never
    );

    const result = await setDepartmentDriveStatus({
      driveId: DRIVE_ID,
      status: "CLOSED",
    });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Master lifecycle
// ---------------------------------------------------------------------------

describe("setMasterDriveStatus", () => {
  it("publishes a draft that has at least one assignment", async () => {
    const result = await setMasterDriveStatus({
      driveId: DRIVE_ID,
      status: "PUBLISHED",
    });

    expect(result.success).toBe(true);
  });

  it("refuses to publish a master drive assigned to nobody", async () => {
    vi.mocked(prisma.driveDepartmentConfig.count).mockResolvedValue(0 as never);

    const result = await setMasterDriveStatus({
      driveId: DRIVE_ID,
      status: "PUBLISHED",
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("refuses for a department-owned drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...centralDrive,
      isCentralDrive: false,
    } as never);

    const result = await setMasterDriveStatus({
      driveId: DRIVE_ID,
      status: "ARCHIVED",
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("is refused for a department admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new Error("This action requires SUPER_ADMIN role.")
    );

    const result = await setMasterDriveStatus({
      driveId: DRIVE_ID,
      status: "ARCHIVED",
    });

    expect(result.success).toBe(false);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Server-side lock enforcement on configuration
// ---------------------------------------------------------------------------

describe("saveDriveDepartmentConfig — lock enforcement", () => {
  const configInput = {
    driveId: DRIVE_ID,
    venue: "Hall B",
    reportingTime: "10:00",
    fields: [{ key: "name", required: true }],
  };

  beforeEach(() => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...centralDrive,
      eligibleDepartmentLinks: [{ departmentId: DEPT_A }],
    } as never);
  });

  it("moves an ASSIGNED instance to CONFIGURED on first save", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-1",
      status: "ASSIGNED",
      lockedAt: null,
      applicationFields: null,
    } as never);

    const result = await saveDriveDepartmentConfig(configInput);

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (call[0] as { update: Record<string, unknown> }).update;
    expect(update.status).toBe("CONFIGURED");
  });

  it("refuses an application-form change once published", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-1",
      status: "PUBLISHED",
      lockedAt: new Date(),
      applicationFields: JSON.stringify([{ key: "somethingElse" }]),
    } as never);

    const result = await saveDriveDepartmentConfig(configInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/locked/i);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });

  it("still allows a logistics-only save once published", async () => {
    // Same application form, different venue — a room change must not need
    // un-publishing. The stored value is built from the real catalog the
    // action reads, so "unchanged" means byte-identical rather than guessed.
    const entry = AVAILABLE_STUDENT_FIELDS.find((item) => item.key === "name")!;
    const stored = JSON.stringify([
      {
        key: entry.key,
        label: entry.label,
        source: entry.source,
        category: entry.category,
        icon: entry.icon,
        description: entry.description,
        required: true,
        enabled: true,
      },
    ]);

    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue({
      id: "config-1",
      status: "PUBLISHED",
      lockedAt: new Date(),
      applicationFields: stored,
    } as never);

    const result = await saveDriveDepartmentConfig(configInput);

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (call[0] as { update: Record<string, unknown> }).update;

    // The form is not rewritten, and publishing is not undone.
    expect(update).not.toHaveProperty("applicationFields");
    expect(update).not.toHaveProperty("status");
    expect(update.venue).toBe("Hall B");
  });
});
