import Link from "next/link";
import type { AnnouncementRow } from "../queries/get-announcements";
import { PRIORITY_PRESENTATION } from "@/features/notifications/utils/notification-priority";
import type { NotificationPriority } from "@prisma/client";
import { batchLabel } from "@/features/students/utils/batch";

/**
 * One announcement in a list. The same card for every role; what differs is
 * the base path of its link, which the page passes in.
 */
export function AnnouncementCard({
  announcement,
  basePath,
}: {
  announcement: AnnouncementRow;
  basePath: string;
}) {
  const presentation = PRIORITY_PRESENTATION[announcement.priority as NotificationPriority];
  const excerpt =
    announcement.content.length > 220
      ? `${announcement.content.slice(0, 217)}…`
      : announcement.content;

  return (
    <Link
      href={`${basePath}/${announcement.id}`}
      className="card"
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderLeft:
          announcement.priority === "URGENT"
            ? "3px solid var(--red)"
            : "3px solid transparent",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className={`badge ${presentation.badgeClass}`}>{presentation.label}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {announcement.departmentCode ?? "Institution-wide"}
          {announcement.batchYears.length > 0 && ` · Batch ${announcement.batchYears.map(batchLabel).join(", ")}`}
          {announcement.audience === "ADMINS" && " · Admins"}
        </span>
        {announcement.status !== "PUBLISHED" && (
          <span className="badge badge-gray">{announcement.status.toLowerCase()}</span>
        )}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>{announcement.title}</h3>
      <p className="text-secondary" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        {excerpt}
      </p>

      <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
        {announcement.authorName}
        {announcement.publishAt && ` · ${new Date(announcement.publishAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })}`}
        {announcement.attachmentName && " · 1 attachment"}
      </div>
    </Link>
  );
}
