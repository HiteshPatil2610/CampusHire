import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DriveForm } from "@/features/drives/components/drive-form/drive-form";
import { getDepartmentBatchYears } from "@/features/students/queries/department-batch-years";
import { getDepartmentSettings } from "@/features/settings/queries/get-settings";

export default async function PostDrivePage() {
  const { department } = await requireDepartmentAdmin();

  const [allDepts, batchYears, settings] = await Promise.all([
    // Shown for context only: a department drive reaches its own department.
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
    getDepartmentBatchYears(department.id),
    // The department's own defaults, prefilled into a drive that does not
    // exist yet. Nothing published is touched.
    getDepartmentSettings(department.id),
  ]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Post New Drive</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Create a new campus placement drive for {department.name} department
        </p>
      </div>

      <DriveForm
        scope={{
          role: "DEPARTMENT_ADMIN",
          department: { id: department.id, name: department.name, code: department.code },
          allDepartments: allDepts,
        }}
        batchYears={batchYears}
        initialValues={{
          minCGPA: "7.0",
          // Every one of these can be typed over before the drive is posted.
          venue: settings.defaultVenue ?? "",
          reportingTime: settings.defaultReportingTime ?? "",
          contactPerson: settings.coordinatorName ?? "",
          contactPhone: settings.coordinatorPhone ?? "",
          coordinatorEmail: settings.coordinatorEmail ?? "",
          specialInstructions: settings.defaultInstructions ?? "",
        }}
        doneHref="/admin-dashboard/drives"
      />
    </div>
  );
}
