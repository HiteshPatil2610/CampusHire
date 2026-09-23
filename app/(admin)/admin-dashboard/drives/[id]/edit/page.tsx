import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DriveForm } from "@/features/drives/components/drive-form/drive-form";
import { getDepartmentBatchYears } from "@/features/students/queries/department-batch-years";
import { targetedBatchYears } from "@/features/drives/domain/batch-targeting";
import { indiaDay } from "@/features/drives/domain/drive-window";
import { isCentralDrive } from "@/features/drives/domain/drive-kind";
import { parseJsonArray } from "@/lib/parse-json-array";
import type { ApplicationFieldConfig } from "@/components/admin/drives/admin-application-fields-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDrivePage(props: PageProps) {
  const params = await props.params;
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: params.id },
    include: { eligibilityRules: true },
  });

  if (!drive) {
    notFound();
  }

  // A department edits only its own department's drives; a central drive is
  // the Super Admin's. `saveDrive` checks both again on submit.
  if (isCentralDrive(drive) || drive.departmentId !== department.id) {
    throw new AuthorizationError("You do not have permission to edit this drive");
  }

  const [allDepts, batchYears] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
    getDepartmentBatchYears(department.id),
  ]);

  const applicationFields = drive.applicationFields
    ? (JSON.parse(drive.applicationFields) as ApplicationFieldConfig[])
    : [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Edit Drive</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Update {drive.companyName} - {drive.roleName} drive details
        </p>
      </div>

      <DriveForm
        scope={{
          role: "DEPARTMENT_ADMIN",
          department: { id: department.id, name: department.name, code: department.code },
          allDepartments: allDepts,
        }}
        mode={{ kind: "edit", driveId: drive.id }}
        batchYears={batchYears}
        initialValues={{
          companyName: drive.companyName,
          companyLogoUrl: drive.companyLogoUrl,
          roleName: drive.roleName,
          packageOffered: drive.packageOffered.toString(),
          packageDisplay: drive.packageDisplay ?? "",
          jobDescriptionUrl: drive.jobDescriptionUrl ?? "",
          jobDescriptionText: drive.jobDescriptionText ?? "",
          requirements: drive.requirements ?? "",
          skills: parseJsonArray(drive.skills).join(", "),
          minCGPA: String(drive.minCGPA),
          maxActiveBacklogs: String(drive.maxActiveBacklogs),
          batchYears: targetedBatchYears(drive.eligibilityRules) ?? [],
          // Stored instants shown as the India days they fall on.
          applicationStartDate: indiaDay(drive.applicationStartDate),
          applicationDeadline: indiaDay(drive.applicationDeadline),
          nextStageDate: indiaDay(drive.nextStageDate),
          applyMethod: drive.applyMethod,
          externalApplyUrl: drive.externalApplyUrl ?? "",
          pptLink: drive.pptLink ?? "",
          venue: drive.venue ?? "",
          reportingTime: drive.reportingTime ?? "",
          contactPerson: drive.contactPerson ?? "",
          contactPhone: drive.contactPhone ?? "",
          selectionRounds: parseJsonArray(drive.selectionRounds),
        }}
        initialApplicationFields={applicationFields}
        doneHref="/admin-dashboard/drives"
      />
    </div>
  );
}
