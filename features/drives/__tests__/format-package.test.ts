import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { formatPackage } from "../utils/format-package";

describe("formatPackage", () => {
  it("renders a Decimal without the stored trailing zeros", () => {
    // NUMERIC(10,2) stores 12.00; showing "12.00 LPA" would be a visible
    // change from what the old Float column rendered.
    expect(formatPackage({ packageOffered: new Prisma.Decimal("12.00") })).toBe("12 LPA");
    expect(formatPackage({ packageOffered: new Prisma.Decimal("12.50") })).toBe("12.5 LPA");
  });

  it("renders the string a client component actually receives", () => {
    // decimal.js defines toJSON, so React's serializer turns the Decimal into
    // a string on its way across the server/client boundary. Same output.
    const serialized = JSON.parse(JSON.stringify({ packageOffered: new Prisma.Decimal("12.50") }));
    expect(typeof serialized.packageOffered).toBe("string");
    expect(formatPackage(serialized)).toBe("12.5 LPA");
  });

  it("renders a plain number, as an unsaved form preview supplies", () => {
    expect(formatPackage({ packageOffered: 8 })).toBe("8 LPA");
  });

  it("prefers packageDisplay when the Super Admin set one", () => {
    expect(
      formatPackage({ packageDisplay: "14 – 22 LPA", packageOffered: new Prisma.Decimal("14") })
    ).toBe("14 – 22 LPA");
  });

  it("falls through to the number when packageDisplay is blank", () => {
    // `??` here instead of `||` would render an empty string.
    expect(formatPackage({ packageDisplay: "", packageOffered: 9 })).toBe("9 LPA");
    expect(formatPackage({ packageDisplay: "   ", packageOffered: 9 })).toBe("9 LPA");
  });

  it("says CTC TBD rather than rendering NaN or null", () => {
    expect(formatPackage({ packageOffered: Number.parseFloat("") })).toBe("CTC TBD");
    expect(formatPackage({ packageOffered: null })).toBe("CTC TBD");
    expect(formatPackage({})).toBe("CTC TBD");
  });
});
