import { requireSuperAdmin } from "@/lib/auth";
import { getDepartments } from "@/features/departments/queries/get-departments";
import { getInstitutionSettings } from "@/features/settings/queries/get-settings";
import { institutionDefaultStages } from "@/features/settings/domain/default-pipeline";
import { toStageDrafts } from "@/features/recruitment/domain/stage-drafts";
import { getInstitutionBatchYears } from "@/features/students/queries/department-batch-years";
import { DriveForm } from "@/features/drives/components/drive-form/drive-form";

/** Where the Super Admin's unsent drive is kept in the browser. */
const SUPER_ADMIN_DRIVE_DRAFT_KEY = "campushire:drive-form-draft:v2:super-admin";

export default async function SuperAdminPostDrivePage() {
  await requireSuperAdmin();

  const [departments, settings, batchYears] = await Promise.all([
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
    getInstitutionSettings(),
    // Eligible-batch options: the passout years students actually hold.
    getInstitutionBatchYears(),
  ]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Post Drive</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Create a central placement drive for all departments or the ones you choose. Each assigned department
          configures and publishes it for its students.
        </p>
      </div>

      <DriveForm
        scope={{
          role: "SUPER_ADMIN",
          departments: departments.data.map((dept) => ({ id: dept.id, name: dept.name, code: dept.code })),
        }}
        batchYears={batchYears}
        // The institution's defaults for a new drive (Settings → Institution).
        initialValues={{
          minCGPA: settings.defaultMinCGPA !== null ? String(settings.defaultMinCGPA) : "",
          maxActiveBacklogs: settings.defaultMaxBacklogs !== null ? String(settings.defaultMaxBacklogs) : "0",
        }}
        initialStages={toStageDrafts(institutionDefaultStages(settings.defaultPipelineStages))}
        draftKey={SUPER_ADMIN_DRIVE_DRAFT_KEY}
        doneHref="/super-admin-dashboard/drives"
      />
    </div>
  );
}
