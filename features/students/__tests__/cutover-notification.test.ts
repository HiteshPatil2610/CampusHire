import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The July 1 changeover tells the batch that has just become final year about
 * the drives it can now apply to (owner's decision, 2026-09-24) — on the visit
 * that records the new cycle, and not on every dashboard visit after it.
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return { AuthorizationError, requireSuperAdmin: vi.fn(async () => ({ id: "super-1" })) };
});
vi.mock("../domain/record-academic-cutover", () => ({ recordAcademicCutover: vi.fn() }));
vi.mock("@/features/notifications/domain/newly-eligible-drives", () => ({
  notifyNewlyEligibleDrivesForBatch: vi.fn(async () => ({ students: 3, notifications: 5 })),
}));

import { requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { recordAcademicCutover } from "../domain/record-academic-cutover";
import { notifyNewlyEligibleDrivesForBatch } from "@/features/notifications/domain/newly-eligible-drives";
import { ensureAcademicCutoverRecorded } from "../actions/academic-cutover";

const cycle = { label: "2027-28", finalYearPassout: 2028, startsAt: new Date("2027-06-30T18:30:00Z") };

beforeEach(() => vi.clearAllMocks());

describe("the changeover notifies the new final-year batch", () => {
  it("tells the batch when this visit records the new cycle", async () => {
    vi.mocked(recordAcademicCutover).mockResolvedValue({
      recorded: true,
      cycle,
      counts: { graduatedCount: 1, fourthYearCount: 3, thirdYearCount: 2 },
    });

    const result = await ensureAcademicCutoverRecorded();

    expect(result.success).toBe(true);
    expect(notifyNewlyEligibleDrivesForBatch).toHaveBeenCalledWith(2028);
  });

  it("does nothing more on later visits, once the cycle is recorded", async () => {
    vi.mocked(recordAcademicCutover).mockResolvedValue({ recorded: false, cycle, recordedAt: new Date() });

    await ensureAcademicCutoverRecorded();

    expect(notifyNewlyEligibleDrivesForBatch).not.toHaveBeenCalled();
  });

  it("a failed fan-out never fails the Super Admin's dashboard", async () => {
    vi.mocked(recordAcademicCutover).mockResolvedValue({
      recorded: true,
      cycle,
      counts: { graduatedCount: 0, fourthYearCount: 0, thirdYearCount: 0 },
    });
    vi.mocked(notifyNewlyEligibleDrivesForBatch).mockRejectedValueOnce(new Error("database busy"));

    expect((await ensureAcademicCutoverRecorded()).success).toBe(true);
  });

  it("only a Super Admin's visit records it, and so notifies", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new AuthorizationError("Super Admin only"));

    expect(await ensureAcademicCutoverRecorded()).toEqual({ success: false, error: "Super Admin only" });
    expect(recordAcademicCutover).not.toHaveBeenCalled();
    expect(notifyNewlyEligibleDrivesForBatch).not.toHaveBeenCalled();
  });
});
