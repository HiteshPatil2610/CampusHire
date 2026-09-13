import { requireDepartmentAdmin } from "@/lib/auth";
import { getAdminDrives } from "@/features/drives/actions/get-admin-drives";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { DepartmentScopeBanner } from "@/components/shared/department-scope-banner";
import { DrivesListClient } from "./drives-list-client";

interface PageProps {
  searchParams: Promise<{
    status?: "all" | "open" | "closed";
    search?: string;
    page?: string;
  }>;
}

export default async function AdminDrivesPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const { department } = await requireDepartmentAdmin();

  const status = searchParams.status || "all";
  const search = searchParams.search || "";
  const page = parseInt(searchParams.page || "1", 10);

  const { data: drives, totalCount, pageSize } = await getAdminDrives({
    status,
    search,
    page,
    pageSize: 25,
  });

  // Compute status for each drive
  const drivesWithStatus = drives.map((drive) => ({
    ...drive,
    status: getDriveStatus(drive.applicationDeadline),
  }));

  return (
    <div>
      <DepartmentScopeBanner
        departmentName={department.name}
        departmentCode={department.code}
        studentCount={0}
        driveCount={totalCount}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Campus Recruitment Drives</h1>
          <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Manage placement drives for {department.name} department
          </p>
        </div>
      </div>

      <DrivesListClient
        drives={drivesWithStatus}
        totalCount={totalCount}
        currentPage={page}
        pageSize={pageSize}
        currentStatus={status}
        currentSearch={search}
      />
    </div>
  );
}
