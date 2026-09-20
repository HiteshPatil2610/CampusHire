/**
 * "What needs me now" — the action-required items on each role's dashboard.
 *
 * An item is computed from the current state each time the dashboard is
 * rendered; nothing is stored. So an item disappears the moment the thing it
 * asks for is done — a profile completed, an application submitted, a request
 * decided — and can never be stale. And an item is built only from things the
 * viewer can act on: the queries behind the department admin's and Super
 * Admin's items are scoped to their own authority.
 *
 * Pure builders live here so the rules (what is urgent, what is grouped, when
 * an item is shown at all) are tested without a database.
 */

export type ActionPriority = "URGENT" | "HIGH" | "NORMAL";

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  /** How many things this item stands for, when it is a group. */
  count?: number;
  href: string;
  priority: ActionPriority;
}

const RANK: Record<ActionPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };

/** Most urgent first; within a tier, the larger group first, then by title. */
export function sortActionItems(items: ActionItem[]): ActionItem[] {
  return [...items].sort(
    (a, b) =>
      RANK[a.priority] - RANK[b.priority] ||
      (b.count ?? 0) - (a.count ?? 0) ||
      a.title.localeCompare(b.title)
  );
}

const HOUR = 60 * 60 * 1000;

/** Whole hours from `now` until `date` (negative once past). */
export function hoursUntil(date: Date, now: Date): number {
  return Math.floor((date.getTime() - now.getTime()) / HOUR);
}

/** "closes in 5 hours", "closes tomorrow", "closes in 3 days". */
export function closesIn(deadline: Date, now: Date): string {
  const hours = hoursUntil(deadline, now);
  if (hours < 1) return "closes within the hour";
  if (hours < 24) return `closes in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "closes tomorrow" : `closes in ${days} days`;
}

/** A deadline this close is urgent; this close is important. */
export const URGENT_WITHIN_HOURS = 24;
export const HIGH_WITHIN_HOURS = 72;

export function deadlinePriority(deadline: Date, now: Date): ActionPriority {
  const hours = hoursUntil(deadline, now);
  if (hours <= URGENT_WITHIN_HOURS) return "URGENT";
  if (hours <= HIGH_WITHIN_HOURS) return "HIGH";
  return "NORMAL";
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export interface StudentActionInput {
  now: Date;
  /** 0-100, from the profile completion calculation. */
  profileCompletion: number;
  hasAcademicRecord: boolean;
  /** Drives the student is eligible for (decided by the evaluator) and open. */
  eligibleDrives: {
    driveId: string;
    companyName: string;
    roleName: string;
    deadline: Date;
    applied: boolean;
  }[];
  /** In-progress applications with a scheduled next stage. */
  upcomingStages: {
    driveId: string;
    companyName: string;
    stageName: string;
    stageKind: "test" | "interview" | "other";
    scheduledAt: Date | null;
    location: string | null;
  }[];
  /** Live announcements that ask for attention. */
  announcements: { id: string; title: string; priority: string }[];
}

/** Stage scheduled further away than this is not "upcoming" yet. */
const UPCOMING_STAGE_DAYS = 14;

export function buildStudentActionItems(input: StudentActionInput): ActionItem[] {
  const items: ActionItem[] = [];
  const { now } = input;

  // A profile with no academic record makes the student eligible for
  // nothing, so it outranks everything else on the page.
  if (!input.hasAcademicRecord) {
    items.push({
      id: "profile-academic",
      title: "Add your academic details",
      detail: "Without them you are not eligible for any drive.",
      href: "/student-dashboard/profile",
      priority: "URGENT",
    });
  } else if (input.profileCompletion < 100) {
    items.push({
      id: "profile-incomplete",
      title: "Complete your profile",
      detail: `${input.profileCompletion}% complete — recruiters and admins read the rest.`,
      href: "/student-dashboard/profile",
      priority: "NORMAL",
    });
  }

  // Open drives not applied to yet: those closing soon are their own items;
  // the rest are one group, so a long list does not bury the urgent ones.
  const open = input.eligibleDrives.filter((drive) => !drive.applied && drive.deadline > now);
  const closing = open.filter((drive) => hoursUntil(drive.deadline, now) <= HIGH_WITHIN_HOURS);
  for (const drive of closing) {
    items.push({
      id: `deadline-${drive.driveId}`,
      title: `Apply to ${drive.companyName}`,
      detail: `${drive.roleName} ${closesIn(drive.deadline, now)}. You are eligible and have not applied.`,
      href: `/student-dashboard/drives/${drive.driveId}`,
      priority: deadlinePriority(drive.deadline, now),
    });
  }
  const rest = open.filter((drive) => !closing.includes(drive));
  if (rest.length > 0) {
    items.push({
      id: "eligible-drives",
      title: `${rest.length} eligible drive${rest.length === 1 ? "" : "s"} open`,
      detail: "You can apply to these now.",
      count: rest.length,
      href: "/student-dashboard/drives",
      priority: "NORMAL",
    });
  }

  // A test or interview coming up is something to prepare for; a stage with
  // no date is shown as "waiting", so the student knows it is not lost.
  for (const stage of input.upcomingStages) {
    if (stage.stageKind === "other") continue;
    if (stage.scheduledAt) {
      const days = (stage.scheduledAt.getTime() - now.getTime()) / (24 * HOUR);
      // Already past, or too far away to prepare for yet.
      if (days < 0 || days > UPCOMING_STAGE_DAYS) continue;
      items.push({
        id: `stage-${stage.driveId}`,
        title: `${stage.stageName} — ${stage.companyName}`,
        detail: `${stage.scheduledAt.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })}${stage.location ? ` · ${stage.location}` : ""}`,
        href: "/student-dashboard/applications",
        priority: days <= 1 ? "URGENT" : "HIGH",
      });
    } else {
      items.push({
        id: `stage-${stage.driveId}`,
        title: `${stage.stageName} — ${stage.companyName}`,
        detail: "You have reached this round. The date has not been set yet.",
        href: "/student-dashboard/applications",
        priority: "NORMAL",
      });
    }
  }

  for (const announcement of input.announcements) {
    items.push({
      id: `announcement-${announcement.id}`,
      title: announcement.title,
      detail: "Important announcement",
      href: `/student-dashboard/announcements/${announcement.id}`,
      priority: announcement.priority === "URGENT" ? "URGENT" : "HIGH",
    });
  }

  return sortActionItems(items);
}

// ---------------------------------------------------------------------------
// Department admin
// ---------------------------------------------------------------------------

export interface AdminActionInput {
  now: Date;
  pendingAccessRequests: number;
  needsConfiguration: { driveId: string; companyName: string }[];
  readyToPublish: { driveId: string; companyName: string }[];
  /** Unread "your stage change was approved/rejected" notifications. */
  unreadStageDecisions: number;
  applicationsToReview: { driveId: string; companyName: string; count: number }[];
  closingSoon: { driveId: string; companyName: string; deadline: Date }[];
}

export function buildAdminActionItems(input: AdminActionInput): ActionItem[] {
  const items: ActionItem[] = [];
  const { now } = input;

  if (input.pendingAccessRequests > 0) {
    items.push({
      id: "access-requests",
      title: `${input.pendingAccessRequests} student access request${input.pendingAccessRequests === 1 ? "" : "s"} waiting`,
      detail: "Students cannot use CampusHire until you approve or decline them.",
      count: input.pendingAccessRequests,
      href: "/admin-dashboard/students/import",
      priority: "HIGH",
    });
  }

  for (const drive of input.needsConfiguration) {
    items.push({
      id: `configure-${drive.driveId}`,
      title: `Configure ${drive.companyName}`,
      detail: "Assigned to your department. Your students cannot see it until you publish it.",
      href: `/admin-dashboard/drives/${drive.driveId}`,
      priority: "HIGH",
    });
  }

  for (const drive of input.readyToPublish) {
    items.push({
      id: `publish-${drive.driveId}`,
      title: `Publish ${drive.companyName}`,
      detail: "Everything required is filled in. Publishing tells your eligible students.",
      href: `/admin-dashboard/drives/${drive.driveId}`,
      priority: "HIGH",
    });
  }

  if (input.unreadStageDecisions > 0) {
    items.push({
      id: "stage-decisions",
      title: `${input.unreadStageDecisions} stage change decision${input.unreadStageDecisions === 1 ? "" : "s"} from the placement office`,
      detail: "Approved or rejected changes to a published drive's stages.",
      count: input.unreadStageDecisions,
      href: "/admin-dashboard/notifications?filter=recruitment",
      priority: "NORMAL",
    });
  }

  for (const drive of input.applicationsToReview) {
    items.push({
      id: `review-${drive.driveId}`,
      title: `${drive.count} application${drive.count === 1 ? "" : "s"} to review — ${drive.companyName}`,
      detail: "Still at the first stage. Move them on or reject them.",
      count: drive.count,
      href: `/admin-dashboard/drives/${drive.driveId}?tab=applications`,
      priority: "NORMAL",
    });
  }

  for (const drive of input.closingSoon) {
    items.push({
      id: `closing-${drive.driveId}`,
      title: `${drive.companyName} ${closesIn(drive.deadline, now)}`,
      detail: "Applications stop when the deadline passes.",
      href: `/admin-dashboard/drives/${drive.driveId}`,
      priority: deadlinePriority(drive.deadline, now),
    });
  }

  return sortActionItems(items);
}

// ---------------------------------------------------------------------------
// Super Admin
// ---------------------------------------------------------------------------

export interface SuperAdminActionInput {
  pendingInvitations: number;
  /** Department drives still ASSIGNED, grouped by master drive. */
  awaitingConfiguration: { driveId: string; companyName: string; departments: number }[];
  pendingPipelineRequests: number;
  /** Unread milestone notifications. */
  milestones: { id: string; title: string }[];
  failedDeliveries: number;
  unreadSystemAlerts: number;
}

export function buildSuperAdminActionItems(input: SuperAdminActionInput): ActionItem[] {
  const items: ActionItem[] = [];

  if (input.pendingPipelineRequests > 0) {
    items.push({
      id: "pipeline-requests",
      title: `${input.pendingPipelineRequests} stage change request${input.pendingPipelineRequests === 1 ? "" : "s"} to review`,
      detail: "Departments are waiting to change a published drive's recruitment stages.",
      count: input.pendingPipelineRequests,
      href: "/super-admin-dashboard/pipeline-requests",
      priority: "HIGH",
    });
  }

  if (input.failedDeliveries > 0 || input.unreadSystemAlerts > 0) {
    const count = Math.max(input.failedDeliveries, input.unreadSystemAlerts);
    items.push({
      id: "system-issues",
      title:
        input.failedDeliveries > 0
          ? `${input.failedDeliveries} notification deliver${input.failedDeliveries === 1 ? "y" : "ies"} failed`
          : `${input.unreadSystemAlerts} system alert${input.unreadSystemAlerts === 1 ? "" : "s"}`,
      detail: "Some people may not have been told. Re-send them from Notification deliveries.",
      count,
      href: "/super-admin-dashboard/notification-deliveries?status=failed",
      priority: "URGENT",
    });
  }

  if (input.pendingInvitations > 0) {
    items.push({
      id: "invitations",
      title: `${input.pendingInvitations} admin invitation${input.pendingInvitations === 1 ? "" : "s"} not accepted yet`,
      detail: "Resend or withdraw them.",
      count: input.pendingInvitations,
      href: "/super-admin-dashboard/admins",
      priority: "NORMAL",
    });
  }

  for (const drive of input.awaitingConfiguration) {
    items.push({
      id: `awaiting-${drive.driveId}`,
      title: `${drive.companyName}: ${drive.departments} department${drive.departments === 1 ? "" : "s"} not configured`,
      detail: "Assigned but not yet set up. You can remind them from the drive.",
      count: drive.departments,
      href: "/super-admin-dashboard/drives",
      priority: "NORMAL",
    });
  }

  for (const milestone of input.milestones) {
    items.push({
      id: `milestone-${milestone.id}`,
      title: milestone.title,
      detail: "Application milestone",
      href: "/super-admin-dashboard/notifications?filter=application",
      priority: "NORMAL",
    });
  }

  return sortActionItems(items);
}
