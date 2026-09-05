import { describe, it, expect } from "vitest";
import { getDriveStatus, isDriveOpen, getDaysUntilDeadline } from "../utils/drive-status";

describe("Drive Status Calculation", () => {
  it("should return 'open' for future deadline", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    const status = getDriveStatus(futureDate);
    expect(status).toBe("open");
  });

  it("should return 'closed' for past deadline", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

    const status = getDriveStatus(pastDate);
    expect(status).toBe("closed");
  });

  it("should return 'closed' for current moment", () => {
    const now = new Date();

    const status = getDriveStatus(now);
    expect(status).toBe("closed");
  });

  it("should correctly identify open drive", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    expect(isDriveOpen(futureDate)).toBe(true);
  });

  it("should correctly identify closed drive", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    expect(isDriveOpen(pastDate)).toBe(false);
  });

  it("should calculate days until deadline correctly", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const days = getDaysUntilDeadline(futureDate);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("should return 0 days for past deadline", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const days = getDaysUntilDeadline(pastDate);
    expect(days).toBe(0);
  });

  it("should handle date object correctly", () => {
    const futureDate = new Date("2030-12-31");

    const status = getDriveStatus(futureDate);
    expect(status).toBe("open");
  });
});
