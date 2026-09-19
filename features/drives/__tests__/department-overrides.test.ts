import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Department-specific drive configuration.
 *
 *   Master  ABC · Software Engineer · 8 LPA · CGPA 7.0
 *   CSE     Software Engineer           · CSE JD · CGPA 7.5
 *   IT      Backend Developer           · IT JD  · CGPA 7.0
 *   ECE     Embedded Software Engineer  · ECE JD · CGPA 6.5
 *
 * NULL on an instance means "inherit from the master"; the master row is never
 * copied per department. These tests pin three properties:
 *
 *  1. Resolution — each department sees its own values, and only its own.
 *  2. Isolation  — changing one department's instance cannot change another's,
 *                  and no department-admin path can reach the master row.
 *  3. Every read path decides on the *resolved* values: eligibility, the
 *     deadline, the apply action, the listing and the notifications. A path
 *     that reads the master instead silently ignores the department's bar.
 */

// React's `cache` is a request-scoped memoiser that does not exist outside a
// server render; identity is the correct stand-in for a single test call.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    driveDepartmentConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    driveApplication: { create: vi.fn() },
    studentAcademic: { findUnique: vi.fn() },
    student: { findUnique: vi.fn(), findMany: vi.fn() },
    notification: { createMany: vi.fn(), findMany: vi.fn() },
    driveApplicationField: { deleteMany: vi.fn(), createMany: vi.fn() },
    driveEligibilityRule: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
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
  requireDepartmentAdmin: vi.fn(),
  requireStudent: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  createAuditLogInTransaction: vi.fn(),
  AuditAction: { APPLY: "APPLY", UPDATE: "UPDATE", CREATE: "CREATE" },
  AuditEntityType: {
    DRIVE: "Drive",
    DRIVE_APPLICATION: "DriveApplication",
    APPLICATION_SNAPSHOT: "DriveApplicationSnapshot",
  },
}));

vi.mock("@/lib/notifications", () => ({
  createApplicationSubmittedNotification: vi.fn(),
}));

vi.mock("@/features/applications/queries/check-application-exists", () => ({
  checkApplicationExists: vi.fn(async () => false),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { withActivePipeline } from "@/features/recruitment/__tests__/pipeline-fixtures";

// Every department drive here already has an active recruitment pipeline.
beforeEach(() => withActivePipeline(prisma));
import { requireDepartmentAdmin, requireStudent } from "@/lib/auth";
import {
  resolveDepartmentDrive,
  resolveDepartmentDriveWithRules,
  overriddenFields,
  OVERRIDABLE_FIELDS,
} from "../domain/resolve-department-drive";
import { toInstanceOverrideColumns } from "../domain/department-overrides";
import { departmentOverridesSchema } from "../schemas/drive-department-config";
import { isStudentAcademicallyEligibleForDrive } from "../queries/drive-eligibility";
import { saveDriveDepartmentConfig } from "../actions/save-drive-department-config";
import { getEligibleDrives } from "../queries/get-eligible-drives";
import { applyToDrive } from "@/features/applications/actions/apply-to-drive";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";

const CSE = "dept-cse";
const IT = "dept-it";
const ECE = "dept-ece";
const DRIVE_ID = "clabcdrive0000000000000a";

const inDays = (days: number) => new Date(Date.now() + days * 864e5);

/** Master drive ABC, assigned to all three departments. */
const master = {
  id: DRIVE_ID,
  departmentId: null,
  createdByUserId: "user-super",
  isCentralDrive: true,
  lifecycleStatus: "PUBLISHED" as const,
  // Every content field open to departments, as the migration set it for
  // every pre-existing central drive.
  departmentEditableFields: [
    "roleName",
    "jobDescriptionText",
    "requirements",
    "skills",
    "driveDate",
    "applicationDeadline",
  ],
  masterPipeline: null,
  companyName: "ABC",
  roleName: "Software Engineer",
  jobDescriptionUrl: null,
  jobDescriptionText: "Master JD",
  requirements: "Master requirements",
  skills: JSON.stringify(["Programming"]),
  packageOffered: "8.00",
  packageDisplay: "8 LPA",
  selectionRounds: JSON.stringify(["Aptitude", "Technical", "HR"]),
  driveDate: inDays(14),
  applicationDeadline: inDays(7),
  applyMethod: "IN_APP" as const,
  externalApplyUrl: null,
  minCGPA: 7.0,
  maxActiveBacklogs: 1,
  companyLogoUrl: null,
  venue: "Main Auditorium",
  reportingTime: "09:00",
  contactPerson: "Placement Cell",
  contactPhone: "1111111111",
  pptLink: null,
  applicationFields: null,
  formFields: [],
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  // No stored master rules: the evaluator derives CGPA / backlogs from the
  // legacy columns above, exactly as for a drive predating the rule table.
  eligibilityRules: [] as never[],
  eligibleDepartmentLinks: [
    { departmentId: CSE },
    { departmentId: IT },
    { departmentId: ECE },
  ],
};

/** An instance that overrides nothing; spread and set only what differs. */
function instance(departmentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `config-${departmentId}`,
    driveId: DRIVE_ID,
    departmentId,
    status: "PUBLISHED" as const,
    assignedAt: new Date("2026-09-01"),
    publishedAt: new Date("2026-09-02"),
    publishedByUserId: "user-admin",
    lockedAt: new Date("2026-09-02"),
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
    venue: null,
    reportingTime: null,
    coordinatorName: null,
    coordinatorPhone: null,
    coordinatorEmail: null,
    seatingAllocation: null,
    pptLink: null,
    specialInstructions: null,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
    eligibilityRules: [] as never[],
    ...overrides,
  };
}

const cseInstance = instance(CSE, {
  jobDescriptionText: "CSE-specific JD",
  minCGPA: 7.5,
});
const itInstance = instance(IT, {
  roleName: "Backend Developer",
  jobDescriptionText: "IT-specific JD",
  minCGPA: 7.0,
});
const eceInstance = instance(ECE, {
  roleName: "Embedded Software Engineer",
  jobDescriptionText: "ECE-specific JD",
  minCGPA: 6.5,
});

/** A student with a given department and CGPA. */
function student(departmentId: string, currentCGPA: number) {
  return {
    id: `student-${departmentId}-${currentCGPA}`,
    userId: `user-${departmentId}-${currentCGPA}`,
    departmentId,
    rollNumber: "R-001",
    name: "Test Student",
    email: "s@example.com",
    // Approved, opted in, not placed: standing passes, the bar decides.
    isPending: false,
    optedIn: true,
    placements: [] as { revokedAt: Date | null }[],
    academic: { currentCGPA, activeBacklogs: 0 },
    skills: [] as { skillName: string }[],
    // What the application form's profile fields read.
    phoneNumber: "9999999999",
    department: { code: departmentId.toUpperCase() },
    projects: [],
    certifications: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Resolution
// ---------------------------------------------------------------------------

describe("resolution — one master, three departments", () => {
  it("gives each department its own role, JD and CGPA bar", () => {
    const cse = resolveDepartmentDrive(master, cseInstance);
    const it_ = resolveDepartmentDrive(master, itInstance);
    const ece = resolveDepartmentDrive(master, eceInstance);

    expect([cse.roleName, cse.jobDescriptionText, cse.minCGPA]).toEqual([
      "Software Engineer",
      "CSE-specific JD",
      7.5,
    ]);
    expect([it_.roleName, it_.jobDescriptionText, it_.minCGPA]).toEqual([
      "Backend Developer",
      "IT-specific JD",
      7.0,
    ]);
    expect([ece.roleName, ece.jobDescriptionText, ece.minCGPA]).toEqual([
      "Embedded Software Engineer",
      "ECE-specific JD",
      6.5,
    ]);
  });

  it("inherits every field a department left NULL", () => {
    const cse = resolveDepartmentDrive(master, cseInstance);

    // CSE did not override the role, requirements, skills, rounds or dates.
    expect(cse.roleName).toBe(master.roleName);
    expect(cse.requirements).toBe(master.requirements);
    expect(cse.skills).toBe(master.skills);
    expect(cse.selectionRounds).toBe(master.selectionRounds);
    expect(cse.driveDate).toEqual(master.driveDate);
    expect(cse.applicationDeadline).toEqual(master.applicationDeadline);
    // Company and package are never overridable.
    expect(cse.companyName).toBe("ABC");
    expect(cse.packageDisplay).toBe("8 LPA");
  });

  it("resolves to the master exactly when an instance overrides nothing", () => {
    const resolved = resolveDepartmentDrive(master, instance(CSE));

    for (const field of Object.keys(OVERRIDABLE_FIELDS)) {
      expect(resolved[field as keyof typeof resolved]).toEqual(
        master[field as keyof typeof master]
      );
    }
  });

  it("overrides every content field when the department sets them all", () => {
    const deadline = inDays(3);
    const driveDate = inDays(10);
    const full = instance(IT, {
      roleName: "Backend Developer",
      jobDescriptionText: "IT JD",
      requirements: "IT requirements",
      skills: JSON.stringify(["Go", "Postgres"]),
      driveDate,
      applicationDeadline: deadline,
      selectionRounds: JSON.stringify(["Coding", "System design"]),
      minCGPA: 6.0,
      maxActiveBacklogs: 2,
    });

    const resolved = resolveDepartmentDrive(master, full);

    expect(resolved.requirements).toBe("IT requirements");
    expect(resolved.skills).toBe(JSON.stringify(["Go", "Postgres"]));
    expect(resolved.driveDate).toEqual(driveDate);
    expect(resolved.applicationDeadline).toEqual(deadline);
    expect(resolved.selectionRounds).toBe(
      JSON.stringify(["Coding", "System design"])
    );
    expect(resolved.maxActiveBacklogs).toBe(2);
  });

  it("honours a zero override instead of falling back to the master", () => {
    // `??`, not `||` — 0 backlogs is a real, stricter answer than the master's 1.
    const strict = resolveDepartmentDrive(
      master,
      instance(CSE, { maxActiveBacklogs: 0, minCGPA: 0 })
    );

    expect(strict.maxActiveBacklogs).toBe(0);
    expect(strict.minCGPA).toBe(0);
  });

  it("works on a serialized master, for the admin's client-side preview", () => {
    // `packageOffered` has already become a string by the time it reaches a
    // Client Component; the resolver must not care.
    const resolved = resolveDepartmentDrive(
      { ...master, packageOffered: "8.00" },
      eceInstance
    );

    expect(resolved.roleName).toBe("Embedded Software Engineer");
    expect(resolved.packageOffered).toBe("8.00");
  });

  it("reports exactly which fields a department overrides", () => {
    expect(new Set(overriddenFields(itInstance))).toEqual(
      new Set(["roleName", "jobDescriptionText", "minCGPA"])
    );
    expect(overriddenFields(instance(CSE))).toEqual([]);
    expect(overriddenFields(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Isolation
// ---------------------------------------------------------------------------

describe("isolation — one department cannot affect another", () => {
  it("changing CSE's instance leaves IT's resolution untouched", () => {
    const before = resolveDepartmentDrive(master, itInstance);

    const editedCse = { ...cseInstance, roleName: "Platform Engineer", minCGPA: 9 };
    resolveDepartmentDrive(master, editedCse);

    expect(resolveDepartmentDrive(master, itInstance)).toEqual(before);
  });

  it("never mutates the master while resolving any department", () => {
    const snapshot = structuredClone(master);

    for (const each of [cseInstance, itInstance, eceInstance]) {
      resolveDepartmentDrive(master, each);
    }

    expect(master).toEqual(snapshot);
  });

  it("puts a 7.2 student in IT and ECE but not CSE", () => {
    // The whole point: the same master, three different bars.
    const cse = resolveDepartmentDriveWithRules(master, cseInstance);
    const it_ = resolveDepartmentDriveWithRules(master, itInstance);
    const ece = resolveDepartmentDriveWithRules(master, eceInstance);

    expect(isStudentAcademicallyEligibleForDrive(student(CSE, 7.2) as never, cse)).toBe(false);
    expect(isStudentAcademicallyEligibleForDrive(student(IT, 7.2) as never, it_)).toBe(true);
    expect(isStudentAcademicallyEligibleForDrive(student(ECE, 7.2) as never, ece)).toBe(true);
  });

  it("does not let one department's override leak into another's eligibility", () => {
    // ECE's 6.5 bar must not admit a 6.8 CSE student; the CSE bar (7.5) applies.
    const cse = resolveDepartmentDriveWithRules(master, cseInstance);

    expect(isStudentAcademicallyEligibleForDrive(student(CSE, 6.8) as never, cse)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Override input semantics
// ---------------------------------------------------------------------------

describe("override input — absent, null and value are three different things", () => {
  it("leaves absent fields out, so the stored value is untouched", () => {
    expect(toInstanceOverrideColumns({ roleName: "Backend Developer" })).toEqual({
      roleName: "Backend Developer",
    });
  });

  it("passes null through, which clears back to inheriting", () => {
    expect(toInstanceOverrideColumns({ roleName: null, requirements: null })).toEqual({
      roleName: null,
      requirements: null,
    });
  });

  it("stores lists as JSON and dates as Date", () => {
    const columns = toInstanceOverrideColumns({
      skills: ["Go", "SQL"],
      selectionRounds: ["Coding"],
      applicationDeadline: "2026-12-01",
    });

    expect(columns.skills).toBe(JSON.stringify(["Go", "SQL"]));
    expect(columns.selectionRounds).toBe(JSON.stringify(["Coding"]));
    expect(columns.applicationDeadline).toBeInstanceOf(Date);
  });

  it("treats a blank text box or an empty list as 'inherit'", () => {
    const parsed = departmentOverridesSchema.parse({
      roleName: "   ",
      jobDescriptionText: "",
      skills: [],
      driveDate: "",
    });

    expect(parsed).toEqual({
      roleName: null,
      jobDescriptionText: null,
      skills: null,
      driveDate: null,
    });
  });
});

// ---------------------------------------------------------------------------
// The department admin's save path
// ---------------------------------------------------------------------------

describe("saveDriveDepartmentConfig — isolation and master protection", () => {
  const adminOf = (departmentId: string, code: string) => ({
    user: { id: `user-admin-${code}` },
    admin: { id: `admin-${code}`, departmentId },
    department: { id: departmentId, name: code, code, isActive: true },
  });

  const baseInput = {
    driveId: DRIVE_ID,
    venue: "Seminar Hall",
    reportingTime: "10:00",
    fields: [{ key: "name", required: true }],
  };

  beforeEach(() => {
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOf(IT, "IT") as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      eligibleDepartmentLinks: [{ departmentId: IT }],
    } as never);
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(IT, { status: "CONFIGURED", lockedAt: null, publishedAt: null }) as never
    );
    vi.mocked(prisma.driveDepartmentConfig.upsert).mockResolvedValue({ id: `config-${IT}` } as never);
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => unknown) => fn(prisma)
    );
  });

  it("writes only the caller's own department's row", async () => {
    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { roleName: "Backend Developer" },
      eligibilityRules: [{ ruleType: "CGPA", operator: "GTE", numberValue: 7.0 }],
    });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    expect((call[0] as { where: unknown }).where).toEqual({
      driveId_departmentId: { driveId: DRIVE_ID, departmentId: IT },
    });

    // The application form is written to this department's rows only —
    // replaced by instance id, never by drive, so no other department's form
    // and not the master's can be touched.
    expect(prisma.driveApplicationField.deleteMany).toHaveBeenCalledWith({
      where: { driveDepartmentConfigId: `config-${IT}` },
    });
    const [rows] = vi.mocked(prisma.driveApplicationField.createMany).mock.calls;
    expect(
      (rows[0] as { data: { driveDepartmentConfigId?: string; driveId?: string }[] }).data
    ).toEqual([
      expect.objectContaining({ fieldKey: "name", driveDepartmentConfigId: `config-${IT}` }),
    ]);
    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("ignores a department id smuggled into the payload", async () => {
    await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { roleName: "Hijacked" },
      // Not part of the schema — the department is the session's, full stop.
      departmentId: CSE,
    } as never);

    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    expect(
      (call[0] as { where: { driveId_departmentId: { departmentId: string } } })
        .where.driveId_departmentId.departmentId
    ).toBe(IT);
  });

  it("never writes to the master drive", async () => {
    await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: {
        roleName: "Backend Developer",
        jobDescriptionText: "IT JD",
      },
      eligibilityRules: [{ ruleType: "CGPA", operator: "GTE", numberValue: 6.0 }],
    });

    expect(prisma.drive.update).not.toHaveBeenCalled();
  });

  it("refuses an override of a field the Super Admin locked, naming it", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentEditableFields: ["jobDescriptionText"],
      eligibleDepartmentLinks: [{ departmentId: IT }],
    } as never);

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { roleName: "Backend Developer", jobDescriptionText: "IT JD" },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Role \/ job title/);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });

  it("still lets a department clear a locked field back to the master's value", async () => {
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentEditableFields: [],
      eligibleDepartmentLinks: [{ departmentId: IT }],
    } as never);

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { roleName: null, jobDescriptionText: null },
    });

    expect(result.success).toBe(true);
  });

  it("saves an incomplete configuration as a draft", async () => {
    // No venue or reporting time yet: a draft, finished later. Publishing is
    // what requires them.
    const result = await saveDriveDepartmentConfig({
      driveId: DRIVE_ID,
      venue: "",
      reportingTime: "",
    });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (call[0] as { update: Record<string, unknown> }).update;
    expect(update.venue).toBeNull();
    expect(update.reportingTime).toBeNull();
  });

  it("refuses any change to a cancelled department drive", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(IT, { status: "CANCELLED", lockedAt: null, publishedAt: null }) as never
    );

    const result = await saveDriveDepartmentConfig({ ...baseInput, venue: "Hall 9" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/cancelled/);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });

  it("stores overrides on the instance and clears them with null", async () => {
    await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { roleName: "Backend Developer", jobDescriptionText: null },
    });

    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (call[0] as { update: Record<string, unknown> }).update;
    expect(update.roleName).toBe("Backend Developer");
    expect(update.jobDescriptionText).toBeNull();
  });

  it("refuses a deadline override that falls after the drive date", async () => {
    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      // Master drive date is +14 days; a +20 day deadline contradicts it.
      overrides: { applicationDeadline: inDays(20).toISOString().slice(0, 10) },
    });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });

  it("checks the dates on resolved values, so one override must agree with the inherited other", async () => {
    // Moving the drive date earlier than the inherited (+7 day) deadline.
    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      overrides: { driveDate: inDays(5).toISOString().slice(0, 10) },
    });

    expect(result.success).toBe(false);
  });

  it("refuses to change an override once published", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      itInstance as never
    );

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      // IT published with CGPA ≥ 7.0; lowering it now would re-judge applicants.
      eligibilityRules: [{ ruleType: "CGPA", operator: "GTE", numberValue: 5.0 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/eligibilityRules/);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });

  it("still takes a logistics-only save on a published, never-customised instance", async () => {
    // The backfilled instances are PUBLISHED and locked with a NULL form, while
    // students see the catalog defaults. Resubmitting those defaults with a
    // new venue must not be mistaken for a form change.
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(IT) as never
    );

    const { resolveSelectedApplicationFields } = await import(
      "../utils/application-fields"
    );
    const defaults = resolveSelectedApplicationFields(null).map((field) => ({
      key: field.key,
      required: field.required,
    }));

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      venue: "New Seminar Hall",
      fields: defaults,
    });

    expect(result.success).toBe(true);
    const [call] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (call[0] as { update: Record<string, unknown> }).update;
    expect(update.venue).toBe("New Seminar Hall");
    expect(update).not.toHaveProperty("applicationFields");
    expect(update).not.toHaveProperty("minCGPA");
  });
});

// ---------------------------------------------------------------------------
// 3. Read paths decide on resolved values
// ---------------------------------------------------------------------------

describe("getEligibleDrives — the department's bar, not the master's", () => {
  function listFor(departmentId: string, cgpa: number, inst: object) {
    const s = student(departmentId, cgpa);
    vi.mocked(requireStudent).mockResolvedValue({ user: {}, student: s } as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue({
      academic: s.academic,
      skills: s.skills,
    } as never);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([
      { ...master, departmentConfigs: [inst] },
    ] as never);
  }

  it("shows ECE's 6.5-bar drive to a 6.8 ECE student though the master says 7.0", async () => {
    listFor(ECE, 6.8, eceInstance);

    const result = await getEligibleDrives();

    expect(result.totalCount).toBe(1);
    expect(result.data[0].roleName).toBe("Embedded Software Engineer");
  });

  it("hides CSE's 7.5-bar drive from a 7.2 CSE student though the master says 7.0", async () => {
    listFor(CSE, 7.2, cseInstance);

    const result = await getEligibleDrives();

    expect(result.totalCount).toBe(0);
  });

  it("never prefilters on the master's CGPA, backlogs or deadline in SQL", async () => {
    // A master-based prefilter would drop the ECE drive above before the
    // resolver ever saw it — an under-match, which is never acceptable.
    listFor(ECE, 6.8, eceInstance);

    await getEligibleDrives();

    const [call] = vi.mocked(prisma.drive.findMany).mock.calls;
    const where = (call[0] as { where: Record<string, unknown> }).where;
    expect(where).not.toHaveProperty("minCGPA");
    expect(where).not.toHaveProperty("maxActiveBacklogs");
    expect(where).not.toHaveProperty("applicationDeadline");
  });

  it("closes a drive by the department's own deadline", async () => {
    listFor(IT, 8.0, { ...itInstance, applicationDeadline: inDays(-1) });

    const result = await getEligibleDrives({ status: "open" });

    // Master deadline is still open; IT's has passed.
    expect(result.totalCount).toBe(0);
  });

  it("searches the department's role title", async () => {
    listFor(IT, 8.0, itInstance);

    const found = await getEligibleDrives({ search: "backend" });
    expect(found.totalCount).toBe(1);

    const notFound = await getEligibleDrives({ search: "embedded" });
    expect(notFound.totalCount).toBe(0);
  });

  it("loads only the student's own department's instance", async () => {
    listFor(IT, 8.0, itInstance);

    await getEligibleDrives();

    const [call] = vi.mocked(prisma.drive.findMany).mock.calls;
    const include = (call[0] as { include: { departmentConfigs: unknown } }).include;
    // Scoped to this department, and loaded with this department's rules
    // and application form.
    expect(include.departmentConfigs).toEqual({
      where: { departmentId: IT },
      include: { eligibilityRules: true, formFields: true },
    });
  });
});

describe("applyToDrive — judged against the department's version", () => {
  function applyAs(departmentId: string, cgpa: number, inst: object | null) {
    const s = student(departmentId, cgpa);
    vi.mocked(requireStudent).mockResolvedValue({ user: { id: s.userId }, student: s } as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(s as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: inst ? [inst] : [],
    } as never);
    vi.mocked(prisma.driveApplication.create).mockResolvedValue({ id: "app-1" } as never);
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );
  }

  it("refuses a 7.2 CSE student against CSE's 7.5 bar", async () => {
    applyAs(CSE, 7.2, cseInstance);

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("accepts a 6.8 ECE student against ECE's 6.5 bar", async () => {
    applyAs(ECE, 6.8, eceInstance);

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(true);
  });

  it("refuses when the department's own deadline has passed", async () => {
    applyAs(IT, 8.0, { ...itInstance, applicationDeadline: inDays(-1) });

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
  });

  it("refuses when the department has not published the drive", async () => {
    applyAs(IT, 8.0, { ...itInstance, status: "ASSIGNED" });
    expect((await applyToDrive(DRIVE_ID, { consent: true })).success).toBe(false);

    applyAs(IT, 8.0, { ...itInstance, status: "CLOSED" });
    expect((await applyToDrive(DRIVE_ID, { consent: true })).success).toBe(false);

    applyAs(IT, 8.0, null);
    expect((await applyToDrive(DRIVE_ID, { consent: true })).success).toBe(false);

    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("loads only the applicant's own department's instance", async () => {
    applyAs(IT, 8.0, itInstance);

    await applyToDrive(DRIVE_ID, { consent: true });

    const [call] = vi.mocked(prisma.drive.findUnique).mock.calls;
    const include = (call[0] as { include: { departmentConfigs: unknown } }).include;
    // Scoped to this department, and loaded with this department's rules
    // and application form.
    expect(include.departmentConfigs).toEqual({
      where: { departmentId: IT },
      include: { eligibilityRules: true, formFields: true },
    });
  });
});

describe("notifyEligibleStudentsOfDrive — per-department bar and role", () => {
  beforeEach(() => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.driveEligibilityRule.findMany).mockResolvedValue([] as never);
  });

  it("notifies against each department's own bar, with its own role title", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([
      cseInstance,
      itInstance,
    ] as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      student(CSE, 7.2), // below CSE's 7.5
      student(IT, 7.2), // meets IT's 7.0
    ] as never);

    const { notified } = await notifyEligibleStudentsOfDrive(master as never);

    expect(notified).toBe(1);
    const [call] = vi.mocked(prisma.notification.createMany).mock.calls;
    const rows = (call[0] as { data: { userId: string; message: string }[] }).data;
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(student(IT, 7.2).userId);
    expect(rows[0].message).toContain("Backend Developer");
  });

  it("only announces to departments that have published", async () => {
    await notifyEligibleStudentsOfDrive(master as never);

    const [call] = vi.mocked(prisma.driveDepartmentConfig.findMany).mock.calls;
    expect((call[0] as { where: { status: string } }).where.status).toBe("PUBLISHED");
  });
});
