import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Unit 5 — the Master Drive console: the Super Admin's applications drill-down,
 * the real activity trail, the department admin's My Drives buckets and the
 * shared department status summary.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn() },
    driveApplication: { count: vi.fn(), findMany: vi.fn() },
    student: { groupBy: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import {
  departmentDriveBucket,
  DEPARTMENT_DRIVE_BUCKETS,
} from "../domain/department-drive-bucket";
import { summarizeDepartmentStatuses } from "../utils/dept-status-summary";
import { getSuperAdminDriveApplications } from "@/features/applications/queries/get-super-admin-drive-applications";
import { getDriveActivity } from "../queries/get-drive-activity";

const DRIVE_ID = "drive-1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "user-super" } as never);
});

// ---------------------------------------------------------------------------
// My Drives buckets
// ---------------------------------------------------------------------------

describe("My Drives buckets", () => {
  const bucket = (
    status: Parameters<typeof departmentDriveBucket>[0]["status"],
    ready = false,
    deadlineOpen = true
  ) => departmentDriveBucket({ status, ready, deadlineOpen });

  it("places a drive by its lifecycle, readiness and deadline", () => {
    expect(bucket("ASSIGNED")).toBe("ASSIGNED");
    expect(bucket("CONFIGURED", false)).toBe("CONFIGURING");
    expect(bucket("CONFIGURED", true)).toBe("READY_TO_PUBLISH");
    expect(bucket("PUBLISHED", true, true)).toBe("ACTIVE");
    expect(bucket("PUBLISHED", true, false)).toBe("COMPLETED");
    expect(bucket("CLOSED")).toBe("CLOSED");
    expect(bucket("CANCELLED")).toBe("CLOSED");
    expect(bucket("ARCHIVED")).toBe("COMPLETED");
  });

  it("treats a complete but unsaved assignment as ready to publish", () => {
    expect(bucket("ASSIGNED", true)).toBe("READY_TO_PUBLISH");
    expect(bucket(null, false)).toBe("ASSIGNED");
  });

  it("never reads a published drive's readiness (it is already live)", () => {
    expect(bucket("PUBLISHED", false, true)).toBe("ACTIVE");
  });

  it("offers the six buckets the department admin asked for, in order", () => {
    expect(DEPARTMENT_DRIVE_BUCKETS.map((entry) => entry.label)).toEqual([
      "Assigned",
      "Configuring",
      "Ready to Publish",
      "Active",
      "Closed",
      "Completed",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Department status summary
// ---------------------------------------------------------------------------

describe("department status summary", () => {
  const instance = (code: string, status: never) => ({
    departmentId: `dept-${code}`,
    status,
    department: { code, name: code },
  });

  it("counts every state, so closed and cancelled are not silently dropped", () => {
    const summary = summarizeDepartmentStatuses([
      instance("CSE", "ASSIGNED" as never),
      instance("IT", "CONFIGURED" as never),
      instance("ECE", "PUBLISHED" as never),
      instance("ME", "CLOSED" as never),
      instance("CE", "CANCELLED" as never),
    ]);

    expect(summary).toMatchObject({
      assignedCount: 1,
      configuredCount: 1,
      publishedCount: 1,
      closedCount: 2,
    });
    expect(summary.deptStatusSummary.map((entry) => `${entry.departmentCode} ${entry.status}`)).toEqual([
      "CSE ASSIGNED",
      "IT CONFIGURED",
      "ECE PUBLISHED",
      "ME CLOSED",
      "CE CANCELLED",
    ]);
  });

  it("is the one builder both central-drive queries use", () => {
    for (const file of ["get-central-drives.ts", "get-central-drive-by-id.ts"]) {
      const source = readFileSync(join(__dirname, "../queries", file), "utf8");
      expect(source).toMatch(/summarizeDepartmentStatuses\(/);
      expect(source).not.toMatch(/filter\(\(d\) => d\.status === "PUBLISHED"\)/);
    }
  });
});

// ---------------------------------------------------------------------------
// Super Admin applications drill-down
// ---------------------------------------------------------------------------

describe("Super Admin applications drill-down", () => {
  beforeEach(() => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      companyName: "Acme",
      roleName: "SE",
      applicationDeadline: new Date(),
      isCentralDrive: true,
      departmentConfigs: [
        { departmentId: "dept-cse", department: { code: "CSE", name: "Computer" } },
      ],
    } as never);
    vi.mocked(prisma.driveApplication.count).mockResolvedValue(0);
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);
    vi.mocked(prisma.student.groupBy).mockResolvedValue([] as never);
  });

  it("filters by the department CODE the URL carries, not by an id it never matches", async () => {
    await getSuperAdminDriveApplications(DRIVE_ID, { departmentCode: "CSE" });

    const [count] = vi.mocked(prisma.driveApplication.count).mock.calls;
    expect(count[0]).toEqual({
      where: { driveId: DRIVE_ID, student: { department: { code: "CSE" } } },
    });
    const [find] = vi.mocked(prisma.driveApplication.findMany).mock.calls;
    expect((find[0] as { where: unknown }).where).toEqual({
      driveId: DRIVE_ID,
      student: { department: { code: "CSE" } },
    });
  });

  it("shows every department without a filter", async () => {
    await getSuperAdminDriveApplications(DRIVE_ID, {});
    const [count] = vi.mocked(prisma.driveApplication.count).mock.calls;
    expect(count[0]).toEqual({ where: { driveId: DRIVE_ID } });
  });

  it("turns a bad page number into page 1 instead of failing the query", async () => {
    for (const page of [Number.NaN, 0, -3, Number.POSITIVE_INFINITY]) {
      vi.mocked(prisma.driveApplication.findMany).mockClear();
      await getSuperAdminDriveApplications(DRIVE_ID, { page, pageSize: 50 });
      const [find] = vi.mocked(prisma.driveApplication.findMany).mock.calls;
      expect((find[0] as { skip: number }).skip).toBe(0);
    }
  });

  it("is Super Admin only", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    await expect(getSuperAdminDriveApplications(DRIVE_ID)).rejects.toThrow();
    expect(prisma.driveApplication.findMany).not.toHaveBeenCalled();
  });

  it("keeps the page's own department link a code, and never links to a route that does not exist", () => {
    const panel = readFileSync(join(__dirname, "../components/central-drive-detail-panel.tsx"), "utf8");
    expect(panel).toMatch(/\?dept=\$\{encodeURIComponent\(dept\.departmentCode\)\}/);
    expect(panel).not.toMatch(/super-admin-dashboard\/audit-logs/);
    expect(panel).toMatch(/href="\/audit-logs"/);
  });
});

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

describe("drive activity", () => {
  const row = (id: string, action: string, entityType: string, metadata: object | null) => ({
    id,
    action,
    entityType,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    user: { email: "super@example.com" },
  });

  beforeEach(() => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({ id: DRIVE_ID, isCentralDrive: true } as never);
  });

  it("reads the recorded audit trail, not the current statuses", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      row("a1", "CANCEL", "Drive", { scope: "department-drive", departmentCode: "CSE", reason: "Company withdrew" }),
      row("a2", "EXTEND_DEADLINE", "Drive", { departmentCode: "IT", reason: "Company asked" }),
      row("a3", "REQUEST", "PipelineChangeRequest", { departmentCode: "ECE", reason: "Add a GD round" }),
      row("a4", "UPDATE", "Drive", { event: "department-drive-published", departmentCode: "ME" }),
      row("a5", "CREATE", "Drive", null),
    ] as never);

    const items = await getDriveActivity(DRIVE_ID);

    expect(items.map((item) => item.summary)).toEqual([
      "Drive cancelled (CSE) — Company withdrew",
      "Application deadline extended (IT) — Company asked",
      "Recruitment stage change proposed (ECE) — Add a GD round",
      "Published to students (ME)",
      "Master drive created",
    ]);
    expect(items[0]).toMatchObject({ actorEmail: "super@example.com" });

    const [call] = vi.mocked(prisma.auditLog.findMany).mock.calls;
    const where = (call[0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toContainEqual({ entityType: "Drive", entityId: DRIVE_ID });
    expect(where.OR).toContainEqual({
      entityType: { in: ["RecruitmentPipelineVersion", "PipelineChangeRequest"] },
      metadata: { contains: `"driveId":"${DRIVE_ID}"` },
    });
    expect((call[0] as { orderBy: unknown }).orderBy).toEqual({ createdAt: "desc" });
  });

  it("survives an unreadable metadata row", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      { ...row("b1", "UPDATE", "Drive", null), metadata: "{not json" },
    ] as never);
    const items = await getDriveActivity(DRIVE_ID);
    expect(items).toHaveLength(1);
  });

  it("returns nothing for a drive that is not a Super Admin drive", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({ id: DRIVE_ID, isCentralDrive: false } as never);
    expect(await getDriveActivity(DRIVE_ID)).toEqual([]);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("is Super Admin only", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    await expect(getDriveActivity(DRIVE_ID)).rejects.toThrow();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
