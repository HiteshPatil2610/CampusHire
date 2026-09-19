import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";

/**
 * An application is final once submitted.
 *
 * The rule: after submission the student cannot edit it and cannot withdraw or
 * delete it; the row stays attached to the drive; only an authorised
 * department admin may move `stage`/`status`; and the submitted content never
 * changes. These tests pin all four halves server-side, because the UI is not
 * where this is enforced.
 *
 * Context: `withdrawApplication` used to exist and *deleted* the row, which
 * contradicted `project-overview.md` ("no edit, no withdrawal, no reapplying")
 * and let a student silently vacate a drive's applicant count. It was removed.
 * `ApplicationStatus.WITHDRAWN` survives on the Prisma enum so any historical
 * row still reads, but nothing can write it.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    drive: { findUnique: vi.fn() },
    driveApplication: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
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
  requireDepartmentAdmin: vi.fn(),
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
  createApplicationSubmittedNotification: vi.fn(),
  createNotification: vi.fn(),
  NotificationType: { APPLICATION: "APPLICATION" },
}));

vi.mock("../queries/check-application-exists", () => ({
  checkApplicationExists: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { withActivePipeline } from "@/features/recruitment/__tests__/pipeline-fixtures";

// Every department drive here already has an active recruitment pipeline.
beforeEach(() => withActivePipeline(prisma));
import { requireStudent, requireDepartmentAdmin } from "@/lib/auth";
import { checkApplicationExists } from "../queries/check-application-exists";
import { applyToDrive } from "../actions/apply-to-drive";
import { updateApplicationStage } from "../actions/update-application-stage";
import { updateApplicationStageSchema } from "../schemas/application";
import { validateStageTransition } from "../utils/application-progress";

const DRIVE_ID = "clzzzzzzzzzzzzzzzzzzzzzzz";
const APPLICATION_ID = "claaaaaaaaaaaaaaaaaaaaaaa";

const student = {
  id: "student-1",
  userId: "user-1",
  departmentId: "dept-a",
  rollNumber: "CS2021001",
  name: "Test Student",
  email: "student@example.com",
  phoneNumber: "9876543210",
};

const studentWithAcademic = {
  skills: [],
  projects: [],
  certifications: [],
  department: { code: "CSE" },
  isPending: false,
  optedIn: true,
  placements: [],
  ...student,
  academic: { currentCGPA: 8.5, activeBacklogs: 0 },
};

const openDrive = {
  id: DRIVE_ID,
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  minCGPA: 7,
  maxActiveBacklogs: 0,
  applicationDeadline: new Date(Date.now() + 7 * 864e5),
  lifecycleStatus: "PUBLISHED" as const,
  eligibleDepartmentLinks: [{ departmentId: "dept-a" }],
  // The applicant's department has published this drive and overrides nothing.
  eligibilityRules: [],
  // No form anywhere: the catalog default applies.
  applicationFields: null,
  formFields: [],
  departmentConfigs: [
    {
      status: "PUBLISHED" as const,
      lockedAt: new Date(),
      eligibilityRules: [],
      applicationFields: null,
      formFields: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );

  vi.mocked(requireStudent).mockResolvedValue({
    user: { id: "user-1" },
    student,
  } as never);
  vi.mocked(prisma.student.findUnique).mockResolvedValue(
    studentWithAcademic as never
  );
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(openDrive as never);
  vi.mocked(checkApplicationExists).mockResolvedValue(false);
  vi.mocked(prisma.driveApplication.create).mockResolvedValue({
    id: APPLICATION_ID,
    studentId: student.id,
    driveId: DRIVE_ID,
  } as never);
});

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

describe("applyToDrive — submission", () => {
  it("accepts a first submission once the declaration is ticked", async () => {
    const result = await applyToDrive(DRIVE_ID, {
      consent: true,
      submittedDetails: { phone: "9999999999" },
    });

    expect(result.success).toBe(true);
    expect(prisma.driveApplication.create).toHaveBeenCalledTimes(1);
  });

  it("refuses to submit without the finality declaration", async () => {
    const result = await applyToDrive(DRIVE_ID, { consent: false });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("refuses when consent is simply absent", async () => {
    // The drive detail page used to call `applyToDrive(driveId)` with no
    // options at all, so every submission from that page was rejected. The
    // default stays `false` on purpose — this pins that it is a refusal and
    // never an implicit acceptance.
    const result = await applyToDrive(DRIVE_ID);

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("keeps only editable keys out of the submitted payload", async () => {
    await applyToDrive(DRIVE_ID, {
      consent: true,
      // `cgpa` is registrar-owned and must never be taken from the client.
      submittedDetails: { phone: "9999999999", cgpa: "10.0" },
    });

    const [call] = vi.mocked(prisma.driveApplication.create).mock.calls;
    const stored = JSON.parse(
      (call[0] as { data: { submittedDetails: string } }).data.submittedDetails
    );

    // The form's editable fields with their effective values; the
    // registrar-owned CGPA is dropped.
    expect(stored).toEqual({
      name: "Test Student",
      email: "student@example.com",
      phone: "9999999999",
    });
    expect(stored).not.toHaveProperty("cgpa");
  });
});

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

describe("applyToDrive — editing is impossible", () => {
  it("rejects a re-submission for a drive already applied to", async () => {
    vi.mocked(checkApplicationExists).mockResolvedValue(true);

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/final/i);
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("rejects a racing re-submission at the unique constraint", async () => {
    // The app-level check passed, so two requests got this far at once. The
    // database is the backstop and the first row must stand.
    vi.mocked(prisma.driveApplication.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
    );

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/final/i);
  });

  it("never updates an existing application row", async () => {
    vi.mocked(checkApplicationExists).mockResolvedValue(true);

    await applyToDrive(DRIVE_ID, {
      consent: true,
      submittedDetails: { phone: "1111111111" },
    });

    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Withdraw
// ---------------------------------------------------------------------------

describe("withdrawal — no path exists", () => {
  // Checked against the filesystem rather than by importing the old module:
  // a deleted module cannot be referenced in a type-checked test, and this
  // form also fails if someone reintroduces the action under a new filename.
  it("ships no withdraw action in the applications feature", () => {
    const actionsDir = path.join(__dirname, "..", "actions");
    const withdrawActions = fs
      .readdirSync(actionsDir)
      .filter((file) => /withdraw/i.test(file));

    expect(withdrawActions).toEqual([]);
  });

  it("has no caller of a withdrawApplication action anywhere in the app", () => {
    const roots = ["app", "components", "features", "lib"].map((dir) =>
      path.join(__dirname, "..", "..", "..", dir)
    );

    const offenders: string[] = [];
    const selfPath = path.normalize(__filename);

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (path.normalize(full) === selfPath) continue;
        if (/\bwithdrawApplication\b/.test(fs.readFileSync(full, "utf8"))) {
          offenders.push(full);
        }
      }
    };

    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });

  it("exposes no withdraw schema", async () => {
    const schemas = await import("../schemas/application");
    expect(schemas).not.toHaveProperty("withdrawApplicationSchema");
  });

  it("refuses WITHDRAWN at the admin write boundary", () => {
    const parsed = updateApplicationStageSchema.safeParse({
      applicationId: APPLICATION_ID,
      stage: "APPLIED",
      status: "WITHDRAWN",
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses WITHDRAWN in the pure transition rule as well", () => {
    const result = validateStageTransition({
      currentStage: "APPLIED",
      currentStatus: "IN_PROGRESS",
      nextStage: "APPLIED",
      nextStatus: "WITHDRAWN",
    });

    expect(result.valid).toBe(false);
  });

  it("leaves a historical withdrawn application readable but frozen", () => {
    const result = validateStageTransition({
      currentStage: "APPLIED",
      currentStatus: "WITHDRAWN",
      nextStage: "INTERVIEW",
      nextStatus: "IN_PROGRESS",
    });

    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Admin permissions stay exactly as intended
// ---------------------------------------------------------------------------

describe("updateApplicationStage — admin scope unchanged", () => {
  const adminOfA = {
    user: { id: "user-admin-a" },
    admin: { id: "admin-a", departmentId: "dept-a" },
    department: { id: "dept-a", name: "Computer", code: "CS", isActive: true },
  };

  const applicationRow = {
    id: APPLICATION_ID,
    stage: "APPLIED" as const,
    status: "IN_PROGRESS" as const,
    student: { id: student.id, departmentId: "dept-a", userId: "user-1" },
    drive: {
      id: DRIVE_ID,
      companyName: "Acme Corp",
      roleName: "Software Engineer",
      departmentId: "dept-a",
      isCentralDrive: false,
      eligibleDepartmentLinks: [{ departmentId: "dept-a" }],
      departmentConfigs: [{ id: "config-1", roleName: null }],
    },
    currentStage: null,
  };

  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOfA as never);
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(
      applicationRow as never
    );
    vi.mocked(prisma.driveApplication.update).mockResolvedValue({} as never);
  });

  it("lets the owning department's admin advance the stage", async () => {
    const result = await updateApplicationStage({
      applicationId: APPLICATION_ID,
      stageId: "rst_technical",
      status: "IN_PROGRESS",
    });

    expect(result.success).toBe(true);
    expect(prisma.driveApplication.update).toHaveBeenCalled();
  });

  it("writes only stage and status — never the submitted content", async () => {
    await updateApplicationStage({
      applicationId: APPLICATION_ID,
      stageId: "rst_technical",
      status: "IN_PROGRESS",
    });

    const [call] = vi.mocked(prisma.driveApplication.update).mock.calls;
    const data = (call[0] as { data: Record<string, unknown> }).data;

    expect(Object.keys(data).sort()).toEqual([
      "currentStageId",
      "stage",
      "stageUpdatedAt",
      "stageUpdatedById",
      "status",
    ]);
    expect(data).not.toHaveProperty("submittedDetails");
    expect(data).not.toHaveProperty("snapshotCgpa");
    expect(data).not.toHaveProperty("consentAcceptedAt");
  });

  it("refuses an admin from another department", async () => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue({
      ...applicationRow,
      student: { ...applicationRow.student, departmentId: "dept-b" },
    } as never);

    const result = await updateApplicationStage({
      applicationId: APPLICATION_ID,
      stageId: "rst_technical",
      status: "IN_PROGRESS",
    });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not a department admin", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(
      new Error("This action requires DEPT_ADMIN role.")
    );

    const result = await updateApplicationStage({
      applicationId: APPLICATION_ID,
      stageId: "rst_technical",
      status: "IN_PROGRESS",
    });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("never deletes an application", async () => {
    await updateApplicationStage({
      applicationId: APPLICATION_ID,
      stageId: "rst_technical",
      status: "IN_PROGRESS",
    });

    expect(prisma.driveApplication.delete).not.toHaveBeenCalled();
    expect(prisma.driveApplication.deleteMany).not.toHaveBeenCalled();
  });
});
