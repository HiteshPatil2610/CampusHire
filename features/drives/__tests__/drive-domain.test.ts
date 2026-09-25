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
import { driveFormSchema } from "../schemas/drive-form";

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

  it("keeps a department's own drive's seating, instructions and email (Item 13)", () => {
    // A department's own drive stores these on the Drive row. They must not be
    // wiped to null just because no instance overrides them.
    const ownDrive = {
      ...masterDrive,
      seatingAllocation: "Hall B-201",
      specialInstructions: "Carry college ID",
      coordinatorEmail: "cse.placement@college.edu",
    };

    for (const instance of [null, { ...departmentInstance, seatingAllocation: null, specialInstructions: null, coordinatorEmail: null }]) {
      const resolved = resolveDepartmentDrive(ownDrive, instance);
      expect(resolved.seatingAllocation).toBe("Hall B-201");
      expect(resolved.specialInstructions).toBe("Carry college ID");
      expect(resolved.coordinatorEmail).toBe("cse.placement@college.edu");
    }
  });

  it("an instance's own seating, instructions and email still win over the drive's", () => {
    const ownDrive = { ...masterDrive, seatingAllocation: "Drive hall", specialInstructions: "Drive note", coordinatorEmail: "drive@x.edu" };
    const resolved = resolveDepartmentDrive(ownDrive, departmentInstance);
    expect(resolved.seatingAllocation).toBe("Rows 1-10");
    expect(resolved.specialInstructions).toBe("Bring your ID card.");
    expect(resolved.coordinatorEmail).toBe("coordinator@cs.example.edu");
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
// Write payloads — both kinds are written from the one drive form
// ---------------------------------------------------------------------------

/** One drive form submission; the role decides which extras ride along. */
const formInput = {
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  packageOffered: 12,
  packageDisplay: "12 - 16 LPA",
  batchYears: ["2026"],
  applicationStartDate: "2026-10-01",
  applicationDeadline: "2026-11-01",
  nextStageDate: "2026-12-01",
  applyMethod: "IN_APP" as const,
  minCGPA: 7,
  maxActiveBacklogs: 0,
  jobDescriptionText: "Build things",
  skills: ["Java", "SQL"],
};

const departmentInput = {
  ...formInput,
  selectionRounds: ["Aptitude", "Technical"],
  applicationFields: '[{"key":"name"}]',
  venue: "Hall A",
};

const centralInput = {
  ...formInput,
  companyName: "Globex",
  departmentScope: { mode: "SELECTED" as const, departmentIds: [DEPT_A] },
  departmentEditableFields: ["roleName" as const],
};

/** The instants the actions pass to the builders, from validateDriveDates. */
const DATES: DriveDates = (() => {
  const decision = validateDriveDates(formInput, { startNotBeforeToday: false });
  if (!decision.ok) throw new Error("fixture dates invalid");
  return decision.dates;
})();

describe("drive write payloads", () => {
  it("stamps a department drive with its owner and non-central kind", () => {
    const data = buildDepartmentDriveData(driveFormSchema.parse(departmentInput), DEPT_A, DATES);

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

  it("stamps a central drive as a central, department-less DRAFT", () => {
    const data = buildCentralDriveData(driveFormSchema.parse(centralInput), DATES);

    expect(data.isCentralDrive).toBe(true);
    expect(data.departmentId).toBeNull();
    expect(data.lifecycleStatus).toBe("DRAFT");
    // NOT NULL column, seeded empty — a master's rounds come from its pipeline.
    expect(data.selectionRounds).toBe("[]");
  });

  it("writes the same content columns for both kinds from the same input", () => {
    const department = buildDepartmentDriveData(driveFormSchema.parse(departmentInput), DEPT_A, DATES);
    const central = buildCentralDriveData(driveFormSchema.parse(centralInput), DATES);

    for (const column of [
      "roleName",
      "packageOffered",
      "packageDisplay",
      "jobDescriptionText",
      "skills",
      "applyMethod",
      "minCGPA",
      "maxActiveBacklogs",
      "applicationStartDate",
      "applicationDeadline",
      "nextStageDate",
    ] as const) {
      expect(central[column]).toEqual(department[column]);
    }
    expect(department.skills).toBe(JSON.stringify(["Java", "SQL"]));
  });

  it("keeps a portal URL only when students apply externally", () => {
    const external = buildCentralDriveData(
      driveFormSchema.parse({ ...centralInput, applyMethod: "EXTERNAL", externalApplyUrl: "careers.globex.com/apply" }),
      DATES
    );
    const inApp = buildCentralDriveData(
      driveFormSchema.parse({ ...centralInput, externalApplyUrl: "careers.globex.com/apply" }),
      DATES
    );

    expect(external.applyMethod).toBe("EXTERNAL");
    expect(external.externalApplyUrl).toBe("https://careers.globex.com/apply");
    expect(inApp.applyMethod).toBe("IN_APP");
    expect(inApp.externalApplyUrl).toBeNull();
  });

  it("clears an emptied optional field instead of storing an empty string", () => {
    const data = buildDepartmentDriveData(
      driveFormSchema.parse({ ...departmentInput, packageDisplay: "", venue: "" }),
      DEPT_A,
      DATES
    );

    expect(data.packageDisplay).toBeNull();
    expect(data.venue).toBeNull();
  });

  it("never rewrites ownership or kind on a department edit", () => {
    const data = toDepartmentDriveUpdateData(driveFormSchema.parse(departmentInput), DATES);

    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
    expect(data.companyName).toBe("Acme Corp");
  });

  it("never rewrites ownership, kind, lifecycle or rounds on a central edit", () => {
    const data = toCentralDriveUpdateData(driveFormSchema.parse(centralInput), DATES);

    expect(data).not.toHaveProperty("isCentralDrive");
    expect(data).not.toHaveProperty("departmentId");
    expect(data).not.toHaveProperty("lifecycleStatus");
    // Re-sending the seeded "[]" would wipe the rounds its pipeline set.
    expect(data).not.toHaveProperty("selectionRounds");
    expect(data.companyName).toBe("Globex");
  });
});

// ---------------------------------------------------------------------------
// The one validation schema
// ---------------------------------------------------------------------------

describe("the drive form schema", () => {
  it("applies the same rules whichever role submits", () => {
    for (const input of [departmentInput, centralInput]) {
      expect(driveFormSchema.safeParse(input).success).toBe(true);
      expect(driveFormSchema.safeParse({ ...input, companyName: "" }).success).toBe(false);
      expect(driveFormSchema.safeParse({ ...input, minCGPA: 11 }).success).toBe(false);
      expect(driveFormSchema.safeParse({ ...input, applicationDeadline: "2026-12-15" }).success).toBe(false);
    }
  });

  it("requires the application end to precede the next stage date", () => {
    const result = driveFormSchema.safeParse({ ...departmentInput, applicationDeadline: "2026-12-15" });

    expect(result.success).toBe(false);
    // Reported on the next stage date, the field that has to move.
    if (!result.success) expect(result.error.issues[0].path).toEqual(["nextStageDate"]);
  });

  it("rejects an unparseable date rather than letting it through", () => {
    expect(driveFormSchema.safeParse({ ...departmentInput, nextStageDate: "not-a-date" }).success).toBe(false);
  });

  it("requires the package and the eligibility bar from every role", () => {
    const { packageOffered: _package, ...withoutPackage } = departmentInput;
    const { maxActiveBacklogs: _backlogs, ...withoutBacklogs } = centralInput;

    expect(driveFormSchema.safeParse(withoutPackage).success).toBe(false);
    expect(driveFormSchema.safeParse(withoutBacklogs).success).toBe(false);
  });

  it("rejects more than two decimal places on a package", () => {
    expect(driveFormSchema.safeParse({ ...departmentInput, packageOffered: 12.345 }).success).toBe(false);
    expect(driveFormSchema.safeParse({ ...departmentInput, packageOffered: 12.34 }).success).toBe(true);
  });

  it("requires an external URL when the apply method is EXTERNAL", () => {
    const result = driveFormSchema.safeParse({ ...departmentInput, applyMethod: "EXTERNAL" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["externalApplyUrl"]);
  });

  it("refuses origin and ownership fields outright instead of stripping them", () => {
    for (const forged of [
      { isCentralDrive: true },
      { departmentId: "dept-b" },
      { createdByUserId: "someone-else" },
      { lifecycleStatus: "PUBLISHED" },
      { eligibleDepartments: ["dept-b"] },
    ]) {
      expect(driveFormSchema.safeParse({ ...departmentInput, ...forged }).success).toBe(false);
    }
  });

  it("accepts All departments or a non-empty selection, nothing else", () => {
    const scoped = (departmentScope: unknown) => driveFormSchema.safeParse({ ...centralInput, departmentScope });

    expect(scoped({ mode: "ALL" }).success).toBe(true);
    expect(scoped({ mode: "SELECTED", departmentIds: [DEPT_A] }).success).toBe(true);
    expect(scoped({ mode: "SELECTED", departmentIds: [] }).success).toBe(false);
    expect(scoped({ mode: "ALL", departmentIds: [DEPT_A] }).success).toBe(false);
    expect(scoped({ mode: "EVERYONE" }).success).toBe(false);
  });
});