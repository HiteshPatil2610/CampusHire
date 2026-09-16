import { describe, it, expect } from "vitest";
import {
  partitionRows,
  rejectedRowsToCsvData,
} from "../validator/partition-rows";
import type { ParsedRow } from "../schemas/import";

const rows: ParsedRow[] = [
  { rowNumber: 2, data: { name: "Aditi", email: "a@c.edu", rollNumber: "R1" } },
  { rowNumber: 3, data: { name: "Rohan", email: "b@c.edu", rollNumber: "R2" } },
  { rowNumber: 4, data: { name: "Priya", email: "c@c.edu", rollNumber: "" } },
];

describe("partitionRows", () => {
  it("treats every row as ready when there is nothing wrong", () => {
    const { ready, rejected } = partitionRows(rows, [], []);

    expect(ready).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it("keeps good rows importable when another row is bad", () => {
    // The whole point: one typo must not block the other 299 students.
    const { ready, rejected } = partitionRows(
      rows,
      [{ row: 3, field: "email", value: "bad", error: "Invalid email format" }],
      []
    );

    expect(ready.map((r) => r.rowNumber)).toEqual([2, 4]);
    expect(rejected.map((r) => r.rowNumber)).toEqual([3]);
  });

  it("reports every issue on a row together, not once per issue", () => {
    const { rejected } = partitionRows(
      rows,
      [
        { row: 2, field: "email", value: "x", error: "Invalid email format" },
        { row: 2, field: "phoneNumber", value: "", error: "Phone number is required" },
      ],
      []
    );

    expect(rejected).toHaveLength(1);
    expect(rejected[0].issues).toHaveLength(2);
  });

  it("rejects a row for a duplicate as well as a validation error", () => {
    const { ready, rejected } = partitionRows(
      rows,
      [],
      [{ row: 4, field: "email", value: "c@c.edu", existsInDatabase: true }]
    );

    expect(ready.map((r) => r.rowNumber)).toEqual([2, 3]);
    expect(rejected[0].issues[0]).toContain("already exists");
  });

  it("distinguishes a within-file duplicate from a database one", () => {
    const { rejected } = partitionRows(
      rows,
      [],
      [{ row: 3, field: "rollNumber", value: "R2", duplicateRow: 2 }]
    );

    expect(rejected[0].issues[0]).toContain("duplicates row 2");
  });

  it("carries identifying details through for the error export", () => {
    const { rejected } = partitionRows(
      rows,
      [{ row: 2, field: "email", value: "x", error: "Invalid email format" }],
      []
    );

    expect(rejected[0]).toMatchObject({
      name: "Aditi",
      email: "a@c.edu",
      rollNumber: "R1",
    });
  });

  it("formats the export with one row per student", () => {
    const csv = rejectedRowsToCsvData([
      {
        rowNumber: 7,
        name: "Priya",
        email: "c@c.edu",
        rollNumber: "",
        issues: ["email: Invalid email format", "phoneNumber: required"],
      },
    ]);

    expect(csv).toHaveLength(1);
    expect(csv[0]["Roll Number"]).toBe("—");
    expect(csv[0].Issues).toBe(
      "email: Invalid email format; phoneNumber: required"
    );
  });
});
