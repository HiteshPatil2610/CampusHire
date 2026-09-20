import { requireDepartmentAdmin } from "@/lib/auth";
import {
  getAnnouncementFeed,
  getManagedAnnouncements,
  getTargetableBatchYears,
} from "@/features/announcements/queries/get-announcements";
import { AnnouncementManager } from "@/features/announcements/components/announcement-manager";
import { AnnouncementCard } from "@/features/announcements/components/announcement-card";

// Everything here is scoped to the signed-in admin's department.
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { user, department } = await requireDepartmentAdmin();

  const [managed, batchYears, feed] = await Promise.all([
    getManagedAnnouncements(user),
    getTargetableBatchYears(department.id),
    getAnnouncementFeed(user, { pageSize: 10 }),
  ]);

  // What the placement office sent them, as opposed to what they wrote.
  const received = feed.rows.filter((row) => row.departmentCode === null);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Announcements</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Write to the students of {department.name}. Publishing notifies them; a draft does not.
        </p>
      </div>

      <AnnouncementManager
        isSuperAdmin={false}
        departments={[]}
        batchYears={batchYears}
        departmentName={department.name}
        managed={managed}
        basePath="/admin-dashboard/announcements"
      />

      {received.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 className="section-title">From the placement office</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {received.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                basePath="/admin-dashboard/announcements"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
