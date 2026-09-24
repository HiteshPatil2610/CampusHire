import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The department roster's batch filter (Phase 8, Item 17): All / 3rd Year /
 * 4th Year / Graduated, multi-select. Each category is derived from the
 * student's batch plus the current academic cycle — never a stored tag — and
 * the filter never widens past the admin's own department.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { student: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(async () => ({ department: { id: "dept-comp", code: "COMP" } })),
}));

import { prisma } from "@/lib/prisma";
import { getDepartmentStudents } from "../queries/get-department-students";

/** 2026-09-23, India time: the 2026-27 cycle, final-year passout 2027. */
const SEPTEMBER = new Date("2026-09-23T06:30:00Z");

const whereOf = () => (vi.mocked(prisma.student.findMany).mock.calls[0][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(SEPTEMBER);
});
afterEach(() => vi.useRealTimers());

describe("roster batch filter", () => {
  it("4th Year is this cycle's final-year batch", async () => {
    await getDepartmentStudents({ years: ["fourth"] });
    expect(whereOf()).toMatchObject({ OR: [{ expectedPassoutYear: 2027 }], departmentId: "dept-comp" });
  });

  it("3rd Year is the batch after it", async () => {
    await getDepartmentStudents({ years: ["third"] });
    expect(whereOf()).toMatchObject({ OR: [{ expectedPassoutYear: 2028 }], departmentId: "dept-comp" });
  });

  it("Graduated is an open-ended range, not one passout year", async () => {
    await getDepartmentStudents({ years: ["graduated"] });
    expect(whereOf()).toMatchObject({
      OR: [{ expectedPassoutYear: { lt: 2027 } }],
      departmentId: "dept-comp",
    });
  });

  it("multi-select ORs the selected categories together", async () => {
    await getDepartmentStudents({ years: ["third", "fourth"] });
    expect(whereOf()).toMatchObject({
      OR: [{ expectedPassoutYear: 2028 }, { expectedPassoutYear: 2027 }],
    });
  });

  it("All does not filter by batch — empty array or omitted", async () => {
    await getDepartmentStudents({ years: [] });
    expect(whereOf()).not.toHaveProperty("OR");

    vi.clearAllMocks();
    await getDepartmentStudents();
    expect(whereOf()).not.toHaveProperty("OR");
  });

  it("combines with the status filter and the count uses the same filter", async () => {
    await getDepartmentStudents({ years: ["fourth"], status: "pending" });
    expect(whereOf()).toMatchObject({ isPending: true, OR: [{ expectedPassoutYear: 2027 }] });
    expect(vi.mocked(prisma.student.count).mock.calls[0][0]).toEqual({ where: whereOf() });
  });

  it("a batch filter and a search term do not collide on the same Prisma key", async () => {
    await getDepartmentStudents({ years: ["fourth"], search: "priya" });
    const where = whereOf();
    expect(where).toMatchObject({ OR: [{ expectedPassoutYear: 2027 }] });
    expect(where).toHaveProperty("AND");
    expect((where.AND as { OR: unknown[] }[])[0].OR).toEqual([
      { name: { contains: "priya", mode: "insensitive" } },
      { rollNumber: { contains: "priya", mode: "insensitive" } },
      { misNumber: { contains: "priya", mode: "insensitive" } },
      { prnNumber: { contains: "priya", mode: "insensitive" } },
      { email: { contains: "priya", mode: "insensitive" } },
    ]);
  });
});
