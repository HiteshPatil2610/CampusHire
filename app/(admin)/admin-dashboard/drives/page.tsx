import { requireDepartmentAdmin } from "@/lib/auth";
import { getDepartmentCentralDrives } from "@/features/drives/queries/get-department-central-drives";
import { DepartmentScopeBanner } from "@/components/shared/department-scope-banner";
import { DepartmentCentralDrivesView } from "@/features/drives/components/department-central-drives-view";

export default async function AdminDrivesPage() {
  const { department } = await requireDepartmentAdmin();
  const { drives, departmentCodesById, studentCount } =
    await getDepartmentCentralDrives();

  return (
    <div>
      <DepartmentScopeBanner
        departmentName={`${department.name} (${department.code})`}
        departmentCode={department.code}
        studentCount={studentCount}
        driveCount={drives.length}
      />

      <DepartmentCentralDrivesView
        drives={drives}
        departmentCodesById={departmentCodesById}
        departmentCode={department.code}
        studentCount={studentCount}
      />
    </div>
  );
}
