import { describe, it, expect } from "vitest";
import {
  placedStudentSql,
  PLACED_STUDENT_FILTER,
  PLACEMENT_STATE_BADGES,
  UNPLACED_STUDENT_FILTER,
  resolvePlacementState,
} from "../utils/placement-status";

describe("resolvePlacementState", () => {
  it("reports a student who has not registered yet as pending", () => {
    expect(
      resolvePlacementState({ isPending: true, optedIn: true, isPlaced: false })
    ).toBe("PENDING");
  });

  it("reports pending even when the student opted out", () => {
    expect(
      resolvePlacementState({ isPending: true, optedIn: false, isPlaced: false })
    ).toBe("PENDING");
  });

  it("reports a student with an offer as placed", () => {
    expect(
      resolvePlacementState({ isPending: false, optedIn: true, isPlaced: true })
    ).toBe("PLACED");
  });

  it("keeps a placed student placed even after opting out", () => {
    // The offer is a fact; the opt-out is a later choice about future drives.
    expect(
      resolvePlacementState({ isPending: false, optedIn: false, isPlaced: true })
    ).toBe("PLACED");
  });

  it("reports an opted-out student with no offer as opted out", () => {
    expect(
      resolvePlacementState({
        isPending: false,
        optedIn: false,
        isPlaced: false,
      })
    ).toBe("OPTED_OUT");
  });

  it("reports everyone else as eligible", () => {
    expect(
      resolvePlacementState({ isPending: false, optedIn: true, isPlaced: false })
    ).toBe("ELIGIBLE");
  });

  it("has a badge for every state", () => {
    for (const state of [
      "PENDING",
      "PLACED",
      "OPTED_OUT",
      "ELIGIBLE",
    ] as const) {
      expect(PLACEMENT_STATE_BADGES[state].text).toBeTruthy();
      expect(PLACEMENT_STATE_BADGES[state].className).toMatch(/^badge-/);
    }
  });
});

describe("Placement query filters", () => {
  it("defines placed as holding an active (unrevoked) placement", () => {
    expect(PLACED_STUDENT_FILTER).toEqual({
      placements: { some: { revokedAt: null } },
    });
  });

  it("defines unplaced as the exact inverse", () => {
    expect(UNPLACED_STUDENT_FILTER).toEqual({
      placements: { none: { revokedAt: null } },
    });
  });

  it("expresses the same definition as SQL for the raw reports", () => {
    const sql = placedStudentSql("s");
    expect(sql).toContain('FROM "StudentPlacement"');
    expect(sql).toContain('"studentId" = s."id"');
    expect(sql).toContain('"revokedAt" IS NULL');
  });
});
