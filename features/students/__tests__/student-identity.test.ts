import { describe, it, expect } from "vitest";
import {
  isValidIdentifier,
  namesMatch,
  normalizeIdentifier,
  normalizePhone,
  normalizeRollNumber,
} from "../utils/student-identity";

describe("identifiers", () => {
  it("normalises MIS / PRN so case and spacing cannot dodge uniqueness", () => {
    expect(normalizeIdentifier(" mis 2023 001 ")).toBe("MIS2023001");
    expect(normalizeRollNumber(" 21cs 042 ")).toBe("21CS042");
  });

  it.each(["MIS2023001", "123", "PRN-72/123"])("accepts %s", (value) => {
    expect(isValidIdentifier(value)).toBe(true);
  });

  it.each(["", "AB", "-MIS1", "MIS#1", "A".repeat(31)])("rejects %s", (value) => {
    expect(isValidIdentifier(value)).toBe(false);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
  ])("%s → %s", (raw, phone) => {
    expect(normalizePhone(raw)).toBe(phone);
  });

  it.each(["", "12345", "5876543210", "98765432101", "+1 415 555 0100", "phone"])(
    "rejects %s",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    }
  );
});

describe("namesMatch", () => {
  it("ignores case, full stops and spacing", () => {
    expect(namesMatch("A. B. Sharma", "a b sharma")).toBe(true);
    expect(namesMatch("Aditi  Sharma", "aditi sharma")).toBe(true);
  });

  it("is not fuzzy", () => {
    expect(namesMatch("Aditi Sharma", "Aditi Sharmaa")).toBe(false);
    expect(namesMatch("Aditi Sharma", "Sharma Aditi")).toBe(false);
    expect(namesMatch("", "")).toBe(false);
  });
});
