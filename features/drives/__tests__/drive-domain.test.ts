import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  driveKindOf,
  driveKindColumns,
  isCentralDrive,
  isDepartmentDrive,
} from "../domain/drive-kind";
import {
  resolveDepartmentDrive,
  resolveDepartmentDrives,
} from "../domain/resolve-department-drive";
import {
  buildDepartmentDriveData,
  buildCentralDriveData,
  toDepartmentDriveUpdateData,
  toCentralDriveUpdateData,
} from "../domain/drive-write-data";
import { validateDriveDates, type DriveDates } from "../domain/drive-window";
import { driveSchema } from "../schemas/drive";
import { createCentralDriveSchema } from "../schemas/central-drive";

/**
 * The unified drive domain.
 *
 *   MASTER DRIVE (`Drive`) → DEPARTMENT INSTANCE (`DriveDepartmentConfig`) → APPLICATION
 *
 * Central and department drives were two parallel implementations — two
 * schemas, four actions, two query families — that had already drifted
 * (`applicationFields` persisted by one create path and not the other). These
 * tests pin the shared pieces: the discriminant, the resolver's output shape,
 * the column payload builders, and the validation rules both schemas inherit.
 */

const DEPT_A = "dept-a";

/** A master drive row as Prisma returns it, plus its eligibility links. */
const masterDrive = {
  id: "drive-1",
  departmentId: null,
  createdByUserId: "user-super",
  isCentralDrive: true,
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  jobDescriptionUrl: null,
  jobDescriptionText: "Build things.",
  packageOffered: new Prisma.Decimal("12.00"),
  selectionRounds: "[]",
  nextStageDate: new Date("2026-12-01"),
  applicationDeadline: new Date("2026-11-01"),
  applyMethod: "IN_APP" as const,
  externalApplyUrl: null,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  companyLogoUrl: null,
  packageDisplay: "12 LPA",
  venue: "Main Auditorium",
  reportingTime: "09:00",
  contactPerson: "Central Coordinator",
  contactPhone: "1111111111",
  pptLink: "https://example.com/master-ppt",
  applicationFields: '[{"key":"name"}]',
  lifecycleStatus: "PUBLISHED" as const,
  requirements: "Strong DSA fundamentals",
  skills: '["Java","SQL"]',
  createdAt: new Date("2026-10-01"),
  updatedAt: new Date("2026-10-01"),
  eligibleDepartmentLinks: [{ departmentId: DEPT_A }],
};

const departmentInstance = {
  id: "config-1",
  driveId: "drive-1",
  departmentId: DEPT_A,
  status: "ASSIGNED" as const,
  assignedAt: new Date("2026-10-02"),
  publishedAt: null,
  publishedByUserId: null,
  lockedAt: null,
  roleName: null,
  jobDescriptionText: null,
  requirements: null,
  skills: null,
  nextStageDate: null,
  applicationDeadline: null,
  selectionRounds: null,
  minCGPA: null,
  maxActiveBacklogs: null,
  venue: "CS Block Seminar Hall",
  reportingTime: "10:30",
  coordinatorName: "Dept Coordinator",
  coordinatorPhone: "2222222222",
  coordinatorEmail: "coordinator@cs.example.edu",
  seatingAllocation: "Rows 1-10",
  pptLink: "https://example.com/dept-ppt",
  specialInstructions: "Bring your ID card.",
  applicationFields: '[{"key":"phone"}]',
  createdAt: new Date("2026-10-02"),
  updatedAt: new Date("2026-10-02"),
};

// ---------------------------------------------------------------------------
// Discriminant
// ---------------------------------------------------------------------------

describe("drive kind discriminant", () => {
  it("classifies a central drive", () => {
    expect(driveKindOf({ isCentralDrive: true })).toBe("CENTRAL");
    expect(isCentralDrive({ isCentralDrive: true })).toBe(true);
    expect(isDepartmentDrive({ isCentralDrive: true })).toBe(false);
  });

  it("classifies a department drive", () => {
    expect(driveKindOf({ isCentralDrive: false })).toBe("DEPARTMENT");
    expect(isDepartmentDrive({ isCentralDrive: false })).toBe(true);
  });

  it("forces a central drive to have no owning department", () => {
    // Passing a department id must not be able to smuggle ownership onto a
    // central drive — the kind decides the columns, not the caller.
    expect(driveKindColumns("CENTRAL", DEPT_A)).toEqual({
      isCentralDrive: true,
      departmentId: null,
    });
  });

  it("gives a department drive its owning department", () => {
    expect(driveKindColumns("DEPARTMENT", DEPT_A)).toEqual({
      isCentralDrive: false,
      departmentId: DEPT_A,
    });
  });
});

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

describe("resolveDepartmentDrive", () => {
  it("inherits everything from the master when no instance exists", () => {
    const resolved = resolveDepartmentDrive(masterDrive, null);

    expect(resolved.venue).toBe("Main Auditorium");
    expect(resolved.reportingTime).toBe("09:00");
    expect(resolved.contactPerson).toBe("Central Coordinator");
    expect(resolved.contactPhone).toBe("1111111111");
    expect(resolved.pptLink).toBe("https://example.com/master-ppt");
    expect(resolved.applicationFields).toBe('[{"key":"name"}]');
    expect(resolved.seatingAllocation).toBeNull();
    expect(resolved.specialInstructions).toBeNull();
    expect(resolved.coordinatorEmail).toBeNull();
  });

  it("treats undefined the same as a missing instance", () => {
    expect(resolveDepartmentDrive(masterDrive, undefined)).toEqual(
      resolveDepartmentDrive(masterDrive, null)
    );
  });

  it("lets the department instance override the master", () => {
    const resolved = resolveDepartmentDrive(masterDrive, departmentInstance);

    expect(resolved.venue).toBe("CS Block Seminar Hall");
    expect(resolved.reportingTime).toBe("10:30");
    expect(resolved.contactPerson).toBe("Dept Coordinator");
    expect(resolved.contactPhone).toBe("2222222222");
    expect(resolved.pptLink).toBe("https://example.com/dept-ppt");
    expect(resolved.applicationFields).toBe('[{"key":"phone"}]');
    expect(resolved.seatingAllocation).toBe("Rows 1-10");
    expect(resolved.specialInstructions).toBe("Bring your ID card.");
    expect(resolved.coordinatorEmail).toBe("coordinator@cs.example.edu");
  });

  it("falls back per field, not all-or-nothing", () => {
    const partial = { ...departmentInstance, venue: null, pptLink: null };
    const resolved = resolveDepartmentDrive(masterDrive, partial);

    expect(resolved.venue).toBe("Main Auditorium");
    expect(resolved.pptLink).toBe("https://example.com/master-ppt");
    // Still overridden.
    expect(resolved.reportingTime).toBe("10:30");
  });

  it("keeps an instance's deliberate empty string instead of inheriting", () => {
    // `??` not `||`: "no venue announced yet" is an answer the department gave.
    const resolved = resolveDepartmentDrive(masterDrive, {
      ...departmentInstance,
      venue: "",
    });

    expect(resolved.venue).toBe("");
  });

  it("never mutates the master row", () => {
    const before = { ...masterDrive };
    resolveDepartmentDrive(masterDrive, departmentInstance);

    expect(masterDrive).toEqual(before);
  });

  it("preserves the master's identity and money fields untouched", () => {
    const resolved = resolveDepartmentDrive(masterDrive, departmentInstance);

    expect(resolved.id).toBe("drive-1");
    expect(resolved.companyName).toBe("Acme Corp");
    expect(resolved.roleName).toBe("Software Engineer");
    expect(resolved.minCGPA).toBe(7);
    expect(resolved.maxActiveBacklogs).toBe(0);
    expect(resolved.applicationDeadline).toEqual(new Date("2026-11-01"));
    // Decimal must survive resolution as a Decimal — serialization happens
    // later, as the last step before a Client Component.
    expect(resolved.packageOffered).toBeInstanceOf(Prisma.Decimal);
    expect(resolved.packageOffered.toString()).toBe("12");
    expect(resolved.eligibleDepartmentLinks).toEqual([{ departmentId: DEPT_A }]);
  });

  it("exposes exactly the resolved shape components expect", () => {
    const resolved = resolveDepartmentDrive(masterDrive, departmentInstance);

    // The flat contract six components read. Adding a key is fine; removing
    // one breaks them, which is what this guards.
    for (const key of [
      ...Object.keys(masterDrive),
      "seatingAllocation",
      "specialInstructions",
      "coordinatorEmail",
    ]) {
      expect(resolved).toHaveProperty(key);
    }
  });

  it("maps a page of masters onto their own department's instances", () => {
    const other = { ...masterDrive, id: "drive-2", venue: "Other Hall" };
    const resolved = resolveDepartmentDrives(
      [masterDrive, other],
      [departmentInstance]
    );

    expect(resolved[0].venue).toBe("CS Block Seminar Hall");
    // No instance for drive-2 — inherits.
    expect(resolved[1].venue).toBe("Other Hall");
    expect(resolved[1].seatingAllocation).toBeNull();
  });

  it("never leaks another department's instance onto a drive", () => {
    const foreign = {
      ...departmentInstance,
      id: "config-2",
      driveId: "drive-999",
      venue: "Mechanical Block",
    };

    const resolved = resolveDepartmentDrives([masterDrive], [foreign]);

    expect(resolved[0].venue).toBe("Main Auditorium");
  });
});

// ---------------------------------------------------------------------------
// Write payloads
// ---------------------------------------------------------------------------

const departmentInput = {
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  packageOffered: 12,
  selectionRounds: ["Aptitude", "Technical"],
  batchYears: ["2026"],
  applicationStartDate: "2026-10-01",
  applicationDeadline: "2026-11-01",
  nextStageDate: "2026-12-01",
  applyMethod: "IN_APP" as const,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  eligibleDepartments: [DEPT_A],
  applicationFields: '[{"key":"name"}]',
};

const centralInput = {
  companyName: "Globex",
  roleName: "Analyst",
  packageDisplay: "14 - 22 LPA",
  minCGPA: 6,
  maxActiveBacklogs: 0,
  applicationStartDate: "2026-10-01",
  applicationDeadline: "2026-11-01",
  nextStageDate: "2026-12-01",
  eligibleDepartments: [DEPT_A],
};

/** The instants the actions pass to the builders, from validateDriveDates. */
const DATES: DriveDates = (() => {
  const decision = validateDriveDates(centralInput, { startNotBeforeToday: false });
  if (!decision.ok) throw new Error("fixture dates invalid");
  return decision.dates;
})();

describe("drive write payloads", () => {
  it("stamps a department drive with its owner and non-central kind", () => {
    const data = buildDepartmentDriveData(
      driveSchema.parse(departmentInput),
      DEPT_A,
      DATES
    );

    expect(data.isCentralDrive).toBe(false);
    expect(data.departmentId).toBe(DEPT_A);
    // The window is written as the validated instants, never the raw input.
    expect(data.applicationStartDate).toEqual(DATES.applicationStartDate);
    expect(data.applicationDeadline).toEqual(DATES.applicationDeadline);
    expect(data.nextStageDate).toEqual(DATES.nextStageDate);
    expect(data.selectionRounds).toBe(JSON.stringify(["Aptitude", "Technical"]));
    // The form is not part of the column payload: it is validated and written
    // to `DriveApplicationField` rows (with the JSON mirrored) by
    // `writeMasterForm`, so the two can never be written separately.
    expect(data).not.toHaveProperty("applicationFields");
  });

  it("stamps a central drive as central and department-less", () => {
    const data = buildCentralDriveData(
      createCentralDriveSchema.parse(centralInput),
      DATES
    );

    expect(data.isCentralDrive).toBe(true);
    expect(data.departmentId).toBeNull();
    // NOT NULL column, seeded empty — rounds are configured after creation.
    expect(data.selectionRounds).toBe("[]");
  });

  it("derives a central drive's apply method from the portal URL", () => {
    const withPortal = buildCentralDriveData(
      createCentralDriveSchema.parse({
        ...centralInput,
        externalApplyUrl: "careers.globex.com/apply",
      }),
      DATES
    );
    const withoutPortal = buildCentralDriveData(
      createCentralDriveSchema.parse(centralInput),
      DATES
    );

    expect(withPortal.applyMethod).toBe("EXTERNAL");
    expect(withPortal.externalApplyUrl).toBe("https://careers.globex.com/apply");
    expect(withoutPortal.applyMethod).toBe("IN_APP");
    expect(withoutPortal.externalApplyUrl).toBeNull();
  });

  it("parses a central drive's numeric package from its free-text CTC", () => {
    const data = buildCentralDriveData(
      createCentralDriveSchema.parse(centralInput),
      DATES
    );

    expect(data.packageOffered).toBe(14);
    // What students actually see stays the text the admin typed.
    expect(data.packageDisplay).toBe("14 - 22 LPA");
  });

  it("never rewrites ownership or kind on a department edit", () => {
    const data = toDepartmentDriveUpdateData(driveSchema.parse(departmentInput), DATES);

    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
    expect(data.companyName).toBe("Acme Corp");
  });

  it("never rewrites ownership, kind or rounds on a central edit", () => {
    const data = toCentralDriveUpdateData(
      createCentralDriveSchema.parse(centralInput),
      DATES
    );

    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
    // Re-sending the seeded "[]" would wipe rounds configured after creation.
    expect(data).not.toHaveProperty("selectionRounds");
    expect(data.companyName).toBe("Globex");
  });
});

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

describe("shared validation rules", () => {
  it("applies the same company/role constraints to both kinds", () => {
    expect(
      driveSchema.safeParse({ ...departmentInput, companyName: "" }).success
    ).toBe(false);
    expect(
      createCentralDriveSchema.safeParse({ ...centralInput, companyName: "" })
        .success
    ).toBe(false);
  });

  it("applies the same CGPA bounds to both kinds", () => {
    expect(
      driveSchema.safeParse({ ...departmentInput, minCGPA: 11 }).success
    ).toBe(false);
    expect(
      createCentralDriveSchema.safeParse({ ...centralInput, minCGPA: 11 })
        .success
    ).toBe(false);
  });

  it("requires the application end to precede the next stage date on both kinds", () => {
    const deptResult = driveSchema.safeParse({
      ...departmentInput,
      applicationDeadline: "2026-12-15",
    });
    const centralResult = createCentralDriveSchema.safeParse({
      ...centralInput,
      applicationDeadline: "2026-12-15",
    });

    expect(deptResult.success).toBe(false);
    expect(centralResult.success).toBe(false);
    if (!deptResult.success && !centralResult.success) {
      expect(deptResult.error.errors[0].message).toBe(
        centralResult.error.errors[0].message
      );
    }
  });

  it("rejects an unparseable date rather than letting it through", () => {
    expect(
      driveSchema.safeParse({ ...departmentInput, nextStageDate: "not-a-date" })
        .success
    ).toBe(false);
  });

  it("requires backlogs on a department drive but defaults them centrally", () => {
    const { maxActiveBacklogs: _dept, ...deptWithout } = departmentInput;
    const { maxActiveBacklogs: _central, ...centralWithout } = centralInput;

    expect(driveSchema.safeParse(deptWithout).success).toBe(false);

    const parsed = createCentralDriveSchema.safeParse(centralWithout);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.maxActiveBacklogs).toBe(0);
  });

  it("still rejects more than two decimal places on a package", () => {
    expect(
      driveSchema.safeParse({ ...departmentInput, packageOffered: 12.345 })
        .success
    ).toBe(false);
    expect(
      driveSchema.safeParse({ ...departmentInput, packageOffered: 12.34 })
        .success
    ).toBe(true);
  });

  it("still requires an external URL when the apply method is EXTERNAL", () => {
    expect(
      driveSchema.safeParse({
        ...departmentInput,
        applyMethod: "EXTERNAL",
      }).success
    ).toBe(false);
  });
});
