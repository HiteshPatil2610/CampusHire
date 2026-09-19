"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import { formatDriveDate, formatDeadline } from "@/lib/drive-date-helpers";
import { getDriveStatus } from "../utils/drive-status";
import { CentralDriveDetailPanel } from "./central-drive-detail-panel";
import { PostCentralDriveModal } from "./post-central-drive-modal";
import type { CentralDriveListItem, DriveDeptStatusSummary } from "../queries/get-central-drives";
import { formatPackage } from "../utils/format-package";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface CentralDrivesViewProps {
  drives: CentralDriveListItem[];
  departments: DepartmentOption[];
}

/** Color class for each dept instance status. */
const DEPT_STATUS_BADGE: Record<string, string> = {
  ASSIGNED: "badge-gray",
  CONFIGURED: "badge-purple",
  PUBLISHED: "badge-green",
  CLOSED: "badge-amber",
  ARCHIVED: "badge-gray",
  CANCELLED: "badge-red",
};

/** Short human label for a DepartmentDriveStatus. */
const DEPT_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  CONFIGURED: "Configuring",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

function DeptStatusHierarchy({ summary }: { summary: DriveDeptStatusSummary[] }) {
  if (summary.length === 0) {
    return (
      <span className="text-muted" style={{ fontSize: 11 }}>
        No departments assigned
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {summary.map((dept) => (
        <span key={dept.departmentId} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{dept.departmentCode}</span>
          <span className={`badge ${DEPT_STATUS_BADGE[dept.status] ?? "badge-gray"}`} style={{ fontSize: 9 }}>
            {DEPT_STATUS_LABEL[dept.status] ?? dept.status}
          </span>
        </span>
      ))}
    </div>
  );
}

export function CentralDrivesView({
  drives,
  departments,
}: CentralDrivesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    drives[0]?.id ?? null
  );
  const [search, setSearch] = useState("");

  // Keep the selection valid as the server list refreshes
  useEffect(() => {
    if (drives.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) =>
      current && drives.some((drive) => drive.id === current)
        ? current
        : drives[0].id
    );
  }, [drives]);

  const selectedDrive = drives.find((drive) => drive.id === selectedId) ?? null;

  const visibleDrives = drives.filter((drive) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      drive.companyName.toLowerCase().includes(term) ||
      drive.roleName.toLowerCase().includes(term)
    );
  });

  // Summary counts for the header KPI row
  const totalApps = drives.reduce((sum, d) => sum + d._count.applications, 0);
  const totalPublished = drives.reduce((sum, d) => sum + d.publishedCount, 0);
  const totalAssigned = drives.reduce((sum, d) => sum + d.assignedCount + d.configuredCount, 0);

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Central Drives
          </h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Configure institutional campus placement drives across all
            engineering departments.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >
          + Post Central Drive
        </button>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Master Drives", value: drives.length, tone: "var(--text-primary)" },
          { label: "Dept Drives Published", value: totalPublished, tone: "var(--teal)" },
          { label: "Awaiting Config", value: totalAssigned, tone: "var(--amber)" },
          { label: "Total Applications", value: totalApps, tone: "var(--accent)" },
        ].map(({ label, value, tone }) => (
          <div key={label} className="card" style={{ padding: "12px 16px" }}>
            <div className="text-secondary" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: tone, margin: "4px 0 0" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {drives.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            No central drives yet
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>
            Post a central drive to open it across every active department.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setModalOpen(true)}
          >
            + Post Central Drive
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 340px) 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* ── Master list ── */}
          <div>
            <div style={{ marginBottom: 10 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company or role…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "0.5px solid var(--border-strong)",
                  background: "var(--surface-2)",
                }}
              />
            </div>

            {visibleDrives.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 13, padding: "20px 4px" }}>
                No drives match &ldquo;{search}&rdquo;.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
                {visibleDrives.map((drive) => {
                  const status = getDriveStatus(new Date(drive.applicationDeadline));
                  const isSelected = drive.id === selectedId;
                  const packageText = formatPackage(drive);

                  return (
                    <button
                      type="button"
                      key={drive.id}
                      onClick={() => setSelectedId(drive.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: isSelected ? "var(--accent-light)" : "var(--surface-2)",
                        border: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                      }}
                    >
                      {/* Company + status */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
                          {drive.companyName}
                        </strong>
                        <StatusBadge variant={status === "open" ? "teal" : "gray"}>
                          {status === "open" ? "Open" : "Closed"}
                        </StatusBadge>
                      </div>

                      {/* Role + package */}
                      <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>
                        {drive.roleName}
                        {" · "}
                        <strong style={{ color: "var(--text-primary)" }}>{packageText}</strong>
                      </div>

                      {/* Applications count */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {drive._count.applications} application{drive._count.applications !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {formatDriveDate(new Date(drive.driveDate))}
                        </span>
                      </div>

                      {/* Per-department status hierarchy */}
                      <DeptStatusHierarchy summary={drive.deptStatusSummary} />

                      {/* Master lifecycle badge */}
                      {drive.lifecycleStatus !== "PUBLISHED" && (
                        <div style={{ marginTop: 6 }}>
                          <span
                            className={`badge ${
                              drive.lifecycleStatus === "DRAFT"
                                ? "badge-amber"
                                : drive.lifecycleStatus === "CANCELLED"
                                  ? "badge-red"
                                  : "badge-gray"
                            }`}
                            style={{ fontSize: 9 }}
                          >
                            Master: {drive.lifecycleStatus}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Detail panel ── */}
          {selectedDrive ? (
            <CentralDriveDetailPanel
              drive={selectedDrive}
              departments={departments}
            />
          ) : (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Select a drive from the list to see details.
              </div>
            </div>
          )}
        </div>
      )}

      <PostCentralDriveModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        departments={departments}
        onCreated={(driveId) => setSelectedId(driveId)}
      />
    </div>
  );
}
