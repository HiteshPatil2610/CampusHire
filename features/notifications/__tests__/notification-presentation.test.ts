import { describe, it, expect } from "vitest";
import type { Notification } from "@prisma/client";
import {
  NOTIFICATION_EVENTS,
  isEventForRole,
  isSuppressedByPreference,
  optionalEventsFor,
  safeActionUrl,
} from "../domain/events";
import {
  getNotificationHref,
  getNotificationTypeLabel,
  needsAttention,
  PRIORITY_PRESENTATION,
  sortByPriority,
} from "../utils/notification-priority";
import { groupNotifications } from "../utils/notification-grouping";
import { applicationMoveEvent, reachedMilestone, startOfIndianDay } from "../domain/application-event";

/**
 * How a notification is presented and ordered, and the registry rules behind
 * it. All pure, so they are checked without a database.
 */

const notification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: "n1",
    userId: "u1",
    type: "DRIVE",
    event: "DRIVE_PUBLISHED",
    category: "DRIVE",
    priority: "INFO",
    title: "New Drive Available",
    message: "Acme is hiring",
    resourceType: "Drive",
    resourceId: "d1",
    actionUrl: "/student-dashboard/drives/d1",
    isRead: false,
    readAt: null,
    expiresAt: null,
    dedupeKey: "drive-published:d1",
    dispatchId: null,
    createdAt: new Date("2026-09-20T09:00:00Z"),
    ...overrides,
  }) as Notification;

describe("the registry is complete", () => {
  it("gives every event an audience, a category and a legacy type", () => {
    for (const [event, definition] of Object.entries(NOTIFICATION_EVENTS)) {
      expect(definition.audience.length, event).toBeGreaterThan(0);
      expect(definition.label.length, event).toBeGreaterThan(0);
      expect(definition.description.length, event).toBeGreaterThan(0);
      expect(PRIORITY_PRESENTATION[definition.priority], event).toBeDefined();
    }
  });

  it("gives each role events it may mute, and never the outcomes", () => {
    const studentOptional = optionalEventsFor("STUDENT");

    expect(studentOptional).toContain("DRIVE_PUBLISHED");
    expect(studentOptional).not.toContain("APPLICATION_SELECTED");
    expect(studentOptional).not.toContain("APPLICATION_REJECTED");
    expect(studentOptional).not.toContain("DRIVE_CANCELLED");
    expect(studentOptional).not.toContain("ACCOUNT_UPDATE");
    // A student is never offered an admin's or the office's events.
    expect(studentOptional).not.toContain("NEW_APPLICATIONS");
    expect(optionalEventsFor("SUPER_ADMIN")).not.toContain("SYSTEM_ALERT");
  });

  it("keeps each role's events to that role", () => {
    expect(isEventForRole("APPLICATION_SELECTED", "STUDENT")).toBe(true);
    expect(isEventForRole("APPLICATION_SELECTED", "DEPT_ADMIN")).toBe(false);
    expect(isEventForRole("NEW_APPLICATIONS", "DEPT_ADMIN")).toBe(true);
    expect(isEventForRole("NEW_APPLICATIONS", "STUDENT")).toBe(false);
    // An announcement can reach anyone.
    for (const role of ["STUDENT", "DEPT_ADMIN", "SUPER_ADMIN"] as const) {
      expect(isEventForRole("ANNOUNCEMENT", role)).toBe(true);
    }
  });

  it("suppresses only what may be suppressed", () => {
    expect(isSuppressedByPreference("DRIVE_PUBLISHED", "INFO", ["DRIVE_PUBLISHED"])).toBe(true);
    expect(isSuppressedByPreference("DRIVE_PUBLISHED", "INFO", [])).toBe(false);
    expect(isSuppressedByPreference("APPLICATION_SELECTED", "SUCCESS", ["APPLICATION_SELECTED"])).toBe(
      false
    );
    expect(isSuppressedByPreference("ANNOUNCEMENT", "URGENT", ["ANNOUNCEMENT"])).toBe(false);
  });
});

describe("links", () => {
  it("keeps an in-app path", () => {
    expect(getNotificationHref(notification())).toBe("/student-dashboard/drives/d1");
  });

  it("drops anything that leaves the app", () => {
    expect(safeActionUrl("https://example.com")).toBeNull();
    expect(safeActionUrl("//example.com")).toBeNull();
    expect(safeActionUrl("/admin\\..\\x")).toBeNull();
    expect(safeActionUrl(null)).toBeNull();
    expect(safeActionUrl("/admin-dashboard")).toBe("/admin-dashboard");
  });

  it("renders a row with no link as text", () => {
    expect(getNotificationHref(notification({ actionUrl: null }))).toBeNull();
  });
});

describe("labels and ranking", () => {
  it("labels a row by its event, not the raw enum", () => {
    expect(getNotificationTypeLabel(notification())).toBe("New drive");
    expect(getNotificationTypeLabel(notification({ event: "APPLICATION_SELECTED" }))).toBe("Selected");
  });

  it("falls back to the category for a row written before events existed", () => {
    expect(getNotificationTypeLabel(notification({ event: null, category: "SYSTEM" }))).toBe("System");
  });

  it("ranks urgent above action, action above warning, and good news last", () => {
    const ranks = (["URGENT", "ACTION_REQUIRED", "WARNING", "INFO", "SUCCESS"] as const).map(
      (priority) => PRIORITY_PRESENTATION[priority].rank
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("puts unread first, then priority, then newest", () => {
    const rows = [
      notification({ id: "read-urgent", isRead: true, priority: "URGENT" }),
      notification({ id: "unread-info", priority: "INFO" }),
      notification({ id: "unread-action", priority: "ACTION_REQUIRED" }),
      notification({
        id: "unread-info-older",
        priority: "INFO",
        createdAt: new Date("2026-09-01T09:00:00Z"),
      }),
    ];

    expect(sortByPriority(rows).map((row) => row.id)).toEqual([
      "unread-action",
      "unread-info",
      "unread-info-older",
      "read-urgent",
    ]);
  });

  it("calls an unread urgent or action item attention, and a read one not", () => {
    expect(needsAttention(notification({ priority: "URGENT" }))).toBe(true);
    expect(needsAttention(notification({ priority: "ACTION_REQUIRED" }))).toBe(true);
    expect(needsAttention(notification({ priority: "WARNING" }))).toBe(true);
    expect(needsAttention(notification({ priority: "INFO" }))).toBe(false);
    expect(needsAttention(notification({ priority: "URGENT", isRead: true }))).toBe(false);
  });
});

describe("sections", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("lifts an unread urgent item out of its time bucket, however old", () => {
    const sections = groupNotifications(
      [
        notification({
          id: "old-urgent",
          priority: "ACTION_REQUIRED",
          createdAt: new Date("2026-01-01T09:00:00Z"),
        }),
        notification({ id: "today", createdAt: new Date("2026-09-20T08:00:00Z") }),
      ],
      now
    );

    expect(sections[0].key).toBe("attention");
    expect(sections[0].items.map((item) => item.id)).toEqual(["old-urgent"]);
    expect(sections[1].key).toBe("today");
  });

  it("drops a handled item back into its time bucket once read", () => {
    const sections = groupNotifications(
      [
        notification({
          id: "handled",
          priority: "ACTION_REQUIRED",
          isRead: true,
          createdAt: new Date("2026-09-20T08:00:00Z"),
        }),
      ],
      now
    );

    expect(sections.map((section) => section.key)).toEqual(["today"]);
  });

  it("buckets by age and leaves out empty sections", () => {
    const sections = groupNotifications(
      [
        notification({ id: "today", createdAt: new Date("2026-09-20T08:00:00Z") }),
        notification({ id: "week", createdAt: new Date("2026-09-17T08:00:00Z") }),
        notification({ id: "older", createdAt: new Date("2026-06-01T08:00:00Z") }),
      ],
      now
    );

    expect(sections.map((section) => section.key)).toEqual(["today", "week", "older"]);
  });
});

describe("which student event a move is", () => {
  it("is the outcome when the application closes", () => {
    expect(
      applicationMoveEvent({ fromStageType: "HR_INTERVIEW", toStageType: "OFFER", status: "SELECTED" })
    ).toBe("APPLICATION_SELECTED");
    expect(
      applicationMoveEvent({ fromStageType: "CODING", toStageType: "CODING", status: "REJECTED" })
    ).toBe("APPLICATION_REJECTED");
  });

  it("is being shortlisted when they leave screening", () => {
    expect(
      applicationMoveEvent({ fromStageType: "APPLICATION", toStageType: "CODING", status: "IN_PROGRESS" })
    ).toBe("APPLICATION_SHORTLISTED");
  });

  it("is a test or an interview, by the stage they reach", () => {
    expect(
      applicationMoveEvent({ fromStageType: "CODING", toStageType: "APTITUDE", status: "IN_PROGRESS" })
    ).toBe("APPLICATION_TEST");
    expect(
      applicationMoveEvent({
        fromStageType: "CODING",
        toStageType: "TECHNICAL_INTERVIEW",
        status: "IN_PROGRESS",
      })
    ).toBe("APPLICATION_INTERVIEW");
  });

  it("is a plain stage change otherwise", () => {
    expect(
      applicationMoveEvent({ fromStageType: "HR_INTERVIEW", toStageType: "OFFER", status: "IN_PROGRESS" })
    ).toBe("APPLICATION_STAGE_CHANGED");
    expect(
      applicationMoveEvent({ fromStageType: "CODING", toStageType: "CUSTOM", status: "IN_PROGRESS" })
    ).toBe("APPLICATION_STAGE_CHANGED");
  });
});

describe("milestones and the day boundary", () => {
  it("reports the highest milestone reached, so a skipped count is not lost", () => {
    expect(reachedMilestone(9)).toBeNull();
    expect(reachedMilestone(10)).toBe(10);
    expect(reachedMilestone(11)).toBe(10);
    expect(reachedMilestone(60)).toBe(50);
  });

  it("starts the day in India, not in UTC", () => {
    // 02:00 IST on the 21st is 20:30 UTC on the 20th.
    const { start, key } = startOfIndianDay(new Date("2026-09-20T20:30:00Z"));

    expect(key).toBe("2026-09-21");
    expect(start.toISOString()).toBe("2026-09-20T18:30:00.000Z");
  });
});
