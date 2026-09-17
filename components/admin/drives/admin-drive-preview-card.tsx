"use client";

import { getDriveStatus, getDaysUntilDeadline } from "@/features/drives/utils/drive-status";
import { formatPackage } from "@/features/drives/utils/format-package";

/**
 * The half-filled form this card previews, not a saved row — so the numbers
 * are what the inputs parsed to (and `NaN` while a field is still empty),
 * rather than the `Decimal`/`Float` a `Drive` from the database would carry.
 */
interface DrivePreviewDraft {
  companyName?: string;
  roleName?: string;
  packageOffered?: number | null;
  packageDisplay?: string | null;
  minCGPA?: number | null;
  driveDate?: Date | string | null;
  applicationDeadline?: Date | string | null;
}

interface AdminDrivePreviewCardProps {
  drive: DrivePreviewDraft;
  venue?: string;
  reportingTime?: string;
  deptCode: string;
}

export function AdminDrivePreviewCard({
  drive,
  venue,
  reportingTime,
  deptCode,
}: AdminDrivePreviewCardProps) {
  if (!drive) return null;

  const deadline = drive.applicationDeadline ? new Date(drive.applicationDeadline) : null;
  const driveStatus = deadline ? getDriveStatus(deadline) : "open";
  const daysLeft = deadline ? Math.floor(getDaysUntilDeadline(deadline)) : null;
  const isDlPassed = driveStatus === "closed";

  const packageDisplay = formatPackage(drive);

  return (
    <div
      className="card"
      style={{
        border: "1.5px solid var(--border-strong)",
        background: "var(--surface-0)",
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {/* Top Banner: Admin Preview Indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              padding: "2px 8px",
              borderRadius: 10,
              background: "var(--purple-light)",
              color: "var(--purple)",
            }}
          >
            Student Portal Preview
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Live Drive Preview for Students
          </span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Student Drive Card Preview */}
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div
            className="drive-card"
            style={{
              background: "var(--surface-2)",
              border: "1.5px solid var(--border)",
              borderRadius: 12,
              boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  className="company-avatar"
                  style={{
                    width: 42,
                    height: 42,
                    fontSize: 12,
                    background: "var(--accent)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    fontWeight: 700,
                  }}
                >
                  {(drive.companyName || "CO").slice(0, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    className="drive-role"
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {drive.roleName || "Role"}
                  </div>
                  <div className="drive-company" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {drive.companyName || "Company"} · <strong>{packageDisplay}</strong>
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: driveStatus === "open" ? "var(--teal-light)" : "var(--amber-light)",
                  color: driveStatus === "open" ? "var(--teal)" : "var(--amber)",
                }}
              >
                {driveStatus === "open" ? "Open" : "Closed"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 12,
                color: "var(--text-secondary)",
                margin: "10px 0",
              }}
            >
              <span>
                📅{" "}
                {drive.driveDate
                  ? new Date(drive.driveDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "TBD"}
              </span>
              <span>🎓 Min CGPA {drive.minCGPA ?? 6.5}</span>
              <span>🏢 {deptCode}</span>
            </div>

            {/* Deadline & Admin Logistics Pills */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {isDlPassed ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--red)",
                    fontWeight: 600,
                  }}
                >
                  ⚠️ Deadline passed
                </span>
              ) : daysLeft !== null && daysLeft <= 5 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--amber)",
                    fontWeight: 600,
                    background: "var(--amber-light)",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  ⏰ {daysLeft}d left to apply
                </span>
              ) : (
                <span className="text-muted" style={{ fontSize: 11 }}>
                  📅 Deadline:{" "}
                  {deadline
                    ? deadline.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "TBD"}
                </span>
              )}

              {venue && (
                <span
                  style={{
                    fontSize: 10,
                    background: "var(--surface-1)",
                    padding: "2px 6px",
                    borderRadius: 6,
                    color: "var(--text-secondary)",
                  }}
                >
                  📍 {venue.slice(0, 24)}
                  {venue.length > 24 ? "..." : ""}
                </span>
              )}
            </div>

            {/* Student Action Row with interactive Apply button */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                Apply Now →
              </button>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 8,
            }}
          >
            This is how your department students see this drive card in their
            catalog.
          </div>
        </div>
      </div>
    </div>
  );
}
