import Link from "next/link";
import type { NotificationPriority } from "@prisma/client";
import { PRIORITY_PRESENTATION } from "@/features/notifications/utils/notification-priority";
import type { AnnouncementRow } from "../queries/get-announcements";
import { batchLabel } from "@/features/students/utils/batch";

/**
 * One announcement, read in full. The content is plain text and rendered as
 * text — an announcement is written by a person and read by many, so nothing
 * in it is interpreted as markup.
 */
export function AnnouncementDetail({
  announcement,
  backHref,
}: {
  announcement: AnnouncementRow;
  backHref: string;
}) {
  const presentation = PRIORITY_PRESENTATION[announcement.priority as NotificationPriority];
  const when = announcement.publishAt ?? announcement.createdAt;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Link href={backHref} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        ← Back to announcements
      </Link>

      <article className="card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`badge ${presentation.badgeClass}`}>{presentation.label}</span>
          <span className="text-muted" style={{ fontSize: 11 }}>
            {announcement.departmentCode ?? "Institution-wide"}
            {announcement.batchYears.length > 0 && ` · Batch ${announcement.batchYears.map(batchLabel).join(", ")}`}
          </span>
          {announcement.status !== "PUBLISHED" && (
            <span className="badge badge-gray">{announcement.status.toLowerCase()}</span>
          )}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "10px 0 4px" }}>
          {announcement.title}
        </h1>
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>
          {announcement.authorName} ·{" "}
          {new Date(when).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })}
          {announcement.expiresAt &&
            ` · hidden after ${new Date(announcement.expiresAt).toLocaleDateString("en-IN")}`}
        </div>

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {announcement.content}
        </p>

        {announcement.attachmentUrl && announcement.attachmentName && (
          <p style={{ marginTop: 16 }}>
            <a
              href={announcement.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              📎 {announcement.attachmentName}
            </a>
          </p>
        )}
      </article>
    </div>
  );
}
