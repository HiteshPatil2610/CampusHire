import { describe, it, expect } from "vitest";
import { groupNotifications } from "../utils/notification-grouping";
import type { Notification } from "@prisma/client";

const NOW = new Date("2026-06-15T12:00:00Z");

function make(over: Partial<Notification>): Notification {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "user_1",
    type: "ADMIN",
    title: "Announcement",
    message: "Body",
    resourceType: "ANNOUNCEMENT",
    resourceId: "dept_1",
    isRead: false,
    createdAt: NOW,
    ...over,
  } as Notification;
}

describe("groupNotifications", () => {
  it("omits empty sections rather than rendering an empty heading", () => {
    const sections = groupNotifications([make({ isRead: true })], NOW);

    expect(sections.every((s) => s.items.length > 0)).toBe(true);
  });

  it("lifts an unread outcome into the attention section regardless of age", () => {
    const sections = groupNotifications(
      [
        make({
          type: "APPLICATION",
          title: "Infosys — Offer",
          createdAt: new Date("2025-01-01"),
        }),
      ],
      NOW
    );

    expect(sections[0].key).toBe("attention");
    expect(sections[0].items).toHaveLength(1);
  });

  it("drops a read outcome back into its time bucket", () => {
    // Once handled it should stop occupying the attention section.
    const sections = groupNotifications(
      [
        make({
          type: "APPLICATION",
          title: "Infosys — Offer",
          isRead: true,
          createdAt: new Date("2025-01-01"),
        }),
      ],
      NOW
    );

    expect(sections.map((s) => s.key)).toEqual(["older"]);
  });

  it("buckets by today, this week, and older", () => {
    const sections = groupNotifications(
      [
        make({ isRead: true, createdAt: new Date("2026-06-15T09:00:00Z") }),
        make({ isRead: true, createdAt: new Date("2026-06-12T09:00:00Z") }),
        make({ isRead: true, createdAt: new Date("2026-01-01T09:00:00Z") }),
      ],
      NOW
    );

    expect(sections.map((s) => s.key)).toEqual(["today", "week", "older"]);
  });

  it("ranks the attention section by priority, not recency", () => {
    const sections = groupNotifications(
      [
        make({
          type: "APPLICATION",
          title: "TCS — Interview",
          createdAt: new Date("2026-06-15T11:00:00Z"),
          resourceType: "Drive",
        }),
        make({
          type: "APPLICATION",
          title: "Wipro — Offer",
          createdAt: new Date("2026-06-15T08:00:00Z"),
          resourceType: "Drive",
        }),
      ],
      NOW
    );

    const attention = sections.find((s) => s.key === "attention");
    expect(attention?.items[0].title).toBe("Wipro — Offer");
  });

  it("keeps time buckets in reverse chronological order", () => {
    const sections = groupNotifications(
      [
        make({
          isRead: true,
          title: "Older today",
          createdAt: new Date("2026-06-15T06:00:00Z"),
        }),
        make({
          isRead: true,
          title: "Newer today",
          createdAt: new Date("2026-06-15T10:00:00Z"),
        }),
      ],
      NOW
    );

    const today = sections.find((s) => s.key === "today");
    expect(today?.items.map((i) => i.title)).toEqual([
      "Newer today",
      "Older today",
    ]);
  });

  it("does not put an unread low-priority announcement in attention", () => {
    const sections = groupNotifications(
      [make({ type: "ADMIN", isRead: false, createdAt: NOW })],
      NOW
    );

    expect(sections.map((s) => s.key)).toEqual(["today"]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupNotifications([], NOW)).toEqual([]);
  });
});
