import { requireSuperAdmin } from "@/lib/auth";
import { getCentralDrives } from "@/features/drives/queries/get-central-drives";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { CentralDrivesView } from "@/features/drives/components/central-drives-view";
import { getInstitutionSettings } from "@/features/settings/queries/get-settings";
import { institutionDefaultStages } from "@/features/settings/domain/default-pipeline";
import { toStageDrafts } from "@/features/recruitment/domain/stage-drafts";

export default async function CampusDrivesPage() {
  await requireSuperAdmin();

  const [centralDrives, departments, settings] = await Promise.all([
    getCentralDrives({ page: 1, pageSize: 100 }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
    getInstitutionSettings(),
  ]);

  return (
    <CentralDrivesView
      drives={centralDrives.data}
      departments={departments.data.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
      }))}
      driveDefaults={{
        minCGPA: settings.defaultMinCGPA,
        stages: toStageDrafts(institutionDefaultStages(settings.defaultPipelineStages)),
      }}
    />
  );
}
