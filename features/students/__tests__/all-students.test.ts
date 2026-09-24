import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Super Admin's institution-wide student directory (Phase 9, Item 21).
 * The rule under test: department, batch and placement status filters
 * combine with AND, search never collides with the "not yet eligible"
 * filter's own OR, and only a Super Admin can reach any of it — a
 * department admin has no equivalent cross-department query at all.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
    AuthorizationError,
  };
});

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { getAllStudents, getAllStudentsBatches } from "../queries/get-all-students";

const whereOf = () =>
  (vi.mocked(prisma.student.findMany).mock.calls[0][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorization", () => {
  it("only a Super Admin may read the institution-wide directory", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new AuthorizationError("Super Admin only"));

    await expect(getAllStudents()).rejects.toThrow("Super Admin only");
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it("the batch dropdown's own query is also Super Admin only", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new AuthorizationError("Super Admin only"));

    await expect(getAllStudentsBatches()).rejects.toThrow("Super Admin only");
  });
});

describe("empty data", () => {
  it("no students at all returns an empty page, not an error", async () => {
    const result = await getAllStudents();

    expect(result).toEqual({ data: [], page: 1, pageSize: 50, totalCount: 0 });
  });
});

describe("department filter", () => {
  it("one department narrows the where clause", async () => {
    await getAllStudents({ deptId: "dept-cse" });
    expect(whereOf()).toMatchObject({ departmentId: "dept-cse" });
  });

  it("no department filter reaches every department", async () => {
    await getAllStudents();
    expect(whereOf()).not.toHaveProperty("departmentId");
  });

  it("switching between departments changes only that one clause", async () => {
    await getAllStudents({ deptId: "dept-cse" });
    expect(whereOf()).toMatchObject({ departmentId: "dept-cse" });

    vi.clearAllMocks();
    await getAllStudents({ deptId: "dept-it" });
    expect(whereOf()).toMatchObject({ departmentId: "dept-it" });
  });
});

describe("batch filter", () => {
  it("filters by expectedPassoutYear", async () => {
    await getAllStudents({ batchYear: 2027 });
    expect(whereOf()).toMatchObject({ expectedPassoutYear: 2027 });
  });

  it("omitted batch does not filter by year", async () => {
    await getAllStudents();
    expect(whereOf()).not.toHaveProperty("expectedPassoutYear");
  });
});

describe("placement status filter", () => {
  it("placed", async () => {
    await getAllStudents({ status: "placed" });
    expect(whereOf()).toMatchObject({ placements: { some: { revokedAt: null } } });
  });

  it("not placed: registered, opted in, no active placement", async () => {
    await getAllStudents({ status: "not-placed" });
    expect(whereOf()).toMatchObject({
      isPending: false,
      optedIn: true,
      placements: { none: { revokedAt: null } },
    });
  });

  it("not yet eligible: pending or opted out", async () => {
    await getAllStudents({ status: "not-yet-eligible" });
    expect(whereOf()).toMatchObject({
      OR: [{ isPending: true }, { isPending: false, optedIn: false }],
    });
  });

  it("'all' applies no placement filter", async () => {
    await getAllStudents({ status: "all" });
    expect(whereOf()).not.toHaveProperty("placements");
    expect(whereOf()).not.toHaveProperty("OR");
  });
});

describe("combined filters", () => {
  it("department + batch + not-placed all apply together, as an AND", async () => {
    await getAllStudents({ deptId: "dept-cse", batchYear: 2027, status: "not-placed" });

    expect(whereOf()).toMatchObject({
      departmentId: "dept-cse",
      expectedPassoutYear: 2027,
      isPending: false,
      optedIn: true,
      placements: { none: { revokedAt: null } },
    });
  });

  it("a search term and 'not yet eligible' do not collide on the same Prisma key", async () => {
    await getAllStudents({ status: "not-yet-eligible", search: "priya" });

    const where = whereOf();
    // The status filter's own top-level OR is untouched by the search term.
    // Opted out *and not placed*: a student placed then opted out is Placed.
    expect(where.OR).toEqual([
      { isPending: true },
      { isPending: false, optedIn: false, placements: { none: { revokedAt: null } } },
    ]);
    // The search term's OR is nested inside AND instead.
    expect(where).toHaveProperty("AND");
    expect((where.AND as { OR: unknown[] }[])[0].OR).toEqual([
      { name: { contains: "priya", mode: "insensitive" } },
      { rollNumber: { contains: "priya", mode: "insensitive" } },
      { misNumber: { contains: "priya", mode: "insensitive" } },
      { prnNumber: { contains: "priya", mode: "insensitive" } },
      { email: { contains: "priya", mode: "insensitive" } },
    ]);
  });

  it("department + batch + status + search: only students matching all four are asked for", async () => {
    await getAllStudents({
      deptId: "dept-cse",
      batchYear: 2027,
      status: "not-placed",
      search: "sharma",
    });

    const where = whereOf();
    expect(where).toMatchObject({
      departmentId: "dept-cse",
      expectedPassoutYear: 2027,
      isPending: false,
      optedIn: true,
    });
    expect((where.AND as { OR: unknown[] }[])[0].OR).toContainEqual({
      name: { contains: "sharma", mode: "insensitive" },
    });
  });
});

describe("has backlogs toggle", () => {
  it("narrows to students with active backlogs", async () => {
    await getAllStudents({ hasBacklogs: true });
    expect(whereOf()).toMatchObject({ academic: { activeBacklogs: { gt: 0 } } });
  });

  it("off by default", async () => {
    await getAllStudents();
    expect(whereOf()).not.toHaveProperty("academic");
  });

  it("with Not Placed, reproduces the old Needs Attention view", async () => {
    await getAllStudents({ status: "not-placed", hasBacklogs: true });
    expect(whereOf()).toMatchObject({
      isPending: false,
      optedIn: true,
      placements: { none: { revokedAt: null } },
      academic: { activeBacklogs: { gt: 0 } },
    });
  });
});

describe("search", () => {
  it("matches on name, roll number, MIS, PRN or email", async () => {
    await getAllStudents({ search: "cs2027" });

    const where = whereOf();
    expect((where.AND as { OR: unknown[] }[])[0].OR).toHaveLength(5);
  });

  it("an empty search string applies no search filter", async () => {
    await getAllStudents({ search: "   " });
    expect(whereOf()).not.toHaveProperty("AND");
  });
});

describe("count and page share the same filter", () => {
  it("the total count query uses the exact same where clause as the page query", async () => {
    await getAllStudents({ deptId: "dept-cse", status: "placed" });

    expect(vi.mocked(prisma.student.count).mock.calls[0][0]).toEqual({ where: whereOf() });
  });
});

describe("multiple departments (no filter applied)", () => {
  it("orders by department code, then roll number, across every department", async () => {
    await getAllStudents();

    expect(vi.mocked(prisma.student.findMany).mock.calls[0][0]).toMatchObject({
      orderBy: [{ department: { code: "asc" } }, { rollNumber: "asc" }],
    });
  });
});
