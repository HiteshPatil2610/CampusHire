import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getSuperAdminDriveApplications } from "@/features/applications/queries/get-super-admin-drive-applications";
import { formatDeadline } from "@/lib/drive-date-helpers";
import { SuperAdminApplicationsClient } from "./super-admin-applications-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; dept?: string }>;
}

export default async function SuperAdminDriveApplicationsPage({
  params,
  searchParams,
}: PageProps) {
  await requireSuperAdmin();

  const { id: driveId } = await params;
  const { page: pageParam, dept } = await searchParams;
  const parsedPage = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let result;
  try {
    result = await getSuperAdminDriveApplications(driveId, {
      page,
      pageSize: 50,
      departmentCode: dept || undefined,
    });
  } catch {
    notFound();
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/super-admin-dashboard/drives"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-secondary)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        ← Back to Central Drives
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {result.companyName} — {result.roleName}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-secondary)",
            flexWrap: "wrap",
          }}
        >
          <span>
            {result.totalCount} application{result.totalCount !== 1 ? "s" : ""}
          </span>
          <span>
            Deadline: {formatDeadline(result.applicationDeadline)}
          </span>
          {result.isCentralDrive && (
            <span
              className="badge badge-purple"
              style={{ fontSize: 11 }}
            >
              Central Drive
            </span>
          )}
        </div>
      </div>

      {/* Per-department summary tiles */}
      {result.byDepartment.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {result.byDepartment.map((dept) => (
            <Link
              key={dept.departmentCode}
              href={`/super-admin-dashboard/drives/${driveId}/applications?dept=${encodeURIComponent(dept.departmentCode)}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card"
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  border: "0.5px solid var(--border)",
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
                >
                  {dept.departmentCode}
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {dept.departmentName}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginTop: 4,
                  }}
                >
                  {dept.count}
                </div>
                <div className="text-muted" style={{ fontSize: 10 }}>
                  applicant{dept.count !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SuperAdminApplicationsClient
        driveId={driveId}
        applications={result.applications}
        totalCount={result.totalCount}
        currentPage={page}
        pageSize={50}
        activeDeptFilter={dept || null}
        byDepartment={result.byDepartment}
      />
    </div>
  );
}
