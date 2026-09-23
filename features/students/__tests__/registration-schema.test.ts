import { describe, it, expect } from "vitest";
import { studentRegistrationSchema } from "../schemas/registration";

const base = {
  misNumber: "mis2023001",
  name: "Hitesh Patil",
  rollNumber: "4242",
  departmentId: "cmtsxe83c0000tttcj2u7jbzl",
  expectedPassoutYear: 2027,
  entryType: "REGULAR" as const,
  phoneNumber: "9876543210",
};

describe("studentRegistrationSchema — first-time verification", () => {
  it("accepts the required details, normalised, with no PRN", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      name: "  Hitesh   Patil ",
      rollNumber: "lat-77",
      phoneNumber: "+91 98765 43210",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      ...base,
      misNumber: "MIS2023001",
      rollNumber: "LAT-77",
      prnNumber: undefined,
    });
  });

  it("accepts an optional PRN, normalised", () => {
    const result = studentRegistrationSchema.safeParse({ ...base, prnNumber: " 72123456a " });
    expect(result.success && result.data.prnNumber).toBe("72123456A");
  });

  it("treats a blank PRN as not given", () => {
    const result = studentRegistrationSchema.safeParse({ ...base, prnNumber: "   " });
    expect(result.success && result.data.prnNumber).toBeUndefined();
  });

  it.each([
    ["MIS number", { misNumber: "" }],
    ["name", { name: " " }],
    ["roll number", { rollNumber: "" }],
    ["department", { departmentId: "" }],
    ["batch", { expectedPassoutYear: undefined }],
    ["phone number", { phoneNumber: "" }],
    ["entry type", { entryType: undefined }],
  ])("requires the %s", (_field, change) => {
    expect(studentRegistrationSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });

  it("requires a roll number from a diploma (lateral-entry) student too", () => {
    const result = studentRegistrationSchema.safeParse({ ...base, entryType: "DIPLOMA", rollNumber: "" });
    expect(result.success).toBe(false);
  });

  it.each([
    ["a malformed MIS", { misNumber: "M!" }],
    ["a malformed PRN", { prnNumber: "#" }],
    ["a malformed phone", { phoneNumber: "not-a-phone" }],
    ["an implausible batch", { expectedPassoutYear: 1999 }],
  ])("rejects %s", (_label, change) => {
    expect(studentRegistrationSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });

  it("has no email field — the email is the signed-in account's", () => {
    const result = studentRegistrationSchema.safeParse({ ...base, email: "someone@else.com" });
    expect(result.success && "email" in result.data).toBe(false);
  });
});
