import { requireSuperAdmin } from "@/lib/auth";
import { getDepartments } from "@/features/departments/queries/get-departments";
import {
  getManagedAnnouncements,
  getTargetableBatchYears,
} from "@/features/announcements/queries/get-announcements";
import { AnnouncementManager } from "@/features/announcements/components/announcement-manager";

export const dynamic = "force-dynamic";

/** Institution-wide announcements, and oversight of every department's. */
export default async function SuperAdminAnnouncementsPage() {
  const user = await requireSuperAdmin();

  const [managed, departments, batchYears] = await Promise.all([
    getManagedAnnouncements(user),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
    getTargetableBatchYears(null),
  ]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Announcements</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Write to the whole institution or to one department, and see everything the
          departments have published.
        </p>
      </div>

      <AnnouncementManager
        isSuperAdmin
        departments={departments.data.map((department) => ({
          id: department.id,
          code: department.code,
          name: department.name,
        }))}
        batchYears={batchYears}
        managed={managed}
        basePath="/super-admin-dashboard/announcements"
      />
    </div>
  );
}
