import { describe, it, expect } from "vitest";
import {
  decideAccessRequestWithdrawal,
  decideStudentRetirement,
} from "../utils/retire-student-record";

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

describe("decideAccessRequestWithdrawal", () => {
  it("does nothing when the account never registered", () => {
    expect(
      decideAccessRequestWithdrawal({ hasRequest: false, status: null }).action
    ).toBe("none");
  });

  it("withdraws a request still sitting on the waiting list", () => {
    const result = decideAccessRequestWithdrawal({
      hasRequest: true,
      status: "PENDING",
    });

    expect(result.action).toBe("withdraw");
  });

  it("leaves an already-decided request alone", () => {
    // Only PENDING is "on the waiting list". An APPROVED request belongs to a
    // real student whose roster row retirement already handles, and a REJECTED
    // one is what stops them re-registering — neither is ours to delete here.
    for (const status of ["APPROVED", "REJECTED"] as const) {
      expect(
        decideAccessRequestWithdrawal({ hasRequest: true, status }).action
      ).toBe("none");
    }
  });
});
