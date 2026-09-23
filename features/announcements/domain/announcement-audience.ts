import type { AnnouncementAudience, AnnouncementStatus, Prisma, Role } from "@prisma/client";

/**
 * Who an announcement is for.
 *
 * One rule, in two forms that must agree: `announcementReaches` (a pure
 * predicate, used to decide a single announcement and unit-tested) and
 * `visibleAnnouncementWhere` (the same rule as a Prisma filter, for lists).
 * The notification fan-out resolves its recipients from the same fields, so
 * nobody is notified about an announcement they cannot open.
 *
 * Reading it never depends on anything the client sends: the viewer's role,
 * department and batch come from their session and their student record.
 */

export interface AnnouncementViewer {
  role: Role;
  /** A department admin's own department, or a student's. */
  departmentId: string | null;
  /** A student's batch year; irrelevant for admins. */
  expectedPassoutYear: number | null;
}

export interface TargetedAnnouncement {
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  departmentId: string | null;
  batchYears: number[];
  publishAt: Date | null;
  expiresAt: Date | null;
}

/** Published (or scheduled and due), and not expired. */
export function announcementIsLive(
  announcement: Pick<TargetedAnnouncement, "status" | "publishAt" | "expiresAt">,
  now: Date = new Date()
): boolean {
  if (announcement.status !== "PUBLISHED" && announcement.status !== "SCHEDULED") return false;
  if (!announcement.publishAt || announcement.publishAt > now) return false;
  return !announcement.expiresAt || announcement.expiresAt > now;
}

/** Whether this announcement's targeting covers this viewer (ignoring time). */
export function announcementTargets(
  announcement: Pick<TargetedAnnouncement, "audience" | "departmentId" | "batchYears">,
  viewer: AnnouncementViewer
): boolean {
  // A Super Admin oversees every announcement in the institution.
  if (viewer.role === "SUPER_ADMIN") return true;

  if (viewer.role === "STUDENT") {
    if (announcement.audience === "ADMINS") return false;
    if (announcement.departmentId && announcement.departmentId !== viewer.departmentId) return false;
    if (announcement.batchYears.length > 0) {
      return viewer.expectedPassoutYear !== null && announcement.batchYears.includes(viewer.expectedPassoutYear);
    }
    return true;
  }

  // Department admin: institution-wide announcements to admins, and their
  // own department's.
  if (announcement.audience === "STUDENTS" && announcement.departmentId !== viewer.departmentId) {
    return false;
  }
  if (announcement.departmentId && announcement.departmentId !== viewer.departmentId) return false;
  return true;
}

/** Live, and targeted at this viewer. */
export function announcementReaches(
  announcement: TargetedAnnouncement,
  viewer: AnnouncementViewer,
  now: Date = new Date()
): boolean {
  return announcementIsLive(announcement, now) && announcementTargets(announcement, viewer);
}

/**
 * The same rule as a query filter. A Super Admin's list is not filtered by
 * targeting (they oversee everything) but is still filtered by time, so their
 * feed shows what is actually live; their management list uses its own query.
 */
export function visibleAnnouncementWhere(
  viewer: AnnouncementViewer,
  now: Date = new Date()
): Prisma.AnnouncementWhereInput {
  const live: Prisma.AnnouncementWhereInput = {
    status: { in: ["PUBLISHED", "SCHEDULED"] },
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  if (viewer.role === "SUPER_ADMIN") return live;

  if (viewer.role === "STUDENT") {
    return {
      ...live,
      audience: { in: ["STUDENTS", "EVERYONE"] },
      AND: [
        { OR: [{ departmentId: null }, { departmentId: viewer.departmentId ?? "" }] },
        {
          OR: [
            { batchYears: { isEmpty: true } },
            ...(viewer.expectedPassoutYear !== null ? [{ batchYears: { has: viewer.expectedPassoutYear } }] : []),
          ],
        },
      ],
    };
  }

  return {
    ...live,
    AND: [
      { OR: [{ departmentId: null }, { departmentId: viewer.departmentId ?? "" }] },
      {
        OR: [
          { audience: { in: ["ADMINS", "EVERYONE"] } },
          // Their own department's announcements to its students.
          { audience: "STUDENTS", departmentId: viewer.departmentId ?? "" },
        ],
      },
    ],
  };
}

/** What an author of this role may write. */
export function allowedAudiencesFor(role: Role): AnnouncementAudience[] {
  return role === "SUPER_ADMIN" ? ["STUDENTS", "ADMINS", "EVERYONE"] : ["STUDENTS"];
}

/**
 * Whether this user may create or change this announcement. A department
 * admin owns their own department's announcements and nothing else; an
 * institution-wide announcement is the Super Admin's alone.
 */
export function canManageAnnouncement(
  viewer: { role: Role; departmentId: string | null },
  announcement: { departmentId: string | null }
): boolean {
  if (viewer.role === "SUPER_ADMIN") return true;
  if (viewer.role !== "DEPT_ADMIN") return false;
  return announcement.departmentId !== null && announcement.departmentId === viewer.departmentId;
}
