import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/**
 * The Super Admin's student directory and the department roster, against
 * real Postgres — the real Prisma query builder, including the nested
 * OR/AND that search and "Not yet eligible" both need.
 */

const ctx = vi.hoisted(() => ({ departmentId: "", departmentCode: "" }));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "it-super", role: "SUPER_ADMIN" })),
  requireDepartmentAdmin: vi.fn(async () => ({
    department: { id: ctx.departmentId, code: ctx.departmentCode },
  })),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { createWorld, type World } from "./fixtures";
import {
  getAllStudents,
  type AllStudentsPlacementFilter,
} from "@/features/students/queries/get-all-students";
import { getDepartmentStudents } from "@/features/students/queries/get-department-students";

let world: World;
const names = async (status: AllStudentsPlacementFilter, extra: Record<string, unknown> = {}) =>
  (await getAllStudents({ deptId: world.department.id, status, pageSize: 100, ...extra })).data
    .map((s) => s.name)
    .sort();

beforeAll(async () => {
  world = await createWorld();
  ctx.departmentId = world.department.id;
  ctx.departmentCode = world.department.code;

  await world.student({ name: "Pending" , isPending: true });
  await world.student({ name: "Opted Out", optedIn: false });
  await world.student({ name: "Eligible", activeBacklogs: 2 });
  await world.student({ name: "Eligible Clean" });
  const placed = await world.student({ name: "Placed" });
  await world.placeManually(placed.id);
  const optedOutAfter = await world.student({ name: "Placed Then Opted Out", optedIn: false });
  await world.placeManually(optedOutAfter.id);
  const pendingPlaced = await world.student({ name: "Pending Placed", isPending: true });
  await world.placeManually(pendingPlaced.id);
  await world.student({ name: "Graduated", batch: 2025 });
  await world.student({ name: "Third Year", batch: 2028, semester: 5 });
});

afterAll(async () => {
  await world?.cleanup();
});

describe("placement status filters", () => {
  it("split the department into three groups with no student in two of them", async () => {
    const placed = await names("placed");
    const notPlaced = await names("not-placed");
    const notYet = await names("not-yet-eligible");
    const all = await names("all");

    const seen = [...placed, ...notPlaced, ...notYet];
    expect(new Set(seen).size).toBe(seen.length); // no overlap
    expect(seen.sort()).toEqual(all); // and nobody missing
  });

  it("each group matches the badge its students show", async () => {
    const all = (await getAllStudents({ deptId: world.department.id, pageSize: 100 })).data;
    const badge = Object.fromEntries(all.map((s) => [s.name, s.placementState]));

    for (const name of await names("placed")) expect(badge[name]).toBe("PLACED");
    for (const name of await names("not-placed")) expect(badge[name]).toBe("ELIGIBLE");
    for (const name of await names("not-yet-eligible")) expect(["PENDING", "OPTED_OUT"]).toContain(badge[name]);
  });

  it("Placed and Not placed together are exactly the eligible pool", async () => {
    expect([...(await names("placed")), ...(await names("not-placed"))].sort()).toEqual(
      ["Eligible", "Eligible Clean", "Graduated", "Placed", "Placed Then Opted Out", "Third Year"].sort()
    );
  });
});

describe("filters combine with AND", () => {
  it("batch + Not placed", async () => {
    expect(await names("not-placed", { batchYear: 2028 })).toEqual(["Third Year"]);
  });

  it("Not placed + Has backlogs is the old Needs Attention view", async () => {
    expect(await names("not-placed", { hasBacklogs: true })).toEqual(["Eligible"]);
  });

  it("a search term and Not yet eligible do not collide", async () => {
    expect(await names("not-yet-eligible", { search: "opted" })).toEqual(["Opted Out"]);
  });

  it("search matches email, case-insensitively", async () => {
    const hits = await names("all", { search: `ELIGIBLE.CLEAN.${world.tag}` });
    expect(hits).toEqual(["Eligible Clean"]);
  });
});

describe("department roster status buttons", () => {
  it("Placed / Eligible / Pending / Opted Out never overlap, and each matches its badge", async () => {
    const statuses = ["placed", "unplaced", "pending", "opted-out"] as const;
    const expected = { placed: "PLACED", unplaced: "ELIGIBLE", pending: "PENDING", "opted-out": "OPTED_OUT" };
    const seen: string[] = [];
    for (const status of statuses) {
      const rows = (await getDepartmentStudents({ status, pageSize: 100 })).data;
      for (const row of rows) expect(row.placementState).toBe(expected[status]);
      seen.push(...rows.map((row) => row.name));
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(9);
  });
});

describe("department roster batch filter (Item 17), 2026-27 cycle", () => {
  const roster = async (years: ("third" | "fourth" | "graduated")[]) =>
    (await getDepartmentStudents({ years, pageSize: 100 })).data.map((s) => s.name).sort();

  it("Graduated, 3rd Year and 4th Year resolve from the batch", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T06:00:00Z"));
    try {
      expect(await roster(["graduated"])).toEqual(["Graduated"]);
      expect(await roster(["third"])).toEqual(["Third Year"]);
      expect(await roster(["third", "graduated"])).toEqual(["Graduated", "Third Year"]);
      expect((await roster([])).length).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});
