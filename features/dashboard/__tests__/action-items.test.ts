import { describe, it, expect } from "vitest";
import {
  buildAdminActionItems,
  buildStudentActionItems,
  buildSuperAdminActionItems,
  closesIn,
  deadlinePriority,
  sortActionItems,
  type ActionItem,
} from "../domain/action-items";

/**
 * The action-required panels.
 *
 * Items are computed from current state, so the rules that matter are: an item
 * exists only while the thing it asks for is still open, urgent things lead,
 * and a long list is grouped instead of burying the urgent ones.
 */

const NOW = new Date("2026-09-20T10:00:00Z");
const inHours = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

const student = (overrides: object = {}) => ({
  now: NOW,
  profileCompletion: 100,
  hasAcademicRecord: true,
  eligibleDrives: [],
  upcomingStages: [],
  announcements: [],
  ...overrides,
});

const drive = (id: string, hours: number, applied = false) => ({
  driveId: id,
  companyName: `Company ${id}`,
  roleName: "SDE",
  // Applications opened a week ago.
  applicationStartDate: inHours(-24 * 7),
  deadline: inHours(hours),
  applied,
});

describe("student", () => {
  it("shows nothing when there is nothing to do", () => {
    expect(buildStudentActionItems(student())).toEqual([]);
  });

  it("puts a missing academic record above everything, since it blocks every drive", () => {
    const items = buildStudentActionItems(
      student({ hasAcademicRecord: false, profileCompletion: 40, eligibleDrives: [drive("a", 5)] })
    );

    expect(items[0]).toMatchObject({ id: "profile-academic", priority: "URGENT" });
  });

  it("asks for the rest of a profile only once the academic record exists", () => {
    const items = buildStudentActionItems(student({ profileCompletion: 70 }));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "profile-incomplete", priority: "NORMAL" });
  });

  it("drops the profile item the moment the profile is complete", () => {
    expect(buildStudentActionItems(student({ profileCompletion: 100 })).map((i) => i.id)).not.toContain(
      "profile-incomplete"
    );
  });

  it("lists a drive closing within a day as urgent, and within three as important", () => {
    const items = buildStudentActionItems(
      student({ eligibleDrives: [drive("soon", 5), drive("later", 60)] })
    );

    expect(items.find((i) => i.id === "deadline-soon")?.priority).toBe("URGENT");
    expect(items.find((i) => i.id === "deadline-later")?.priority).toBe("HIGH");
  });

  it("groups the drives that are not closing soon into one item", () => {
    const items = buildStudentActionItems(
      student({ eligibleDrives: [drive("a", 200), drive("b", 300), drive("c", 400)] })
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "eligible-drives", count: 3 });
  });

  it("does not ask for an application already submitted, or a deadline already gone", () => {
    const items = buildStudentActionItems(
      student({ eligibleDrives: [drive("done", 5, true), drive("gone", -2)] })
    );

    expect(items).toEqual([]);
  });

  it("shows a scheduled test or interview, with when and where", () => {
    const items = buildStudentActionItems(
      student({
        upcomingStages: [
          {
            driveId: "a",
            companyName: "Acme",
            stageName: "Coding round",
            stageKind: "test",
            scheduledAt: inHours(30),
            location: "Lab 2",
          },
        ],
      })
    );

    expect(items[0].title).toBe("Coding round — Acme");
    expect(items[0].detail).toContain("Lab 2");
    expect(items[0].priority).toBe("HIGH");
  });

  it("makes a round tomorrow morning urgent, and ignores one that has passed or is far off", () => {
    const stage = (hours: number) => ({
      driveId: `d${hours}`,
      companyName: "Acme",
      stageName: "Interview",
      stageKind: "interview" as const,
      scheduledAt: inHours(hours),
      location: null,
    });

    const items = buildStudentActionItems(student({ upcomingStages: [stage(10), stage(-5), stage(24 * 30)] }));

    expect(items.map((i) => i.id)).toEqual(["stage-d10"]);
    expect(items[0].priority).toBe("URGENT");
  });

  it("says a round has no date yet rather than hiding it", () => {
    const items = buildStudentActionItems(
      student({
        upcomingStages: [
          { driveId: "a", companyName: "Acme", stageName: "HR", stageKind: "interview", scheduledAt: null, location: null },
        ],
      })
    );

    expect(items[0].detail).toContain("not been set");
  });

  it("ignores a stage that is not a test or interview", () => {
    const items = buildStudentActionItems(
      student({
        upcomingStages: [
          { driveId: "a", companyName: "Acme", stageName: "Offer", stageKind: "other", scheduledAt: null, location: null },
        ],
      })
    );

    expect(items).toEqual([]);
  });

  it("links an important announcement to its page", () => {
    const items = buildStudentActionItems(
      student({ announcements: [{ id: "ann-1", title: "Campus closed", priority: "URGENT" }] })
    );

    expect(items[0]).toMatchObject({ href: "/student-dashboard/announcements/ann-1", priority: "URGENT" });
  });
});

describe("department admin", () => {
  const admin = (overrides: object = {}) => ({
    now: NOW,
    pendingAccessRequests: 0,
    needsConfiguration: [],
    readyToPublish: [],
    unreadStageDecisions: 0,
    applicationsToReview: [],
    closingSoon: [],
    ...overrides,
  });

  it("shows nothing when nothing is waiting", () => {
    expect(buildAdminActionItems(admin())).toEqual([]);
  });

  it("counts access requests and sends them to the review page", () => {
    const items = buildAdminActionItems(admin({ pendingAccessRequests: 3 }));

    expect(items[0]).toMatchObject({ count: 3, href: "/admin-dashboard/students/import" });
  });

  it("separates a drive to configure from one ready to publish", () => {
    const items = buildAdminActionItems(
      admin({
        needsConfiguration: [{ driveId: "a", companyName: "Acme" }],
        readyToPublish: [{ driveId: "b", companyName: "Beta" }],
      })
    );

    expect(items.map((i) => i.title)).toEqual(["Configure Acme", "Publish Beta"]);
  });

  it("names how many applications are waiting, per drive", () => {
    const items = buildAdminActionItems(
      admin({ applicationsToReview: [{ driveId: "a", companyName: "Acme", count: 12 }] })
    );

    expect(items[0]).toMatchObject({ count: 12, href: "/admin-dashboard/drives/a?tab=applications" });
  });

  it("ranks a deadline closing tonight above the routine work", () => {
    const items = buildAdminActionItems(
      admin({
        pendingAccessRequests: 1,
        closingSoon: [{ driveId: "a", companyName: "Acme", deadline: inHours(6) }],
        applicationsToReview: [{ driveId: "b", companyName: "Beta", count: 4 }],
      })
    );

    expect(items[0].id).toBe("closing-a");
    expect(items[0].priority).toBe("URGENT");
  });

  it("gathers stage decisions into one item", () => {
    const items = buildAdminActionItems(admin({ unreadStageDecisions: 2 }));

    expect(items[0]).toMatchObject({ count: 2 });
    expect(items[0].title).toContain("2 stage change decisions");
  });
});

describe("Super Admin", () => {
  const superAdmin = (overrides: object = {}) => ({
    pendingInvitations: 0,
    awaitingConfiguration: [],
    pendingPipelineRequests: 0,
    milestones: [],
    failedDeliveries: 0,
    unreadSystemAlerts: 0,
    ...overrides,
  });

  it("shows nothing when nothing is waiting", () => {
    expect(buildSuperAdminActionItems(superAdmin())).toEqual([]);
  });

  it("puts a failed delivery first, since people may not have been told", () => {
    const items = buildSuperAdminActionItems(
      superAdmin({ failedDeliveries: 2, pendingPipelineRequests: 5, pendingInvitations: 1 })
    );

    expect(items[0]).toMatchObject({ id: "system-issues", priority: "URGENT" });
    expect(items[0].href).toContain("notification-deliveries");
  });

  it("counts requests waiting for review and invitations not accepted", () => {
    const items = buildSuperAdminActionItems(
      superAdmin({ pendingPipelineRequests: 3, pendingInvitations: 2 })
    );

    expect(items.find((i) => i.id === "pipeline-requests")?.count).toBe(3);
    expect(items.find((i) => i.id === "invitations")?.count).toBe(2);
  });

  it("lists drives whose departments have not configured them, with how many", () => {
    const items = buildSuperAdminActionItems(
      superAdmin({ awaitingConfiguration: [{ driveId: "a", companyName: "Acme", departments: 4 }] })
    );

    expect(items[0].title).toBe("Acme: 4 departments not configured");
  });

  it("offers a milestone only while it is unread", () => {
    expect(buildSuperAdminActionItems(superAdmin({ milestones: [] }))).toEqual([]);
    expect(
      buildSuperAdminActionItems(superAdmin({ milestones: [{ id: "n1", title: "Acme reached 50 applications" }] }))
    ).toHaveLength(1);
  });
});

describe("ordering and wording", () => {
  it("sorts urgent, then important, then the rest; larger groups first within a tier", () => {
    const item = (id: string, priority: ActionItem["priority"], count?: number): ActionItem => ({
      id,
      title: id,
      detail: "",
      href: "/",
      priority,
      count,
    });

    const sorted = sortActionItems([
      item("normal-small", "NORMAL", 1),
      item("urgent", "URGENT"),
      item("normal-big", "NORMAL", 9),
      item("high", "HIGH"),
    ]);

    expect(sorted.map((i) => i.id)).toEqual(["urgent", "high", "normal-big", "normal-small"]);
  });

  it("describes a deadline in plain words", () => {
    expect(closesIn(inHours(0), NOW)).toBe("closes within the hour");
    expect(closesIn(inHours(5), NOW)).toBe("closes in 5 hours");
    expect(closesIn(inHours(30), NOW)).toBe("closes tomorrow");
    expect(closesIn(inHours(24 * 4), NOW)).toBe("closes in 4 days");
  });

  it("calls a deadline within a day urgent and within three important", () => {
    expect(deadlinePriority(inHours(23), NOW)).toBe("URGENT");
    expect(deadlinePriority(inHours(48), NOW)).toBe("HIGH");
    expect(deadlinePriority(inHours(200), NOW)).toBe("NORMAL");
  });
});
