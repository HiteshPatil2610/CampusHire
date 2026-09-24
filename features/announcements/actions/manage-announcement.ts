"use server";

import { revalidatePath } from "next/cache";
import type { Announcement, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAnyRole, getActiveDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { isAnnouncementAttachmentUrl, uploadAnnouncementAttachment } from "@/lib/blob";
import { notifyAnnouncementPublished } from "@/features/notifications/producers/announcement-events";
import {
  allowedAudiencesFor,
  canManageAnnouncement,
} from "../domain/announcement-audience";
import {
  announcementIdSchema,
  publishAnnouncementSchema,
  saveAnnouncementSchema,
  type AnnouncementActionResult,
  type SaveAnnouncementInput,
} from "../schemas/announcement";

/**
 * Writing announcements.
 *
 * Scope is never taken from the client:
 *
 * - A department admin writes for their own department (from their session)
 *   and to its students only. They can never reach another department, and
 *   never the whole institution.
 * - Only the Super Admin writes an institution-wide announcement, targets
 *   another department, addresses admins, or uses the URGENT priority (which
 *   ignores notification preferences).
 *
 * A draft notifies nobody. Publishing is what generates notifications, once
 * — the fan-out is keyed by the announcement.
 */

function revalidateAnnouncementViews(id?: string) {
  revalidatePath("/admin-dashboard/announcements");
  revalidatePath("/super-admin-dashboard/announcements");
  revalidatePath("/student-dashboard/announcements");
  if (id) {
    revalidatePath(`/admin-dashboard/announcements/${id}`);
    revalidatePath(`/super-admin-dashboard/announcements/${id}`);
    revalidatePath(`/student-dashboard/announcements/${id}`);
  }
}

/** The author's own scope, from their session. */
async function authorContext() {
  const user = await requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"]);
  if (user.role === "SUPER_ADMIN") {
    return { user, role: "SUPER_ADMIN" as Role, departmentId: null as string | null };
  }
  const admin = await getActiveDepartmentAdmin(user.id);
  if (!admin) {
    throw new AuthorizationError(
      "Your account is not associated with an active department, or your access has been disabled."
    );
  }
  return { user, role: "DEPT_ADMIN" as Role, departmentId: admin.departmentId };
}

const parseDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

export async function saveAnnouncement(
  input: SaveAnnouncementInput
): Promise<AnnouncementActionResult> {
  try {
    const author = await authorContext();

    const validated = saveAnnouncementSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const data = validated.data;

    // Scope, decided here rather than accepted.
    const departmentId =
      author.role === "SUPER_ADMIN" ? data.departmentId ?? null : author.departmentId;
    const audience = allowedAudiencesFor(author.role).includes(data.audience)
      ? data.audience
      : "STUDENTS";
    // URGENT is delivered even to people who muted announcements, so it stays
    // with the placement office.
    const priority =
      author.role === "SUPER_ADMIN" ? data.priority : data.priority === "URGENT" ? "WARNING" : data.priority;

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });
      if (!department) return { success: false, error: "Department not found." };
    }

    const publishAt = parseDate(data.publishAt);
    const expiresAt = parseDate(data.expiresAt);
    if (publishAt && expiresAt && expiresAt <= publishAt) {
      return { success: false, error: "The expiry must be after the publication time." };
    }
    if (data.attachmentUrl && !isAnnouncementAttachmentUrl(data.attachmentUrl)) {
      return { success: false, error: "That attachment was not uploaded here." };
    }
    if (Boolean(data.attachmentUrl) !== Boolean(data.attachmentName)) {
      return { success: false, error: "An attachment needs both a file and a name." };
    }

    let existing: Announcement | null = null;
    if (data.id) {
      existing = await prisma.announcement.findUnique({ where: { id: data.id } });
      if (!existing || !canManageAnnouncement(author, existing)) {
        // Not found and not yours read the same.
        return { success: false, error: "Announcement not found." };
      }
      if (existing.status === "ARCHIVED") {
        return { success: false, error: "An archived announcement can no longer be edited." };
      }
    }

    // Once it is out, its audience is fixed: people have already been
    // notified against it. Only its text, expiry and attachment still change.
    const live = existing?.status === "PUBLISHED";

    const saved = await prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.announcement.update({
            where: { id: existing.id },
            data: {
              title: data.title,
              content: data.content,
              expiresAt,
              attachmentUrl: data.attachmentUrl ?? null,
              attachmentName: data.attachmentName ?? null,
              // Only a real edit sets this — never create, publish or
              // archive, which is why it lives here and not on the model's
              // own `@updatedAt`.
              editedAt: new Date(),
              ...(live
                ? {}
                : {
                    audience,
                    departmentId,
                    batchYears: data.batchYears,
                    priority,
                    ...(existing.status === "SCHEDULED" && publishAt ? { publishAt } : {}),
                  }),
            },
          })
        : await tx.announcement.create({
            data: {
              title: data.title,
              content: data.content,
              authorId: author.user.id,
              departmentId,
              audience,
              batchYears: data.batchYears,
              priority,
              status: "DRAFT",
              expiresAt,
              attachmentUrl: data.attachmentUrl ?? null,
              attachmentName: data.attachmentName ?? null,
            },
          });

      await createAuditLogInTransaction(
        tx,
        {
          action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: AuditEntityType.ANNOUNCEMENT,
          entityId: row.id,
          metadata: {
            title: row.title,
            status: row.status,
            audience: row.audience,
            departmentId: row.departmentId,
            batchYears: row.batchYears,
            priority: row.priority,
            targetingLocked: live,
          },
        },
        author.user.id
      );

      return row;
    });

    revalidateAnnouncementViews(saved.id);
    return {
      success: true,
      id: saved.id,
      message: live ? "Saved. Its audience cannot change once published." : "Saved.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("saveAnnouncement error:", error);
    return { success: false, error: "Failed to save the announcement. Please try again." };
  }
}

/**
 * Release a draft: now, or at a time in the future. Publishing now notifies
 * its audience; scheduling notifies nobody until it is due (the release runs
 * on the next visit, see `releaseDueAnnouncements`).
 */
export async function publishAnnouncement(
  input: { id: string; publishAt?: string | null }
): Promise<AnnouncementActionResult> {
  try {
    const author = await authorContext();

    const validated = publishAnnouncementSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }

    const existing = await prisma.announcement.findUnique({ where: { id: validated.data.id } });
    if (!existing || !canManageAnnouncement(author, existing)) {
      return { success: false, error: "Announcement not found." };
    }
    if (existing.status === "PUBLISHED") {
      return { success: false, error: "This announcement is already published." };
    }
    if (existing.status === "ARCHIVED") {
      return { success: false, error: "An archived announcement cannot be published." };
    }

    const now = new Date();
    const requested = parseDate(validated.data.publishAt);
    const scheduled = requested !== null && requested > now;
    const publishAt = scheduled ? requested! : now;

    if (existing.expiresAt && existing.expiresAt <= publishAt) {
      return { success: false, error: "This announcement would expire before it is published." };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.announcement.updateMany({
        where: { id: existing.id, status: existing.status },
        data: {
          status: scheduled ? "SCHEDULED" : "PUBLISHED",
          publishAt,
          publishedAt: now,
        },
      });
      if (claim.count === 0) throw new Error("changed");

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.PUBLISH,
          entityType: AuditEntityType.ANNOUNCEMENT,
          entityId: existing.id,
          metadata: {
            title: existing.title,
            audience: existing.audience,
            departmentId: existing.departmentId,
            batchYears: existing.batchYears,
            priority: existing.priority,
            publishAt: publishAt.toISOString(),
            scheduled,
          },
        },
        author.user.id
      );
      return true;
    });
    if (!updated) return { success: false, error: "Announcement not found." };

    if (scheduled) {
      revalidateAnnouncementViews(existing.id);
      return {
        success: true,
        id: existing.id,
        message: `Scheduled for ${publishAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}.`,
      };
    }

    const { notified } = await notifyAnnouncementPublished({
      announcementId: existing.id,
      actorId: author.user.id,
    });

    revalidateAnnouncementViews(existing.id);
    return {
      success: true,
      id: existing.id,
      message: `Published. ${notified} ${notified === 1 ? "person was" : "people were"} notified.`,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This announcement changed while you were working. Reload it." };
    }
    console.error("publishAnnouncement error:", error);
    return { success: false, error: "Failed to publish the announcement. Please try again." };
  }
}

/**
 * Take an announcement down. The record is kept — announcements are history
 * — and the notifications pointing at it stop being shown, since there is
 * nothing to open any more.
 */
export async function archiveAnnouncement(
  input: { id: string }
): Promise<AnnouncementActionResult> {
  try {
    const author = await authorContext();

    const validated = announcementIdSchema.safeParse(input);
    if (!validated.success) return { success: false, error: "Invalid input" };

    const existing = await prisma.announcement.findUnique({ where: { id: validated.data.id } });
    if (!existing || !canManageAnnouncement(author, existing)) {
      return { success: false, error: "Announcement not found." };
    }
    if (existing.status === "ARCHIVED") {
      return { success: false, error: "This announcement is already archived." };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const claim = await tx.announcement.updateMany({
        where: { id: existing.id, status: existing.status },
        data: { status: "ARCHIVED", archivedAt: now, archivedById: author.user.id },
      });
      if (claim.count === 0) throw new Error("changed");

      // Its notifications now point at something nobody can open.
      await tx.notification.updateMany({
        where: {
          resourceType: "Announcement",
          resourceId: existing.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { expiresAt: now },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.ARCHIVE,
          entityType: AuditEntityType.ANNOUNCEMENT,
          entityId: existing.id,
          metadata: { title: existing.title, fromStatus: existing.status },
        },
        author.user.id
      );
    });

    revalidateAnnouncementViews(existing.id);
    return { success: true, id: existing.id, message: "Archived." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error && error.message === "changed") {
      return { success: false, error: "This announcement changed while you were working. Reload it." };
    }
    console.error("archiveAnnouncement error:", error);
    return { success: false, error: "Failed to archive the announcement. Please try again." };
  }
}

export type UploadAttachmentResult =
  | { success: true; url: string; name: string }
  | { success: false; error: string };

/** Upload an attachment for an announcement being written. */
export async function uploadAnnouncementFile(
  formData: FormData
): Promise<UploadAttachmentResult> {
  try {
    const author = await authorContext();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Choose a file to attach." };
    }

    const uploaded = await uploadAnnouncementAttachment(file, author.user.id);
    if (!uploaded.success || !uploaded.url) {
      return { success: false, error: uploaded.error ?? "Failed to upload the attachment." };
    }

    return { success: true, url: uploaded.url, name: file.name.slice(0, 200) };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("uploadAnnouncementFile error:", error);
    return { success: false, error: "Failed to upload the attachment. Please try again." };
  }
}
