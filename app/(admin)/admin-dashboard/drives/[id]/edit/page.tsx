import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditDriveForm } from "./edit-drive-form";
import { eligibleDepartmentLinksInclude } from "@/features/drives/utils/eligible-departments";
import { serializePackageOffered } from "@/features/drives/utils/serialize-drive";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDrivePage(props: PageProps) {
  const params = await props.params;
  const { department } = await requireDepartmentAdmin();

  // Fetch the drive
  const drive = await prisma.drive.findUnique({
    where: { id: params.id },
    include: eligibleDepartmentLinksInclude,
  });

  if (!drive) {
    notFound();
  }

  // Verify drive belongs to admin's department
  if (drive.departmentId !== department.id) {
    throw new AuthorizationError("You do not have permission to edit this drive");
  }

  // Fetch all active departments
  const allDepts = await prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { code: "asc" },
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Edit Drive</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Update {drive.companyName} - {drive.roleName} drive details
        </p>
      </div>

      <EditDriveForm
        driveId={drive.id}
        drive={serializePackageOffered(drive)}
        departmentId={department.id}
        departmentCode={department.code}
        allDepartments={allDepts}
      />
    </div>
  );
}
