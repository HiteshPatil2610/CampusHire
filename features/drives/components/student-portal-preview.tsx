"use client";

import { useState } from "react";
import { getDriveDisplayStatus } from "../utils/drive-status";
import { formatDeadline } from "@/lib/drive-date-helpers";
import { StudentApplicationReviewCard } from "./student-application-preview";
import type { PreviewLogistics } from "./student-application-preview";
import type { StoredApplicationField } from "../utils/application-fields";

type PreviewTab = "card" | "submission";

interface StudentPortalPreviewProps {
  companyName: string;
  roleName: string;
  packageText: string;
  driveDate: Date;
  applicationDeadline: Date;
  minCGPA: number;
  eligibleCodes: string[];
  departmentCode: string;
  logistics: PreviewLogistics;
  selectionRounds: string[];
  fields: StoredApplicationField[];
  onOpenModal: () => void;
}

/**
 * Read-only rendering of what this department's students will see for the
 * drive, so the admin can check a configuration before saving it. Values come
 * from the live form state, not from the database.
 */
export function StudentPortalPreview({
  companyName,
  roleName,
  packageText,
  driveDate,
  applicationDeadline,
  minCGPA,
  eligibleCodes,
  departmentCode,
  logistics,
  selectionRounds,
  fields,
  onOpenModal,
}: StudentPortalPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("card");

  const status = getDriveDisplayStatus(applicationDeadline, driveDate);
  const steps = selectionRounds.length
    ? selectionRounds
    : ["Apply", "Assessment", "Interview", "Offer"];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "var(--surface-1)",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <span
          className="text-secondary"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Student Portal Preview
        </span>
        <strong style={{ fontSize: 13 }}>Live Drive Preview for Students</strong>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setTab("card")}
            className={`btn btn-sm ${tab === "card" ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: 11 }}
          >
            📕 Student Drive Card
          </button>
          <button
            type="button"
            onClick={() => setTab("submission")}
            className={`btn btn-sm ${
              tab === "submission" ? "btn-primary" : "btn-ghost"
            }`}
            style={{ fontSize: 11 }}
          >
            📋 Application Submission Card
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11 }}
          >
            🚀 Test Full Modal
          </button>
        </div>
      </div>

      <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: tab === "card" ? 520 : 640 }}>
          {tab === "card" ? (
            <PreviewDriveCard
              companyName={companyName}
              roleName={roleName}
              packageText={packageText}
              driveDate={driveDate}
              applicationDeadline={applicationDeadline}
              minCGPA={minCGPA}
              eligibleCodes={eligibleCodes}
              venue={logistics.venue}
              steps={steps}
              status={status}
            />
          ) : (
            <StudentApplicationReviewCard
              departmentCode={departmentCode}
              logistics={logistics}
              fields={fields}
              onOpenModal={onOpenModal}
            />
          )}

          <p
            className="text-muted"
            style={{ fontSize: 11, textAlign: "center", marginTop: 14 }}
          >
            {tab === "card"
              ? "This is how your department students see this drive card in their catalog."
              : "This preview shows how locked fields (CGPA, Roll No, Dept) vs editable fields (Name, Contact) are presented to students."}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewDriveCard({
  companyName,
  roleName,
  packageText,
  driveDate,
  applicationDeadline,
  minCGPA,
  eligibleCodes,
  venue,
  steps,
  status,
}: {
  companyName: string;
  roleName: string;
  packageText: string;
  driveDate: Date;
  applicationDeadline: Date;
  minCGPA: number;
  eligibleCodes: string[];
  venue: string;
  steps: string[];
  status: "open" | "upcoming" | "closed";
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "0.5px solid var(--border)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {companyName.slice(0, 4).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>{roleName}</div>
            <span
              className={`badge ${
                status === "open"
                  ? "badge-teal"
                  : status === "upcoming"
                    ? "badge-purple"
                    : "badge-red"
              }`}
              style={{ fontSize: 10 }}
            >
              {status === "open"
                ? "Open"
                : status === "upcoming"
                  ? "Upcoming"
                  : "Closed"}
            </span>
          </div>
          <div
            className="text-secondary"
            style={{ fontSize: 12, marginTop: 3 }}
          >
            {companyName} · <strong>{packageText}</strong>
          </div>
        </div>
      </div>

      <div
        className="text-secondary"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 11,
          marginTop: 14,
        }}
      >
        <span>📅 {formatDeadline(driveDate)}</span>
        <span>🎓 Min CGPA {minCGPA}</span>
        {eligibleCodes.length > 0 && <span>🏢 {eligibleCodes.join(", ")}</span>}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 10,
        }}
      >
        {status === "open" ? (
          <span className="text-secondary" style={{ fontSize: 11 }}>
            📅 Deadline: {formatDeadline(applicationDeadline)}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--red-light)",
              color: "var(--red)",
            }}
          >
            ⚠ Deadline passed
          </span>
        )}
        {venue && (
          <span
            className="text-secondary"
            style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--surface-1)",
              border: "0.5px solid var(--border)",
            }}
          >
            📍 {venue.length > 22 ? `${venue.slice(0, 22)}…` : venue}
          </span>
        )}
      </div>

      {/* Selection stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          marginTop: 20,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={`${step}-${index}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              flex: index === steps.length - 1 ? "0 0 auto" : 1,
            }}
          >
            <div style={{ textAlign: "center", width: 64 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: index === 0 ? "#fff" : "var(--text-secondary)",
                  background:
                    index === 0 ? "var(--accent)" : "var(--surface-1)",
                  border:
                    index === 0
                      ? "none"
                      : "0.5px solid var(--border-strong)",
                  boxShadow:
                    index === 0 ? "0 0 0 3px var(--accent-light)" : "none",
                }}
              >
                {index + 1}
              </div>
              <div
                className="text-secondary"
                style={{ fontSize: 9, marginTop: 6 }}
              >
                {step}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 9,
                  background: "var(--border-strong)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <span
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12, cursor: "default" }}
        >
          Apply Now →
        </span>
      </div>
    </div>
  );
}
