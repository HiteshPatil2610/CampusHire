import { describe, it, expect } from "vitest";
import { EMPTY_DRIVE_FILTER, driveFilterActive, filterDrives } from "../domain/drive-list-filter";

const drive = (overrides: object = {}) => ({
  companyName: "Acme Corp",
  roleName: "Software Engineer",
  lifecycleStatus: "PUBLISHED" as const,
  nextStageDate: new Date("2026-10-10T00:00:00Z"),
  eligibleDepartmentLinks: [{ departmentId: "cse" }],
  ...overrides,
});

const drives = [
  drive(),
  drive({ companyName: "Beta Ltd", roleName: "Data Analyst", lifecycleStatus: "CANCELLED", eligibleDepartmentLinks: [{ departmentId: "it" }] }),
  drive({ companyName: "Gamma", roleName: "SDE", lifecycleStatus: "ARCHIVED", nextStageDate: new Date("2026-12-01T00:00:00Z"), eligibleDepartmentLinks: [{ departmentId: "cse" }, { departmentId: "it" }] }),
];

const names = (list: typeof drives) => list.map((d) => d.companyName);

describe("filtering the Super Admin's drive list", () => {
  it("returns everything when nothing is set", () => {
    expect(filterDrives(drives, EMPTY_DRIVE_FILTER)).toHaveLength(3);
    expect(driveFilterActive(EMPTY_DRIVE_FILTER)).toBe(false);
  });

  it("matches company or role, ignoring case", () => {
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, search: "acme" }))).toEqual(["Acme Corp"]);
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, search: "analyst" }))).toEqual(["Beta Ltd"]);
  });

  it("filters by the drive's state: published, closed, cancelled", () => {
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, status: "CANCELLED" }))).toEqual(["Beta Ltd"]);
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, status: "ARCHIVED" }))).toEqual(["Gamma"]);
  });

  it("filters by a department the drive is assigned to", () => {
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, departmentId: "it" }))).toEqual(["Beta Ltd", "Gamma"]);
  });

  it("filters by drive date, inclusive at both ends", () => {
    expect(
      names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, from: "2026-10-10", to: "2026-10-10" }))
    ).toEqual(["Acme Corp", "Beta Ltd"]);
    expect(names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, from: "2026-11-01" }))).toEqual(["Gamma"]);
  });

  it("combines filters as an intersection", () => {
    expect(
      names(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, departmentId: "cse", status: "ARCHIVED" }))
    ).toEqual(["Gamma"]);
  });

  it("ignores a date that is not a date rather than hiding everything", () => {
    expect(filterDrives(drives, { ...EMPTY_DRIVE_FILTER, from: "soon" })).toHaveLength(3);
  });

  it("only ever narrows the list it was given", () => {
    const result = filterDrives(drives, { ...EMPTY_DRIVE_FILTER, search: "gamma" });
    for (const item of result) expect(drives).toContain(item);
  });
});
