"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseJsonArray } from "@/lib/parse-json-array";
import { eligibleDepartmentIdsOf } from "../utils/eligible-departments";
import { getDriveStatus } from "../utils/drive-status";
import { resolveSelectedApplicationFields } from "../utils/application-fields";
import {
  AVAILABLE_STUDENT_FIELDS,
  FIELD_PRESETS,
} from "../data/application-fields-catalog";
import { saveDriveDepartmentConfig } from "../actions/save-drive-department-config";
import { StudentPortalPreview } from "./student-portal-preview";
import { StudentApplicationPreviewModal } from "./student-application-preview";
import type { StoredApplicationField } from "../utils/application-fields";
import type { DepartmentCentralDrive } from "../queries/get-department-central-drives";

import { formatPackage } from "../utils/format-package";
interface DepartmentDriveConfigPanelProps {
  drive: DepartmentCentralDrive;
  departmentCodesById: Record<string, string>;
  departmentCode: string;
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-secondary"
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>
      {children}
      {hint && (
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  borderRadius: 8,
  border: "0.5px solid var(--border-strong)",
  background: "var(--surface-2)",
};

export function DepartmentDriveConfigPanel({
  drive,
  departmentCodesById,
  departmentCode,
}: DepartmentDriveConfigPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const config = drive.config;
  const [venue, setVenue] = useState(config?.venue ?? "");
  const [reportingTime, setReportingTime] = useState(
    config?.reportingTime ?? ""
  );
  const [coordinatorName, setCoordinatorName] = useState(
    config?.coordinatorName ?? ""
  );
  const [coordinatorPhone, setCoordinatorPhone] = useState(
    config?.coordinatorPhone ?? ""
  );
  const [coordinatorEmail, setCoordinatorEmail] = useState(
    config?.coordinatorEmail ?? ""
  );
  const [seatingAllocation, setSeatingAllocation] = useState(
    config?.seatingAllocation ?? ""
  );
  const [pptLink, setPptLink] = useState(config?.pptLink ?? "");
  const [specialInstructions, setSpecialInstructions] = useState(
    config?.specialInstructions ?? ""
  );
  const [fields, setFields] = useState<StoredApplicationField[]>(() =>
    resolveSelectedApplicationFields(config?.applicationFields)
  );

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setSaved(false);
    };
  }

  const status = getDriveStatus(new Date(drive.applicationDeadline));
  const eligibleCodes = useMemo(
    () =>
      eligibleDepartmentIdsOf(drive)
        .map((id) => departmentCodesById[id])
        .filter((code): code is string => Boolean(code)),
    [drive, departmentCodesById]
  );

  const selectedKeys = useMemo(
    () => new Set(fields.map((field) => field.key)),
    [fields]
  );
  const remainingCatalog = AVAILABLE_STUDENT_FIELDS.filter(
    (entry) => !selectedKeys.has(entry.key)
  );

  const mandatoryCount = fields.filter((field) => field.required).length;
  const logisticsReady = Boolean(venue.trim() && reportingTime.trim());
  const packageText = formatPackage(drive);

  // Previews read the live form state, so the admin sees unsaved edits too.
  const previewLogistics = {
    venue: venue.trim(),
    reportingTime: reportingTime.trim(),
    coordinatorName: coordinatorName.trim(),
    coordinatorPhone: coordinatorPhone.trim(),
    specialInstructions: specialInstructions.trim(),
  };

  function applyPreset(presetKey: string) {
    const preset = FIELD_PRESETS[presetKey];
    if (!preset) return;

    setFields(
      preset.keys
        .map((key) => AVAILABLE_STUDENT_FIELDS.find((e) => e.key === key))
        .filter((entry): entry is (typeof AVAILABLE_STUDENT_FIELDS)[number] =>
          Boolean(entry)
        )
        .map((entry) => ({
          key: entry.key,
          label: entry.label,
          source: entry.source,
          category: entry.category,
          icon: entry.icon,
          description: entry.description,
          required: entry.defaultRequired,
          enabled: true,
        }))
    );
    setDirty(true);
    setSaved(false);
  }

  function addField(key: string) {
    const entry = AVAILABLE_STUDENT_FIELDS.find((item) => item.key === key);
    if (!entry) return;

    setFields((current) => [
      ...current,
      {
        key: entry.key,
        label: entry.label,
        source: entry.source,
        category: entry.category,
        icon: entry.icon,
        description: entry.description,
        required: entry.defaultRequired,
        enabled: true,
      },
    ]);
    setPickerOpen(false);
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await saveDriveDepartmentConfig({
        driveId: drive.id,
        venue,
        reportingTime,
        coordinatorName,
        coordinatorPhone,
        coordinatorEmail,
        seatingAllocation,
        pptLink,
        specialInstructions,
        fields: fields.map((field) => ({
          key: field.key,
          required: field.required,
        })),
      });

      if (!result.success) {
        setError(result.error ?? "Failed to save configuration");
        return;
      }

      setDirty(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Drive header */}
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {drive.companyName.slice(0, 4).toUpperCase()}
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ fontSize: 18, margin: 0 }}>{drive.companyName}</h2>
                <span className="badge badge-purple" style={{ fontSize: 10 }}>
                  Posted by Super Admin
                </span>
                <span
                  className={`badge ${status === "open" ? "badge-teal" : "badge-gray"}`}
                  style={{ fontSize: 10 }}
                >
                  {status === "open" ? "Open" : "Closed"}
                </span>
              </div>
              <div
                className="text-secondary"
                style={{ fontSize: 13, marginTop: 4 }}
              >
                {drive.roleName} · <strong>{packageText}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12 }}
            >
              👁 Preview Student View
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
            >
              {isPending ? "Saving…" : "💾 Save Configuration"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 16,
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 10,
            background: "var(--surface-1)",
          }}
        >
          <MetaCell label="Min CGPA Criteria" value={`≥ ${drive.minCGPA}`} />
          <MetaCell
            label="Max Backlogs"
            value={`≤ ${drive.maxActiveBacklogs} active`}
          />
          <MetaCell
            label="Eligible Depts"
            value={eligibleCodes.join(", ") || "—"}
          />
          <MetaCell
            label="Drive Date"
            value={new Date(drive.driveDate).toISOString().slice(0, 10)}
          />
          <MetaCell
            label="App Deadline"
            value={new Date(drive.applicationDeadline)
              .toISOString()
              .slice(0, 10)}
          />
          <MetaCell
            label={`${departmentCode} Applicants`}
            value={`${drive.departmentApplicantCount} applicant${
              drive.departmentApplicantCount === 1 ? "" : "s"
            }`}
          />
        </div>

        {drive.jobDescriptionText && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Job Scope &amp; Description (from Super Admin):
            </div>
            <p
              className="text-secondary"
              style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}
            >
              {drive.jobDescriptionText}
            </p>
          </div>
        )}
      </div>

      <StudentPortalPreview
        companyName={drive.companyName}
        roleName={drive.roleName}
        packageText={packageText}
        driveDate={new Date(drive.driveDate)}
        applicationDeadline={new Date(drive.applicationDeadline)}
        minCGPA={drive.minCGPA}
        eligibleCodes={eligibleCodes}
        departmentCode={departmentCode}
        logistics={previewLogistics}
        selectionRounds={parseJsonArray(drive.selectionRounds)}
        fields={fields}
        onOpenModal={() => setPreviewOpen(true)}
      />

      <StudentApplicationPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        companyName={drive.companyName}
        roleName={drive.roleName}
        packageText={packageText}
        driveDate={new Date(drive.driveDate)}
        applicationDeadline={new Date(drive.applicationDeadline)}
        departmentCode={departmentCode}
        logistics={previewLogistics}
        fields={fields}
      />

      {/* Logistics form */}
      <div className="card">
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
            <h3 className="section-title" style={{ margin: 0 }}>
              🏢 Department Logistics &amp; Additional Drive Information
            </h3>
            <p
              className="text-secondary"
              style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 720 }}
            >
              Provide offline venue, reporting schedule, faculty coordinator
              helpline, and department-specific student guidelines. Students see
              this information prior to attending the drive.
            </p>
          </div>
          <span
            className={`badge ${logisticsReady ? "badge-teal" : "badge-amber"}`}
            style={{ fontSize: 10 }}
          >
            {logisticsReady ? "✓ Logistics Configured" : "⚠ Logistics Pending"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          <Field
            label="Drive Venue / Lab / Auditorium Location"
            hint="Specific building, hall, or lab where students should gather."
            required
          >
            <input
              type="text"
              value={venue}
              onChange={(e) => touch(setVenue)(e.target.value)}
              placeholder="e.g. Main Auditorium, Block A"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Reporting Time & Schedule"
            hint="Required arrival time for biometric/physical verification."
            required
          >
            <input
              type="text"
              value={reportingTime}
              onChange={(e) => touch(setReportingTime)(e.target.value)}
              placeholder="e.g. 09:00 AM"
              style={inputStyle}
            />
          </Field>

          <Field label="Department Placement Coordinator">
            <input
              type="text"
              value={coordinatorName}
              onChange={(e) => touch(setCoordinatorName)(e.target.value)}
              placeholder="e.g. Prof. S. R. Deshmukh"
              style={inputStyle}
            />
          </Field>

          <Field label="Coordinator Contact Helpline (Phone)">
            <input
              type="tel"
              value={coordinatorPhone}
              onChange={(e) => touch(setCoordinatorPhone)(e.target.value)}
              placeholder="e.g. 98000 12345"
              style={inputStyle}
            />
          </Field>

          <Field label="Coordinator Official Email">
            <input
              type="email"
              value={coordinatorEmail}
              onChange={(e) => touch(setCoordinatorEmail)(e.target.value)}
              placeholder="e.g. cse.placement@college.edu"
              style={inputStyle}
            />
          </Field>

          <Field label="Seating & Lab Allocation Breakdown">
            <input
              type="text"
              value={seatingAllocation}
              onChange={(e) => touch(setSeatingAllocation)(e.target.value)}
              placeholder="e.g. Hall B-201 (Roll CS001–CS075), Lab 3 (CS076+)"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Pre-Placement Talk (PPT) / Online Meeting Link (if applicable)">
            <div style={{ display: "flex" }}>
              <span
                className="text-muted"
                style={{
                  fontSize: 12,
                  padding: "9px 12px",
                  border: "0.5px solid var(--border-strong)",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  background: "var(--surface-1)",
                }}
              >
                https://
              </span>
              <input
                type="text"
                value={pptLink}
                onChange={(e) => touch(setPptLink)(e.target.value)}
                placeholder="meet.google.com/xyz-abc-def or teams.microsoft.com/..."
                style={{ ...inputStyle, borderRadius: "0 8px 8px 0" }}
              />
            </div>
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Special Instructions & Student Guidelines">
            <textarea
              value={specialInstructions}
              onChange={(e) => touch(setSpecialInstructions)(e.target.value)}
              rows={3}
              placeholder="e.g. Carry 2 copies of resume and college ID. Formal dress code mandatory."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
      </div>

      {/* Application fields */}
      <div className="card">
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
            <h3 className="section-title" style={{ margin: 0 }}>
              📋 Required Student Application Fields
            </h3>
            <p
              className="text-secondary"
              style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 700 }}
            >
              Choose which fields students must supply to apply for this drive.
              Pre-filled from the student&apos;s completed profile.
            </p>
          </div>
          <span className="badge badge-accent" style={{ fontSize: 10 }}>
            {fields.length} Fields Configured ({mandatoryCount} Mandatory,{" "}
            {fields.length - mandatoryCount} Optional)
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 14px",
            marginTop: 16,
            borderRadius: 8,
            background: "var(--surface-1)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <span style={{ fontSize: 14 }}>💡</span>
          <p className="text-secondary" style={{ fontSize: 12, margin: 0 }}>
            <strong style={{ color: "var(--text-primary)" }}>
              Profile Integration:
            </strong>{" "}
            All selected fields are verified and pre-populated directly from the
            student&apos;s profile records when they click <em>Apply Now</em>.
          </p>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            className="text-secondary"
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Quick Application Presets:
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {Object.entries(FIELD_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11 }}
                title={preset.description}
              >
                ⚡ {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFields([]);
                setDirty(true);
                setSaved(false);
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--accent)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 10,
            border: "0.5px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={remainingCatalog.length === 0}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            ＋ Add Field from Profile Catalog
          </button>
          <span className="text-muted" style={{ fontSize: 11, marginLeft: "auto" }}>
            {remainingCatalog.length} more profile field
            {remainingCatalog.length === 1 ? "" : "s"} available in catalog
          </span>
        </div>

        {pickerOpen && remainingCatalog.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 10,
              border: "0.5px solid var(--border-strong)",
              background: "var(--surface-1)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {remainingCatalog.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => addField(entry.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 14 }}>{entry.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {entry.label}
                  </span>
                  <span
                    className="text-muted"
                    style={{ display: "block", fontSize: 10 }}
                  >
                    {entry.category}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {fields.length === 0 ? (
          <div
            className="text-muted"
            style={{
              fontSize: 12,
              textAlign: "center",
              padding: 28,
              marginTop: 16,
              border: "0.5px dashed var(--border-strong)",
              borderRadius: 10,
            }}
          >
            No fields selected. Apply a preset or add fields from the catalog.
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Field Name &amp; Source</th>
                  <th>Category</th>
                  <th>Requirement Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.key}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{field.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {field.label}
                            {field.required && (
                              <span style={{ color: "var(--accent)" }}> *</span>
                            )}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            Source:{" "}
                            {field.source === "upload"
                              ? "File Upload"
                              : "Student Profile"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>
                        {field.category}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setFields((current) =>
                            current.map((item) =>
                              item.key === field.key
                                ? { ...item, required: !item.required }
                                : item
                            )
                          );
                          setDirty(true);
                          setSaved(false);
                        }}
                        className={`btn btn-sm ${
                          field.required ? "btn-primary" : "btn-outline"
                        }`}
                        style={{ fontSize: 11 }}
                      >
                        {field.required ? "✓ Mandatory (*)" : "○ Optional"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFields((current) =>
                            current.filter((item) => item.key !== field.key)
                          );
                          setDirty(true);
                          setSaved(false);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--accent)",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        ✕ Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>
            {error ? "⛔" : dirty ? "✏️" : "✅"}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {error
                ? error
                : dirty
                  ? "Unsaved changes"
                  : saved
                    ? "Configuration saved"
                    : "Drive configuration is up-to-date"}
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              {fields.length} field{fields.length === 1 ? "" : "s"} configured ·
              Venue: {venue.trim() || "not set"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12 }}
        >
          {isPending ? "Saving…" : "💾 Save All Changes"}
        </button>
      </div>
    </div>
  );
}
