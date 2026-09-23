import { describe, it, expect } from "vitest";
import {
  ALREADY_LINKED,
  DETAILS_MISMATCH,
  decideRegistrationOutcome,
  mergeOntoRosterRecord,
  type RosterRecord,
} from "../utils/registration-match";
import type { StudentRegistration } from "../schemas/registration";

const EMAIL = "aditi.sharma@college.edu";

const submitted: StudentRegistration = {
  misNumber: "MIS2023001",
  prnNumber: undefined,
  name: "Aditi Sharma",
  rollNumber: "21CS042",
  departmentId: "dept-comp",
  expectedPassoutYear: 2027,
  entryType: "REGULAR",
  phoneNumber: "9876543210",
};

/** The roster row the department imported for that student. */
const imported: RosterRecord = {
  id: "stu_1",
  userId: null,
  isPending: true,
  misNumber: "MIS2023001",
  email: EMAIL,
  name: "Aditi Sharma",
  rollNumber: "21CS042",
  departmentId: "dept-comp",
  expectedPassoutYear: 2027,
};

function decide(overrides: Partial<Parameters<typeof decideRegistrationOutcome>[0]> = {}) {
  return decideRegistrationOutcome({
    submitted,
    verifiedEmail: EMAIL,
    byMis: imported,
    byEmail: imported,
    ...overrides,
  });
}

describe("decideRegistrationOutcome — MIS-based verification", () => {
  it("links when the MIS matches and every cross-check agrees", () => {
    expect(decide()).toEqual({ kind: "link", studentId: "stu_1" });
  });

  it("tolerates case, full stops and spacing in the name — nothing looser", () => {
    expect(decide({ submitted: { ...submitted, name: "  aditi   SHARMA " } }).kind).toBe("link");
    expect(decide({ byMis: { ...imported, name: "A. Sharma" }, byEmail: { ...imported, name: "A. Sharma" } }).kind).toBe("refuse");
  });

  it.each([
    ["name", { name: "Priya Patel" }],
    ["roll number", { rollNumber: "21CS099" }],
    ["department", { departmentId: "dept-mech" }],
    ["batch", { expectedPassoutYear: 2028 }],
  ])("refuses when the %s does not match — a partial match unlocks nothing", (_field, change) => {
    const outcome = decide({ submitted: { ...submitted, ...change } });
    expect(outcome).toEqual({ kind: "refuse", reason: DETAILS_MISMATCH });
  });

  it("does not say which field was wrong", () => {
    const outcome = decide({ submitted: { ...submitted, rollNumber: "WRONG" } });
    expect(outcome.kind === "refuse" && outcome.reason).not.toMatch(/roll number is/i);
  });

  it("refuses a record already linked to another account", () => {
    const claimed = { ...imported, userId: "user_other", isPending: false };
    expect(decide({ byMis: claimed, byEmail: claimed })).toEqual({ kind: "refuse", reason: ALREADY_LINKED });
  });

  it("sends a full match with a different sheet email to an admin, never links it", () => {
    // The details are right but the account's verified email is not the one
    // on the roster. Only the admin can vouch that this account is them.
    const outcome = decide({ verifiedEmail: "aditi.personal@gmail.com", byEmail: null });
    expect(outcome.kind).toBe("request-review");
  });

  it("refuses when the verified email belongs to a different roster record than the MIS", () => {
    const someoneElse = { ...imported, id: "stu_2", misNumber: "MIS2023002" };
    expect(decide({ byEmail: someoneElse }).kind).toBe("refuse");
  });

  it("refuses a typo'd MIS when the email names a record with a different MIS", () => {
    const outcome = decide({ submitted: { ...submitted, misNumber: "MIS2023009" }, byMis: null });
    expect(outcome).toEqual({ kind: "refuse", reason: DETAILS_MISMATCH });
  });

  it("queues someone nobody imported", () => {
    expect(decide({ byMis: null, byEmail: null }).kind).toBe("request-review");
  });

  it("sends an unclaimed but not-pending record to an admin", () => {
    const odd = { ...imported, isPending: false };
    expect(decide({ byMis: odd, byEmail: odd }).kind).toBe("request-review");
  });
});

describe("existing student compatibility", () => {
  // A roster row imported before MIS numbers and batches existed.
  const legacy: RosterRecord = { ...imported, misNumber: null, expectedPassoutYear: null };

  it("a pre-MIS roster row is claimed by its verified email when the other details agree", () => {
    expect(decide({ byMis: null, byEmail: legacy })).toEqual({ kind: "link", studentId: "stu_1" });
  });

  it("a pre-MIS roster row still refuses a wrong roll number", () => {
    const outcome = decide({ byMis: null, byEmail: legacy, submitted: { ...submitted, rollNumber: "X" } });
    expect(outcome.kind).toBe("refuse");
  });

  it("claiming a pre-MIS row fills in its MIS number and batch", () => {
    expect(mergeOntoRosterRecord(submitted, { misNumber: null, prnNumber: null, expectedPassoutYear: null })).toEqual({
      phoneNumber: "9876543210",
      misNumber: "MIS2023001",
      expectedPassoutYear: 2027,
    });
  });
});

describe("mergeOntoRosterRecord", () => {
  it("never overwrites what the registrar owns", () => {
    const merged = mergeOntoRosterRecord(
      { ...submitted, prnNumber: "PRN1" },
      { misNumber: "MIS2023001", prnNumber: "PRN-ON-FILE", expectedPassoutYear: 2027 }
    );
    expect(merged).toEqual({ phoneNumber: "9876543210" });
  });

  it("fills a PRN the sheet left blank", () => {
    const merged = mergeOntoRosterRecord(
      { ...submitted, prnNumber: "PRN1" },
      { misNumber: "MIS2023001", prnNumber: null, expectedPassoutYear: 2027 }
    );
    expect(merged).toEqual({ phoneNumber: "9876543210", prnNumber: "PRN1" });
  });
});
