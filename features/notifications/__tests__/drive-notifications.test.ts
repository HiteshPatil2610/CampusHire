import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Who hears about a drive.
 *
 * The rule the whole unit rests on: a student is told about a drive when —
 * and only when — their department has published it and the same evaluator
 * the listing uses finds them eligible. Creating or assigning a master
 * drive tells nobody; a second publish tells nobody twice.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn() },
    driveDepartmentConfig: { findMany: vi.fn() },
    driveEligibilityRule: { findMany: vi.fn() },
    driveApplication: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
    departmentAdmin: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    notificationDispatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { NOTIFY: "NOTIFY", NOTIFY_FAILED: "NOTIFY_FAILED", RETRY: "RETRY" },
  AuditEntityType: { NOTIFICATION_DISPATCH: "NotificationDispatch" },
}));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyEligibleStudentsOfDrive } from "../actions/notify-eligible-students-of-drive";
import { primeDeliveryMocks } from "./delivery-test-helpers";

const CSE = "dept-cse";
const IT = "dept-it";
const DRIVE = "drive-1";

const drive = {
  id: DRIVE,
  companyName: "Acme",
  roleName: "Software Engineer",
  packageOffered: 1200000,
  packageDisplay: "12 LPA",
  minCGPA: 7,
  maxActiveBacklogs: 0,
  applicationDeadline: new Date("2030-01-01T00:00:00Z"),
  driveDate: new Date("2030-02-01T00:00:00Z"),
  eligibleDepartmentLinks: [{ departmentId: CSE }, { departmentId: IT }],
};

/** A published instance of the drive for one department. */
const publishedIn = (departmentId: string, overrides: object = {}) => ({
  id: `config-${departmentId}`,
  driveId: DRIVE,
  departmentId,
  status: "PUBLISHED",
  roleName: null,
  applicationDeadline: null,
  driveDate: null,
  minCGPA: null,
  maxActiveBacklogs: null,
  eligibilityRules: [],
  ...overrides,
});

const student = (id: string, overrides: object = {}) => ({
  id,
  userId: `user-${id}`,
  departmentId: CSE,
  isPending: false,
  optedIn: true,
  rollNumber: `R-${id}`,
  expectedPassoutYear: 2026,
  entryType: "REGULAR",
  academic: { currentCGPA: 8.5, pastBacklogCount: 0, activeBacklogs: 0 },
  skills: [],
  placements: [],
  ...overrides,
});

const recipients = () =>
  (vi.mocked(prisma.notification.createMany).mock.calls.flatMap(
    (call) => (call[0] as { data: { userId: string; event: string }[] }).data
  ) ?? []).filter((row) => row.event === "DRIVE_PUBLISHED").map((row) => row.userId);

beforeEach(() => {
  vi.clearAllMocks();
  primeDeliveryMocks(prisma as never);
  vi.mocked(prisma.driveEligibilityRule.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.student.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([] as never);
});

describe("a drive nobody has published notifies nobody", () => {
  it("says nothing when no department has published its instance", async () => {
    // Assigned, configured — but not published.
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([student("s1")] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never);

    expect(result).toEqual({ notified: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("says nothing when the drive is assigned to no department", async () => {
    const unassigned = { ...drive, eligibleDepartmentLinks: [] };

    const result = await notifyEligibleStudentsOfDrive(unassigned as never);

    expect(result).toEqual({ notified: 0 });
    expect(prisma.driveDepartmentConfig.findMany).not.toHaveBeenCalled();
  });
});

describe("a published drive reaches exactly the eligible students", () => {
  beforeEach(() => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      publishedIn(CSE),
    ] as never);
  });

  it("notifies an eligible student of the publishing department", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([student("s1")] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(result.notified).toBe(1);
    expect(recipients()).toEqual(["user-s1"]);
  });

  it("does not notify a student below the drive's bar", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("s1", { academic: { currentCGPA: 6, pastBacklogCount: 0, activeBacklogs: 0 } }),
    ] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(result.notified).toBe(0);
    expect(recipients()).toEqual([]);
  });

  it("does not notify a placed student", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("s1", { placements: [{ revokedAt: null }] }),
    ] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(result.notified).toBe(0);
    // Narrowed in SQL as well, so the database never returns them either.
    const query = vi.mocked(prisma.student.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(query.where).toMatchObject({ placements: { none: { revokedAt: null } } });
  });

  it("does not notify a student who has not been approved, or opted out", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("s1", { isPending: true }),
      student("s2", { optedIn: false }),
    ] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(result.notified).toBe(0);
    const query = vi.mocked(prisma.student.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(query.where).toMatchObject({ isPending: false, optedIn: true });
  });

  it("does not notify a student outside the targeted batch", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      publishedIn(CSE, {
        eligibilityRules: [
          {
            id: "rule-1",
            ruleType: "BATCH_YEAR",
            operator: "IN",
            numberValue: null,
            textValue: null,
            listValue: ["2026"],
          },
        ],
      }),
    ] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("s1", { expectedPassoutYear: 2026 }),
      student("s2", { expectedPassoutYear: 2027 }),
    ] as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(recipients()).toEqual(["user-s1"]);
    expect(result.notified).toBe(1);
  });

  it("notifies only the publishing department, not the others running the drive", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      publishedIn(CSE),
    ] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student("s1"),
      student("s2", { departmentId: IT }),
    ] as never);

    await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    // The instance query is narrowed to the requested department...
    const query = vi.mocked(prisma.driveDepartmentConfig.findMany).mock.calls[0][0] as {
      where: { departmentId: { in: string[] }; status: string };
    };
    expect(query.where.departmentId.in).toEqual([CSE]);
    expect(query.where.status).toBe("PUBLISHED");
    // ...and a student of another department is not notified even if the
    // query returned them.
    expect(recipients()).toEqual(["user-s1"]);
  });

  it("cannot be widened past the departments the drive is assigned to", async () => {
    await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: ["dept-mech"] });

    expect(prisma.driveDepartmentConfig.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("publishing twice notifies once", () => {
  it("does no work at all when the fan-out already ran under the same key", async () => {
    // The dispatch row exists and succeeded: the key is taken.
    vi.mocked(prisma.notificationDispatch.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.0",
      })
    );
    vi.mocked(prisma.notificationDispatch.findUnique).mockResolvedValue({
      id: "dispatch-1",
      status: "SENT",
      attempts: 1,
      updatedAt: new Date(),
    } as never);

    const result = await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    expect(result).toEqual({ notified: 0 });
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("keys the fan-out by drive and department, so each publish is its own", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      publishedIn(CSE),
    ] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([student("s1")] as never);

    await notifyEligibleStudentsOfDrive(drive as never, { departmentIds: [CSE] });

    const dispatch = vi.mocked(prisma.notificationDispatch.create).mock.calls[0][0] as {
      data: { key: string; event: string; payload: string };
    };
    expect(dispatch.data.key).toBe(`drive-published:${DRIVE}:${CSE}`);
    expect(dispatch.data.event).toBe("DRIVE_PUBLISHED");
    // Ids only: a retry resolves everything again.
    expect(JSON.parse(dispatch.data.payload)).toEqual({
      driveId: DRIVE,
      departmentIds: [CSE],
    });

    // And each recipient's row carries the per-student key.
    const rows = (vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: { dedupeKey: string }[];
    }).data;
    expect(rows[0].dedupeKey).toBe(`drive-published:${DRIVE}`);
  });
});
