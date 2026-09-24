import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/**
 * The eligible pool and Placement Rate, against real Postgres.
 *
 * The unit tests mock `$queryRaw`, so they prove the arithmetic around the
 * SQL but not the SQL itself. Here the four raw queries that compute a
 * Placement Rate run for real against one fixture department whose students
 * cover every edge of `eligiblePoolSql`.
 */

const ctx = vi.hoisted(() => ({ departmentId: "", departmentCode: "" }));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "it-super", role: "SUPER_ADMIN" })),
  requireDepartmentAdmin: vi.fn(async () => ({
    department: { id: ctx.departmentId, code: ctx.departmentCode },
  })),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { createWorld, type World } from "./fixtures";
import { getDepartmentInsights } from "@/features/students/queries/get-department-insights";
import { getAdminDashboardStats } from "@/features/students/queries/get-admin-dashboard-stats";
import { getDepartmentMatrix } from "@/features/departments/queries/get-department-matrix";
import { getSystemStats } from "@/features/departments/queries/get-system-stats";

let world: World;

beforeAll(async () => {
  world = await createWorld();
  ctx.departmentId = world.department.id;
  ctx.departmentCode = world.department.code;

  const drive = await world.openDrive();

  // Not in the pool
  await world.student({ name: "Pending", isPending: true });
  await world.student({ name: "Opted Out", optedIn: false });
  const pendingPlaced = await world.student({ name: "Pending Placed", isPending: true });
  await world.placeManually(pendingPlaced.id); // anomaly: must not count as placed-in-pool

  // In the pool
  await world.student({ name: "Eligible Idle" });
  const applied = await world.student({ name: "Applied" });
  await world.apply(applied.id, drive.id);
  const placed = await world.student({ name: "Applied Placed" });
  await world.apply(placed.id, drive.id);
  await world.placeManually(placed.id);
  const optedOutAfter = await world.student({ name: "Placed Then Opted Out", optedIn: false });
  await world.placeManually(optedOutAfter.id); // an offer is a fact: stays in the pool

  const revoked = await world.student({ name: "Revoked" });
  const placement = await world.placeManually(revoked.id);
  await prisma.studentPlacement.update({
    where: { id: placement.id },
    data: { revokedAt: new Date(), revokedById: world.admin.id, revokeReason: "Recorded by mistake" },
  });

  // Different batch and semester, for the filters
  await world.student({ name: "Junior", batch: 2028, semester: 5 });
});

afterAll(async () => {
  await world?.cleanup();
});

describe("eligible pool, counted by real SQL", () => {
  it("Department Insights: eligible 6, applied 2, placed 2", async () => {
    const insights = await getDepartmentInsights();

    expect(insights).toMatchObject({
      totalStudents: 9,
      // Eligible Idle, Applied, Applied Placed, Placed Then Opted Out, Revoked, Junior
      eligibleStudents: 6,
      appliedStudents: 2,
      // Applied Placed, Placed Then Opted Out — never Pending Placed or Revoked
      placedStudents: 2,
      placementRate: 33,
      participationRate: 33,
      activeDrivesCount: 1,
    });
  });

  it("the batch filter narrows every count together", async () => {
    const insights = await getDepartmentInsights({ batchYear: 2027 });
    expect(insights).toMatchObject({ totalStudents: 8, eligibleStudents: 5, placedStudents: 2, placementRate: 40 });
  });

  it("the semester filter narrows every count together", async () => {
    const insights = await getDepartmentInsights({ semester: 5 });
    expect(insights).toMatchObject({ totalStudents: 1, eligibleStudents: 1, appliedStudents: 0, placementRate: 0 });
  });

  it("batch and semester combine", async () => {
    const insights = await getDepartmentInsights({ batchYear: 2028, semester: 7 });
    expect(insights).toMatchObject({ totalStudents: 0, eligibleStudents: 0, placementRate: 0 });
  });

  it("offers this department's real batches and semesters", async () => {
    const insights = await getDepartmentInsights();
    expect(insights.availableBatches).toEqual([2027, 2028]);
    expect(insights.availableSemesters).toEqual([5, 7]);
  });
});

describe("one Placement Rate on every screen", () => {
  it("department Overview agrees with Insights", async () => {
    const stats = await getAdminDashboardStats();
    expect(stats.placementRate).toBe(33);
    expect(stats.totalStudents).toBe(9);
  });

  it("Super Admin matrix agrees, with the funnel counts per department", async () => {
    const row = (await getDepartmentMatrix()).find((d) => d.id === world.department.id);
    expect(row).toMatchObject({
      totalStudents: 9,
      registeredStudents: 7,
      eligibleStudents: 6,
      appliedStudents: 2,
      placedInPool: 2,
      placementRate: 33,
      openDrives: 1,
    });
  });

  it("Super Admin system stats run for real and stay a percentage", async () => {
    const stats = await getSystemStats();
    expect(Number.isInteger(stats.overallPlacementRate)).toBe(true);
    expect(stats.overallPlacementRate).toBeGreaterThanOrEqual(0);
    expect(stats.overallPlacementRate).toBeLessThanOrEqual(100);
  });
});
