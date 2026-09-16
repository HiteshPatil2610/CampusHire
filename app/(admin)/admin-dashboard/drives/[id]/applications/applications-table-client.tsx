"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { exportToCsv } from "@/lib/csv-export";
import type { DriveApplicationItem } from "@/features/applications/queries/get-drive-applications";
import {
  STAGE_LABELS,
  STATUS_LABELS,
} from "@/features/applications/utils/application-progress";
import { ApplicationStageControl } from "./application-stage-control";

interface ApplicationsTableClientProps {
  applications: DriveApplicationItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  driveId: string;
  companyName: string;
  roleName: string;
}

export function ApplicationsTableClient({
  applications,
  totalCount,
  currentPage,
  pageSize,
  driveId,
  companyName,
  roleName,
}: ApplicationsTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(totalCount / pageSize);

  function handleExportCSV() {
    const csvData = applications.map((app) => ({
      Name: app.student.name,
      "Roll Number": app.student.rollNumber,
      Department: app.student.department.code,
      "CGPA (at application)": app.snapshotCgpa ?? "N/A",
      "Backlogs (at application)": app.snapshotBacklogs ?? "N/A",
      "Applied Date": new Date(app.appliedAt).toLocaleDateString(),
      Stage: STAGE_LABELS[app.stage],
      Status: STATUS_LABELS[app.status],
    }));

    exportToCsv(
      `${companyName}_${roleName}_applicants_${new Date().toISOString().split("T")[0]}`,
      csvData
    );
  }

  return (
    <div>
      {applications.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
            No applications yet for this drive
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Applications will appear here once students apply.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="text-secondary" style={{ fontSize: 13 }}>
              Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
            <button onClick={handleExportCSV} className="btn btn-outline btn-sm">
              📥 Export CSV
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Department</th>
                  <th>CGPA</th>
                  <th>Backlogs</th>
                  <th>Applied On</th>
                  <th>Selection Progress</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{app.student.name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{app.student.rollNumber}</div>
                    </td>
                    <td>{app.student.department.code}</td>
                    <td>
                      <strong>{app.snapshotCgpa?.toFixed(2) ?? "N/A"}</strong>
                    </td>
                    <td>
                      <span className={app.snapshotBacklogs === 0 ? "text-muted" : ""}>
                        {app.snapshotBacklogs ?? "N/A"}
                      </span>
                    </td>
                    <td>
                      {new Date(app.appliedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <ApplicationStageControl
                        applicationId={app.id}
                        stage={app.stage}
                        status={app.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
              <button
                onClick={() => router.push(`/admin-dashboard/drives/${driveId}/applications?page=${currentPage - 1}`)}
                disabled={currentPage === 1}
                className="btn btn-outline btn-sm"
              >
                ← Previous
              </button>
              <span className="text-secondary" style={{ fontSize: 13 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => router.push(`/admin-dashboard/drives/${driveId}/applications?page=${currentPage + 1}`)}
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
