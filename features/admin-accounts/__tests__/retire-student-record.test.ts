import { describe, it, expect } from "vitest";
import { decideStudentRetirement } from "../utils/retire-student-record";

describe("decideStudentRetirement", () => {
  it("does nothing when the account never had a student record", () => {
    const result = decideStudentRetirement({
      hasStudentRecord: false,
      applicationCount: 0,
    });

    expect(result.action).toBe("none");
  });

  it("retires a student record that carries no applications", () => {
    const result = decideStudentRetirement({
      hasStudentRecord: true,
      applicationCount: 0,
    });

    expect(result.action).toBe("delete");
  });

  it("refuses to delete a record that would cascade away applications", () => {
    // DriveApplication cascades on Student delete, so this would silently
    // destroy application history that drive reports depend on.
    const result = decideStudentRetirement({
      hasStudentRecord: true,
      applicationCount: 1,
    });

    expect(result.action).toBe("refuse");
    expect(result.reason).toContain("application");
  });

  it("refuses regardless of how many applications there are", () => {
    for (const applicationCount of [1, 2, 25]) {
      expect(
        decideStudentRetirement({ hasStudentRecord: true, applicationCount })
          .action
      ).toBe("refuse");
    }
  });

  it("never reports a deletion as safe for a record it refused", () => {
    const refused = decideStudentRetirement({
      hasStudentRecord: true,
      applicationCount: 3,
    });

    expect(refused.action).not.toBe("delete");
  });
});
