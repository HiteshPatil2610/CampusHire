import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getAnnouncementFeed } from "@/features/announcements/queries/get-announcements";
import { AnnouncementCard } from "@/features/announcements/components/announcement-card";

export const dynamic = "force-dynamic";

/** Announcements targeted at this student: their department's and the office's. */
export default async function StudentAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let user;
  try {
    ({ user } = await requireStudent());
  } catch {
    redirect("/student-dashboard");
  }

  const params = await searchParams;
  const page = Number(params.page) >= 1 ? Math.floor(Number(params.page)) : 1;
  const feed = await getAnnouncementFeed(user, { page });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Announcements</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          From your department and the placement office.
        </p>
      </div>

      {feed.rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          No announcements yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {feed.rows.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              basePath="/student-dashboard/announcements"
            />
          ))}
        </div>
      )}
    </div>
  );
}
