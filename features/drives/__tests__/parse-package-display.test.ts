import { describe, it, expect } from "vitest";
import { parsePackageFromDisplay } from "../utils/parse-package-display";

describe("parsePackageFromDisplay", () => {
  it("extracts the lower bound from a range", () => {
    expect(parsePackageFromDisplay("14 – 22 LPA")).toBe(14);
  });

  it("extracts a decimal package", () => {
    expect(parsePackageFromDisplay("7.5 LPA")).toBe(7.5);
  });

  it("extracts a plain number", () => {
    expect(parsePackageFromDisplay("12")).toBe(12);
  });

  it("handles currency prefixes", () => {
    expect(parsePackageFromDisplay("₹18 LPA fixed")).toBe(18);
  });

  it("returns 0 when no number is present", () => {
    expect(parsePackageFromDisplay("Competitive")).toBe(0);
  });

  it("returns 0 for an empty string", () => {
    expect(parsePackageFromDisplay("")).toBe(0);
  });
});
