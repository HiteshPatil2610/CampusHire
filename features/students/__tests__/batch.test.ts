import { describe, it, expect } from "vitest";
import {
  batchLabel,
  formatBatch,
  parseBatch,
  selectablePassoutYears,
} from "../utils/batch";

describe("batchLabel — the one place a batch label is derived", () => {
  it.each([
    [2027, "2023-27"],
    [2026, "2022-26"],
    [2030, "2026-30"],
    [2100, "2096-00"],
  ])("%i → %s", (year, label) => {
    expect(batchLabel(year)).toBe(label);
  });

  it("shows a dash for a student with no batch on record", () => {
    expect(formatBatch(null)).toBe("—");
    expect(formatBatch(2027)).toBe("2023-27");
  });
});

describe("parseBatch — a batch as typed into a sheet or form", () => {
  it.each([
    ["2027", 2027],
    [" 2027 ", 2027],
    ["2023-27", 2027],
    ["2023-2027", 2027],
    ["2023 – 27", 2027],
    ["2023/27", 2027],
    ["2096-00", 2100],
  ])("%s → %i", (raw, year) => {
    expect(parseBatch(raw)).toBe(year);
  });

  it.each(["2023-26", "2023-28", "27", "20277", "batch 2027", "1999", "2101", ""])(
    "refuses %s rather than guessing",
    (raw) => {
      expect(parseBatch(raw)).toBeNull();
    }
  );

  it("round-trips with the label", () => {
    for (let year = 2000; year <= 2100; year++) {
      expect(parseBatch(batchLabel(year))).toBe(year);
    }
  });
});

describe("selectablePassoutYears", () => {
  it("offers last year's batch through the batch that has just joined", () => {
    expect(selectablePassoutYears(new Date("2026-09-23"))).toEqual([2025, 2026, 2027, 2028, 2029, 2030]);
  });
});
