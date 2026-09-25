"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import { formatNextStageDate, formatDeadline } from "@/lib/drive-date-helpers";
import { eligibleDepartmentIdsOf } from "../utils/eligible-departments";
import { getDriveStatus } from "../utils/drive-status";
import { MasterDriveSettings } from "./master-drive-settings";
import { DriveAssignmentPanel } from "./drive-assignment-panel";
import type { CentralDriveListItem } from "../queries/get-central-drives";
import { getDriveActivity, type DriveActivityItem } from "../queries/get-drive-activity";
import { formatPackage } from "../utils/format-package";
import { parseJsonArray } from "@/lib/parse-json-array";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface CentralDriveDetailPanelProps {
  drive: CentralDriveListItem;
  departments: DepartmentOption[];
}

type DetailTab = "overview" | "departments" | "stages" | "applications" | "activity";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "stages", label: "Recruitment Stages" },
  { id: "applications", label: "Applications" },
  { id: "activity", label: "Activity" },
];

const DEPT_STATUS_BADGE: Record<string, string> = {
  ASSIGNED: "badge-gray",
  CONFIGURED: "badge-purple",
  PUBLISHED: "badge-green",
  CLOSED: "badge-amber",
  ARCHIVED: "badge-gray",
  CANCELLED: "badge-red",
};

const DEPT_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned — not yet configured",
  CONFIGURED: "Configuring — saved as draft",
  PUBLISHED: "Published — live to students",
  CLOSED: "Closed — no new applications",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
        {label}
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--accent-dark)",
          }}
        >
          {url}
          <ExternalLink size={12} />
        </a>
      ) : (
        <div className="text-muted" style={{ fontSize: 13 }}>
          Not provided
        </div>
      )}
    </div>
  );
}

function OverviewTab({ drive, eligibleCodes }: { drive: CentralDriveListItem; eligibleCodes: string[] }) {
  const status = getDriveStatus(drive);
  const packageText = formatPackage(drive);
  const skills = parseJsonArray(drive.skills);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header card */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>
              {drive.companyName} — {drive.roleName}
            </h2>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {packageText} · Min CGPA {drive.minCGPA} · {drive._count.applications} applicant
              {drive._count.applications === 1 ? "" : "s"}
            </div>
            {eligibleCodes.length > 0 && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Eligible departments: {eligibleCodes.join(", ")}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <StatusBadge variant={status === "open" ? "teal" : "gray"}>
              {status === "open" ? "Open" : "Closed"}
            </StatusBadge>
            <span
              className={`badge ${
                drive.lifecycleStatus === "PUBLISHED"
                  ? "badge-green"
                  : drive.lifecycleStatus === "DRAFT"
                    ? "badge-amber"
                    : drive.lifecycleStatus === "CANCELLED"
                      ? "badge-red"
                      : "badge-gray"
              }`}
              style={{ fontSize: 10 }}
            >
              Master: {drive.lifecycleStatus}
            </span>
          </div>
        </div>

        {drive.jobDescriptionText && (
          <p
            style={{
              fontSize: 13,
              marginTop: 12,
              marginBottom: 0,
              whiteSpace: "pre-wrap",
              color: "var(--text-secondary)",
            }}
          >
            {drive.jobDescriptionText}
          </p>
        )}
      </div>

      {/* Key dates */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 12 }}>Key Dates</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <DetailRow label="Next Stage Date" value={formatNextStageDate(new Date(drive.nextStageDate))} />
          <DetailRow label="Application End Date" value={formatDeadline(new Date(drive.applicationDeadline))} />
          <DetailRow label="Min CGPA" value={String(drive.minCGPA)} />
          <DetailRow label="Max Active Backlogs" value={String(drive.maxActiveBacklogs)} />
        </div>
      </div>

      {/* Requirements & skills */}
      {(drive.requirements || skills.length > 0) && (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>Requirements &amp; Skills</h3>
          {drive.requirements && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: "0 0 12px" }}>
              {drive.requirements}
            </p>
          )}
          {skills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skills.map((skill) => (
                <span key={skill} className="badge badge-gray" style={{ fontSize: 11 }}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Portals */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 12 }}>Portals &amp; Links</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <LinkRow label="Company Career / Registration Portal" url={drive.externalApplyUrl} />
          <LinkRow label="Pre-Placement Talk (PPT) Link" url={drive.pptLink} />
          <LinkRow label="Job Description (PDF)" url={drive.jobDescriptionUrl} />
        </div>
      </div>

      {/* Venue defaults */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 12 }}>Venue &amp; Logistics Defaults</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <DetailRow label="Venue" value={drive.venue || "Not provided"} />
          <DetailRow label="Reporting Time" value={drive.reportingTime || "Not provided"} />
          <DetailRow label="Contact Person" value={drive.contactPerson || "Not provided"} />
          <DetailRow label="Contact Phone" value={drive.contactPhone || "Not provided"} />
        </div>
      </div>
    </div>
  );
}

function DepartmentsTab({ drive }: { drive: CentralDriveListItem }) {
  return (
    <div className="card">
      <DriveAssignmentPanel driveId={drive.id} lifecycleStatus={drive.lifecycleStatus} />
    </div>
  );
}

function StagesTab({ drive }: { drive: CentralDriveListItem }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <MasterDriveSettings drive={drive} />
    </div>
  );
}

function ApplicationsTab({ drive }: { drive: CentralDriveListItem }) {
  const { deptStatusSummary, _count } = drive;
  // Any department whose drive was ever live can hold applications.
  const hasApplications = (status: string) =>
    ["PUBLISHED", "CLOSED", "CANCELLED", "ARCHIVED"].includes(status);
  const published = deptStatusSummary.filter((d) => d.status === "PUBLISHED");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Summary */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Application Summary</h3>
          {_count.applications > 0 && (
            <Link
              href={`/super-admin-dashboard/drives/${drive.id}/applications`}
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
            >
              View all applications →
            </Link>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Total Applications", value: _count.applications, tone: "var(--accent)" },
            { label: "Published Depts", value: published.length, tone: "var(--teal)" },
          ].map(({ label, value, tone }) => (
            <div key={label} style={{ padding: "12px 16px", borderRadius: 10, background: "var(--surface-1)" }}>
              <div className="text-secondary" style={{ fontSize: 11, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: tone, margin: "4px 0 0" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-department breakdown */}
      {deptStatusSummary.length > 0 ? (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>Department Breakdown</h3>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Department</th>
                <th>Instance Status</th>
                <th style={{ textAlign: "right" }}>View Applications</th>
              </tr>
            </thead>
            <tbody>
              {deptStatusSummary.map((dept) => (
                <tr key={dept.departmentId}>
                  <td>
                    <strong>{dept.departmentCode}</strong>{" "}
                    <span className="text-muted">{dept.departmentName}</span>
                  </td>
                  <td>
                    <span className={`badge ${DEPT_STATUS_BADGE[dept.status] ?? "badge-gray"}`} style={{ fontSize: 11 }}>
                      {DEPT_STATUS_LABEL[dept.status] ?? dept.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {hasApplications(dept.status) && (
                      <Link
                        href={`/super-admin-dashboard/drives/${drive.id}/applications?dept=${encodeURIComponent(dept.departmentCode)}`}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11 }}
                      >
                        View →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: "32px 20px", textAlign: "center" }}>
          <div className="text-muted" style={{ fontSize: 13 }}>
            No departments assigned yet. Assign departments from the Departments tab.
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ drive }: { drive: CentralDriveListItem }) {
  const [items, setItems] = useState<DriveActivityItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setFailed(false);
    getDriveActivity(drive.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [drive.id]);

  return (
    <div className="card" style={{ padding: "24px 20px" }}>
      <h3 className="section-title" style={{ marginBottom: 8 }}>Activity</h3>
      <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        What has been recorded for this master drive and its department drives, newest first.
      </p>

      {failed && (
        <div style={{ fontSize: 13, color: "var(--red, #c0392b)" }}>Could not load the activity.</div>
      )}
      {!failed && items === null && (
        <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      )}
      {items && items.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>Nothing has been recorded for this drive yet.</div>
      )}
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{ fontSize: 12, padding: "10px 12px", borderRadius: 8, background: "var(--surface-1)", display: "flex", gap: 10 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 5, flexShrink: 0 }} />
              <div>
                <div>{item.summary}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {" · "}
                  {item.actorEmail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted" style={{ fontSize: 11, margin: "16px 0 0" }}>
        The complete trail is in the{" "}
        <Link href="/audit-logs" style={{ color: "var(--accent)" }}>
          audit log
        </Link>
        .
      </p>
    </div>
  );
}

export function CentralDriveDetailPanel({
  drive,
  departments,
}: CentralDriveDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const eligibleCodes = useMemo(() => {
    const byId = new Map(departments.map((dept) => [dept.id, dept.code]));
    return eligibleDepartmentIdsOf(drive)
      .map((id) => byId.get(id))
      .filter((code): code is string => Boolean(code));
  }, [drive, departments]);

  // Automatically show the dept status summary in the tab label
  const publishedCount = drive.deptStatusSummary.filter((d) => d.status === "PUBLISHED").length;
  const totalAssigned = drive.deptStatusSummary.length;

  const tabLabel: Record<DetailTab, string> = {
    overview: "Overview",
    departments: totalAssigned > 0 ? `Departments (${totalAssigned})` : "Departments",
    stages: "Recruitment Stages",
    applications: drive._count.applications > 0 ? `Applications (${drive._count.applications})` : "Applications",
    activity: "Activity",
  };

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Drive detail tabs"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`drive-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            aria-controls="drive-tab-panel"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent)" : "transparent"}`,
              color: activeTab === tab.id ? "var(--accent-dark)" : "var(--text-secondary)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginBottom: -1,
            }}
          >
            {tabLabel[tab.id]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id="drive-tab-panel" aria-labelledby={`drive-tab-${activeTab}`}>
      {activeTab === "overview" && (
        <OverviewTab drive={drive} eligibleCodes={eligibleCodes} />
      )}
      {activeTab === "departments" && (
        <DepartmentsTab drive={drive} />
      )}
      {activeTab === "stages" && (
        <StagesTab drive={drive} />
      )}
      {activeTab === "applications" && (
        <ApplicationsTab drive={drive} />
      )}
      {activeTab === "activity" && (
        <ActivityTab drive={drive} />
      )}
      </div>
    </div>
  );
}
