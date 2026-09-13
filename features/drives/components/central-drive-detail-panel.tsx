"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import { formatDriveDate, formatDeadline } from "@/lib/drive-date-helpers";
import { parseJsonArray } from "@/lib/parse-json-array";
import { getDriveStatus } from "../utils/drive-status";
import { buildApplicationFieldRows } from "../utils/application-fields";
import { CentralDriveFieldsToggle } from "./central-drive-fields-toggle";
import type { CentralDriveListItem } from "../queries/get-central-drives";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface CentralDriveDetailPanelProps {
  drive: CentralDriveListItem;
  departments: DepartmentOption[];
}

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

export function CentralDriveDetailPanel({
  drive,
  departments,
}: CentralDriveDetailPanelProps) {
  const status = getDriveStatus(new Date(drive.applicationDeadline));

  const eligibleCodes = useMemo(() => {
    const byId = new Map(departments.map((dept) => [dept.id, dept.code]));
    return parseJsonArray(drive.eligibleDepartments)
      .map((id) => byId.get(id))
      .filter((code): code is string => Boolean(code));
  }, [drive.eligibleDepartments, departments]);

  const fieldRows = useMemo(
    () => buildApplicationFieldRows(drive.applicationFields),
    [drive.applicationFields]
  );

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>
              {drive.companyName} — {drive.roleName}
            </h2>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {drive.packageDisplay || `${drive.packageOffered} LPA`} · Min CGPA{" "}
              {drive.minCGPA} · {drive._count.applications} applicant
              {drive._count.applications === 1 ? "" : "s"}
            </div>
            {eligibleCodes.length > 0 && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Eligible: {eligibleCodes.join(", ")}
              </div>
            )}
          </div>
          <StatusBadge variant={status === "open" ? "teal" : "gray"}>
            {status === "open" ? "Open" : "Closed"}
          </StatusBadge>
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

      {/* Key Placement Dates */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          Key Placement Dates
        </h3>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <DetailRow
            label="Drive Date"
            value={formatDriveDate(new Date(drive.driveDate))}
          />
          <DetailRow
            label="Application Deadline"
            value={formatDeadline(new Date(drive.applicationDeadline))}
          />
        </div>
      </div>

      {/* Portals & Online Links */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          Portals &amp; Online Links
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          <LinkRow
            label="Company Career / Registration Portal"
            url={drive.externalApplyUrl}
          />
          <LinkRow label="Pre-Placement Talk Link" url={drive.pptLink} />
        </div>
      </div>

      {/* Venue & Logistics */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          Venue &amp; Logistics
        </h3>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <DetailRow label="Venue" value={drive.venue || "Not provided"} />
          <DetailRow
            label="Reporting Time"
            value={drive.reportingTime || "Not provided"}
          />
          <DetailRow
            label="Contact Person"
            value={drive.contactPerson || "Not provided"}
          />
          <DetailRow
            label="Contact Phone"
            value={drive.contactPhone || "Not provided"}
          />
        </div>
      </div>

      {/* Application Fields Required */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 4 }}>
          Application Fields Required
        </h3>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Choose which profile details students submit when applying to this
          drive.
        </p>
        <CentralDriveFieldsToggle driveId={drive.id} fields={fieldRows} />
      </div>
    </div>
  );
}
