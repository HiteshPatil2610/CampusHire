import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Permanent placement exclusion and batch targeting.
 *
 *  - A placed student (an active StudentPlacement) is ineligible for every new
 *    drive. The evaluator checks it first and stops: no rule is evaluated.
 *  - Batch targeting is the BATCH_YEAR rule, required before publishing.
 *  - Placement is managed by department admins for their own students only,
 *    corrected by revocation, never edited; students can only read it.
 *  - Every path — list, apply, notifications, the admin's eligible list —
 *    decides through the same evaluator, so they cannot disagree.
 */

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn(), findMany: vi.fn() },
    drive: { findUnique: vi.fn(), findMany: vi.fn() },
    driveDepartmentConfig: { findMany: vi.fn() },
    driveEligibilityRule: { findMany: vi.fn() },
    driveApplication: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    studentPlacement: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    departmentAdmin: { findUnique: vi.fn() },
    notification: { createMany: vi.fn(), findMany: vi.fn() },
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
  requireAnyRole: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: { APPLY: "APPLY", UPDATE: "UPDATE", CREATE: "CREATE", REVOKE: "REVOKE" },
  AuditEntityType: {
    DRIVE_APPLICATION: "DriveApplication",
    APPLICATION_SNAPSHOT: "DriveApplicationSnapshot",
    STUDENT_PLACEMENT: "StudentPlacement",
  },
}));

vi.mock("@/lib/notifications", () => ({
  createApplicationSubmittedNotification: vi.fn(),
  createNotification: vi.fn(),
  NotificationType: { APPLICATION: "APPLICATION" },
}));

vi.mock("@/features/applications/queries/check-application-exists", () => ({
  checkApplicationExists: vi.fn(async () => false),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { withActivePipeline } from "@/features/recruitment/__tests__/pipeline-fixtures";

// Every department drive here already has an active recruitment pipeline.
beforeEach(() => withActivePipeline(prisma));
import { requireStudent, requireDepartmentAdmin, requireAnyRole } from "@/lib/auth";
import {
  evaluateEligibility,
  STANDING_REASONS,
  type EligibilitySubject,
} from "@/features/drives/domain/eligibility-evaluator";
import {
  getIneligibilityReasons,
  isStudentEligibleForDrive,
} from "@/features/drives/queries/drive-eligibility";
import { getEligibleDrives } from "@/features/drives/queries/get-eligible-drives";
import { getDepartmentDriveEligibleStudents } from "@/features/drives/queries/get-department-drive-eligible-students";
import { applyToDrive } from "@/features/applications/actions/apply-to-drive";
import { updateApplicationStage } from "@/features/applications/actions/update-application-stage";
import { validateStageTransition } from "@/features/applications/utils/application-progress";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { recordManualPlacement, revokePlacement } from "../actions/manage-placement";
import { decideStudentRetirement } from "@/features/admin-accounts/utils/retire-student-record";
import {
  targetedBatchYears,
  withTargetedBatchYears,
} from "@/features/drives/domain/batch-targeting";
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

const ACTIVE = { revokedAt: null };
const REVOKED = { revokedAt: new Date("2026-09-01") };

/** CSE targets the 2026 batch; the master asks CGPA ≥ 7. */
const cseInstance = {
  id: "config-cse",
  driveId: DRIVE_ID,
  departmentId: CSE,
  status: "PUBLISHED",
  publishedAt: new Date("2026-09-02"),
  lockedAt: new Date("2026-09-02"),
  updatedAt: new Date("2026-09-02"),
  roleName: null,
  jobDescriptionText: null,
  requirements: null,
  skills: null,
  driveDate: null,
  applicationDeadline: null,
  selectionRounds: null,
  minCGPA: null,
  maxActiveBacklogs: null,
  applicationFields: null,
  formFields: [],
  eligibilityRules: [rule("BATCH_YEAR", "IN", ["2026"])],
  venue: null,
  reportingTime: null,
  coordinatorName: null,
  coordinatorPhone: null,
  coordinatorEmail: null,
  seatingAllocation: null,
  pptLink: null,
  specialInstructions: null,
};

const master = {
  id: DRIVE_ID,
  departmentId: null,
  isCentralDrive: true,
  lifecycleStatus: "PUBLISHED",
  companyName: "ABC",
  roleName: "Software Engineer",
  jobDescriptionUrl: null,
  jobDescriptionText: null,
  requirements: null,
  skills: null,
  packageOffered: "8.00",
  packageDisplay: "8 LPA",
  selectionRounds: "[]",
  driveDate: inDays(14),
  applicationDeadline: inDays(7),
  applyMethod: "IN_APP",
  externalApplyUrl: null,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  companyLogoUrl: null,
  venue: null,
  reportingTime: null,
  contactPerson: null,
  contactPhone: null,
  pptLink: null,
  applicationFields: null,
  formFields: [],
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  eligibleDepartmentLinks: [{ departmentId: CSE }],
  eligibilityRules: [rule("CGPA", "GTE", 7), rule("ACTIVE_BACKLOGS", "LTE", 0)],
};

function student(extra: Record<string, unknown> = {}, cgpa = 8.2) {
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
    entryType: "REGULAR" as const,
    batchYear: 2026,
    department: { code: "CSE" },
    skills: [] as { skillName: string; skillType?: string }[],
    projects: [],
    certifications: [],
    placements: [] as { revokedAt: Date | null }[],
    academic: {
      currentCGPA: cgpa,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 90,
      twelfthPercentage: 85,
      diplomaPercentage: null,
      currentSemester: 7,
    },
    ...extra,
  };
}

const resolvedCse = {
  applicationDeadline: inDays(7),
  eligibleDepartmentLinks: [{ departmentId: CSE }],
  eligibilityRules: [...master.eligibilityRules, ...cseInstance.eligibilityRules],
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );
});

// ---------------------------------------------------------------------------
// The evaluator: placement first, and it stops
// ---------------------------------------------------------------------------

describe("placement short-circuits the evaluator", () => {
  const subject = (overrides: Partial<EligibilitySubject> = {}): EligibilitySubject => ({
    approved: true,
    placed: false,
    optedIn: true,
    entryType: "REGULAR",
    batchYear: 2026,
    academic: {
      currentCGPA: 9,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 90,
      twelfthPercentage: 90,
      diplomaPercentage: null,
      currentSemester: 7,
    },
    skills: [],
    ...overrides,
  });

  const rules = [rule("CGPA", "GTE", 7), rule("BATCH_YEAR", "IN", ["2026"])];

  it("excludes a placed student even when every rule would pass", () => {
    const result = evaluateEligibility(subject({ placed: true }), rules);

    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("PLACED");
    expect(result.reasons).toEqual([STANDING_REASONS.PLACED]);
  });

  it("does not evaluate CGPA, backlogs, batch or any rule once placed", () => {
    // A placed student who would also fail every rule: only placement is reported,
    // and no rule result exists at all — the rules were never evaluated.
    const result = evaluateEligibility(
      subject({ placed: true, batchYear: 2020, academic: null }),
      [...rules, rule("SKILL", "INCLUDES_ALL", ["Rust"])]
    );

    expect(result.results).toEqual([]);
    expect(result.reasons).toEqual([STANDING_REASONS.PLACED]);
  });

  it("checks approval before placement", () => {
    expect(evaluateEligibility(subject({ approved: false, placed: true }), rules).blockedBy).toBe(
      "NOT_APPROVED"
    );
  });

  it("an unplaced student continues to the rules", () => {
    const pass = evaluateEligibility(subject(), rules);
    expect(pass.eligible).toBe(true);
    expect(pass.results).toHaveLength(2);

    const fail = evaluateEligibility(subject({ academic: { ...subject().academic!, currentCGPA: 6 } }), rules);
    expect(fail.blockedBy).toBeNull();
    expect(fail.reasons.join(" ")).toMatch(/CGPA/);
  });

  it("a revoked placement does not exclude", () => {
    const withRevoked = student({ placements: [REVOKED] });
    expect(isStudentEligibleForDrive(withRevoked as never, resolvedCse as never)).toBe(true);

    const withActive = student({ placements: [REVOKED, ACTIVE] });
    expect(isStudentEligibleForDrive(withActive as never, resolvedCse as never)).toBe(false);
  });

  it("explains placement alone, without listing other criteria", () => {
    const placedAndWeak = student({ placements: [ACTIVE], batchYear: 2025 }, 5);
    expect(getIneligibilityReasons(placedAndWeak as never, resolvedCse as never)).toEqual([
      STANDING_REASONS.PLACED,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Batch targeting
// ---------------------------------------------------------------------------

describe("batch targeting", () => {
  it("a student in a targeted batch passes", () => {
    expect(isStudentEligibleForDrive(student() as never, resolvedCse as never)).toBe(true);
  });

  it("a student in another batch fails, and is told why", () => {
    const other = student({ batchYear: 2027 });
    expect(isStudentEligibleForDrive(other as never, resolvedCse as never)).toBe(false);
    expect(getIneligibilityReasons(other as never, resolvedCse as never).join(" ")).toMatch(
      /Your batch \(2027\) is not targeted/
    );
  });

  it("a student with no batch on record fails rather than passing by default", () => {
    const unknown = student({ batchYear: null });
    expect(isStudentEligibleForDrive(unknown as never, resolvedCse as never)).toBe(false);
  });

  it("reads and writes exactly the BATCH_YEAR rule", () => {
    const rules = [rule("CGPA", "GTE", 7)];
    const targeted = withTargetedBatchYears(rules, ["2027", "2026", "2026", " "]);

    expect(targetedBatchYears(targeted)).toEqual(["2026", "2027"]);
    expect(targeted.filter((r) => r.ruleType === "CGPA")).toHaveLength(1);
    expect(targetedBatchYears(withTargetedBatchYears(targeted, []))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Department isolation
// ---------------------------------------------------------------------------

describe("department isolation", () => {
  it("a student outside the drive's departments is excluded before any rule", () => {
    const ece = student({ departmentId: ECE });
    expect(getIneligibilityReasons(ece as never, resolvedCse as never)).toEqual([
      STANDING_REASONS.DEPARTMENT,
    ]);
  });

  it("the admin eligible list covers the admin's own department only, via the evaluator", async () => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue({
      user: { id: "admin-cse" },
      department: { id: CSE, code: "CSE" },
    } as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: [cseInstance],
    } as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student({ id: "s-ok", name: "Eligible" }),
      student({ id: "s-placed", placements: [ACTIVE] }),
      student({ id: "s-2027", batchYear: 2027 }),
      student({ id: "s-weak" }, 6),
    ] as never);

    const result = await getDepartmentDriveEligibleStudents(DRIVE_ID);

    const [call] = vi.mocked(prisma.student.findMany).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({ departmentId: CSE });
    expect(result.eligible.map((s) => s.id)).toEqual(["s-ok"]);
    expect(result.placedExcluded).toBe(1);
    expect(result.ineligibleReasons.map((r) => r.students).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("refuses another department's drive on the admin eligible list", async () => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue({
      user: { id: "admin-ece" },
      department: { id: ECE, code: "ECE" },
    } as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({ ...master, departmentConfigs: [] } as never);

    await expect(getDepartmentDriveEligibleStudents(DRIVE_ID)).rejects.toThrow();
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// One evaluator everywhere
// ---------------------------------------------------------------------------

describe("list, apply and notifications agree", () => {
  function asStudent(s: ReturnType<typeof student>) {
    vi.mocked(requireStudent).mockResolvedValue({ user: { id: s.userId }, student: s } as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(s as never);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([
      { ...master, departmentConfigs: [cseInstance] },
    ] as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: [cseInstance],
    } as never);
    vi.mocked(prisma.driveApplication.create).mockResolvedValue({ id: "app-1" } as never);
  }

  it.each([
    ["an unplaced student in the targeted batch", student(), true],
    ["a placed student", student({ placements: [ACTIVE] }), false],
    ["a student in another batch", student({ batchYear: 2027 }), false],
  ])("%s gets the same answer from the list and from apply", async (_label, s, expected) => {
    asStudent(s);

    const listed = (await getEligibleDrives()).totalCount === 1;
    const applied = (await applyToDrive(DRIVE_ID, { consent: true })).success;

    expect(listed).toBe(expected);
    expect(applied).toBe(expected);
  });

  it("apply refuses a placed student before loading any drive", async () => {
    asStudent(student({ placements: [ACTIVE] }));

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toEqual([STANDING_REASONS.PLACED]);
    expect(prisma.drive.findUnique).not.toHaveBeenCalled();
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("notifications narrow out placed students in SQL and exclude them exactly too", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([cseInstance] as never);
    vi.mocked(prisma.driveEligibilityRule.findMany).mockResolvedValue(master.eligibilityRules as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
    // Even if the narrowing let one through, the evaluator decides.
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student({ id: "s-ok", userId: "u-ok" }),
      student({ id: "s-placed", userId: "u-placed", placements: [ACTIVE] }),
      student({ id: "s-2027", userId: "u-2027", batchYear: 2027 }),
    ] as never);

    const { notified } = await notifyEligibleStudentsOfDrive(master as never);

    const [query] = vi.mocked(prisma.student.findMany).mock.calls;
    expect((query[0] as { where: Record<string, unknown> }).where).toMatchObject({
      placements: { none: { revokedAt: null } },
    });
    expect(notified).toBe(1);
    const [call] = vi.mocked(prisma.notification.createMany).mock.calls;
    expect((call[0] as { data: { userId: string }[] }).data.map((row) => row.userId)).toEqual(["u-ok"]);
  });
});

// ---------------------------------------------------------------------------
// Placement management: authorization and history
// ---------------------------------------------------------------------------

describe("recording a placement", () => {
  const input = {
    studentId: "student-1",
    companyName: "Offcampus Ltd",
    roleName: "Analyst",
    packageDisplay: "6 LPA",
    packageOffered: 6,
    placedAt: "2026-09-10",
  };

  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue({
      user: { id: "admin-cse" },
      department: { id: CSE, code: "CSE" },
    } as never);
    vi.mocked(prisma.studentPlacement.create).mockResolvedValue({ id: "plc-1" } as never);
  });

  it("lets a department admin record a placement for their own student", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue({ id: "student-1", departmentId: CSE } as never);

    const result = await recordManualPlacement(input);

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.studentPlacement.create).mock.calls;
    expect((call[0] as { data: Record<string, unknown> }).data).toMatchObject({
      studentId: "student-1",
      source: "MANUAL",
      recordedById: "admin-cse",
    });
  });

  it("refuses another department's student", async () => {
    vi.mocked(prisma.student.findUnique).mockResolvedValue({ id: "student-1", departmentId: ECE } as never);

    const result = await recordManualPlacement(input);

    expect(result.success).toBe(false);
    expect(prisma.studentPlacement.create).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not a department admin — a student cannot record one", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(
      new (await import("@/lib/auth")).AuthorizationError("Forbidden")
    );

    const result = await recordManualPlacement(input);

    expect(result.success).toBe(false);
    expect(prisma.studentPlacement.create).not.toHaveBeenCalled();
  });
});

describe("revoking a placement", () => {
  const placement = {
    id: "plc-1",
    revokedAt: null,
    companyName: "ABC",
    student: { id: "student-1", departmentId: CSE },
  };

  beforeEach(() => {
    vi.mocked(prisma.studentPlacement.findUnique).mockResolvedValue(placement as never);
    vi.mocked(prisma.studentPlacement.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("lets the student's department admin revoke it, keeping the record", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-cse", role: "DEPT_ADMIN" } as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({ departmentId: CSE } as never);

    const result = await revokePlacement({ placementId: "plc-1", reason: "Recorded against the wrong student" });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.studentPlacement.updateMany).mock.calls;
    // An update of the revocation fields only — never a delete.
    expect(call[0]).toMatchObject({
      where: { id: "plc-1", revokedAt: null },
      data: { revokedById: "admin-cse", revokeReason: "Recorded against the wrong student" },
    });
  });

  it("refuses another department's admin", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-ece", role: "DEPT_ADMIN" } as never);
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue({ departmentId: ECE } as never);

    const result = await revokePlacement({ placementId: "plc-1", reason: "Recorded by mistake" });

    expect(result.success).toBe(false);
    expect(prisma.studentPlacement.updateMany).not.toHaveBeenCalled();
  });

  it("lets the Super Admin revoke any placement", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "super", role: "SUPER_ADMIN" } as never);

    expect((await revokePlacement({ placementId: "plc-1", reason: "Duplicate record" })).success).toBe(true);
  });

  it("requires a reason", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "super", role: "SUPER_ADMIN" } as never);

    expect((await revokePlacement({ placementId: "plc-1", reason: "no" })).success).toBe(false);
    expect(prisma.studentPlacement.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a second revocation", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "super", role: "SUPER_ADMIN" } as never);
    vi.mocked(prisma.studentPlacement.findUnique).mockResolvedValue({
      ...placement,
      revokedAt: new Date(),
    } as never);

    expect((await revokePlacement({ placementId: "plc-1", reason: "Again, again" })).success).toBe(false);
  });

  it("is not available to students: only admin roles pass the role check", async () => {
    const source = readFileSync(join(process.cwd(), "features/students/actions/manage-placement.ts"), "utf8");
    expect(source).toContain('requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"])');
    // No student-facing module writes a placement.
    for (const file of [
      "features/students/actions/profile-personal.ts",
      "features/students/actions/set-placement-opt-in.ts",
      "features/applications/actions/apply-to-drive.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toMatch(/studentPlacement\.(create|update|delete)/);
    }
  });
});

describe("selecting an application places the student; history stays", () => {
  const application = {
    id: "claaaaaaaaaaaaaaaaaaaaaaa",
    stage: "INTERVIEW",
    status: "IN_PROGRESS",
    student: { id: "student-1", departmentId: CSE, userId: "user-1" },
    drive: {
      id: DRIVE_ID,
      companyName: "ABC",
      roleName: "Software Engineer",
      packageOffered: "8.00",
      packageDisplay: "8 LPA",
      departmentId: null,
      isCentralDrive: true,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
      departmentConfigs: [{ id: "config-1", roleName: "Backend Engineer" }],
    },
  };

  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue({
      user: { id: "admin-cse" },
      department: { id: CSE, code: "CSE" },
    } as never);
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue(application as never);
    vi.mocked(prisma.studentPlacement.create).mockResolvedValue({ id: "plc-1" } as never);
  });

  it("creates the placement with the application, as this department ran the role", async () => {
    const result = await updateApplicationStage({
      applicationId: application.id,
      stageId: "rst_offer",
      status: "SELECTED",
    });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.studentPlacement.create).mock.calls;
    expect((call[0] as { data: Record<string, unknown> }).data).toMatchObject({
      studentId: "student-1",
      source: "APPLICATION",
      applicationId: application.id,
      companyName: "ABC",
      roleName: "Backend Engineer",
      recordedById: "admin-cse",
    });
    // Only this application is written — no other application is touched.
    expect(prisma.driveApplication.update).toHaveBeenCalledTimes(1);
  });

  it("does not create a placement for any other stage change", async () => {
    await updateApplicationStage({ applicationId: application.id, stageId: "rst_offer", status: "IN_PROGRESS" });
    expect(prisma.studentPlacement.create).not.toHaveBeenCalled();
  });

  it("makes a selection final — a mistake is corrected by revoking the placement", async () => {
    vi.mocked(prisma.driveApplication.findUnique).mockResolvedValue({
      ...application,
      stage: "OFFER",
      status: "SELECTED",
    } as never);

    const result = await updateApplicationStage({
      applicationId: application.id,
      stageId: "rst_offer",
      status: "REJECTED",
    });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
    expect(
      validateStageTransition({
        currentStage: "OFFER",
        currentStatus: "SELECTED",
        nextStage: "OFFER",
        nextStatus: "REJECTED",
      }).valid
    ).toBe(false);
  });

  it("revoking a placement leaves its application as it was", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "super", role: "SUPER_ADMIN" } as never);
    vi.mocked(prisma.studentPlacement.findUnique).mockResolvedValue({
      id: "plc-1",
      revokedAt: null,
      companyName: "ABC",
      student: { id: "student-1", departmentId: CSE },
    } as never);
    vi.mocked(prisma.studentPlacement.updateMany).mockResolvedValue({ count: 1 } as never);

    await revokePlacement({ placementId: "plc-1", reason: "Offer rescinded by company" });

    expect(prisma.driveApplication.update).not.toHaveBeenCalled();
  });

  it("the database keeps placements as history and a selection final", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20260923000000_student_placement/migration.sql"),
      "utf8"
    );
    expect(sql).toContain('BEFORE UPDATE ON "StudentPlacement"');
    expect(sql).toContain(`OLD."status" = 'SELECTED'`);
    // Every existing SELECTED application is backfilled in the same migration.
    expect(sql).toMatch(/INSERT INTO "StudentPlacement"[\s\S]*WHERE a\."status" = 'SELECTED'/);
  });

  it("a student with any placement history is never deleted on promotion", () => {
    expect(
      decideStudentRetirement({ hasStudentRecord: true, applicationCount: 0, placementCount: 1 }).action
    ).toBe("refuse");
    expect(
      decideStudentRetirement({ hasStudentRecord: true, applicationCount: 0, placementCount: 0 }).action
    ).toBe("delete");
  });
});
