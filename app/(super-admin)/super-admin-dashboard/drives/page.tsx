import { requireSuperAdmin } from "@/lib/auth";
import { getCentralDrives } from "@/features/drives/queries/get-central-drives";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { CentralDrivesView } from "@/features/drives/components/central-drives-view";

export default async function CampusDrivesPage() {
  await requireSuperAdmin();

  const [centralDrives, departments] = await Promise.all([
    getCentralDrives({ page: 1, pageSize: 100 }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
  ]);

  return (
    <CentralDrivesView
      drives={centralDrives.data}
      departments={departments.data.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
      }))}
    />
  );
}
