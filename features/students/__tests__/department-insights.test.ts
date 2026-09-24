import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Department Insights (Phase 9, Item 20): the eligible → applied → placed
 * funnel, rate math, and that a filter reaches the underlying query rather
 * than being silently dropped. The raw-SQL aggregation itself is exercised
 * against production data by the same pattern every other `$queryRaw`
 * dashboard query in this app uses (untested directly; `getAdminDashboardStats`
 * has the same shape) — what is tested here is the surrounding logic: rate
 * calculation (including division by zero), bigint conversion, and that
 * batch/semester filters are actually passed through to the query.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    student: { groupBy: vi.fn(async () => []) },
    studentAcademic: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    requireDepartmentAdmin: vi.fn(),
    AuthorizationError,
  };
});

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { getDepartmentInsights } from "../queries/get-department-insights";

const DEPT = { id: "dept-cse", code: "CSE" };

function countsRow(over: Partial<Record<string, bigint>> = {}) {
  return {
    totalStudents: BigInt(0),
    eligibleStudents: BigInt(0),
    appliedStudents: BigInt(0),
    placedStudents: BigInt(0),
    activeDrivesCount: BigInt(0),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDepartmentAdmin).mockResolvedValue({ department: DEPT } as never);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([countsRow()] as never);
});

describe("getDepartmentInsights", () => {
  it("requires a department admin session", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValueOnce(new AuthorizationError("Department admin only"));

    await expect(getDepartmentInsights()).rejects.toThrow("Department admin only");
  });

  it("converts every count from bigint to a plain number", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      countsRow({
        totalStudents: BigInt(100),
        eligibleStudents: BigInt(80),
        appliedStudents: BigInt(40),
        placedStudents: BigInt(20),
        activeDrivesCount: BigInt(3),
      }),
    ] as never);

    const result = await getDepartmentInsights();

    expect(result).toMatchObject({
      totalStudents: 100,
      eligibleStudents: 80,
      appliedStudents: 40,
      placedStudents: 20,
      activeDrivesCount: 3,
    });
    expect(typeof result.totalStudents).toBe("number");
  });

  it("placement rate and participation rate are fractions of the eligible pool, not the whole roster", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      countsRow({
        totalStudents: BigInt(200), // includes pending/opted-out students
        eligibleStudents: BigInt(80),
        appliedStudents: BigInt(40),
        placedStudents: BigInt(20),
      }),
    ] as never);

    const result = await getDepartmentInsights();

    // 20/80 and 40/80 — not 20/200 or 40/200.
    expect(result.placementRate).toBe(25);
    expect(result.participationRate).toBe(50);
  });

  it("an empty department reports 0% rates, not NaN or a division error", async () => {
    const result = await getDepartmentInsights();

    expect(result).toMatchObject({
      eligibleStudents: 0,
      placementRate: 0,
      participationRate: 0,
    });
  });

  it("passes the batch filter through to the query instead of dropping it", async () => {
    await getDepartmentInsights({ batchYear: 2027 });

    const [, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown[];
    expect(values).toContain(2027);
  });

  it("passes the semester filter through to the query instead of dropping it", async () => {
    await getDepartmentInsights({ semester: 6 });

    const [, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown[];
    expect(values).toContain(6);
  });

  it("combines batch and semester filters in the same query", async () => {
    await getDepartmentInsights({ batchYear: 2027, semester: 6 });

    const [, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown[];
    expect(values).toContain(2027);
    expect(values).toContain(6);
  });

  it("passes null for an omitted filter rather than a stray zero", async () => {
    await getDepartmentInsights();

    const [, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as unknown[];
    expect(values).toContain(null);
    expect(values).not.toContain(0);
  });

  it("returns the department's batches (the shared batch-year helper) and semesters for the dropdowns", async () => {
    vi.mocked(prisma.student.groupBy).mockResolvedValueOnce([
      { expectedPassoutYear: 2027, _count: { _all: 5 } },
      { expectedPassoutYear: 2028, _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.studentAcademic.findMany).mockResolvedValueOnce([
      { currentSemester: 6 },
      { currentSemester: 7 },
    ] as never);

    const result = await getDepartmentInsights();

    expect(result.availableBatches).toEqual([2027, 2028]);
    expect(result.availableSemesters).toEqual([6, 7]);
    // Scoped to this admin's department, never institution-wide.
    expect(vi.mocked(prisma.student.groupBy).mock.calls[0][0]).toMatchObject({
      where: { departmentId: DEPT.id },
    });
  });
});
