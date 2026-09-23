import { describe, it, expect } from "vitest";
import {
  allowedAudiencesFor,
  announcementIsLive,
  announcementReaches,
  announcementTargets,
  canManageAnnouncement,
  visibleAnnouncementWhere,
  type AnnouncementViewer,
} from "../domain/announcement-audience";

/**
 * Who an announcement reaches, and who may write it.
 *
 * Pure rules, so they can be checked without a database — and the same ones
 * the feed query and the notification fan-out use, which is what keeps a
 * notification from pointing at something its recipient cannot open.
 */

const CSE = "dept-cse";
const IT = "dept-it";
const NOW = new Date("2026-09-20T10:00:00Z");

const announcement = (overrides: object = {}) => ({
  status: "PUBLISHED" as const,
  audience: "STUDENTS" as const,
  departmentId: CSE,
  batchYears: [] as number[],
  publishAt: new Date("2026-09-19T10:00:00Z"),
  expiresAt: null as Date | null,
  ...overrides,
});

const cseStudent: AnnouncementViewer = { role: "STUDENT", departmentId: CSE, expectedPassoutYear: 2026 };
const itStudent: AnnouncementViewer = { role: "STUDENT", departmentId: IT, expectedPassoutYear: 2026 };
const cseAdmin: AnnouncementViewer = { role: "DEPT_ADMIN", departmentId: CSE, expectedPassoutYear: null };
const itAdmin: AnnouncementViewer = { role: "DEPT_ADMIN", departmentId: IT, expectedPassoutYear: null };
const superAdmin: AnnouncementViewer = { role: "SUPER_ADMIN", departmentId: null, expectedPassoutYear: null };

describe("when an announcement is live", () => {
  it("is not live as a draft", () => {
    expect(announcementIsLive(announcement({ status: "DRAFT", publishAt: null }), NOW)).toBe(false);
  });

  it("is not live before its publication time", () => {
    expect(
      announcementIsLive(
        announcement({ status: "SCHEDULED", publishAt: new Date("2026-09-21T10:00:00Z") }),
        NOW
      )
    ).toBe(false);
  });

  it("is live once a scheduled time has passed, even before the status catches up", () => {
    expect(
      announcementIsLive(
        announcement({ status: "SCHEDULED", publishAt: new Date("2026-09-20T09:00:00Z") }),
        NOW
      )
    ).toBe(true);
  });

  it("is not live once it has expired", () => {
    expect(
      announcementIsLive(announcement({ expiresAt: new Date("2026-09-20T09:00:00Z") }), NOW)
    ).toBe(false);
  });

  it("is not live once archived", () => {
    expect(announcementIsLive(announcement({ status: "ARCHIVED" }), NOW)).toBe(false);
  });
});

describe("targeting", () => {
  it("reaches the students of its own department", () => {
    expect(announcementTargets(announcement(), cseStudent)).toBe(true);
  });

  it("does not reach another department's students", () => {
    expect(announcementTargets(announcement(), itStudent)).toBe(false);
  });

  it("does not reach another department's admins", () => {
    expect(announcementTargets(announcement(), itAdmin)).toBe(false);
  });

  it("reaches its own department's admins, who oversee it", () => {
    expect(announcementTargets(announcement(), cseAdmin)).toBe(true);
  });

  it("reaches every student when it is institution-wide", () => {
    const global = announcement({ departmentId: null });
    expect(announcementTargets(global, cseStudent)).toBe(true);
    expect(announcementTargets(global, itStudent)).toBe(true);
  });

  it("reaches only the batches it names", () => {
    const batched = announcement({ batchYears: [2027] });
    expect(announcementTargets(batched, cseStudent)).toBe(false);
    expect(announcementTargets(batched, { ...cseStudent, expectedPassoutYear: 2027 })).toBe(true);
  });

  it("does not reach a student with no batch year when batches are named", () => {
    expect(
      announcementTargets(announcement({ batchYears: [2026] }), { ...cseStudent, expectedPassoutYear: null })
    ).toBe(false);
  });

  it("keeps an admins-only announcement away from students", () => {
    const forAdmins = announcement({ audience: "ADMINS", departmentId: null });
    expect(announcementTargets(forAdmins, cseStudent)).toBe(false);
    expect(announcementTargets(forAdmins, cseAdmin)).toBe(true);
  });

  it("reaches both when it is for everyone", () => {
    const everyone = announcement({ audience: "EVERYONE", departmentId: null });
    expect(announcementTargets(everyone, cseStudent)).toBe(true);
    expect(announcementTargets(everyone, itAdmin)).toBe(true);
  });

  it("shows every announcement to the Super Admin, who oversees them all", () => {
    expect(announcementTargets(announcement({ departmentId: IT }), superAdmin)).toBe(true);
  });

  it("combines liveness and targeting", () => {
    expect(announcementReaches(announcement({ status: "DRAFT", publishAt: null }), cseStudent, NOW)).toBe(
      false
    );
    expect(announcementReaches(announcement(), cseStudent, NOW)).toBe(true);
  });
});

describe("the query filter says the same thing as the predicate", () => {
  it("narrows a student to their department, their batch and live rows", () => {
    const where = visibleAnnouncementWhere(cseStudent, NOW) as Record<string, never>;

    expect(where.status).toEqual({ in: ["PUBLISHED", "SCHEDULED"] });
    expect(where.publishAt).toEqual({ lte: NOW });
    expect(where.audience).toEqual({ in: ["STUDENTS", "EVERYONE"] });
    expect(where.AND).toEqual([
      { OR: [{ departmentId: null }, { departmentId: CSE }] },
      { OR: [{ batchYears: { isEmpty: true } }, { batchYears: { has: 2026 } }] },
    ]);
  });

  it("never lets a department admin's filter reach another department", () => {
    const where = JSON.stringify(visibleAnnouncementWhere(itAdmin, NOW));

    expect(where).toContain(IT);
    expect(where).not.toContain(CSE);
  });

  it("leaves the Super Admin's filter unnarrowed by targeting", () => {
    const where = visibleAnnouncementWhere(superAdmin, NOW) as Record<string, never>;

    expect(where.audience).toBeUndefined();
    expect(where.AND).toBeUndefined();
    expect(where.status).toEqual({ in: ["PUBLISHED", "SCHEDULED"] });
  });
});

describe("who may write what", () => {
  it("lets only the Super Admin address admins or everyone", () => {
    expect(allowedAudiencesFor("SUPER_ADMIN")).toEqual(["STUDENTS", "ADMINS", "EVERYONE"]);
    expect(allowedAudiencesFor("DEPT_ADMIN")).toEqual(["STUDENTS"]);
  });

  it("lets a department admin manage only their own department's announcements", () => {
    expect(canManageAnnouncement(cseAdmin, { departmentId: CSE })).toBe(true);
    expect(canManageAnnouncement(cseAdmin, { departmentId: IT })).toBe(false);
    // Institution-wide belongs to the placement office alone.
    expect(canManageAnnouncement(cseAdmin, { departmentId: null })).toBe(false);
  });

  it("lets the Super Admin manage any announcement", () => {
    expect(canManageAnnouncement(superAdmin, { departmentId: IT })).toBe(true);
    expect(canManageAnnouncement(superAdmin, { departmentId: null })).toBe(true);
  });

  it("lets a student manage none", () => {
    expect(canManageAnnouncement(cseStudent, { departmentId: CSE })).toBe(false);
  });
});
