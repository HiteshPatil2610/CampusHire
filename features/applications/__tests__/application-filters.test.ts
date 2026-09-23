import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The application filters added in unit 9 (placement, applied date). What must
 * hold: a department admin's list stays inside their department whatever
 * filters are added, every filter value from a URL is validated, and an
 * invalid one is dropped rather than passed on.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn() },
    driveApplication: { count: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { getDriveApplications } from "../queries/get-drive-applications";

const CSE = "dept-cse";

const whereOf = () =>
  (vi.mocked(prisma.driveApplication.findMany).mock.calls[0][0] as { where: Record<string, any> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDepartmentAdmin).mockResolvedValue({ department: { id: CSE } } as never);
  vi.mocked(prisma.drive.findUnique).mockResolvedValue({
    departmentId: null,
    isCentralDrive: true,
    eligibleDepartmentLinks: [{ departmentId: CSE }],
  } as never);
  vi.mocked(prisma.driveApplication.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([] as never);
});

describe("placement and date filters", () => {
  it("narrows to placed applicants", async () => {
    await getDriveApplications({ driveId: "d1", placement: "placed" });

    expect(whereOf().student.placements).toEqual({ some: expect.objectContaining({ revokedAt: null }) });
  });

  it("narrows to applicants who are not placed", async () => {
    await getDriveApplications({ driveId: "d1", placement: "unplaced" });

    expect(whereOf().student.placements).toEqual({ none: expect.objectContaining({ revokedAt: null }) });
  });

  it("narrows to a date range, inclusive of the last day", async () => {
    await getDriveApplications({ driveId: "d1", appliedFrom: "2026-09-01", appliedTo: "2026-09-30" });

    const range = whereOf().appliedAt as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("drops a filter value that is not valid instead of passing it on", async () => {
    await getDriveApplications({
      driveId: "d1",
      placement: "everyone" as never,
      appliedFrom: "yesterday",
      appliedTo: "2026-13-45",
    });

    const where = whereOf();
    expect(where.appliedAt).toBeUndefined();
    expect(where.student.placements).toBeUndefined();
  });
});

describe("department scope survives every filter", () => {
  it("keeps the department on a central drive, whatever else is asked", async () => {
    await getDriveApplications({
      driveId: "d1",
      search: "asha",
      expectedPassoutYear: 2026,
      status: "SELECTED",
      placement: "placed",
      appliedFrom: "2026-09-01",
    });

    expect(whereOf().student.departmentId).toBe(CSE);
    expect(whereOf().driveId).toBe("d1");
  });

  it("cannot be pointed at another department", async () => {
    // There is no department parameter at all: the scope is the session's.
    await getDriveApplications({ driveId: "d1", ...({ departmentId: "dept-it" } as object) });

    expect(whereOf().student.departmentId).toBe(CSE);
  });
});
