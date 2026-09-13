import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveApplications } from "@/features/applications/queries/get-drive-applications";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { notFound } from "next/navigation";
import { ApplicationsTableClient } from "./applications-table-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function DriveApplicationsPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  
  const { department } = await requireDepartmentAdmin();

  // Fetch drive summary
  const drive = await prisma.drive.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      departmentId: true,
      companyName: true,
      roleName: true,
      applicationDeadline: true,
    },
  });

  if (!drive) {
    notFound();
  }

  // Verify drive belongs to admin's department
  if (drive.departmentId !== department.id) {
    throw new AuthorizationError("You do not have permission to view applications for this drive");
  }

  const page = parseInt(searchParams.page || "1", 10);
  const { data: applications, totalCount, pageSize } = await getDriveApplications({
    driveId: params.id,
    page,
    pageSize: 25,
  });

  const driveStatus = getDriveStatus(drive.applicationDeadline);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {drive.companyName} — {drive.roleName} Applications
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 13 }}>
          <span className="text-secondary">
            {totalCount} application{totalCount !== 1 ? "s" : ""}
          </span>
          <span className={`badge ${driveStatus === "open" ? "badge-green" : "badge-amber"}`}>
            {driveStatus === "open" ? "Open" : "Closed"}
          </span>
          <span className="text-muted">
            Deadline: {drive.applicationDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      <ApplicationsTableClient
        applications={applications}
        totalCount={totalCount}
        currentPage={page}
        pageSize={pageSize}
        driveId={params.id}
        companyName={drive.companyName}
        roleName={drive.roleName}
      />
    </div>
  );
}
