"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDriveStatus } from "../utils/drive-status";
import {
  DEPARTMENT_DRIVE_BUCKETS,
  departmentDriveBucket,
  type DepartmentDriveBucket,
} from "../domain/department-drive-bucket";
import { DepartmentDriveConfigPanel } from "./department-drive-config-panel";
import type { DepartmentBatchYear } from "@/features/students/queries/department-batch-years";
import { DepartmentDriveLifecyclePanel } from "./department-drive-lifecycle-panel";
import type { DepartmentCentralDrive } from "../queries/get-department-central-drives";

import { formatPackage } from "../utils/format-package";
type SetupFilter = "all" | DepartmentDriveBucket;

interface DepartmentCentralDrivesViewProps {
  drives: DepartmentCentralDrive[];
  departmentCodesById: Record<string, string>;
  departmentCode: string;
  studentCount: number;
  batchYears: DepartmentBatchYear[];
}

/**
 * A drive is set up once every configuration step is complete (the server's
 * readiness check), or once it has been published.
 */
function isConfigured(drive: DepartmentCentralDrive): boolean {
  return drive.readiness.ready || drive.readiness.published;
}

/** The "My Drives" bucket, from the lifecycle, the server's readiness and the deadline. */
function bucketOf(drive: DepartmentCentralDrive): DepartmentDriveBucket {
  return departmentDriveBucket({
    status: drive.config?.status ?? null,
    ready: drive.readiness.ready,
    deadlineOpen: getDriveStatus(drive.resolved) === "open",
  });
}

/** A short status for the list, from the lifecycle and the saved configuration. */
function setupBadge(drive: DepartmentCentralDrive): { text: string; tone: string } {
  const status = drive.config?.status;
  if (status === "CANCELLED") return { text: "Cancelled", tone: "badge-red" };
  if (status === "ARCHIVED") return { text: "Archived", tone: "badge-gray" };
  if (status === "CLOSED") return { text: "Closed", tone: "badge-gray" };
  if (drive.readiness.published) return { text: "✓ Published", tone: "badge-green" };
  if (drive.readiness.ready) return { text: "✓ Ready to publish", tone: "badge-teal" };
  const done = drive.readiness.steps.filter((step) => step.id !== "publish" && step.complete).length;
  const total = drive.readiness.steps.length - 1;
  return { text: `⚠ ${done}/${total} steps done`, tone: "badge-amber" };
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
      <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', color, margin: "6px 0 4px" }}>
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
  batchYears,
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
  const bucketCounts = new Map<DepartmentDriveBucket, number>();
  for (const drive of drives) {
    const bucket = bucketOf(drive);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }
  const totalApplicants = drives.reduce(
    (sum, drive) => sum + drive.departmentApplicantCount,
    0
  );

  const visibleDrives = useMemo(() => {
    const term = search.trim().toLowerCase();

    return drives.filter((drive) => {
      if (filter !== "all" && bucketOf(drive) !== filter) return false;
      if (!term) return true;
      return (
        drive.companyName.toLowerCase().includes(term) ||
        drive.resolved.roleName.toLowerCase().includes(term)
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
          label="Set Up"
          value={configuredCount}
          caption="Every step complete, or published"
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
                border: "1px solid var(--border-strong)",
                marginBottom: 10,
              }}
            />

            <div
              role="group"
              aria-label="Filter drives"
              style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}
            >
              {[
                { id: "all" as const, label: "All", count: drives.length },
                ...DEPARTMENT_DRIVE_BUCKETS.map((bucket) => ({
                  id: bucket.id,
                  label: bucket.label,
                  count: bucketCounts.get(bucket.id) ?? 0,
                })),
              ]
                // An empty bucket is not offered, except the one in use.
                .filter((chip) => chip.id === "all" || chip.count > 0 || chip.id === filter)
                .map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilter(chip.id)}
                    aria-pressed={filter === chip.id}
                    className={`btn btn-sm ${filter === chip.id ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: 11 }}
                  >
                    {chip.label} ({chip.count})
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
                borderBottom: "1px solid var(--border)",
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
                  // This department's own deadline, which may override the
                  // master's.
                  const status = getDriveStatus(drive.resolved);
                  const selected = drive.id === selectedId;
                  const ready = isConfigured(drive);
                  const fieldCount = drive.applicationForm.filter(
                    (field) => field.isEnabled
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
                        border: `1px solid ${
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
                        {drive.resolved.roleName} ·{" "}
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
                          className={`badge ${setupBadge(drive).tone}`}
                          style={{ fontSize: 10 }}
                        >
                          {setupBadge(drive).text}
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
            // One grid child, so the master-detail layout is unchanged.
            <div style={{ minWidth: 0 }}>
              {/* Every assignment carries an instance (assignment creates it
                  and the backfill covered pre-existing ones); the guard keeps a
                  stray instance-less drive from rendering a meaningless control. */}
              {selectedDrive.config && (
                <DepartmentDriveLifecyclePanel
                  driveId={selectedDrive.id}
                  status={selectedDrive.config.status}
                  publishedAt={selectedDrive.config.publishedAt}
                  cancellationReason={selectedDrive.config.cancellationReason}
                />
              )}
              <DepartmentDriveConfigPanel
                key={selectedDrive.id}
                drive={selectedDrive}
                departmentCodesById={departmentCodesById}
                departmentCode={departmentCode}
                batchYears={batchYears}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
