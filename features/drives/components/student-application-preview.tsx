"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildPreviewReviewRows } from "../utils/preview-review-rows";
import type { PreviewReviewRow } from "../utils/preview-review-rows";
import type { StoredApplicationField } from "../utils/application-fields";

export interface PreviewLogistics {
  venue: string;
  reportingTime: string;
  coordinatorName: string;
  coordinatorPhone: string;
  specialInstructions: string;
}

export interface StudentApplicationPreviewProps {
  companyName: string;
  roleName: string;
  packageText: string;
  driveDate: Date;
  applicationDeadline: Date;
  departmentCode: string;
  logistics: PreviewLogistics;
  fields: StoredApplicationField[];
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function SectionLabel({
  icon,
  title,
  note,
  tone,
}: {
  icon: string;
  title: string;
  note: string;
  tone: "locked" | "editable";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color:
            tone === "locked" ? "var(--text-secondary)" : "var(--accent-dark)",
        }}
      >
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <span
        className={tone === "locked" ? "text-muted" : ""}
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: tone === "editable" ? "3px 8px" : 0,
          borderRadius: 999,
          background: tone === "editable" ? "var(--teal-light)" : "transparent",
          color: tone === "editable" ? "var(--teal)" : undefined,
        }}
      >
        {note}
      </span>
    </div>
  );
}

/** Teal strip restating the venue and coordinator the admin configured. */
export function DepartmentLogisticsBox({
  logistics,
  layout,
}: {
  logistics: PreviewLogistics;
  layout: "grid" | "inline";
}) {
  const { venue, reportingTime, coordinatorName, coordinatorPhone } = logistics;

  if (!venue && !reportingTime && !coordinatorName && !coordinatorPhone) {
    return (
      <div
        className="text-muted"
        style={{
          fontSize: 11,
          padding: "10px 12px",
          borderRadius: 10,
          border: "0.5px dashed var(--border-strong)",
        }}
      >
        No department logistics configured yet — students will see nothing here.
      </div>
    );
  }

  const entries = [
    ["📍", "Venue", venue],
    ["⏰", layout === "grid" ? "Reporting" : "Time", reportingTime],
    ["👤", "Coordinator", coordinatorName],
    ["📞", "Phone", coordinatorPhone],
  ].filter(([, , value]) => Boolean(value)) as [string, string, string][];

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--teal)",
        background: "var(--teal-light)",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--teal)",
          marginBottom: 8,
        }}
      >
        🏢 Department Logistics{" "}
        {layout === "grid"
          ? "Configured by Admin:"
          : "& Instructions (Configured by Admin):"}
      </div>

      <div
        style={
          layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "6px 16px",
              }
            : {
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 18px",
              }
        }
      >
        {entries.map(([icon, label, value]) => (
          <div key={label} style={{ fontSize: 12 }}>
            <span>{icon} </span>
            <strong>{label}:</strong> {value}
          </div>
        ))}
      </div>

      {logistics.specialInstructions && layout === "grid" && (
        <div
          style={{
            fontSize: 12,
            marginTop: 10,
            paddingTop: 8,
            borderTop: "0.5px solid var(--teal)",
          }}
        >
          <strong>Instructions:</strong> {logistics.specialInstructions}
        </div>
      )}
    </div>
  );
}

/** Registrar-owned values, rendered as read-only tiles. */
function LockedRecords({
  rows,
  columns,
}: {
  rows: PreviewReviewRow[];
  columns: number;
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <SectionLabel
        icon="🔒"
        title={
          columns === 2
            ? "Locked Institutional Records (Students Cannot Modify)"
            : "Locked Records (Verified Institutional Data — Cannot Be Modified)"
        }
        note="Verified by Registrar"
        tone="locked"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 10,
        }}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <div className="text-muted" style={{ fontSize: 10 }}>
              {row.label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
              {row.value} 🔒
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Auto-filled rows the student may correct, each with its edit affordance. */
function EditableRecords({
  rows,
  readOnlyRows,
  actionLabel,
}: {
  rows: PreviewReviewRow[];
  readOnlyRows: PreviewReviewRow[];
  actionLabel: (row: PreviewReviewRow) => string;
}) {
  if (rows.length === 0 && readOnlyRows.length === 0) return null;

  return (
    <div>
      <SectionLabel
        icon="✏️"
        title="Auto-filled Profile Fields (Student Has Rights to Update/Change)"
        note="Rights to Update Enabled"
        tone="editable"
      />
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 12px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="text-muted" style={{ fontSize: 10 }}>
                {row.label} (Auto-filled, Editable)
                {row.required && (
                  <span style={{ color: "var(--accent)" }}> *</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 2,
                  overflowWrap: "anywhere",
                }}
              >
                {row.icon} {row.value}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-dark)",
                whiteSpace: "nowrap",
              }}
            >
              ✏️ {actionLabel(row)}
            </span>
          </div>
        ))}

        {readOnlyRows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 12px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="text-muted" style={{ fontSize: 10 }}>
                {row.label} (Auto-filled)
                {row.required && (
                  <span style={{ color: "var(--accent)" }}> *</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 2,
                  overflowWrap: "anywhere",
                }}
              >
                {row.icon} {row.value}
              </div>
            </div>
            <span className="text-muted" style={{ fontSize: 11 }}>
              Read-only
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Inline "Student Application Review Card" shown on the Application Submission
 * Card preview tab.
 */
export function StudentApplicationReviewCard({
  departmentCode,
  logistics,
  fields,
  onOpenModal,
}: Pick<
  StudentApplicationPreviewProps,
  "departmentCode" | "logistics" | "fields"
> & { onOpenModal: () => void }) {
  const rows = buildPreviewReviewRows(fields, departmentCode);

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "0.5px solid var(--border)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 style={{ fontSize: 15, margin: 0 }}>
            Student Application Review Card
          </h4>
          <p
            className="text-secondary"
            style={{ fontSize: 12, margin: "4px 0 0" }}
          >
            Showing submitted details with locked institutional data and
            editable profile options.
          </p>
        </div>
        <span className="badge badge-teal" style={{ fontSize: 10 }}>
          ✓ Eligible to Apply
        </span>
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <DepartmentLogisticsBox logistics={logistics} layout="inline" />
        <LockedRecords rows={rows.locked} columns={3} />
        <EditableRecords
          rows={rows.editable}
          readOnlyRows={rows.readOnly}
          actionLabel={(row) => `Edit ${row.label}`}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 18,
          paddingTop: 14,
          borderTop: "0.5px solid var(--border)",
        }}
      >
        <span className="text-secondary" style={{ fontSize: 12 }}>
          Student reviews &amp; checks confirmation before final submission.
        </span>
        <button
          type="button"
          onClick={onOpenModal}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12 }}
        >
          Test Student Modal →
        </button>
      </div>
    </div>
  );
}

/**
 * Full-screen admin preview of the student's apply card, opened from "Preview
 * Student View" and the preview tab's modal buttons.
 */
export function StudentApplicationPreviewModal({
  open,
  onOpenChange,
  companyName,
  roleName,
  packageText,
  driveDate,
  applicationDeadline,
  departmentCode,
  logistics,
  fields,
}: StudentApplicationPreviewProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = buildPreviewReviewRows(fields, departmentCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ maxWidth: 620, maxHeight: "88vh", overflowY: "auto" }}
      >
        <DialogHeader>
          <span
            className="badge badge-purple"
            style={{ fontSize: 10, alignSelf: "flex-start" }}
          >
            ADMIN PREVIEW MODE
          </span>
          <DialogTitle style={{ marginTop: 8 }}>
            Student Application Card Preview — {companyName}
          </DialogTitle>
          <p
            className="text-secondary"
            style={{ fontSize: 12, margin: "6px 0 0" }}
          >
            Simulating what students see when clicking &quot;Apply&quot;: locked
            institutional metrics vs auto-filled editable options.
          </p>
        </DialogHeader>

        {/* Drive summary strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "10px 14px",
            borderRadius: 10,
            border: "0.5px solid var(--border)",
            background: "var(--surface-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "0.5px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {companyName.slice(0, 4).toUpperCase()}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {roleName}{" "}
                <span className="text-secondary" style={{ fontWeight: 400 }}>
                  · {companyName} ({packageText})
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                Drive Date: {isoDate(driveDate)} · Deadline:{" "}
                {isoDate(applicationDeadline)}
              </div>
            </div>
          </div>
          <span className="badge badge-teal" style={{ fontSize: 10 }}>
            ✓ Eligible to Apply
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <DepartmentLogisticsBox logistics={logistics} layout="grid" />
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            marginTop: 14,
            maxHeight: 340,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <LockedRecords rows={rows.locked} columns={2} />
          <EditableRecords
            rows={rows.editable}
            readOnlyRows={rows.readOnly}
            actionLabel={(row) => `Student Can Edit ${row.label}`}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 16,
            paddingTop: 14,
            borderTop: "0.5px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            Close Preview
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
