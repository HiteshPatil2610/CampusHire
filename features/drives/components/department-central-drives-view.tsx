"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDriveStatus } from "../utils/drive-status";
import { resolveSelectedApplicationFields } from "../utils/application-fields";
import { DepartmentDriveConfigPanel } from "./department-drive-config-panel";
import type { DepartmentCentralDrive } from "../queries/get-department-central-drives";

import { formatPackage } from "../utils/format-package";
type SetupFilter = "all" | "ready" | "pending";

interface DepartmentCentralDrivesViewProps {
  drives: DepartmentCentralDrive[];
  departmentCodesById: Record<string, string>;
  departmentCode: string;
  studentCount: number;
}

/** A drive is "ready" once the department has supplied venue and reporting time. */
function isConfigured(drive: DepartmentCentralDrive): boolean {
  return Boolean(drive.config?.venue && drive.config?.reportingTime);
}

function KpiTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone?: "accent" | "teal" | "amber";
}) {
  const color =
    tone === "teal"
      ? "var(--teal)"
      : tone === "amber"
        ? "var(--amber)"
        : "var(--text-primary)";

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div
        className="text-secondary"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color, margin: "6px 0 4px" }}>
        {value}
      </div>
      <div className="text-muted" style={{ fontSize: 11 }}>
        {caption}
      </div>
    </div>
  );
}

export function DepartmentCentralDrivesView({
  drives,
  departmentCodesById,
  departmentCode,
  studentCount,
}: DepartmentCentralDrivesViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    drives[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SetupFilter>("all");

  // Keep the selection valid as the server list refreshes after a save
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

  const configuredCount = drives.filter(isConfigured).length;
  const totalApplicants = drives.reduce(
    (sum, drive) => sum + drive.departmentApplicantCount,
    0
  );

  const visibleDrives = useMemo(() => {
    const term = search.trim().toLowerCase();

    return drives.filter((drive) => {
      if (filter === "ready" && !isConfigured(drive)) return false;
      if (filter === "pending" && isConfigured(drive)) return false;
      if (!term) return true;
      return (
        drive.companyName.toLowerCase().includes(term) ||
        drive.roleName.toLowerCase().includes(term)
      );
    });
  }, [drives, search, filter]);

  const selectedDrive =
    drives.find((drive) => drive.id === selectedId) ?? null;

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Campus Recruitment Drives
            </h1>
            <span
              className="badge badge-accent"
              style={{ fontSize: 11, whiteSpace: "nowrap" }}
            >
              {departmentCode} Department Admin
            </span>
          </div>
          <p
            className="text-secondary"
            style={{ fontSize: 13, margin: "6px 0 0", maxWidth: 760 }}
          >
            Review drives posted by the Central Placement Cell (Super Admin) for{" "}
            {departmentCode}, configure department venue logistics, and set
            required student application fields.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, cursor: "default" }}
          >
            📕 Super Admin Drives ({drives.length})
          </span>
          <Link
            href="/admin-dashboard/drives/new"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12 }}
          >
            ＋ Post Department Drive
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiTile
          label="Super Admin Drives"
          value={drives.length}
          caption="Central placement drives"
        />
        <KpiTile
          label="Logistics Configured"
          value={configuredCount}
          caption="Ready with venue & instructions"
          tone="teal"
        />
        <KpiTile
          label="Pending Admin Setup"
          value={drives.length - configuredCount}
          caption="Awaiting venue / fields config"
          tone="amber"
        />
        <KpiTile
          label="Student Applicants"
          value={totalApplicants || studentCount}
          caption={
            totalApplicants
              ? "Applications from your department"
              : "Registered department students"
          }
          tone="accent"
        />
      </div>

      {drives.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            No central drives for {departmentCode} yet
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Drives posted by the Central Placement Cell for your department will
            appear here for configuration.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Master list */}
          <div className="card" style={{ padding: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Super Admin Posted Drives
              </h2>
              <span className="text-muted" style={{ fontSize: 11 }}>
                {drives.length} drive{drives.length === 1 ? "" : "s"}
              </span>
            </div>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company or role..."
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                borderRadius: 8,
                border: "0.5px solid var(--border-strong)",
                marginBottom: 10,
              }}
            />

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(
                [
                  ["all", "All"],
                  ["ready", "Ready"],
                  ["pending", "Needs Setup"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`btn btn-sm ${
                    filter === value ? "btn-primary" : "btn-ghost"
                  }`}
                  style={{ fontSize: 11 }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                padding: "6px 0 10px",
                borderBottom: "0.5px solid var(--border)",
                marginBottom: 10,
              }}
            >
              <span className="text-secondary">Department Scope:</span>
              <span style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
                ✓ {departmentCode} Only
              </span>
            </div>

            {visibleDrives.length === 0 ? (
              <div
                className="text-muted"
                style={{ fontSize: 12, padding: "16px 4px" }}
              >
                No drives match this filter.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {visibleDrives.map((drive) => {
                  const status = getDriveStatus(
                    new Date(drive.applicationDeadline)
                  );
                  const selected = drive.id === selectedId;
                  const ready = isConfigured(drive);
                  const fieldCount = resolveSelectedApplicationFields(
                    drive.config?.applicationFields
                  ).length;

                  return (
                    <button
                      key={drive.id}
                      type="button"
                      onClick={() => setSelectedId(drive.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        padding: 12,
                        borderRadius: 10,
                        background: selected
                          ? "var(--accent-light)"
                          : "var(--surface-2)",
                        border: `0.5px solid ${
                          selected ? "var(--accent)" : "var(--border)"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              fontWeight: 700,
                              background: selected
                                ? "var(--accent)"
                                : "var(--surface-1)",
                              color: selected ? "#fff" : "var(--text-secondary)",
                            }}
                          >
                            {drive.companyName.slice(0, 4).toUpperCase()}
                          </span>
                          <strong
                            style={{
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {drive.companyName}
                          </strong>
                        </div>
                        <span
                          className="text-secondary"
                          style={{ fontSize: 11, flexShrink: 0 }}
                        >
                          {status === "open" ? "Open" : "Closed"}
                        </span>
                      </div>

                      <div
                        className="text-muted"
                        style={{
                          fontSize: 11,
                          marginTop: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {drive.roleName} ·{" "}
                        {formatPackage(drive)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <span
                          className={`badge ${ready ? "badge-teal" : "badge-amber"}`}
                          style={{ fontSize: 10 }}
                        >
                          {ready ? "✓ Configured" : "⚠ Needs Setup"}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10 }}>
                          {fieldCount} fields required
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail / configuration panel */}
          {selectedDrive && (
            <DepartmentDriveConfigPanel
              key={selectedDrive.id}
              drive={selectedDrive}
              departmentCodesById={departmentCodesById}
              departmentCode={departmentCode}
            />
          )}
        </div>
      )}
    </div>
  );
}
