import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The eligibility rule engine.
 *
 *   rules (relational, per department) → resolve (master defaults + per-type
 *   department override) → evaluate (one pure function) → decision + reasons
 *
 * Covers the evaluator on every rule type the Student model supports, the
 * diploma/regular branch, strict rule validation, master/department
 * resolution and isolation, the legacy-column compatibility path, and — the
 * property the whole design exists for — that the drive list, `applyToDrive`
 * and the notification fan-out all decide through the *same* evaluator.
 */

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn(), findMany: vi.fn() },
    driveDepartmentConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    driveApplicationField: { deleteMany: vi.fn(), createMany: vi.fn() },
    driveEligibilityRule: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    driveApplication: { create: vi.fn() },
    student: { findUnique: vi.fn(), findMany: vi.fn() },
    notification: { createMany: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    notificationDispatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findMany: vi.fn() },
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

vi.mock("@/features/notifications/producers/application-events", () => ({
  notifyApplicationSubmitted: vi.fn(),
  notifyPlacementRecorded: vi.fn(),
  notifyPlacementRevoked: vi.fn(),
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
  evaluateEligibility,
  toEligibilitySubject,
  type EligibilitySubject,
} from "../domain/eligibility-evaluator";
import {
  describeRule,
  legacyColumnsFromRules,
  resolveEligibilityRules,
  ruleSetKey,
  withLegacyRules,
  type EligibilityRuleInput,
} from "../domain/eligibility-rules";
import {
  eligibilityRuleSchema,
  eligibilityRuleSetSchema,
} from "../domain/eligibility-rule-schema";
import {
  getIneligibilityReasons,
  isStudentAcademicallyEligibleForDrive,
} from "../queries/drive-eligibility";
import { resolveDepartmentDriveWithRules } from "../domain/resolve-department-drive";
import { saveDriveDepartmentConfig } from "../actions/save-drive-department-config";
import { defaultApplicationForm } from "../domain/application-form";
import { getEligibleDrives } from "../queries/get-eligible-drives";
import { applyToDrive } from "@/features/applications/actions/apply-to-drive";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { primeDeliveryMocks } from "@/features/notifications/__tests__/delivery-test-helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function regular(overrides: Partial<NonNullable<EligibilitySubject["academic"]>> = {}): EligibilitySubject {
  return {
    // An approved, unplaced, opted-in student: standing passes, so every
    // rule below is actually evaluated.
    approved: true,
    placed: false,
    optedIn: true,
    entryType: "REGULAR",
    expectedPassoutYear: 2026,
    academic: {
      currentCGPA: 8.0,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 85,
      twelfthPercentage: 78,
      diplomaPercentage: null,
      currentSemester: 7,
      ...overrides,
    },
    skills: ["Java", "SQL"],
  };
}

function diploma(overrides: Partial<NonNullable<EligibilitySubject["academic"]>> = {}): EligibilitySubject {
  return {
    ...regular(),
    entryType: "DIPLOMA",
    academic: {
      ...regular().academic!,
      twelfthPercentage: null,
      diplomaPercentage: 82,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------------

describe("evaluateEligibility", () => {
  it("passes an eligible student with no reasons", () => {
    const result = evaluateEligibility(regular(), [
      rule("CGPA", "GTE", 7.5),
      rule("ACTIVE_BACKLOGS", "LTE", 0),
    ]);

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });

  it("fails CGPA with a reason naming the bar and the student's value", () => {
    const result = evaluateEligibility(regular({ currentCGPA: 7.2 }), [rule("CGPA", "GTE", 7.5)]);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["CGPA requirement: 7.5 (You: 7.2)"]);
  });

  it("passes CGPA exactly at the bar", () => {
    expect(evaluateEligibility(regular({ currentCGPA: 7.5 }), [rule("CGPA", "GTE", 7.5)]).eligible).toBe(true);
  });

  it("fails active backlogs over the limit", () => {
    const result = evaluateEligibility(regular({ activeBacklogs: 2 }), [
      rule("ACTIVE_BACKLOGS", "LTE", 0),
    ]);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["Maximum backlogs: 0 (You: 2)"]);
  });

  it("fails past backlogs independently of active ones", () => {
    const result = evaluateEligibility(regular({ pastBacklogCount: 3 }), [
      rule("ACTIVE_BACKLOGS", "LTE", 0),
      rule("PAST_BACKLOGS", "LTE", 1),
    ]);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["Maximum past backlogs: 1 (You: 3)"]);
  });

  it("reports every failing rule, not just the first", () => {
    const result = evaluateEligibility(
      regular({ currentCGPA: 6.0, activeBacklogs: 1, tenthPercentage: 55 }),
      [
        rule("CGPA", "GTE", 7),
        rule("ACTIVE_BACKLOGS", "LTE", 0),
        rule("TENTH_PERCENTAGE", "GTE", 60),
        rule("CURRENT_SEMESTER", "GTE", 5), // passes
      ]
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(3);
    expect(result.results.filter((r) => r.passed)).toHaveLength(1);
  });

  it("evaluates an empty rule set as eligible", () => {
    expect(evaluateEligibility(regular(), []).eligible).toBe(true);
  });

  describe("missing academic data", () => {
    const noAcademic: EligibilitySubject = { ...regular(), academic: null };

    it("fails every academic rule, saying why once", () => {
      const result = evaluateEligibility(noAcademic, [
        rule("CGPA", "GTE", 6),
        rule("ACTIVE_BACKLOGS", "LTE", 0),
        rule("TENTH_PERCENTAGE", "GTE", 60),
      ]);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toEqual(["Academic information not completed"]);
    });

    it("still evaluates rules that need no academic record", () => {
      const result = evaluateEligibility(noAcademic, [rule("ENTRY_TYPE", "IN", ["REGULAR"])]);
      expect(result.eligible).toBe(true);
    });

    it("never treats a missing record as zero", () => {
      // A 0% would make "10th ≥ 0" pass; a missing record must not.
      const result = evaluateEligibility(noAcademic, [rule("TENTH_PERCENTAGE", "GTE", 0)]);
      expect(result.eligible).toBe(false);
    });
  });

  describe("the diploma / regular branch", () => {
    it("fails a 12th rule for a diploma student, saying they have no 12th", () => {
      const result = evaluateEligibility(diploma(), [rule("TWELFTH_PERCENTAGE", "GTE", 60)]);

      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/no 12th|lateral-entry/i);
      // …and not the misleading "0% < 60%".
      expect(result.reasons[0]).not.toMatch(/You: 0/);
    });

    it("fails a diploma rule for a regular student, saying they have no diploma", () => {
      const result = evaluateEligibility(regular(), [rule("DIPLOMA_PERCENTAGE", "GTE", 60)]);

      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/regular-entry/i);
    });

    it("reads the branch each student actually has for the combined rule", () => {
      const rules = [rule("PRE_COLLEGE_PERCENTAGE", "GTE", 80)];

      // Regular: 12th = 78 → fails. Diploma: diploma = 82 → passes.
      expect(evaluateEligibility(regular(), rules).eligible).toBe(false);
      expect(evaluateEligibility(diploma(), rules).eligible).toBe(true);
    });

    it("can restrict a drive to one entry type", () => {
      const rules = [rule("ENTRY_TYPE", "IN", ["REGULAR"])];

      expect(evaluateEligibility(regular(), rules).eligible).toBe(true);
      const result = evaluateEligibility(diploma(), rules);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/regular entry/i);
    });
  });

  describe("semester, batch and skills", () => {
    it("applies a semester range", () => {
      const rules = [rule("CURRENT_SEMESTER", "GTE", 5), rule("CURRENT_SEMESTER", "LTE", 6)];

      expect(evaluateEligibility(regular({ currentSemester: 5 }), rules).eligible).toBe(true);
      expect(evaluateEligibility(regular({ currentSemester: 7 }), rules).eligible).toBe(false);
    });

    it("matches batch years and fails a student with none on record", () => {
      const rules = [rule("BATCH_YEAR", "IN", ["2026", "2027"])];

      expect(evaluateEligibility(regular(), rules).eligible).toBe(true);
      expect(evaluateEligibility({ ...regular(), expectedPassoutYear: 2025 }, rules).eligible).toBe(false);

      const unknown = evaluateEligibility({ ...regular(), expectedPassoutYear: null }, rules);
      expect(unknown.eligible).toBe(false);
      expect(unknown.reasons[0]).toMatch(/not on record/);
    });

    it("requires all listed skills, ignoring case and spacing", () => {
      const all = [rule("SKILL", "INCLUDES_ALL", ["java", " SQL "])];
      expect(evaluateEligibility(regular(), all).eligible).toBe(true);

      const result = evaluateEligibility(regular(), [rule("SKILL", "INCLUDES_ALL", ["Java", "Go"])]);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toBe("Missing required skill: Go");
    });

    it("requires any one listed skill", () => {
      expect(
        evaluateEligibility(regular(), [rule("SKILL", "INCLUDES_ANY", ["Go", "SQL"])]).eligible
      ).toBe(true);
      expect(
        evaluateEligibility(regular(), [rule("SKILL", "INCLUDES_ANY", ["Go", "Rust"])]).eligible
      ).toBe(false);
    });
  });

  it("builds its subject only from server-loaded records", () => {
    const subject = toEligibilitySubject({
      isPending: false,
      optedIn: true,
      placements: [{ revokedAt: new Date() }],
      entryType: "REGULAR",
      expectedPassoutYear: 2026,
      academic: regular().academic,
      skills: [{ skillName: "Java" }],
    });

    expect(subject.skills).toEqual(["Java"]);
    // A revoked placement does not make the student placed.
    expect(subject.placed).toBe(false);
    expect(Object.keys(subject).sort()).toEqual([
      "academic",
      "approved",
      "entryType",
      "expectedPassoutYear",
      "optedIn",
      "placed",
      "skills",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Human-readable text
// ---------------------------------------------------------------------------

describe("describeRule", () => {
  it.each([
    [rule("CGPA", "GTE", 7.5), "CGPA ≥ 7.5"],
    [rule("ACTIVE_BACKLOGS", "LTE", 0), "No active backlogs"],
    [rule("ACTIVE_BACKLOGS", "LTE", 2), "At most 2 active backlogs"],
    [rule("TENTH_PERCENTAGE", "GTE", 60), "10th percentage ≥ 60%"],
    [rule("PRE_COLLEGE_PERCENTAGE", "GTE", 65), "12th / Diploma percentage ≥ 65%"],
    [rule("CURRENT_SEMESTER", "GTE", 5), "Semester 5 or later"],
    [rule("BATCH_YEAR", "IN", ["2026"]), "Batch 2022-26"],
    [rule("ENTRY_TYPE", "IN", ["DIPLOMA"]), "Lateral (diploma) entry only"],
    [rule("SKILL", "INCLUDES_ANY", ["Go", "Rust"]), "Skills: any of Go, Rust"],
  ])("%o reads as %s", (input, text) => {
    expect(describeRule(input)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// Rule configuration validation
// ---------------------------------------------------------------------------

describe("rule validation", () => {
  const ok = (input: unknown) => eligibilityRuleSchema.safeParse(input).success;

  it("accepts a well-formed rule of every shape", () => {
    expect(ok({ ruleType: "CGPA", operator: "GTE", numberValue: 7.5 })).toBe(true);
    expect(ok({ ruleType: "BATCH_YEAR", operator: "IN", listValue: ["2026"] })).toBe(true);
    expect(ok({ ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: ["Java"] })).toBe(true);
  });

  it("refuses an operator the rule type does not allow", () => {
    expect(ok({ ruleType: "CGPA", operator: "LTE", numberValue: 7 })).toBe(false);
    expect(ok({ ruleType: "ACTIVE_BACKLOGS", operator: "GTE", numberValue: 1 })).toBe(false);
    expect(ok({ ruleType: "SKILL", operator: "IN", listValue: ["Java"] })).toBe(false);
  });

  it("refuses an unknown rule type", () => {
    expect(ok({ ruleType: "GENDER", operator: "IN", listValue: ["F"] })).toBe(false);
  });

  it("refuses the wrong kind of value", () => {
    expect(ok({ ruleType: "CGPA", operator: "GTE", listValue: ["7"] })).toBe(false);
    expect(ok({ ruleType: "BATCH_YEAR", operator: "IN", numberValue: 2026 })).toBe(false);
    expect(ok({ ruleType: "CGPA", operator: "GTE" })).toBe(false);
  });

  it("enforces bounds, integers and decimal places", () => {
    expect(ok({ ruleType: "CGPA", operator: "GTE", numberValue: 10.5 })).toBe(false);
    expect(ok({ ruleType: "CGPA", operator: "GTE", numberValue: 7.555 })).toBe(false);
    expect(ok({ ruleType: "ACTIVE_BACKLOGS", operator: "LTE", numberValue: 1.5 })).toBe(false);
    expect(ok({ ruleType: "TENTH_PERCENTAGE", operator: "GTE", numberValue: 101 })).toBe(false);
    expect(ok({ ruleType: "CURRENT_SEMESTER", operator: "EQ", numberValue: 9 })).toBe(false);
  });

  it("refuses invalid list items", () => {
    expect(ok({ ruleType: "BATCH_YEAR", operator: "IN", listValue: ["26"] })).toBe(false);
    expect(ok({ ruleType: "ENTRY_TYPE", operator: "IN", listValue: ["LATERAL"] })).toBe(false);
    expect(ok({ ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: [] })).toBe(false);
    expect(ok({ ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: ["Java", "java"] })).toBe(false);
  });

  it("refuses a duplicated (type, operator) in one set", () => {
    const result = eligibilityRuleSetSchema.safeParse([
      { ruleType: "CGPA", operator: "GTE", numberValue: 7 },
      { ruleType: "CGPA", operator: "GTE", numberValue: 8 },
    ]);
    expect(result.success).toBe(false);
  });

  it("refuses an empty or contradictory semester range", () => {
    expect(
      eligibilityRuleSetSchema.safeParse([
        { ruleType: "CURRENT_SEMESTER", operator: "GTE", numberValue: 7 },
        { ruleType: "CURRENT_SEMESTER", operator: "LTE", numberValue: 5 },
      ]).success
    ).toBe(false);
    expect(
      eligibilityRuleSetSchema.safeParse([
        { ruleType: "CURRENT_SEMESTER", operator: "EQ", numberValue: 6 },
        { ruleType: "CURRENT_SEMESTER", operator: "GTE", numberValue: 5 },
      ]).success
    ).toBe(false);
  });

  it("normalises: trims list items and drops the unused value column", () => {
    const parsed = eligibilityRuleSchema.parse({
      ruleType: "SKILL",
      operator: "INCLUDES_ANY",
      listValue: ["  Java "],
      numberValue: null,
    });
    expect(parsed).toEqual({ ruleType: "SKILL", operator: "INCLUDES_ANY", numberValue: null, listValue: ["Java"] });
  });
});

// ---------------------------------------------------------------------------
// Resolution: master defaults, department overrides, legacy columns
// ---------------------------------------------------------------------------

describe("resolveEligibilityRules", () => {
  const masterRules = [
    rule("CGPA", "GTE", 7),
    rule("ACTIVE_BACKLOGS", "LTE", 0),
    rule("TENTH_PERCENTAGE", "GTE", 60),
  ];

  it("inherits every master default when the department sets nothing", () => {
    const effective = resolveEligibilityRules({
      masterRules,
      masterLegacy: null,
      departmentRules: [],
      departmentLegacy: null,
    });

    expect(effective).toHaveLength(3);
    expect(effective.every((r) => r.source === "MASTER")).toBe(true);
  });

  it("overrides per rule type, keeping every other master rule", () => {
    const effective = resolveEligibilityRules({
      masterRules,
      masterLegacy: null,
      departmentRules: [rule("CGPA", "GTE", 7.5)],
      departmentLegacy: null,
    });

    expect(effective.find((r) => r.ruleType === "CGPA")).toMatchObject({
      numberValue: 7.5,
      source: "DEPARTMENT",
    });
    // Backlogs and 10th are still the master's.
    expect(effective.filter((r) => r.source === "MASTER").map((r) => r.ruleType)).toEqual([
      "ACTIVE_BACKLOGS",
      "TENTH_PERCENTAGE",
    ]);
  });

  it("replaces a master range as a whole rather than half-merging it", () => {
    const effective = resolveEligibilityRules({
      masterRules: [rule("CURRENT_SEMESTER", "GTE", 5), rule("CURRENT_SEMESTER", "LTE", 8)],
      masterLegacy: null,
      departmentRules: [rule("CURRENT_SEMESTER", "EQ", 7)],
      departmentLegacy: null,
    });

    expect(effective.filter((r) => r.ruleType === "CURRENT_SEMESTER")).toEqual([
      expect.objectContaining({ operator: "EQ", numberValue: 7, source: "DEPARTMENT" }),
    ]);
  });

  it("derives CGPA / backlog rules from the legacy columns when none are stored", () => {
    const effective = withLegacyRules([], { minCGPA: 6.5, maxActiveBacklogs: 1 });

    expect(effective).toEqual([rule("CGPA", "GTE", 6.5), rule("ACTIVE_BACKLOGS", "LTE", 1)]);
  });

  it("lets a stored rule win over its legacy column", () => {
    const effective = withLegacyRules([rule("CGPA", "GTE", 8)], { minCGPA: 6.5, maxActiveBacklogs: 1 });

    expect(effective.find((r) => r.ruleType === "CGPA")?.numberValue).toBe(8);
  });

  it("dual-writes: a rule set implies its legacy column values", () => {
    expect(legacyColumnsFromRules([rule("CGPA", "GTE", 7.5)])).toEqual({
      minCGPA: 7.5,
      maxActiveBacklogs: null,
    });
  });

  it("compares rule sets ignoring order and list case", () => {
    expect(
      ruleSetKey([rule("SKILL", "INCLUDES_ALL", ["Java", "SQL"]), rule("CGPA", "GTE", 7)])
    ).toBe(ruleSetKey([rule("CGPA", "GTE", 7), rule("SKILL", "INCLUDES_ALL", ["sql", "java"])]));
    expect(ruleSetKey([rule("CGPA", "GTE", 7)])).not.toBe(ruleSetKey([rule("CGPA", "GTE", 7.5)]));
  });
});

// ---------------------------------------------------------------------------
// Department isolation
// ---------------------------------------------------------------------------

const CSE = "dept-cse";
const IT = "dept-it";
const DRIVE_ID = "clrulesdrive00000000000a";
const inDays = (d: number) => new Date(Date.now() + d * 864e5);

const master = {
  id: DRIVE_ID,
  departmentId: null,
  createdByUserId: "user-super",
  isCentralDrive: true,
  lifecycleStatus: "PUBLISHED" as const,
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
  applyMethod: "IN_APP" as const,
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
  eligibleDepartmentLinks: [{ departmentId: CSE }, { departmentId: IT }],
  // Stored master defaults.
  eligibilityRules: [rule("CGPA", "GTE", 7), rule("ACTIVE_BACKLOGS", "LTE", 0)],
};

function instance(departmentId: string, rules: EligibilityRuleInput[], extra: Record<string, unknown> = {}) {
  return {
    id: `config-${departmentId}`,
    driveId: DRIVE_ID,
    departmentId,
    status: "PUBLISHED" as const,
    lockedAt: new Date("2026-09-02"),
    minCGPA: null,
    maxActiveBacklogs: null,
    roleName: null,
    jobDescriptionText: null,
    requirements: null,
    skills: null,
    driveDate: null,
    applicationDeadline: null,
    selectionRounds: null,
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
    eligibilityRules: rules,
    ...extra,
  };
}

/** CSE demands Java; IT does not. */
const cseInstance = instance(CSE, [rule("SKILL", "INCLUDES_ALL", ["Java"])]);
const itInstance = instance(IT, []);

function student(departmentId: string, skills: string[], cgpa = 8) {
  return {
    id: `student-${departmentId}-${skills.join("-") || "none"}`,
    userId: `user-${departmentId}-${skills.join("-") || "none"}`,
    departmentId,
    rollNumber: "R-001",
    isPending: false,
    optedIn: true,
    placements: [] as { revokedAt: Date | null }[],
    entryType: "REGULAR" as const,
    expectedPassoutYear: 2026,
    academic: {
      currentCGPA: cgpa,
      activeBacklogs: 0,
      pastBacklogCount: 0,
      tenthPercentage: 80,
      twelfthPercentage: 80,
      diplomaPercentage: null,
      currentSemester: 7,
    },
    skills: skills.map((skillName) => ({ skillName })),
    // What the default application form's required fields read.
    name: "Test Student",
    email: "s@example.com",
    phoneNumber: "9999999999",
    department: { code: departmentId.toUpperCase() },
    projects: [],
    certifications: [],
  };
}

describe("department isolation", () => {
  it("applies CSE's rule to CSE students and not to IT's", () => {
    const cse = resolveDepartmentDriveWithRules(master, cseInstance);
    const it_ = resolveDepartmentDriveWithRules(master, itInstance);

    const noJava = (dept: string) => student(dept, ["Python"]) as never;

    expect(isStudentAcademicallyEligibleForDrive(noJava(CSE), cse)).toBe(false);
    expect(isStudentAcademicallyEligibleForDrive(noJava(IT), it_)).toBe(true);
  });

  it("keeps the master defaults for a department with its own extra rule", () => {
    const cse = resolveDepartmentDriveWithRules(master, cseInstance);

    expect(cse.eligibilityRules.map((r) => `${r.ruleType}:${r.source}`)).toEqual([
      "CGPA:MASTER",
      "ACTIVE_BACKLOGS:MASTER",
      "SKILL:DEPARTMENT",
    ]);
  });

  it("does not let one department's rules leak into another's resolution", () => {
    const it_ = resolveDepartmentDriveWithRules(master, itInstance);
    expect(it_.eligibilityRules.some((r) => r.ruleType === "SKILL")).toBe(false);
  });

  it("gives human-readable reasons through the facade", () => {
    const cse = resolveDepartmentDriveWithRules(master, cseInstance);

    expect(getIneligibilityReasons(student(CSE, ["Python"], 6.5) as never, cse)).toEqual([
      "CGPA requirement: 7 (You: 6.5)",
      "Missing required skill: Java",
    ]);
  });
});

// ---------------------------------------------------------------------------
// One evaluator: the list, the apply action and notifications agree
// ---------------------------------------------------------------------------

describe("the list, apply and notifications decide through the same evaluator", () => {
  // A rule only the engine knows about. If any path evaluated eligibility some
  // other way (the old hard-coded CGPA/backlog check, say), a student without
  // Java would slip through on that path and this block would fail.
  const noJavaCse = student(CSE, ["Python"]);
  const javaCse = student(CSE, ["Java"]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.driveApplication.create).mockResolvedValue({ id: "app-1" } as never);
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (fn: (tx: unknown) => unknown) => fn(prisma)
  );
    primeDeliveryMocks(prisma as never);
  });

  function asStudent(s: ReturnType<typeof student>) {
    vi.mocked(requireStudent).mockResolvedValue({ user: { id: s.userId }, student: s } as never);
    vi.mocked(prisma.student.findUnique).mockResolvedValue(s as never);
  }

  it("the drive list hides it from a CSE student without Java", async () => {
    asStudent(noJavaCse);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([
      { ...master, departmentConfigs: [cseInstance] },
    ] as never);

    expect((await getEligibleDrives()).totalCount).toBe(0);
  });

  it("applyToDrive refuses the same student, with the rule's reason", async () => {
    asStudent(noJavaCse);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: [cseInstance],
    } as never);

    const result = await applyToDrive(DRIVE_ID, { consent: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Missing required skill: Java");
    expect(prisma.driveApplication.create).not.toHaveBeenCalled();
  });

  it("applyToDrive accepts a CSE student who has Java", async () => {
    asStudent(javaCse);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: [cseInstance],
    } as never);

    expect((await applyToDrive(DRIVE_ID, { consent: true })).success).toBe(true);
  });

  it("notifications skip the same student and reach the one with Java", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findMany).mockResolvedValue([cseInstance] as never);
    vi.mocked(prisma.driveEligibilityRule.findMany).mockResolvedValue(master.eligibilityRules as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([noJavaCse, javaCse] as never);

    const { notified } = await notifyEligibleStudentsOfDrive(master as never);

    expect(notified).toBe(1);
    const [call] = vi.mocked(prisma.notification.createMany).mock.calls;
    const rows = (call[0] as { data: { userId: string }[] }).data;
    expect(rows.map((row) => row.userId)).toEqual([javaCse.userId]);
  });

  it("apply never evaluates anything the client sent", async () => {
    // The client claims a skill and a CGPA; neither is ever consulted.
    asStudent(noJavaCse);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      departmentConfigs: [cseInstance],
    } as never);

    const result = await applyToDrive(DRIVE_ID, {
      consent: true,
      submittedDetails: { skills: "Java", cgpa: "10.0" },
    });

    expect(result.success).toBe(false);
  });

  it("the listing narrows in SQL on membership and lifecycle only", async () => {
    asStudent(javaCse);
    vi.mocked(prisma.drive.findMany).mockResolvedValue([] as never);

    await getEligibleDrives();

    const [call] = vi.mocked(prisma.drive.findMany).mock.calls;
    const args = call[0] as { where: Record<string, unknown>; include: Record<string, unknown> };
    expect(Object.keys(args.where).sort()).toEqual([
      "departmentConfigs",
      "eligibleDepartmentLinks",
      "lifecycleStatus",
    ]);
    // Rules come back with the candidates, in the same query.
    expect(args.include.eligibilityRules).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Published rule sets are immutable
// ---------------------------------------------------------------------------

describe("published-drive rule immutability", () => {
  const adminOfCse = {
    user: { id: "user-admin-cse" },
    admin: { id: "admin-cse", departmentId: CSE },
    department: { id: CSE, name: "CSE", code: "CSE", isActive: true },
  };
  // Resubmit the form students of this drive actually see (catalog defaults,
  // since neither master nor instance customised it), so that on a locked
  // drive only the rule set can be what differs.
  const baseInput = {
    driveId: DRIVE_ID,
    venue: "Hall A",
    reportingTime: "09:00",
    fields: defaultApplicationForm().map((field) => ({
      key: field.fieldKey,
      required: field.isRequired,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDepartmentAdmin).mockResolvedValue(adminOfCse as never);
    vi.mocked(prisma.drive.findUnique).mockResolvedValue({
      ...master,
      eligibleDepartmentLinks: [{ departmentId: CSE }],
    } as never);
    vi.mocked(prisma.driveDepartmentConfig.upsert).mockResolvedValue({ id: cseInstance.id } as never);
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => unknown) => fn(prisma)
    );
  });

  it("refuses a rule change once the department has published", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(cseInstance as never);

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      eligibilityRules: [{ ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: ["Go"] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/eligibilityRules/);
      // The rules alone — the unchanged form is not what was refused.
      expect(result.error).not.toMatch(/applicationFields/);
    }
    expect(prisma.driveEligibilityRule.deleteMany).not.toHaveBeenCalled();
    expect(prisma.driveEligibilityRule.createMany).not.toHaveBeenCalled();
  });

  it("refuses removing every rule once published", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(cseInstance as never);

    const result = await saveDriveDepartmentConfig({ ...baseInput, eligibilityRules: [] });

    expect(result.success).toBe(false);
  });

  it("accepts the same set resubmitted in another order and case", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(CSE, [rule("SKILL", "INCLUDES_ALL", ["Java", "SQL"])]) as never
    );

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      eligibilityRules: [{ ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: ["sql", "java"] }],
    });

    expect(result.success).toBe(true);
    // Locked: logistics only, the rule rows are not rewritten.
    expect(prisma.driveEligibilityRule.deleteMany).not.toHaveBeenCalled();
  });

  it("writes the set and its legacy mirrors before publication", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(CSE, [], { status: "CONFIGURED", lockedAt: null }) as never
    );

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      eligibilityRules: [
        { ruleType: "CGPA", operator: "GTE", numberValue: 7.5 },
        { ruleType: "SKILL", operator: "INCLUDES_ALL", listValue: ["Java"] },
      ],
    });

    expect(result.success).toBe(true);
    expect(prisma.driveEligibilityRule.deleteMany).toHaveBeenCalledWith({
      where: { driveDepartmentConfigId: cseInstance.id },
    });
    const [create] = vi.mocked(prisma.driveEligibilityRule.createMany).mock.calls;
    expect((create[0] as { data: unknown[] }).data).toHaveLength(2);

    const [upsert] = vi.mocked(prisma.driveDepartmentConfig.upsert).mock.calls;
    const update = (upsert[0] as { update: Record<string, unknown> }).update;
    expect(update.minCGPA).toBe(7.5);
    // No backlog rule → the mirror is cleared to NULL, i.e. inherit.
    expect(update.maxActiveBacklogs).toBeNull();
  });

  it("refuses an invalid rule before writing anything", async () => {
    vi.mocked(prisma.driveDepartmentConfig.findUnique).mockResolvedValue(
      instance(CSE, [], { status: "CONFIGURED", lockedAt: null }) as never
    );

    const result = await saveDriveDepartmentConfig({
      ...baseInput,
      eligibilityRules: [{ ruleType: "CGPA", operator: "LTE", numberValue: 7 }],
    });

    expect(result.success).toBe(false);
    expect(prisma.driveDepartmentConfig.upsert).not.toHaveBeenCalled();
  });
});
