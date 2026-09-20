import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";

/**
 * The application-integrity layer: every check `applyToDrive` makes is made on
 * the server from the database, the application and its snapshot are written
 * together or not at all, and a submitted application cannot be changed.
 *
 * Each test sets up one valid applicant and breaks exactly one thing.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    drive: { findUnique: vi.fn() },
    driveApplication: { create: vi.fn(), findUnique: vi.fn() },
    departmentAdmin: { findUnique: vi.fn() },
    // Recruitment pipeline models (see pipeline-fixtures.ts).
    recruitmentPipelineVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    recruitmentStage: { findUnique: vi.fn() },
    applicationStageEvent: { create: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireStudent: vi.fn(),
  requireAuth: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: { APPLY: "APPLY", UPDATE: "UPDATE", CREATE: "CREATE" },
  AuditEntityType: {
    DRIVE_APPLICATION: "DriveApplication",
    APPLICATION_SNAPSHOT: "DriveApplicationSnapshot",
  },
}));

vi.mock("@/lib/notifications", () => ({
  deliverNotification: vi.fn(async () => ({ delivered: 1 })),
  deliverNotificationSafely: vi.fn(async () => ({ delivered: 1 })),
  departmentAdminRecipients: vi.fn(async () => []),
  superAdminRecipients: vi.fn(async () => []),
}));
vi.mock("@/features/notifications/producers/application-events", () => ({
  notifyApplicationSubmitted: vi.fn(),
  notifyPlacementRecorded: vi.fn(),
  notifyPlacementRevoked: vi.fn(),
}));

vi.mock("../queries/check-application-exists", () => ({
  checkApplicationExists: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { ACTIVE_PIPELINE, withActivePipeline } from "@/features/recruitment/__tests__/pipeline-fixtures";

// Every department drive here already has an active recruitment pipeline.
beforeEach(() => withActivePipeline(prisma));
import { requireStudent, requireAuth } from "@/lib/auth";
import { createAuditLogInTransaction } from "@/lib/audit";
import { notifyApplicationSubmitted } from "@/features/notifications/producers/application-events";
import { checkApplicationExists } from "../queries/check-application-exists";
import { applyToDrive } from "../actions/apply-to-drive";
import { getApplicationRecord } from "../queries/get-application-record";
import { updateApplicationStageSchema } from "../schemas/application";
import { APPLICATION_DECLARATION } from "../utils/application-declaration";
import { evaluateStanding } from "@/features/drives/domain/eligibility-evaluator";
import {
  buildBackfillSnapshot,
  readApplicationRecord,
  stableStringify,
} from "../utils/application-snapshot";
import type { EligibilityRuleInput } from "@/features/drives/domain/eligibility-rules";

const DRIVE_ID = "clzzzzzzzzzzzzzzzzzzzzzzz";
const CSE = "dept-cse";
const ECE = "dept-ece";
const inDays = (n: number) => new Date(Date.now() + n * 864e5);

const rule = (
  ruleType: EligibilityRuleInput["ruleType"],
  operator: EligibilityRuleInput["operator"],
  value: number | string[]
): EligibilityRuleInput => ({
  ruleType,
  operator,
  numberValue: typeof value === "number" ? value : null,
  listValue: typeof value === "number" ? [] : value,
});

/** A custom question CSE made required on its own form. */
const cseForm = [
  { fieldKey: "name", label: "Full Name", source: "PROFILE", category: "Basic Identity", description: null, isRequired: true, isEnabled: true, sortOrder: 0, permission: "EDITABLE" },
  { fieldKey: "cgpa", label: "Current CGPA", source: "PROFILE", category: "Academic", description: null, isRequired: true, isEnabled: true, sortOrder: 1, permission: "READ_ONLY" },
  { fieldKey: "custom_notice", label: "Notice period", source: "STUDENT_INPUT", category: "Custom Questions", description: null, isRequired: true, isEnabled: true, sortOrder: 2, permission: "EDITABLE" },
] as const;

function cseInstance(extra: Record<string, unknown> = {}) {
  return {
    id: "config-cse",
    driveId: DRIVE_ID,
    departmentId: CSE,
    status: "PUBLISHED",
    publishedAt: new Date("2026-09-02"),
    lockedAt: new Date("2026-09-02"),
    updatedAt: new Date("2026-09-02"),
    roleName: "Backend Engineer",
    jobDescriptionText: "CSE JD",
    requirements: null,
    skills: null,
    driveDate: null,
    applicationDeadline: null,
    selectionRounds: null,
    minCGPA: null,
    maxActiveBacklogs: null,
    applicationFields: null,
    formFields: [...cseForm],
    // CSE targets the 2026 batch only.
    eligibilityRules: [rule("BATCH_YEAR", "IN", ["2026"])],
    venue: null,
    reportingTime: null,
    coordinatorName: null,
    coordinatorPhone: null,
    coordinatorEmail: null,
    seatingAllocation: null,
    pptLink: null,
    specialInstructions: null,
    ...extra,
  };
}

function drive(instance: object | null = cseInstance()) {
  return {
    id: DRIVE_ID,
    departmentId: null,
    isCentralDrive: true,
    lifecycleStatus: "PUBLISHED",
    companyName: "ABC",
    roleName: "Software Engineer",
    jobDescriptionUrl: null,
    jobDescriptionText: "Master JD",
    requirements: null,
    skills: null,
    packageOffered: new Prisma.Decimal("8.00"),
    packageDisplay: "8 LPA",
    selectionRounds: '["Aptitude","HR"]',
    driveDate: inDays(14),
    applicationDeadline: inDays(7),
    applyMethod: "IN_APP",
    externalApplyUrl: null,
    minCGPA: 7,
    maxActiveBacklogs: 0,
    applicationFields: null,
    formFields: [],
    updatedAt: new Date("2026-09-01"),
    eligibleDepartmentLinks: [{ departmentId: CSE }],
    eligibilityRules: [rule("CGPA", "GTE", 7), rule("ACTIVE_BACKLOGS", "LTE", 0)],
    departmentConfigs: instance ? [instance] : [],
  };
}

function student(extra: Record<string, unknown> = {}, academic: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    userId: "user-1",
    departmentId: CSE,
    rollNumber: "CS-001",
    name: "Asha Rao",
    email: "asha@example.com",
    phoneNumber: "9876543210",
    isPending: false,
    optedIn: true,
    entryType: "REGULAR",
    batchYear: 2026,
    dateOfBirth: new Date("2004-01-01"),
    address: "Should never reach a snapshot",
    department: { code: "CSE" },
    skills: [{ skillName: "Java", skillType: "TECHNICAL" }],
    projects: [],
    certifications: [],
    // Not placed.
    placements: [] as { revokedAt: Date | null }[],
    academic: {
      currentCGPA: 8.2,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 90,
      twelfthPercentage: 85,
      diplomaPercentage: null,
      currentSemester: 7,
      ...academic,
    },
    ...extra,
  };
}

const validOptions = {
  consent: true,
  declarationVersion: APPLICATION_DECLARATION.version,
  submittedDetails: { custom_notice: "30 days" },
};

/** A transaction client distinct from `prisma`, so writes outside it show. */
const tx = {
  driveApplication: { create: vi.fn() },
  // The drive's pipeline already exists; the application enters its first stage.
  recruitmentPipelineVersion: { findFirst: vi.fn(async () => ACTIVE_PIPELINE) },
  applicationStageEvent: { create: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStudent).mockResolvedValue({
    user: { id: "user-1" },
    student: { id: "student-1" },
  } as never);
  vi.mocked(prisma.student.findUnique).mockResolvedValue(student() as never);
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive() as never);
  vi.mocked(checkApplicationExists).mockResolvedValue(false);
  tx.driveApplication.create.mockResolvedValue({ id: "app-1" });
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (client: unknown) => unknown) => fn(tx)
  );
});

async function refused(options: object = validOptions) {
  const result = await applyToDrive(DRIVE_ID, options as never);
  expect(result.success).toBe(false);
  expect(tx.driveApplication.create).not.toHaveBeenCalled();
  expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  return result as { success: false; error: string; reasons?: string[] };
}

function createdData() {
  const [call] = tx.driveApplication.create.mock.calls;
  return (call[0] as { data: Record<string, any> }).data;
}

function storedSnapshot() {
  return JSON.parse(createdData().snapshot.create.payload);
}

// ---------------------------------------------------------------------------
// A valid application still works — and is recorded completely
// ---------------------------------------------------------------------------

describe("a valid application", () => {
  it("is accepted and written inside the transaction, never outside it", async () => {
    const result = await applyToDrive(DRIVE_ID, validOptions);

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.driveApplication.create).toHaveBeenCalledTimes(1);
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
    expect(notifyApplicationSubmitted).toHaveBeenCalledTimes(1);
  });

  it("creates the snapshot with the application, in one write", async () => {
    await applyToDrive(DRIVE_ID, validOptions);
    const data = createdData();

    expect(data.snapshot.create).toMatchObject({ origin: "SUBMISSION", schemaVersion: 1 });
    // Kept for existing readers.
    expect(data.snapshotCgpa).toBe(8.2);
    expect(data.snapshotBacklogs).toBe(0);
  });

  it("records the eligibility basis: values, batch, placement and the rules applied", async () => {
    await applyToDrive(DRIVE_ID, validOptions);
    const snap = storedSnapshot();

    expect(snap.academic).toMatchObject({ currentCGPA: 8.2, activeBacklogs: 0 });
    expect(snap.student).toMatchObject({ batchYear: 2026, departmentCode: "CSE", rollNumber: "CS-001" });
    expect(snap.placement).toEqual({ activePlacementCount: 0, placed: false });
    expect(snap.eligibility.eligible).toBe(true);
    // The master's CGPA and backlog rules, and CSE's own batch rule.
    expect(snap.eligibility.rules.map((r: { ruleType: string; source: string }) => [r.ruleType, r.source])).toEqual(
      expect.arrayContaining([
        ["CGPA", "MASTER"],
        ["ACTIVE_BACKLOGS", "MASTER"],
        ["BATCH_YEAR", "DEPARTMENT"],
      ])
    );
    expect(snap.eligibility.results.every((r: { passed: boolean }) => r.passed)).toBe(true);
  });

  it("records the form, the values shown and submitted, and the declaration", async () => {
    await applyToDrive(DRIVE_ID, validOptions);
    const snap = storedSnapshot();

    expect(snap.form.fields.map((f: { fieldKey: string }) => f.fieldKey)).toEqual([
      "name",
      "cgpa",
      "custom_notice",
    ]);
    expect(snap.application.values).toEqual({
      name: "Asha Rao",
      cgpa: "8.2 / 10.0",
      custom_notice: "30 days",
    });
    expect(snap.application.consent.declarationVersion).toBe(APPLICATION_DECLARATION.version);
    expect(snap.form.hash).toBe(createdData().snapshot.create.formHash);
  });

  it("records the drive as this department ran it, with its instance reference", async () => {
    await applyToDrive(DRIVE_ID, validOptions);
    const snap = storedSnapshot();

    expect(snap.drive.masterDriveId).toBe(DRIVE_ID);
    expect(snap.drive.departmentDrive).toMatchObject({ id: "config-cse", status: "PUBLISHED" });
    // CSE's overrides, not the master's values.
    expect(snap.drive.content).toMatchObject({
      roleName: "Backend Engineer",
      jobDescriptionText: "CSE JD",
      packageOffered: "8",
    });
  });

  it("stores nothing the form did not ask for", async () => {
    await applyToDrive(DRIVE_ID, validOptions);
    const payload = createdData().snapshot.create.payload as string;

    expect(payload).not.toContain("Should never reach a snapshot");
    expect(payload).not.toContain("2004-01-01");
    expect(payload).not.toContain("asha@example.com");
  });

  it("audits the submission and the snapshot inside the transaction, as the student", async () => {
    await applyToDrive(DRIVE_ID, validOptions);

    const calls = vi.mocked(createAuditLogInTransaction).mock.calls;
    expect(calls.map(([client, input, userId]) => [client, input.action, input.entityType, userId])).toEqual([
      [tx, "APPLY", "DriveApplication", "user-1"],
      [tx, "CREATE", "DriveApplicationSnapshot", "user-1"],
    ]);
  });

  it("still accepts a caller that does not send a declaration version", async () => {
    const result = await applyToDrive(DRIVE_ID, {
      consent: true,
      submittedDetails: { custom_notice: "30 days" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Each check, broken once
// ---------------------------------------------------------------------------

describe("the server refuses", () => {
  it("a duplicate application", async () => {
    vi.mocked(checkApplicationExists).mockResolvedValue(true);
    const result = await refused();
    expect(result.error).toMatch(/already applied/i);
  });

  it("a duplicate that races past the check, at the unique constraint", async () => {
    tx.driveApplication.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6",
      })
    );
    const result = await applyToDrive(DRIVE_ID, validOptions);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already applied/i);
    expect(notifyApplicationSubmitted).not.toHaveBeenCalled();
  });

  it.each([["ASSIGNED"], ["CONFIGURED"]])("a drive this department has not published (%s)", async (status) => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive(cseInstance({ status })) as never);
    const result = await refused();
    expect(result.error).toMatch(/not open/i);
  });

  it.each([["CLOSED"], ["ARCHIVED"]])("a drive this department has closed (%s)", async (status) => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive(cseInstance({ status })) as never);
    await refused();
  });

  it("a drive the Super Admin archived", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...drive(),
      lifecycleStatus: "ARCHIVED",
    } as never);
    await refused();
  });

  it("an expired deadline — the department's own", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(
      drive(cseInstance({ applicationDeadline: inDays(-1) })) as never
    );
    const result = await refused();
    expect(result.reasons).toContain("Drive is closed");
  });

  it("a placed student", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(
      student({ placements: [{ revokedAt: null }] }) as never
    );
    const result = await refused();
    expect(result.reasons?.join(" ")).toMatch(/already been placed/);
  });

  it("an opted-out student", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({ optedIn: false }) as never);
    const result = await refused();
    expect(result.reasons?.join(" ")).toMatch(/opted out/);
  });

  it("a student whose registration is not approved", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({ isPending: true }) as never);
    const result = await refused();
    expect(result.reasons?.join(" ")).toMatch(/not been approved/);
  });

  it("a student from a department the drive has no instance for", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({ departmentId: ECE }) as never);
    // The query is scoped to the student's department, so ECE gets no instance.
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive(null) as never);
    await refused();

    const [call] = vi.mocked(prisma.drive.findUnique).mock.calls;
    expect(
      (call[0] as { include: { departmentConfigs: { where: unknown } } }).include.departmentConfigs.where
    ).toEqual({ departmentId: ECE });
  });

  it("a student whose department is not assigned, even with an instance row", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...drive(),
      eligibleDepartmentLinks: [{ departmentId: ECE }],
    } as never);
    await refused();
  });

  it("a student outside the targeted batch", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({ batchYear: 2025 }) as never);
    const result = await refused();
    expect(result.error).toMatch(/not eligible/i);
  });

  it("an ineligible student", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({}, { currentCGPA: 6.4 }) as never);
    await refused();
  });

  it("forged eligibility — nothing in the request is evaluated", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue(student({}, { currentCGPA: 6.4 }) as never);
    await refused({
      ...validOptions,
      eligible: true,
      submittedDetails: { custom_notice: "30 days", cgpa: "9.9 / 10.0", batch: "2026" },
    });
  });

  it("a missing required field", async () => {
    const result = await refused({ ...validOptions, submittedDetails: {} });
    expect(result.reasons?.join(" ")).toMatch(/Notice period/);
  });

  it("a required read-only value missing from the profile", async () => {
    // CSE requires GitHub, read-only; this student's profile has none.
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(
      drive(
        cseInstance({
          formFields: [
            ...cseForm,
            { fieldKey: "github", label: "GitHub", source: "PROFILE", category: "Links", description: null, isRequired: true, isEnabled: true, sortOrder: 3, permission: "READ_ONLY" },
          ],
        })
      ) as never
    );
    const result = await refused({
      ...validOptions,
      // Supplying it does not help: it is read-only.
      submittedDetails: { custom_notice: "30 days", github: "https://github.com/x" },
    });
    expect(result.reasons?.join(" ")).toMatch(/profile/i);
  });

  it.each([
    ["consent absent", { submittedDetails: { custom_notice: "30 days" } }],
    ["consent false", { ...validOptions, consent: false }],
    ["consent not a boolean", { ...validOptions, consent: "yes" }],
    ["an outdated declaration", { ...validOptions, declarationVersion: "2025-old" }],
  ])("an invalid acknowledgement: %s", async (_label, options) => {
    await refused(options);
  });

  it("an unauthenticated caller", async () => {
    vi.mocked(requireStudent).mockRejectedValue(new Error("Unauthorized"));
    await refused();
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("reads the student from the session, never from the request", async () => {
    await applyToDrive(DRIVE_ID, { ...validOptions, studentId: "someone-else" } as never);
    const [call] = vi.mocked(prisma.student.findUnique).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({ id: "student-1" });
    expect(createdData().studentId).toBe("student-1");
  });
});

describe("forged read-only fields", () => {
  it("are replaced by the profile value in the snapshot and dropped from the answers", async () => {
    await applyToDrive(DRIVE_ID, {
      ...validOptions,
      submittedDetails: { custom_notice: "30 days", cgpa: "10 / 10.0", isPlaced: "no" },
    });

    const data = createdData();
    expect(JSON.parse(data.submittedDetails)).toEqual({
      name: "Asha Rao",
      custom_notice: "30 days",
    });
    expect(storedSnapshot().application.values.cgpa).toBe("8.2 / 10.0");
  });
});

// ---------------------------------------------------------------------------
// Atomicity
// ---------------------------------------------------------------------------

describe("transaction", () => {
  it("a snapshot that fails to write fails the whole application", async () => {
    // The audit/snapshot step inside the transaction throws: the transaction
    // rejects, so Postgres rolls the application back with it.
    vi.mocked(createAuditLogInTransaction).mockRejectedValueOnce(new Error("snapshot write failed"));

    const result = await applyToDrive(DRIVE_ID, validOptions);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/unexpected error/i);
    // Nothing is announced for an application that does not exist.
    expect(notifyApplicationSubmitted).not.toHaveBeenCalled();
    // And nothing was written outside the transaction.
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe("a submitted application cannot be changed", () => {
  const migration = readFileSync(
    join(process.cwd(), "prisma/migrations/20260922000000_application_integrity/migration.sql"),
    "utf8"
  );

  it("the database refuses any change to what was submitted", () => {
    expect(migration).toMatch(/BEFORE UPDATE ON "DriveApplication"/);
    for (const column of [
      "studentId",
      "driveId",
      "appliedAt",
      "snapshotCgpa",
      "snapshotBacklogs",
      "submittedDetails",
      "consentAcceptedAt",
    ]) {
      expect(migration).toContain(`NEW."${column}"`);
    }
    // Recruitment progress stays movable.
    expect(migration).not.toContain(`NEW."stage"`);
    expect(migration).not.toContain(`NEW."status"`);
  });

  it("the database refuses any change to a snapshot", () => {
    expect(migration).toMatch(/BEFORE UPDATE ON "DriveApplicationSnapshot"/);
  });

  it("no student action edits or withdraws an application", () => {
    const actions = readFileSync(join(process.cwd(), "features/applications/actions/apply-to-drive.ts"), "utf8");
    expect(actions).not.toMatch(/driveApplication\.(update|delete|upsert)/);
    // Withdrawal is not a writable status.
    expect(
      updateApplicationStageSchema.safeParse({
        applicationId: "claaaaaaaaaaaaaaaaaaaaaaa",
        stage: "APPLIED",
        status: "WITHDRAWN",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reading the record
// ---------------------------------------------------------------------------

describe("getApplicationRecord — authorization", () => {
  const stored = {
    snapshotCgpa: 8.2,
    snapshotBacklogs: 0,
    submittedDetails: '{"name":"Asha"}',
    consentAcceptedAt: new Date("2026-09-10"),
    snapshot: null,
    student: { userId: "user-1", departmentId: CSE },
    drive: { departmentId: null, isCentralDrive: true, eligibleDepartmentLinks: [{ departmentId: CSE }] },
  };

  beforeEach(() => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(stored as never);
  });

  it("gives a student their own application", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: "user-1", role: "STUDENT" } as never);
    await expect(getApplicationRecord("app-1")).resolves.toMatchObject({ origin: "LEGACY_COLUMNS" });
  });

  it("refuses another student's", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: "user-2", role: "STUDENT" } as never);
    await expect(getApplicationRecord("app-1")).rejects.toThrow();
  });

  it("gives a department admin their own department's applicant", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: "admin-cse", role: "DEPT_ADMIN" } as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({ departmentId: CSE } as never);
    await expect(getApplicationRecord("app-1")).resolves.toBeTruthy();
  });

  it("refuses another department's admin", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: "admin-ece", role: "DEPT_ADMIN" } as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({ departmentId: ECE } as never);
    await expect(getApplicationRecord("app-1")).rejects.toThrow();
  });

  it("answers a missing id exactly like a forbidden one", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: "user-2", role: "STUDENT" } as never);
    const forbidden = await getApplicationRecord("app-1").catch((e: Error) => e.message);
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(null);
    const missing = await getApplicationRecord("nope").catch((e: Error) => e.message);
    expect(missing).toBe(forbidden);
  });
});

describe("snapshot helpers", () => {
  it("hash input is independent of key order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("a backfilled snapshot records only what was recorded, and says what was not", () => {
    const built = buildBackfillSnapshot({
      id: "app-1",
      studentId: "student-1",
      driveId: DRIVE_ID,
      appliedAt: new Date("2026-01-01"),
      snapshotCgpa: 7.9,
      snapshotBacklogs: 1,
      submittedDetails: '{"phone":"1"}',
      consentAcceptedAt: null,
    });
    const payload = JSON.parse(built.payload);

    expect(payload.origin).toBe("BACKFILL");
    expect(payload.academic).toEqual({ currentCGPA: 7.9, activeBacklogs: 1 });
    expect(payload.application.submittedDetails).toEqual({ phone: "1" });
    expect(payload).not.toHaveProperty("eligibility");
    expect(payload.notCaptured).toContain("eligibility rules and evaluation");
  });

  it("falls back to the inline columns for an application with no snapshot", () => {
    const record = readApplicationRecord({
      snapshotCgpa: 8,
      snapshotBacklogs: 0,
      submittedDetails: "not json",
      consentAcceptedAt: null,
      snapshot: null,
    });
    expect(record.origin).toBe("LEGACY_COLUMNS");
    expect(record.legacy).toMatchObject({ cgpa: 8, submittedDetails: null });
  });

  it("standing is checked in order: approval, then placement, then opt-in", () => {
    const ok = { approved: true, placed: false, optedIn: true };
    expect(evaluateStanding(ok)).toBeNull();
    expect(evaluateStanding({ approved: false, placed: true, optedIn: false })).toBe("NOT_APPROVED");
    expect(evaluateStanding({ ...ok, placed: true, optedIn: false })).toBe("PLACED");
    expect(evaluateStanding({ ...ok, optedIn: false })).toBe("OPTED_OUT");
    expect(evaluateStanding(ok, false)).toBe("DEPARTMENT");
  });
});
