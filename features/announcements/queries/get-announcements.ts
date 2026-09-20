import type { Prisma, Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveDepartmentAdmin } from "@/lib/auth";
import {
  announcementReaches,
  canManageAnnouncement,
  visibleAnnouncementWhere,
  type AnnouncementViewer,
} from "../domain/announcement-audience";

/**
 * Reading announcements.
 *
 * The viewer is built from the session — a student's department and batch
 * from their student record, an admin's department from their admin record —
 * and everything is filtered by `visibleAnnouncementWhere`, the query form of
 * the same targeting rule the fan-out uses. A department admin never sees
 * another department's announcements; a student never sees one addressed to
 * admins or to another batch.
 */

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  priority: string;
  audience: string;
  status: string;
  departmentCode: string | null;
  batchYears: number[];
  authorName: string;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  attachmentUrl: string | null;
  attachmentName: string | null;
  canManage: boolean;
}

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  content: true,
  priority: true,
  audience: true,
  status: true,
  batchYears: true,
  departmentId: true,
  publishAt: true,
  expiresAt: true,
  createdAt: true,
  attachmentUrl: true,
  attachmentName: true,
  department: { select: { code: true } },
  author: { select: { name: true, email: true } },
} satisfies Prisma.AnnouncementSelect;

type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{ select: typeof ANNOUNCEMENT_SELECT }>;

/** The signed-in user's targeting facts, from the database. */
export async function announcementViewerFor(user: User): Promise<AnnouncementViewer> {
  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { departmentId: true, batchYear: true },
    });
    return {
      role: "STUDENT",
      departmentId: student?.departmentId ?? null,
      batchYear: student?.batchYear ?? null,
    };
  }
  if (user.role === "DEPT_ADMIN") {
    const admin = await getActiveDepartmentAdmin(user.id);
    return { role: "DEPT_ADMIN", departmentId: admin?.departmentId ?? null, batchYear: null };
  }
  return { role: "SUPER_ADMIN", departmentId: null, batchYear: null };
}

function toRow(
  announcement: AnnouncementWithRelations,
  viewer: AnnouncementViewer
): AnnouncementRow {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    priority: announcement.priority,
    audience: announcement.audience,
    status: announcement.status,
    departmentCode: announcement.department?.code ?? null,
    batchYears: announcement.batchYears,
    authorName: announcement.author.name ?? announcement.author.email,
    publishAt: announcement.publishAt,
    expiresAt: announcement.expiresAt,
    createdAt: announcement.createdAt,
    attachmentUrl: announcement.attachmentUrl,
    attachmentName: announcement.attachmentName,
    canManage: canManageAnnouncement(viewer, announcement),
  };
}

/** What this user can read right now, newest first. */
export async function getAnnouncementFeed(
  user: User,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ rows: AnnouncementRow[]; page: number; pageSize: number; totalCount: number }> {
  const viewer = await announcementViewerFor(user);
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 50);
  const where = visibleAnnouncementWhere(viewer);

  const [totalCount, rows] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: [{ publishAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ANNOUNCEMENT_SELECT,
    }),
  ]);

  return { rows: rows.map((row) => toRow(row, viewer)), page, pageSize, totalCount };
}

/**
 * One announcement, if this user may read it. A draft or scheduled one is
 * readable only by someone who may manage it; anything else reads as not
 * found, so ids cannot be probed.
 */
export async function getAnnouncement(user: User, id: string): Promise<AnnouncementRow | null> {
  const viewer = await announcementViewerFor(user);
  const announcement = await prisma.announcement.findUnique({
    where: { id: String(id) },
    select: ANNOUNCEMENT_SELECT,
  });
  if (!announcement) return null;

  const manages = canManageAnnouncement(viewer, announcement);
  const reaches = announcementReaches(
    {
      status: announcement.status,
      audience: announcement.audience,
      departmentId: announcement.departmentId,
      batchYears: announcement.batchYears,
      publishAt: announcement.publishAt,
      expiresAt: announcement.expiresAt,
    },
    viewer
  );
  if (!manages && !reaches) return null;

  return toRow(announcement, viewer);
}

/**
 * What this author manages: their department's announcements, or every
 * announcement for a Super Admin — drafts and archived ones included.
 */
export async function getManagedAnnouncements(
  user: User,
  options: { status?: string } = {}
): Promise<AnnouncementRow[]> {
  const viewer = await announcementViewerFor(user);
  if (viewer.role !== "SUPER_ADMIN" && viewer.role !== "DEPT_ADMIN") return [];

  const status = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(String(options.status))
    ? (options.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED")
    : undefined;

  const rows = await prisma.announcement.findMany({
    where: {
      ...(viewer.role === "DEPT_ADMIN" ? { departmentId: viewer.departmentId ?? "" } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: ANNOUNCEMENT_SELECT,
  });

  return rows.map((row) => toRow(row, viewer));
}

/** The batch years a department's students are in, for batch targeting. */
export async function getTargetableBatchYears(departmentId: string | null): Promise<number[]> {
  const rows = await prisma.student.findMany({
    where: { batchYear: { not: null }, ...(departmentId ? { departmentId } : {}) },
    distinct: ["batchYear"],
    select: { batchYear: true },
    orderBy: { batchYear: "desc" },
    take: 20,
  });
  return rows.map((row) => row.batchYear!).filter((year): year is number => year !== null);
}

export type { Role };
