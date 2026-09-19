import { requireDepartmentAdmin } from "@/lib/auth";
import { getDepartmentCentralDrives } from "@/features/drives/queries/get-department-central-drives";
import { getDepartmentOwnDrives } from "@/features/drives/queries/get-department-own-drives";
import { DepartmentScopeBanner } from "@/components/shared/department-scope-banner";
import { AdminDrivesView } from "@/features/drives/components/admin-drives-view";

// Every query here is scoped to the signed-in admin's department, so this
// page can never be prerendered - it has no meaning without a session.
export const dynamic = "force-dynamic";

export default async function AdminDrivesPage() {
  const { department } = await requireDepartmentAdmin();

  // Fetch central drives and own drives in parallel.
  const [centralDrivesResult, ownDrivesResult] = await Promise.all([
    getDepartmentCentralDrives(),
    getDepartmentOwnDrives(),
  ]);

  return (
    <div>
      <DepartmentScopeBanner
        departmentName={`${department.name} (${department.code})`}
        departmentCode={department.code}
        studentCount={centralDrivesResult.studentCount}
        driveCount={centralDrivesResult.drives.length + ownDrivesResult.totalCount}
      />

      <AdminDrivesView
        centralDrivesResult={centralDrivesResult}
        ownDrivesResult={ownDrivesResult}
        departmentCode={department.code}
        studentCount={centralDrivesResult.studentCount}
      />
    </div>
  );
}
