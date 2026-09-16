import { describe, it, expect } from "vitest";
import {
  firstSemesterFor,
  isSemesterApplicable,
  preCollegePercentage,
  preCollegeQualificationLabel,
  semestersFor,
} from "../utils/entry-type";
import { academicInfoSchema } from "../schemas/profile";

describe("Entry type — semester range", () => {
  it("starts a regular student at semester 1", () => {
    expect(firstSemesterFor("REGULAR")).toBe(1);
  });

  it("starts a lateral-entry student at semester 3", () => {
    expect(firstSemesterFor("DIPLOMA")).toBe(3);
  });

  it("lists only the semesters a student has reached", () => {
    expect(semestersFor("REGULAR", 5)).toEqual([1, 2, 3, 4, 5]);
    expect(semestersFor("DIPLOMA", 5)).toEqual([3, 4, 5]);
  });

  it("never lists a semester before a lateral-entry student joined", () => {
    expect(semestersFor("DIPLOMA", 3)).toEqual([3]);
    expect(semestersFor("DIPLOMA", 2)).toEqual([]);
  });

  it("caps at the final semester", () => {
    expect(semestersFor("REGULAR", 12)).toHaveLength(8);
  });

  it("rejects semesters 1 and 2 for a lateral-entry student", () => {
    expect(isSemesterApplicable("DIPLOMA", 2)).toBe(false);
    expect(isSemesterApplicable("DIPLOMA", 3)).toBe(true);
    expect(isSemesterApplicable("REGULAR", 1)).toBe(true);
  });
});

describe("Entry type — pre-college record", () => {
  it("reads the 12th score for a regular student", () => {
    expect(
      preCollegePercentage({
        entryType: "REGULAR",
        twelfthPercentage: 88.5,
        diplomaPercentage: null,
      })
    ).toBe(88.5);
  });

  it("reads the diploma score for a lateral-entry student", () => {
    expect(
      preCollegePercentage({
        entryType: "DIPLOMA",
        twelfthPercentage: null,
        diplomaPercentage: 81.2,
      })
    ).toBe(81.2);
  });

  it("returns null rather than falling back to the wrong branch", () => {
    expect(
      preCollegePercentage({
        entryType: "DIPLOMA",
        twelfthPercentage: 88.5,
        diplomaPercentage: null,
      })
    ).toBeNull();
  });

  it("labels the qualification each entry type submits", () => {
    expect(preCollegeQualificationLabel("REGULAR")).toBe("12th / HSC");
    expect(preCollegeQualificationLabel("DIPLOMA")).toBe("Diploma");
  });
});

describe("academicInfoSchema — entry-type branching", () => {
  const base = {
    tenthPercentage: 90,
    currentCGPA: 8.1,
    activeBacklogs: 0,
    pastBacklogCount: 0,
  };

  it("accepts a regular student with a 12th record", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      entryType: "REGULAR",
      twelfthPercentage: 85,
      currentSemester: 5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a regular student with no 12th record", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      entryType: "REGULAR",
      currentSemester: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["twelfthPercentage"]);
    }
  });

  it("accepts a diploma student with no 12th record at all", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      entryType: "DIPLOMA",
      diplomaPercentage: 79,
      currentSemester: 5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a diploma student with no diploma record", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      entryType: "DIPLOMA",
      currentSemester: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["diplomaPercentage"]);
    }
  });

  it("rejects a diploma student placed in semester 1 or 2", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      entryType: "DIPLOMA",
      diplomaPercentage: 79,
      currentSemester: 2,
    });

    expect(result.success).toBe(false);
  });

  it("defaults to REGULAR when entry type is absent", () => {
    const result = academicInfoSchema.safeParse({
      ...base,
      twelfthPercentage: 85,
      currentSemester: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entryType).toBe("REGULAR");
    }
  });
});
