import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * One definition of "Placement Rate" (Phase 10). It used to mean placed ÷ all
 * students on the department Overview, placed ÷ eligible on Insights, and
 * placed ÷ registered on the Super Admin's reports — so the same department
 * could show two different rates on two pages. Every query now uses
 * `eligiblePoolSql` + `percentOfPool`; the last test here feeds the same
 * counts to all four and requires the same answer.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    student: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    studentAcademic: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
  requireDepartmentAdmin: vi.fn(async () => ({ department: { id: "dept-cse", code: "CSE" } })),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { eligiblePoolSql, percentOfPool } from "../utils/placement-status";
import { getAdminDashboardStats } from "../queries/get-admin-dashboard-stats";
import { getDepartmentInsights } from "../queries/get-department-insights";
import { getDepartmentMatrix } from "@/features/departments/queries/get-department-matrix";
import { getSystemStats } from "@/features/departments/queries/get-system-stats";

const big = (value: number) => BigInt(value);

/** 200 on the roster, 80 in the eligible pool, 20 of them placed. */
const COUNTS = { total: 200, registered: 120, eligible: 80, placedInPool: 20, placedAll: 21 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("percentOfPool", () => {
  it("is a whole percentage of the pool", () => {
    expect(percentOfPool(20, 80)).toBe(25);
    expect(percentOfPool(1, 3)).toBe(33);
  });

  it("is 0 for an empty pool, never NaN", () => {
    expect(percentOfPool(0, 0)).toBe(0);
  });
});

describe("eligiblePoolSql", () => {
  it("is registered, and either opted in or already placed", () => {
    const sql = eligiblePoolSql("s");
    expect(sql).toContain(`s."isPending" = false`);
    expect(sql).toContain(`s."optedIn" = true`);
    // Placed students stay in the pool even if they opted out afterwards.
    expect(sql).toMatch(/OR EXISTS \(SELECT 1 FROM "StudentPlacement"/);
  });
});

describe("every screen's Placement Rate agrees", () => {
  it("department Overview uses placed ÷ eligible, not placed ÷ all students", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        totalStudents: big(COUNTS.total),
        placedStudents: big(COUNTS.placedAll),
        optedOutStudents: big(10),
        pendingStudents: big(80),
        openDrivesCount: big(2),
        eligibleStudents: big(COUNTS.eligible),
        placedInPool: big(COUNTS.placedInPool),
      },
    ] as never);

    const stats = await getAdminDashboardStats();
    expect(stats.placementRate).toBe(25); // not 21/200 = 11
  });

  it("department Insights", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        totalStudents: big(COUNTS.total),
        eligibleStudents: big(COUNTS.eligible),
        appliedStudents: big(40),
        placedStudents: big(COUNTS.placedInPool),
        activeDrivesCount: big(2),
      },
    ] as never);

    const insights = await getDepartmentInsights();
    expect(insights.placementRate).toBe(25);
  });

  it("Super Admin department matrix uses placed ÷ eligible, not placed ÷ registered", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        id: "dept-cse",
        name: "Computer",
        code: "CSE",
        isActive: true,
        totalStudents: big(COUNTS.total),
        registeredStudents: big(COUNTS.registered),
        placedStudents: big(COUNTS.placedAll),
        eligibleStudents: big(COUNTS.eligible),
        appliedStudents: big(40),
        placedInPool: big(COUNTS.placedInPool),
        adminCount: big(1),
        openDrives: big(2),
      },
    ] as never);

    const [row] = await getDepartmentMatrix();
    expect(row.placementRate).toBe(25); // not 21/120 = 18
    expect(row).toMatchObject({ eligibleStudents: 80, appliedStudents: 40, placedInPool: 20 });
  });

  it("Super Admin system stats uses placed ÷ eligible, not placed ÷ registered", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        totalStudents: big(COUNTS.total),
        registeredStudents: big(COUNTS.registered),
        totalDepartments: big(1),
        activeDepartments: big(1),
        totalAdmins: big(1),
        totalDrives: big(3),
        openDrives: big(2),
        placedStudents: big(COUNTS.placedAll),
        optedOutStudents: big(10),
        eligibleStudents: big(COUNTS.eligible),
        placedInPool: big(COUNTS.placedInPool),
      },
    ] as never);

    const stats = await getSystemStats();
    expect(stats.overallPlacementRate).toBe(25);
  });
});
