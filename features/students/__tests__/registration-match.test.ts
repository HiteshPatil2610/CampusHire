import { describe, it, expect } from "vitest";
import {
  decideRegistrationOutcome,
  mergeOntoImportedRecord,
} from "../utils/registration-match";

describe("decideRegistrationOutcome", () => {
  it("links a sign-up to an unclaimed imported record", () => {
    const outcome = decideRegistrationOutcome({
      id: "stu_1",
      isPending: true,
      userId: null,
    });

    expect(outcome).toEqual({ kind: "link", studentId: "stu_1" });
  });

  it("queues a sign-up nobody imported", () => {
    const outcome = decideRegistrationOutcome(null);

    expect(outcome.kind).toBe("request-review");
  });

  it("refuses to re-link a record another account already claimed", () => {
    // Silently re-linking would hand one student another's record.
    const outcome = decideRegistrationOutcome({
      id: "stu_1",
      isPending: false,
      userId: "user_other",
    });

    expect(outcome.kind).toBe("blocked");
  });

  it("refuses even when the claimed record is still marked pending", () => {
    const outcome = decideRegistrationOutcome({
      id: "stu_1",
      isPending: true,
      userId: "user_other",
    });

    expect(outcome.kind).toBe("blocked");
  });

  it("sends an unlinked but non-pending record for review rather than guessing", () => {
    const outcome = decideRegistrationOutcome({
      id: "stu_1",
      isPending: false,
      userId: null,
    });

    expect(outcome.kind).toBe("request-review");
  });
});

describe("mergeOntoImportedRecord", () => {
  const submitted = {
    name: "Priya Patel",
    rollNumber: "21CS104",
    departmentId: "dept_other",
    phoneNumber: "9876543210",
    entryType: "DIPLOMA" as const,
  };

  it("takes the student's phone number", () => {
    const merged = mergeOntoImportedRecord(submitted, { rollNumber: "R1" });

    expect(merged.phoneNumber).toBe("9876543210");
  });

  it("never overwrites a roll number the admin imported", () => {
    const merged = mergeOntoImportedRecord(submitted, { rollNumber: "R1" });

    expect(merged.rollNumber).toBeUndefined();
  });

  it("fills a roll number the import left blank", () => {
    const merged = mergeOntoImportedRecord(submitted, { rollNumber: null });

    expect(merged.rollNumber).toBe("21CS104");
  });

  it("leaves a blank roll number blank", () => {
    const merged = mergeOntoImportedRecord(
      { ...submitted, rollNumber: "   " },
      { rollNumber: null }
    );

    expect(merged.rollNumber).toBeUndefined();
  });

  it("never carries the self-asserted department or entry type across", () => {
    // Both decide eligibility and which academic records are required, so the
    // admin's imported values must stand.
    const merged = mergeOntoImportedRecord(submitted, { rollNumber: null });

    expect(merged).not.toHaveProperty("departmentId");
    expect(merged).not.toHaveProperty("entryType");
  });
});
