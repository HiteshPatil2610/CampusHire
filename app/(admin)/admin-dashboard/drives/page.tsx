import { requireDepartmentAdmin } from "@/lib/auth";
import { getAdminDrives } from "@/features/drives/actions/get-admin-drives";
import { getCentralDrivesForDepartment } from "@/features/drives/queries/get-central-drives-for-department";
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

  const [{ data: drives, totalCount, pageSize }, centralDrives] =
    await Promise.all([
      getAdminDrives({ status, search, page, pageSize: 25 }),
      getCentralDrivesForDepartment(),
    ]);

  // Compute status for each drive
  const drivesWithStatus = drives.map((drive) => ({
    ...drive,
    isCentralDrive: false as const,
    status: getDriveStatus(drive.applicationDeadline),
  }));

  // Central drives are institution-wide announcements from the Super Admin —
  // expected to be few, so they're shown in full alongside the paginated
  // department list rather than paginated separately. Apply the same
  // status/search filters the department list already used.
  const searchLower = search.toLowerCase();
  const filteredCentralDrives = centralDrives
    .filter((drive) => {
      if (status === "open" && getDriveStatus(drive.applicationDeadline) !== "open") {
        return false;
      }
      if (status === "closed" && getDriveStatus(drive.applicationDeadline) !== "closed") {
        return false;
      }
      if (
        searchLower &&
        !drive.companyName.toLowerCase().includes(searchLower) &&
        !drive.roleName.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
      return true;
    })
    .map((drive) => ({
      ...drive,
      isCentralDrive: true as const,
      status: getDriveStatus(drive.applicationDeadline),
    }));

  const combinedDrives = [...filteredCentralDrives, ...drivesWithStatus];

  return (
    <div>
      <DepartmentScopeBanner
        departmentName={department.name}
        departmentCode={department.code}
        studentCount={0}
        driveCount={totalCount + filteredCentralDrives.length}
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
        drives={combinedDrives}
        totalCount={totalCount}
        currentPage={page}
        pageSize={pageSize}
        currentStatus={status}
        currentSearch={search}
      />
    </div>
  );
}
