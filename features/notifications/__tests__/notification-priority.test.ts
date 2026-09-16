import { describe, it, expect } from "vitest";
import {
  getNotificationPriority,
  getNotificationHref,
  getNotificationTypeLabel,
  sortByPriority,
  PRIORITY_PRESENTATION,
  PRIORITY_ORDER,
} from "../utils/notification-priority";

describe("getNotificationPriority", () => {
  it("ranks a selection outcome as critical", () => {
    expect(
      getNotificationPriority({
        type: "APPLICATION",
        title: "Infosys — Offer",
        resourceType: "Drive",
      })
    ).toBe("critical");
  });

  it("ranks a rejection as critical", () => {
    expect(
      getNotificationPriority({
        type: "APPLICATION",
        title: "Your application is now marked Rejected",
        resourceType: "Drive",
      })
    ).toBe("critical");
  });

  it("ranks a profile gap as critical, since it blocks applying", () => {
    expect(
      getNotificationPriority({
        type: "PROFILE",
        title: "Complete Your Profile",
        resourceType: "Profile",
      })
    ).toBe("critical");
  });

  it("ranks an in-progress stage move as attention", () => {
    expect(
      getNotificationPriority({
        type: "APPLICATION",
        title: "TCS — Aptitude",
        resourceType: "Drive",
      })
    ).toBe("attention");
  });

  it("ranks a submission acknowledgement as confirmation", () => {
    expect(
      getNotificationPriority({
        type: "APPLICATION",
        title: "Application Submitted",
        resourceType: null,
      })
    ).toBe("confirmation");
  });

  it("ranks a new drive and an announcement as info", () => {
    expect(
      getNotificationPriority({
        type: "DRIVE",
        title: "New Drive Available",
        resourceType: "Drive",
      })
    ).toBe("info");
    expect(
      getNotificationPriority({
        type: "ADMIN",
        title: "Placement meeting Friday",
        resourceType: "ANNOUNCEMENT",
      })
    ).toBe("info");
  });

  it("falls back to info for an unrecognised type", () => {
    expect(
      getNotificationPriority({
        type: "SOMETHING_NEW",
        title: "Hello",
        resourceType: null,
      })
    ).toBe("info");
  });

  it("does not treat a company named like an outcome word as an outcome", () => {
    // Word-boundary matching, so "Offerpad" must not read as an offer.
    expect(
      getNotificationPriority({
        type: "APPLICATION",
        title: "Offerpad — Aptitude",
        resourceType: "Drive",
      })
    ).toBe("attention");
  });

  it("has presentation defined for every tier", () => {
    for (const tier of PRIORITY_ORDER) {
      expect(PRIORITY_PRESENTATION[tier].badgeClass).toMatch(/^badge-/);
      expect(PRIORITY_PRESENTATION[tier].label).toBeTruthy();
    }
  });
});

describe("sortByPriority", () => {
  const base = { resourceType: "Drive" as string | null };
  const make = (
    over: Partial<{
      type: string;
      title: string;
      isRead: boolean;
      createdAt: Date;
      resourceType: string | null;
    }>
  ) => ({
    type: "ADMIN",
    title: "Announcement",
    isRead: false,
    createdAt: new Date("2026-01-01"),
    ...base,
    ...over,
  });

  it("puts unread before read even when the read one is newer", () => {
    const sorted = sortByPriority([
      make({ isRead: true, createdAt: new Date("2026-06-01") }),
      make({ isRead: false, createdAt: new Date("2026-01-01") }),
    ]);

    expect(sorted[0].isRead).toBe(false);
  });

  it("floats an offer above older announcements", () => {
    const sorted = sortByPriority([
      make({ title: "Announcement A", createdAt: new Date("2026-06-03") }),
      make({ title: "Announcement B", createdAt: new Date("2026-06-02") }),
      make({
        type: "APPLICATION",
        title: "Wipro — Offer",
        createdAt: new Date("2026-06-01"),
      }),
    ]);

    expect(sorted[0].title).toBe("Wipro — Offer");
  });

  it("breaks ties within a tier by newest first", () => {
    const sorted = sortByPriority([
      make({ title: "Older", createdAt: new Date("2026-01-01") }),
      make({ title: "Newer", createdAt: new Date("2026-05-01") }),
    ]);

    expect(sorted[0].title).toBe("Newer");
  });

  it("does not mutate the input array", () => {
    const input = [
      make({ title: "A", createdAt: new Date("2026-01-01") }),
      make({
        type: "APPLICATION",
        title: "B — Offer",
        createdAt: new Date("2026-01-02"),
      }),
    ];
    const before = input.map((n) => n.title);

    sortByPriority(input);

    expect(input.map((n) => n.title)).toEqual(before);
  });
});

describe("getNotificationHref", () => {
  it("links a drive notification to that drive", () => {
    expect(
      getNotificationHref({
        type: "DRIVE",
        resourceType: "Drive",
        resourceId: "drive_123",
      })
    ).toBe("/student-dashboard/drives/drive_123");
  });

  it("links an application notification to the applications list", () => {
    expect(
      getNotificationHref({
        type: "APPLICATION",
        resourceType: "Application",
        resourceId: "app_1",
      })
    ).toBe("/student-dashboard/applications");
  });

  it("returns null for an announcement, which has no student-facing page", () => {
    expect(
      getNotificationHref({
        type: "ADMIN",
        resourceType: "ANNOUNCEMENT",
        resourceId: "dept_1",
      })
    ).toBeNull();
  });

  it("returns null when there is no resource id to open", () => {
    expect(
      getNotificationHref({
        type: "DRIVE",
        resourceType: "Drive",
        resourceId: null,
      })
    ).toBeNull();
  });

  it("returns null for an unknown resource type rather than guessing", () => {
    expect(
      getNotificationHref({
        type: "SYSTEM",
        resourceType: "Sprocket",
        resourceId: "x1",
      })
    ).toBeNull();
  });
});

describe("getNotificationTypeLabel", () => {
  it("replaces the raw enum with something a student can read", () => {
    expect(
      getNotificationTypeLabel({
        type: "ADMIN",
        title: "Meeting",
        resourceType: "ANNOUNCEMENT",
      })
    ).toBe("Announcement");
    expect(
      getNotificationTypeLabel({
        type: "APPLICATION",
        title: "Zoho — Offer",
        resourceType: "Drive",
      })
    ).toBe("Outcome");
  });
});
