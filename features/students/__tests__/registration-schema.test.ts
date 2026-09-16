import { describe, it, expect } from "vitest";
import { studentRegistrationSchema } from "../schemas/registration";

const base = {
  name: "Hitesh Patil",
  departmentId: "cmtsxe83c0000tttcj2u7jbzl",
  phoneNumber: "9876543210",
};

describe("studentRegistrationSchema", () => {
  it("accepts a regular student with a roll number", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      entryType: "REGULAR",
      rollNumber: "4242",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a regular student with no roll number", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      entryType: "REGULAR",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["rollNumber"]);
    }
  });

  it("rejects a regular student with a blank roll number", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      entryType: "REGULAR",
      rollNumber: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a diploma student with no roll number", () => {
    // Lateral entry may not have been issued one yet; they are blocked from
    // applying until they add it, which is enforced in applyToDrive.
    const result = studentRegistrationSchema.safeParse({
      ...base,
      entryType: "DIPLOMA",
    });

    expect(result.success).toBe(true);
  });

  it("still accepts a diploma student who does have a roll number", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      entryType: "DIPLOMA",
      rollNumber: "lat-77",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rollNumber).toBe("LAT-77");
    }
  });

  it("requires an entry type", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      rollNumber: "4242",
    });

    expect(result.success).toBe(false);
  });

  it("requires a phone number", () => {
    const result = studentRegistrationSchema.safeParse({
      name: base.name,
      departmentId: base.departmentId,
      entryType: "REGULAR",
      rollNumber: "4242",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = studentRegistrationSchema.safeParse({
      ...base,
      phoneNumber: "not-a-phone",
      entryType: "REGULAR",
      rollNumber: "4242",
    });

    expect(result.success).toBe(false);
  });

  it("requires a department", () => {
    const result = studentRegistrationSchema.safeParse({
      name: base.name,
      phoneNumber: base.phoneNumber,
      departmentId: "",
      entryType: "REGULAR",
      rollNumber: "4242",
    });

    expect(result.success).toBe(false);
  });
});
