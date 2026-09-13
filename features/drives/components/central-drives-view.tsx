"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import { formatDriveDate } from "@/lib/drive-date-helpers";
import { getDriveStatus } from "../utils/drive-status";
import { CentralDriveDetailPanel } from "./central-drive-detail-panel";
import { PostCentralDriveModal } from "./post-central-drive-modal";
import type { CentralDriveListItem } from "../queries/get-central-drives";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface CentralDrivesViewProps {
  drives: CentralDriveListItem[];
  departments: DepartmentOption[];
}

export function CentralDrivesView({
  drives,
  departments,
}: CentralDrivesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    drives[0]?.id ?? null
  );

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

  const selectedDrive =
    drives.find((drive) => drive.id === selectedId) ?? null;

  return (
    <div>
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

      {drives.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            No central drives yet
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Post a central drive to open it across every active department.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Master list */}
          <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
            {drives.map((drive) => {
              const status = getDriveStatus(new Date(drive.applicationDeadline));
              const isSelected = drive.id === selectedId;

              return (
                <button
                  type="button"
                  key={drive.id}
                  onClick={() => setSelectedId(drive.id)}
                  className="card"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 10,
                    cursor: "pointer",
                    borderLeft: `3px solid ${
                      isSelected ? "var(--accent)" : "transparent"
                    }`,
                    background: isSelected
                      ? "var(--accent-light)"
                      : "var(--surface-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{drive.companyName}</strong>
                    <StatusBadge variant={status === "open" ? "teal" : "gray"}>
                      {status === "open" ? "Open" : "Closed"}
                    </StatusBadge>
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: 12, marginTop: 4 }}
                  >
                    {drive.roleName}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: 11, marginTop: 6 }}
                  >
                    {formatDriveDate(new Date(drive.driveDate))} · Min CGPA{" "}
                    {drive.minCGPA}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selectedDrive && (
            <CentralDriveDetailPanel
              drive={selectedDrive}
              departments={departments}
            />
          )}
        </div>
      )}

      <PostCentralDriveModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        eligibleDepartmentIds={departments.map((dept) => dept.id)}
        onCreated={(driveId) => setSelectedId(driveId)}
      />
    </div>
  );
}
