import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The department roster's year filter (All / 3rd Year / 4th Year). The year
 * level is derived from the batch, so the filter is the one passout year that
 * level means this academic cycle — and it never widens the department scope.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { student: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(async () => ({ department: { id: "dept-comp", code: "COMP" } })),
}));

import { prisma } from "@/lib/prisma";
import { getDepartmentStudents } from "../queries/get-department-students";

/** 2026-09-23, India time: the 2026-27 cycle. */
const SEPTEMBER = new Date("2026-09-23T06:30:00Z");

const whereOf = () => (vi.mocked(prisma.student.findMany).mock.calls[0][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(SEPTEMBER);
});
afterEach(() => vi.useRealTimers());

describe("roster year filter", () => {
  it("4th Year is this cycle's final-year batch", async () => {
    await getDepartmentStudents({ year: "fourth" });
    expect(whereOf()).toMatchObject({ expectedPassoutYear: 2027, departmentId: "dept-comp" });
  });

  it("3rd Year is the batch after it", async () => {
    await getDepartmentStudents({ year: "third" });
    expect(whereOf()).toMatchObject({ expectedPassoutYear: 2028, departmentId: "dept-comp" });
  });

  it("All does not filter by batch", async () => {
    await getDepartmentStudents({ year: "all" });
    expect(whereOf()).not.toHaveProperty("expectedPassoutYear");

    vi.clearAllMocks();
    await getDepartmentStudents();
    expect(whereOf()).not.toHaveProperty("expectedPassoutYear");
  });

  it("combines with the status filter and the count uses the same filter", async () => {
    await getDepartmentStudents({ year: "fourth", status: "pending" });
    expect(whereOf()).toMatchObject({ isPending: true, expectedPassoutYear: 2027 });
    expect(vi.mocked(prisma.student.count).mock.calls[0][0]).toEqual({ where: whereOf() });
  });
});
