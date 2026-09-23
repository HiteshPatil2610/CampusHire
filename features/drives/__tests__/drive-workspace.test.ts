import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit 6 — the department drive workspace's read side: every query is scoped
 * to the caller's department (whatever the client names), eligibility comes
 * from the central engine, filters stay inside the scope, and the Super
 * Admin's placements view validates its filters.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn() },
    student: { findMany: vi.fn(), groupBy: vi.fn() },
    driveApplication: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    applicationStageEvent: { findMany: vi.fn() },
    studentPlacement: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    department: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { getDriveStudents } from "../queries/get-drive-students";
import { getDriveApplications } from "@/features/applications/queries/get-drive-applications";
import { getApplicationStageHistory } from "@/features/applications/queries/get-application-stage-history";
import { getDrivePlacements } from "@/features/students/queries/get-drive-placements";
import { getDriveOperationsActivity } from "../queries/get-drive-operations-activity";
import { getGlobalPlacements } from "@/features/students/queries/get-global-placements";
import { FINAL_YEAR_PASSOUT, REQUIRED_MARKS } from "./final-year-fixtures";

const DRIVE_ID = "drive-1";
const CSE = "dept-cse";
const cseAdmin = { user: { id: "u-cse" }, department: { id: CSE, code: "CSE" } };

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

/** A central drive assigned to CSE, targeting batch 2027. */
const drive = (extra: object = {}) => ({
  id: DRIVE_ID,
  departmentId: null,
  isCentralDrive: true,
  companyName: "Acme",
  roleName: "SE",
  packageDisplay: "12 LPA",
  jobDescriptionText: "JD",
  jobDescriptionUrl: null,
  requirements: null,
  skills: null,
  packageOffered: "12.00",
  selectionRounds: "[]",
  masterPipeline: null,
  nextStageDate: inDays(20),
  applicationDeadline: inDays(10),
  applyMethod: "IN_APP",
  externalApplyUrl: null,
  minCGPA: 6,
  maxActiveBacklogs: 2,
  lifecycleStatus: "PUBLISHED",
  eligibleDepartmentLinks: [{ departmentId: CSE }],
  eligibilityRules: [
    { ruleType: "BATCH_YEAR", operator: "IN", numberValue: null, listValue: [String(FINAL_YEAR_PASSOUT)] },
  ],
  departmentConfigs: [{ roleName: null, eligibilityRules: [] }],
  ...extra,
});

const student = (id: string, over: object = {}) => ({
  id,
  name: `Student ${id}`,
  rollNumber: `R${id}`,
  // Final year, semesters 1–6 on record: the final-year requirements pass.
  expectedPassoutYear: FINAL_YEAR_PASSOUT,
  userId: `user-${id}`,
  departmentId: CSE,
  isPending: false,
  optedIn: true,
  approved: true,
  entryType: "REGULAR",
  academic: {
    currentCGPA: 8,
    activeBacklogs: 0,
    pastBacklogCount: 0,
    tenthPercentage: 80,
    twelfthPercentage: 80,
    diplomaPercentage: null,
    currentSemester: 6,
  },
  skills: [],
  placements: [],
  semesterMarks: REQUIRED_MARKS,
  applications: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDepartmentAdmin).mockResolvedValue(cseAdmin as never);
  vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "u-super" } as never);
});

describe("getDriveStudents", () => {
  it("uses the eligibility engine: a placed student stops at PLACED, a wrong batch is not eligible", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive() as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("1"),
      student("2", { placements: [{ id: "p1", revokedAt: null }] }),
      student("3", { expectedPassoutYear: FINAL_YEAR_PASSOUT - 1 }),
      student("4", { academic: null }),
    ] as never);

    const result = await getDriveStudents(DRIVE_ID);

    const byId = Object.fromEntries(result.students.map((row) => [row.id, row]));
    expect(byId["1"]).toMatchObject({ eligibility: "ELIGIBLE", placed: false, reason: null });
    expect(byId["2"]).toMatchObject({ eligibility: "PLACED", placed: true });
    expect(byId["3"].eligibility).toBe("INELIGIBLE");
    expect(byId["3"].reason).toBeTruthy();
    expect(byId["4"]).toMatchObject({ eligibility: "INELIGIBLE", reason: "Academic information not completed" });
    expect(result.batchYears).toEqual([FINAL_YEAR_PASSOUT, FINAL_YEAR_PASSOUT - 1]);
  });

  it("carries the application's status and stage", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive() as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("1", { applications: [{ status: "IN_PROGRESS", currentStage: { name: "Coding" } }] }),
    ] as never);

    const result = await getDriveStudents(DRIVE_ID);

    expect(result.students[0].application).toEqual({ status: "IN_PROGRESS", stageName: "Coding" });
  });

  it("reads only the caller's department's students", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive() as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([]);

    await getDriveStudents(DRIVE_ID);

    const [call] = vi.mocked(prisma.student.findMany).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({ departmentId: CSE });
  });

  it("a drive the department does not run reads as not found", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive({ eligibleDepartmentLinks: [] }) as never);
    await expect(getDriveStudents(DRIVE_ID)).rejects.toThrow("Drive not found");
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});

describe("getDriveApplications filters", () => {
  beforeEach(() => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      departmentId: null,
      isCentralDrive: true,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
    } as never);
    vi.mocked(prisma.driveApplication.count).mockResolvedValue(0);
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([]);
  });

  it("keeps the department scope whatever filters are added", async () => {
    await getDriveApplications({
      driveId: DRIVE_ID,
      search: "asha",
      expectedPassoutYear: 2027,
      stageId: "stage-1",
      status: "IN_PROGRESS",
    });

    const [call] = vi.mocked(prisma.driveApplication.count).mock.calls;
    const where = (call[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      driveId: DRIVE_ID,
      status: "IN_PROGRESS",
      currentStageId: "stage-1",
      student: { departmentId: CSE, expectedPassoutYear: 2027 },
    });
    expect((where.student as { OR: unknown[] }).OR).toHaveLength(3);
  });

  it("ignores filter values that are not valid instead of widening or breaking the query", async () => {
    await getDriveApplications({
      driveId: DRIVE_ID,
      status: "HACKED" as never,
      expectedPassoutYear: Number.NaN,
      page: Number.NaN,
    });

    const [call] = vi.mocked(prisma.driveApplication.count).mock.calls;
    const where = (call[0] as { where: Record<string, unknown> }).where;
    expect(where).not.toHaveProperty("status");
    expect(where.student).toEqual({ departmentId: CSE });
    const [find] = vi.mocked(prisma.driveApplication.findMany).mock.calls;
    expect((find[0] as { skip: number }).skip).toBe(0);
  });
});

describe("stage history", () => {
  it("shows another department's application as not found", async () => {
    vi.mocked(prisma.driveApplication.findFirst).mockResolvedValue(null);

    await expect(getApplicationStageHistory("app-of-it")).rejects.toThrow("Application not found.");

    const [call] = vi.mocked(prisma.driveApplication.findFirst).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({
      id: "app-of-it",
      student: { departmentId: CSE },
    });
    expect(prisma.applicationStageEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns every move, oldest first, with the version and who made it", async () => {
    vi.mocked(prisma.driveApplication.findFirst).mockResolvedValue({ id: "app-1" } as never);
    vi.mocked(prisma.applicationStageEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        createdAt: new Date("2026-09-20T10:00:00Z"),
        fromStage: null,
        toStage: { name: "Application" },
        fromStatus: null,
        toStatus: "IN_PROGRESS",
        actor: null,
        note: null,
        pipelineVersion: { version: 1 },
      },
      {
        id: "e2",
        createdAt: new Date("2026-09-21T10:00:00Z"),
        fromStage: { name: "Application" },
        toStage: { name: "Coding" },
        fromStatus: "IN_PROGRESS",
        toStatus: "IN_PROGRESS",
        actor: { name: "Prof. Rao", email: "rao@x.edu" },
        note: "Cleared",
        pipelineVersion: { version: 2 },
      },
    ] as never);

    const history = await getApplicationStageHistory("app-1");

    expect(history.map((entry) => [entry.fromStage, entry.toStage, entry.actor, entry.pipelineVersion])).toEqual([
      [null, "Application", null, 1],
      ["Application", "Coding", "Prof. Rao", 2],
    ]);
    expect(vi.mocked(prisma.applicationStageEvent.findMany).mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("drive placements", () => {
  it("lists this department's placements and the applicants waiting at the Offer stage", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      companyName: "Acme",
      roleName: "SE",
      packageDisplay: "12 LPA",
      departmentId: null,
      isCentralDrive: true,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
      departmentConfigs: [{ roleName: "Backend Engineer" }],
    } as never);
    vi.mocked(prisma.studentPlacement.findMany).mockResolvedValue([
      {
        id: "p1",
        source: "APPLICATION",
        roleName: "Backend Engineer",
        packageDisplay: "12 LPA",
        placedAt: new Date(),
        revokedAt: null,
        revokeReason: null,
        student: { id: "s1", name: "Asha", rollNumber: "R1" },
        recordedBy: { name: null, email: "rao@x.edu" },
      },
    ] as never);
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
      {
        id: "a2",
        currentStage: { id: "st-offer", name: "Offer" },
        student: { name: "Ravi", rollNumber: "R2", placements: [] },
      },
    ] as never);

    const result = await getDrivePlacements(DRIVE_ID);

    expect(result.roleName).toBe("Backend Engineer");
    expect(result.placements[0]).toMatchObject({ studentName: "Asha", recordedBy: "rao@x.edu" });
    expect(result.candidates).toEqual([
      {
        applicationId: "a2",
        studentName: "Ravi",
        rollNumber: "R2",
        stageId: "st-offer",
        stageName: "Offer",
        alreadyPlaced: false,
      },
    ]);
    // Both reads are this department's, and candidates are Offer-stage, in progress.
    expect(vi.mocked(prisma.studentPlacement.findMany).mock.calls[0][0]).toMatchObject({
      where: { driveId: DRIVE_ID, student: { departmentId: CSE } },
    });
    expect(vi.mocked(prisma.driveApplication.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        driveId: DRIVE_ID,
        status: "IN_PROGRESS",
        student: { departmentId: CSE },
        currentStage: { is: { stageType: "OFFER" } },
      },
    });
  });

  it("a drive the department does not run reads as not found", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      companyName: "Acme",
      roleName: "SE",
      packageDisplay: null,
      departmentId: null,
      isCentralDrive: true,
      eligibleDepartmentLinks: [],
      departmentConfigs: [],
    } as never);
    await expect(getDrivePlacements(DRIVE_ID)).rejects.toThrow("Drive not found");
    expect(prisma.studentPlacement.findMany).not.toHaveBeenCalled();
  });
});

describe("drive operations activity", () => {
  it("is found through this department's own applications and placements, and its own drive rows", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      id: DRIVE_ID,
      departmentId: null,
      isCentralDrive: true,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
    } as never);
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
      { id: "a1", student: { name: "Asha" } },
    ] as never);
    vi.mocked(prisma.studentPlacement.findMany).mockResolvedValue([
      { id: "p1", student: { name: "Asha" } },
    ] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      { id: "l1", action: "APPLY", entityType: "DriveApplication", entityId: "a1", metadata: null, createdAt: new Date(), user: { email: "asha@x.edu" } },
      {
        id: "l2",
        action: "TRANSITION",
        entityType: "DriveApplication",
        entityId: "a1",
        metadata: JSON.stringify({ toStageName: "Coding", toStatus: "IN_PROGRESS" }),
        createdAt: new Date(),
        user: { email: "rao@x.edu" },
      },
      { id: "l3", action: "CREATE", entityType: "StudentPlacement", entityId: "p1", metadata: null, createdAt: new Date(), user: { email: "rao@x.edu" } },
      {
        id: "l4",
        action: "TRANSITION",
        entityType: "Drive",
        entityId: DRIVE_ID,
        metadata: JSON.stringify({ event: "bulk-stage-move", toStage: "Coding", moved: 18, failed: 2, departmentCode: "CSE" }),
        createdAt: new Date(),
        user: { email: "rao@x.edu" },
      },
    ] as never);

    const items = await getDriveOperationsActivity(DRIVE_ID);

    expect(items.map((item) => item.summary)).toEqual([
      "Asha applied",
      "Asha moved to Coding",
      "Asha placed",
      "Bulk move to Coding: 18 moved, 2 failed",
    ]);
    const [call] = vi.mocked(prisma.auditLog.findMany).mock.calls;
    const where = (call[0] as { where: { OR: Record<string, unknown>[] } }).where;
    // Drive rows only when they name this department; the others by the ids found above.
    expect(where.OR[0]).toMatchObject({ metadata: { contains: '"departmentCode":"CSE"' } });
    expect(where.OR[1]).toEqual({ entityType: "DriveApplication", entityId: { in: ["a1"] } });
    expect(where.OR[2]).toEqual({ entityType: "StudentPlacement", entityId: { in: ["p1"] } });
  });
});

describe("Super Admin global placements", () => {
  beforeEach(() => {
    vi.mocked(prisma.studentPlacement.count).mockResolvedValue(0);
    vi.mocked(prisma.studentPlacement.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studentPlacement.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([]);
    vi.mocked(prisma.student.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([]);
  });

  it("is Super Admin only", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Forbidden"));
    await expect(getGlobalPlacements({})).rejects.toThrow();
    expect(prisma.studentPlacement.findMany).not.toHaveBeenCalled();
  });

  it("filters by department, company, batch, date, drive and student", async () => {
    await getGlobalPlacements({
      departmentId: "dept-1",
      company: "Acme",
      expectedPassoutYear: 2027,
      driveId: "drive-9",
      search: "asha",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const [call] = vi.mocked(prisma.studentPlacement.count).mock.calls;
    const where = (call[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      revokedAt: null,
      companyName: { equals: "Acme", mode: "insensitive" },
      driveId: "drive-9",
      student: { departmentId: "dept-1", expectedPassoutYear: 2027 },
    });
    expect(where.placedAt).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-12-31T23:59:59.999Z"),
    });
  });

  it("drops malformed dates and batch years instead of passing them on", async () => {
    await getGlobalPlacements({ from: "yesterday", to: "2026-13-45", expectedPassoutYear: 12 });

    const [call] = vi.mocked(prisma.studentPlacement.count).mock.calls;
    const where = (call[0] as { where: Record<string, unknown> }).where;
    expect(where).not.toHaveProperty("placedAt");
    expect(where.student).toEqual({});
  });

  it("shows placed (active) by default, revoked or all on request", async () => {
    await getGlobalPlacements({});
    await getGlobalPlacements({ status: "revoked" });
    await getGlobalPlacements({ status: "all" });

    const wheres = vi.mocked(prisma.studentPlacement.count).mock.calls.map(
      (call) => (call[0] as { where: Record<string, unknown> }).where
    );
    expect(wheres[0]).toMatchObject({ revokedAt: null });
    expect(wheres[1]).toMatchObject({ revokedAt: { not: null } });
    expect(wheres[2]).not.toHaveProperty("revokedAt");
  });
});
