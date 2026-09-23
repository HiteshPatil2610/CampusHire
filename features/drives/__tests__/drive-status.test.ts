import { describe, it, expect } from "vitest";
import {
  getDriveStatus,
  getDriveDisplayStatus,
  isDriveOpen,
  openApplicationWhere,
  openApplicationSql,
  getDaysUntilDeadline,
} from "../utils/drive-status";

/**
 * The application window — the one place "is this drive taking applications"
 * is decided:  open ⇔ applicationStartDate <= now <= applicationDeadline.
 * The next stage date plays no part in it.
 */

const at = (iso: string) => new Date(iso);
const window = {
  applicationStartDate: at("2026-10-01T00:00:00Z"),
  applicationDeadline: at("2026-10-10T00:00:00Z"),
};

describe("getDriveStatus — the application window", () => {
  it("7. an application that has not started is 'upcoming', never open", () => {
    expect(getDriveStatus(window, at("2026-09-30T23:59:59.999Z"))).toBe("upcoming");
    expect(isDriveOpen(window, at("2026-09-30T23:59:59.999Z"))).toBe(false);
  });

  it("8. a currently open application is 'open', inclusive at both ends", () => {
    expect(getDriveStatus(window, at("2026-10-01T00:00:00Z"))).toBe("open");
    expect(getDriveStatus(window, at("2026-10-05T12:00:00Z"))).toBe("open");
    expect(getDriveStatus(window, at("2026-10-10T00:00:00Z"))).toBe("open");
  });

  it("6. an expired application is 'closed'", () => {
    expect(getDriveStatus(window, at("2026-10-10T00:00:00.001Z"))).toBe("closed");
  });

  it("ignores the next stage date entirely", () => {
    const withStage = { ...window, nextStageDate: at("2026-09-01T00:00:00Z") };
    expect(getDriveStatus(withStage, at("2026-10-05T00:00:00Z"))).toBe("open");
  });

  it("accepts the strings a Date becomes in a client component", () => {
    const serialized = {
      applicationStartDate: window.applicationStartDate.toISOString(),
      applicationDeadline: window.applicationDeadline.toISOString(),
    };
    expect(getDriveStatus(serialized, at("2026-10-05T00:00:00Z"))).toBe("open");
  });

  it("never opens an unreadable window", () => {
    expect(getDriveStatus({ applicationStartDate: "nonsense", applicationDeadline: "nonsense" })).toBe("closed");
  });
});

describe("getDriveDisplayStatus — what a student card says", () => {
  const drive = { ...window, nextStageDate: at("2026-10-15T00:00:00Z") };

  it("upcoming before applications open", () => {
    expect(getDriveDisplayStatus(drive, at("2026-09-20T00:00:00Z"))).toBe("upcoming");
  });

  it("open during the window", () => {
    expect(getDriveDisplayStatus(drive, at("2026-10-05T00:00:00Z"))).toBe("open");
  });

  it("in-progress after applications close, while the next stage is ahead", () => {
    expect(getDriveDisplayStatus(drive, at("2026-10-12T00:00:00Z"))).toBe("in-progress");
  });

  it("closed once the next stage has passed too", () => {
    expect(getDriveDisplayStatus(drive, at("2026-10-20T00:00:00Z"))).toBe("closed");
  });
});

describe("the same rule for the database", () => {
  it("a Prisma filter: started, and not yet ended", () => {
    const now = at("2026-10-05T00:00:00Z");
    expect(openApplicationWhere(now)).toEqual({
      applicationStartDate: { lte: now },
      applicationDeadline: { gte: now },
    });
  });

  it("raw SQL, with or without a table alias", () => {
    expect(openApplicationSql()).toBe(`"applicationStartDate" <= NOW() AND "applicationDeadline" >= NOW()`);
    expect(openApplicationSql("d")).toBe(`d."applicationStartDate" <= NOW() AND d."applicationDeadline" >= NOW()`);
  });
});

describe("getDaysUntilDeadline", () => {
  it("counts down, and never below zero", () => {
    expect(getDaysUntilDeadline(window.applicationDeadline, at("2026-10-08T00:00:00Z"))).toBe(2);
    expect(getDaysUntilDeadline(window.applicationDeadline, at("2026-10-12T00:00:00Z"))).toBe(0);
  });
});
