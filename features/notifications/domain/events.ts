import type {
  NotificationCategory,
  NotificationEvent,
  NotificationPriority,
  Role,
} from "@prisma/client";

/**
 * The notification event registry: the one definition of every event
 * CampusHire notifies about.
 *
 * `deliverNotification` reads this, so no caller chooses a notification's
 * category, priority or audience — it names the event, and the registry
 * decides. A caller that sends an event to a role the event is not defined
 * for is refused at delivery (see `lib/notifications.ts`).
 *
 * Pure (no database, no server imports) so the notification centre and the
 * preference screen can use the same labels and rules.
 */

export interface NotificationEventDefinition {
  /** Short label shown on the notification row. */
  label: string;
  category: NotificationCategory;
  /** Used unless the producer passes a priority the event allows (announcements). */
  priority: NotificationPriority;
  /** The roles that may receive it. Delivery checks each recipient's role. */
  audience: readonly Role[];
  /**
   * Whether a recipient may mute it. Security, account and recruitment
   * outcomes are never optional: a student who muted "Selected" would learn
   * they were placed from someone else.
   */
  optional: boolean;
  /** Legacy `Notification.type`, still written for older readers. */
  legacyType: "DRIVE" | "APPLICATION" | "PROFILE" | "ADMIN" | "SYSTEM";
  /** What the preference toggle says it controls. */
  description: string;
}

const STUDENT = ["STUDENT"] as const;
const ADMIN = ["DEPT_ADMIN"] as const;
const SUPER = ["SUPER_ADMIN"] as const;

export const NOTIFICATION_EVENTS: Record<NotificationEvent, NotificationEventDefinition> = {
  // ---- Student ------------------------------------------------------------
  DRIVE_PUBLISHED: {
    label: "New drive",
    category: "DRIVE",
    priority: "INFO",
    audience: STUDENT,
    optional: true,
    legacyType: "DRIVE",
    description: "A drive you are eligible for opens",
  },
  DRIVE_UPDATED: {
    label: "Drive update",
    category: "DRIVE",
    priority: "INFO",
    audience: STUDENT,
    optional: true,
    legacyType: "DRIVE",
    description: "A drive you can apply to, or applied to, changes",
  },
  DRIVE_DEADLINE: {
    label: "Deadline",
    category: "DRIVE",
    priority: "WARNING",
    audience: STUDENT,
    optional: true,
    legacyType: "DRIVE",
    description: "A deadline is about to pass, or was extended",
  },
  DRIVE_CANCELLED: {
    label: "Drive cancelled",
    category: "DRIVE",
    priority: "WARNING",
    audience: [...STUDENT, ...ADMIN],
    optional: false,
    legacyType: "DRIVE",
    description: "A drive you applied to is cancelled",
  },
  APPLICATION_SUBMITTED: {
    label: "Submitted",
    category: "APPLICATION",
    priority: "SUCCESS",
    audience: STUDENT,
    optional: true,
    legacyType: "APPLICATION",
    description: "Confirmation that your application was received",
  },
  APPLICATION_SHORTLISTED: {
    label: "Shortlisted",
    category: "RECRUITMENT",
    priority: "SUCCESS",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "You were shortlisted",
  },
  APPLICATION_TEST: {
    label: "Test",
    category: "RECRUITMENT",
    priority: "ACTION_REQUIRED",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "You moved to a test or assessment round",
  },
  APPLICATION_INTERVIEW: {
    label: "Interview",
    category: "RECRUITMENT",
    priority: "ACTION_REQUIRED",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "You moved to an interview round",
  },
  APPLICATION_STAGE_CHANGED: {
    label: "Application update",
    category: "RECRUITMENT",
    priority: "INFO",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "Your application moved to another stage",
  },
  APPLICATION_SELECTED: {
    label: "Selected",
    category: "RECRUITMENT",
    priority: "SUCCESS",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "You were selected",
  },
  APPLICATION_REJECTED: {
    label: "Not selected",
    category: "RECRUITMENT",
    priority: "WARNING",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "Your application was not taken forward",
  },
  PLACEMENT_RECORDED: {
    label: "Placement",
    category: "RECRUITMENT",
    priority: "SUCCESS",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "A placement was recorded for you",
  },
  PLACEMENT_REVOKED: {
    label: "Placement",
    category: "RECRUITMENT",
    priority: "WARNING",
    audience: STUDENT,
    optional: false,
    legacyType: "APPLICATION",
    description: "A placement recorded for you was withdrawn",
  },
  PROFILE_INCOMPLETE: {
    label: "Profile",
    category: "SYSTEM",
    priority: "ACTION_REQUIRED",
    audience: STUDENT,
    optional: false,
    legacyType: "PROFILE",
    description: "Something missing from your profile blocks you from applying",
  },
  ACCOUNT_UPDATE: {
    label: "Account",
    category: "SYSTEM",
    priority: "INFO",
    audience: [...STUDENT, ...ADMIN],
    optional: false,
    legacyType: "SYSTEM",
    description: "Changes to your access or account",
  },

  // ---- Department admin ---------------------------------------------------
  DRIVE_ASSIGNED: {
    label: "Drive assigned",
    category: "DRIVE",
    priority: "ACTION_REQUIRED",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "The Super Admin assigns a drive to your department",
  },
  DRIVE_CONFIG_REMINDER: {
    label: "Reminder",
    category: "DRIVE",
    priority: "ACTION_REQUIRED",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "The Super Admin reminds you to configure a drive",
  },
  DRIVE_READY_TO_PUBLISH: {
    label: "Ready to publish",
    category: "DRIVE",
    priority: "ACTION_REQUIRED",
    audience: ADMIN,
    optional: true,
    legacyType: "ADMIN",
    description: "A drive's configuration is complete and can be published",
  },
  PIPELINE_CHANGE_REVIEWED: {
    label: "Stage change",
    category: "RECRUITMENT",
    priority: "INFO",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "The Super Admin approves or rejects a stage change you proposed",
  },
  NEW_APPLICATIONS: {
    label: "New applications",
    category: "APPLICATION",
    priority: "INFO",
    audience: ADMIN,
    optional: true,
    legacyType: "ADMIN",
    description: "Students apply to your department's drives (one summary per drive per day)",
  },
  ACCESS_REQUEST: {
    label: "Access request",
    category: "SYSTEM",
    priority: "ACTION_REQUIRED",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "A student asks for access to your department",
  },
  STUDENT_UPDATE: {
    label: "Student update",
    category: "SYSTEM",
    priority: "INFO",
    audience: ADMIN,
    optional: true,
    legacyType: "ADMIN",
    description: "A student opts in or out of campus placement",
  },
  ADMIN_DRIVE_DEADLINE: {
    label: "Deadline",
    category: "DRIVE",
    priority: "WARNING",
    audience: ADMIN,
    optional: true,
    legacyType: "ADMIN",
    description: "A drive's deadline is close, or the Super Admin extended it",
  },
  MASTER_DRIVE_UPDATED: {
    label: "Master drive update",
    category: "DRIVE",
    priority: "INFO",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "The Super Admin changes a master drive your department runs",
  },
  ADMIN_SYSTEM: {
    label: "System",
    category: "SYSTEM",
    priority: "WARNING",
    audience: ADMIN,
    optional: false,
    legacyType: "ADMIN",
    description: "Decisions the Super Admin made for your department",
  },

  // ---- Super Admin --------------------------------------------------------
  ADMIN_INVITED: {
    label: "Admin invited",
    category: "SYSTEM",
    priority: "INFO",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "Another Super Admin makes someone a department admin",
  },
  ADMIN_ACCEPTED_INVITATION: {
    label: "Admin joined",
    category: "SYSTEM",
    priority: "INFO",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "A new department admin signs in for the first time",
  },
  DRIVE_ASSIGNMENT: {
    label: "Drive assignment",
    category: "DRIVE",
    priority: "INFO",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "Another Super Admin assigns a drive to departments",
  },
  DEPARTMENT_CONFIGURED: {
    label: "Department configured",
    category: "DRIVE",
    priority: "INFO",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "A department finishes configuring a drive",
  },
  DEPARTMENT_DRIVE_PUBLISHED: {
    label: "Drive published",
    category: "DRIVE",
    priority: "SUCCESS",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "A department publishes a drive to its students",
  },
  PIPELINE_CHANGE_REQUESTED: {
    label: "Stage change request",
    category: "RECRUITMENT",
    priority: "ACTION_REQUIRED",
    audience: SUPER,
    optional: false,
    legacyType: "SYSTEM",
    description: "A department asks to change a published drive's stages",
  },
  APPLICATION_MILESTONE: {
    label: "Milestone",
    category: "APPLICATION",
    priority: "INFO",
    audience: SUPER,
    optional: true,
    legacyType: "SYSTEM",
    description: "A drive reaches 10, 25, 50, 100 … applications",
  },
  ACCESS_REQUEST_ESCALATED: {
    label: "Access request",
    category: "SYSTEM",
    priority: "ACTION_REQUIRED",
    audience: SUPER,
    optional: false,
    legacyType: "SYSTEM",
    description: "A student asks for access to a department that has no admin",
  },
  SYSTEM_ALERT: {
    label: "System alert",
    category: "SYSTEM",
    priority: "URGENT",
    audience: SUPER,
    optional: false,
    legacyType: "SYSTEM",
    description: "Notifications for an event could not be delivered",
  },
  SKILL_PENDING_REVIEW: {
    label: "Skill review",
    category: "SYSTEM",
    priority: "ACTION_REQUIRED",
    audience: SUPER,
    optional: false,
    legacyType: "SYSTEM",
    description: "A student typed a skill that is not yet on the master list",
  },

  // ---- Any role -----------------------------------------------------------
  ANNOUNCEMENT: {
    label: "Announcement",
    category: "ANNOUNCEMENT",
    priority: "INFO",
    audience: ["STUDENT", "DEPT_ADMIN", "SUPER_ADMIN"],
    optional: true,
    legacyType: "ADMIN",
    description: "Announcements from your department or the placement office",
  },
};

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  "DRIVE",
  "APPLICATION",
  "RECRUITMENT",
  "ANNOUNCEMENT",
  "SYSTEM",
];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  DRIVE: "Drive",
  APPLICATION: "Application",
  RECRUITMENT: "Recruitment",
  ANNOUNCEMENT: "Announcement",
  SYSTEM: "System",
};

/** Most urgent first; the index is the sort rank. */
export const PRIORITY_ORDER: readonly NotificationPriority[] = [
  "URGENT",
  "ACTION_REQUIRED",
  "WARNING",
  "INFO",
  "SUCCESS",
];

/** Priorities that lift an unread notification into "Needs your attention". */
export const ATTENTION_PRIORITIES: readonly NotificationPriority[] = [
  "URGENT",
  "ACTION_REQUIRED",
  "WARNING",
];

export function eventDefinition(event: NotificationEvent): NotificationEventDefinition {
  return NOTIFICATION_EVENTS[event];
}

export function isEventForRole(event: NotificationEvent, role: Role): boolean {
  return NOTIFICATION_EVENTS[event].audience.includes(role);
}

/** The events a user of this role may mute, in registry order. */
export function optionalEventsFor(role: Role): NotificationEvent[] {
  return (Object.keys(NOTIFICATION_EVENTS) as NotificationEvent[]).filter(
    (event) => NOTIFICATION_EVENTS[event].optional && isEventForRole(event, role)
  );
}

/**
 * Whether a muted preference suppresses this delivery. A mandatory event, or
 * an URGENT one, always gets through.
 */
export function isSuppressedByPreference(
  event: NotificationEvent,
  priority: NotificationPriority,
  mutedEvents: readonly NotificationEvent[]
): boolean {
  if (!NOTIFICATION_EVENTS[event].optional) return false;
  if (priority === "URGENT") return false;
  return mutedEvents.includes(event);
}

/**
 * A stored action URL, only if it is an in-app path. The database refuses
 * anything else too; this is for rows read back and rendered as links.
 */
export function safeActionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null;
  return url;
}
