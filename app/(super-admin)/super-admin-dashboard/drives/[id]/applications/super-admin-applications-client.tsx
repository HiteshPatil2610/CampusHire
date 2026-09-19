"use client";

import { useRouter } from "next/navigation";
import type { SuperAdminApplicationItem } from "@/features/applications/queries/get-super-admin-drive-applications";
import {
  STAGE_LABELS,
  STATUS_LABELS,
} from "@/features/applications/utils/application-progress";
import { exportToCsv } from "@/lib/csv-export";

const STATUS_BADGE: Record<string, string> = {
  IN_PROGRESS: "badge-purple",
  SELECTED: "badge-green",
  REJECTED: "badge-red",
  WITHDRAWN: "badge-gray",
};

interface SuperAdminApplicationsClientProps {
  driveId: string;
  applications: SuperAdminApplicationItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  activeDeptFilter: string | null;
  byDepartment: { departmentCode: string; departmentName: string; count: number }[];
}

export function SuperAdminApplicationsClient({
  driveId,
  applications,
  totalCount,
  currentPage,
  pageSize,
  activeDeptFilter,
  byDepartment,
}: SuperAdminApplicationsClientProps) {
  const router = useRouter();
  const totalPages = Math.ceil(totalCount / pageSize);

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (activeDeptFilter) params.set("dept", activeDeptFilter);
    router.push(
      `/super-admin-dashboard/drives/${driveId}/applications?${params.toString()}`
    );
  }

  function clearDeptFilter() {
    router.push(`/super-admin-dashboard/drives/${driveId}/applications`);
  }

  function handleExport() {
    exportToCsv(
      `drive_${driveId}_applications_${new Date().toISOString().split("T")[0]}`,
      applications.map((app) => ({
        Name: app.student.name,
        "Roll Number": app.student.rollNumber ?? "",
        Department: app.student.department.code,
        "CGPA (snapshot)": app.snapshotCgpa ?? "N/A",
        "Backlogs (snapshot)": app.snapshotBacklogs ?? "N/A",
        "Applied On": new Date(app.appliedAt).toLocaleDateString("en-IN"),
        Stage: app.currentStage?.name ?? STAGE_LABELS[app.stage],
        Status: STATUS_LABELS[app.status],
      }))
    );
  }

  if (applications.length === 0) {
    return (
      <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {activeDeptFilter
            ? `No applications from ${activeDeptFilter} yet`
            : "No applications yet for this drive"}
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Applications appear here once students apply after their department
          admin publishes the drive.
        </div>
        {activeDeptFilter && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={clearDeptFilter}
          >
            ← Show all departments
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="text-secondary" style={{ fontSize: 13 }}>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </span>
          {activeDeptFilter && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 12,
                background: "var(--accent-light)",
                color: "var(--accent-dark)",
                fontWeight: 500,
              }}
            >
              {activeDeptFilter}
              <button
                type="button"
                onClick={clearDeptFilter}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 12,
                  color: "var(--accent-dark)",
                  lineHeight: 1,
                }}
                aria-label="Clear department filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Department filter pills */}
          {!activeDeptFilter && byDepartment.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {byDepartment.map((dept) => (
                <button
                  key={dept.departmentCode}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    router.push(
                      `/super-admin-dashboard/drives/${driveId}/applications?dept=${encodeURIComponent(dept.departmentCode)}`
                    )
                  }
                >
                  {dept.departmentCode} ({dept.count})
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExport}
          >
            📥 Export this page (CSV)
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Department</th>
              <th>CGPA</th>
              <th>Backlogs</th>
              <th>Applied On</th>
              <th>Stage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const placedElsewhere = app.student.placements.filter(
                (p) => p.applicationId !== app.id
              );
              return (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {app.student.name}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {app.student.rollNumber}
                    </div>
                    {placedElsewhere.length > 0 && (
                      <span
                        className="badge badge-gray"
                        style={{ fontSize: 10, marginTop: 2 }}
                        title={`Placed at ${placedElsewhere.map((p) => p.companyName).join(", ")}`}
                      >
                        Placed elsewhere
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <strong>{app.student.department.code}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {app.student.department.name}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <strong>{app.snapshotCgpa?.toFixed(2) ?? "—"}</strong>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <span className={app.snapshotBacklogs === 0 ? "text-muted" : ""}>
                      {app.snapshotBacklogs ?? "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(app.appliedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {app.currentStage?.name ?? STAGE_LABELS[app.stage]}
                  </td>
                  <td>
                    <span
                      className={`badge ${STATUS_BADGE[app.status] ?? "badge-gray"}`}
                      style={{ fontSize: 11 }}
                    >
                      {STATUS_LABELS[app.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span className="text-secondary" style={{ fontSize: 13 }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
