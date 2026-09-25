"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseJsonArray } from "@/lib/parse-json-array";
import { eligibleDepartmentIdsOf } from "../utils/eligible-departments";
import { getDriveStatus } from "../utils/drive-status";
import { endOfIndiaDay, indiaDay, startOfIndiaDay } from "../domain/drive-window";
import { saveDriveDepartmentConfig } from "../actions/save-drive-department-config";
import { StudentApplicationPreviewModal } from "./student-application-preview";
import {
  PipelineReviewStep,
  PublishStep,
  StudentPreviewStep,
} from "./department-drive-steps";
import {
  DEPARTMENT_DRIVE_STEPS,
  type DepartmentDriveStepId,
} from "../domain/department-drive-readiness";
import type { DepartmentEditableField } from "../domain/drive-lifecycle";
import { ApplicationFormEditor } from "./application-form-editor";
import { BatchTargetingPicker } from "./batch-targeting-picker";
import { EligibleStudentsCard } from "./eligible-students-card";
import { DriveLogisticsCard, type DriveLogisticsField } from "./drive-logistics-card";
import {
  targetedBatchYears,
  withTargetedBatchYears,
} from "../domain/batch-targeting";
import type { DepartmentBatchYear } from "@/features/students/queries/department-batch-years";
import type { ApplicationFieldConfig } from "../domain/application-form";
import type { DepartmentCentralDrive } from "../queries/get-department-central-drives";
import {
  resolveDepartmentDrive,
  overriddenFields,
} from "../domain/resolve-department-drive";
import {
  legacyColumnsFromRules,
  withLegacyRules,
} from "../domain/eligibility-rules";
import {
  EligibilityRulesEditor,
  fromDrafts,
  toDrafts,
  type RuleDraft,
} from "./eligibility-rules-editor";

import { formatPackage } from "../utils/format-package";
interface DepartmentDriveConfigPanelProps {
  drive: DepartmentCentralDrive;
  departmentCodesById: Record<string, string>;
  departmentCode: string;
  /** Batch years this department's students have. */
  batchYears: DepartmentBatchYear[];
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
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
};

/**
 * A stored instant as the India day it falls on — the `YYYY-MM-DD` a native
 * date input expects, or "" for none. The same conversion every drive form
 * uses (`indiaDay`); `toISOString()` put a next stage date stored as 00:00 in
 * India on the previous day.
 */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : indiaDay(date);
}

/** "Java, SQL" → ["Java", "SQL"]; blank → null, which means inherit. */
function splitList(value: string): string[] | null {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function listToJson(value: string): string | null {
  const items = splitList(value);
  return items ? JSON.stringify(items) : null;
}

/**
 * One overridable field: the master's value, this department's input, and an
 * explicit Inherited / Overridden marker, so an admin never has to guess which
 * value their students are seeing.
 */
function OverrideRow({
  label,
  hint,
  masterValue,
  isOverridden,
  locked,
  onReset,
  children,
  lockedByMaster = false,
}: {
  label: string;
  hint?: string;
  masterValue: string;
  isOverridden: boolean;
  locked: boolean;
  onReset: () => void;
  children: React.ReactNode;
  /** The Super Admin did not open this field to departments. */
  lockedByMaster?: boolean;
}) {
  if (lockedByMaster) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
          <span className="badge badge-gray" style={{ fontSize: 9 }}>
            🔒 Set by the Super Admin
          </span>
        </div>
        <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{masterValue}</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
        <span
          className={`badge ${isOverridden ? "badge-purple" : "badge-gray"}`}
          style={{ fontSize: 9 }}
        >
          {isOverridden ? "Overridden" : "Inherited"}
        </span>
        {isOverridden && !locked && (
          <button
            type="button"
            onClick={onReset}
            style={{
              fontSize: 11,
              border: "none",
              background: "none",
              color: "var(--accent)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Reset to master
          </button>
        )}
      </div>
      {children}
      <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        Master: {masterValue}
        {hint ? ` · ${hint}` : ""}
      </div>
    </div>
  );
}

export function DepartmentDriveConfigPanel({
  drive,
  departmentCodesById,
  departmentCode,
  batchYears,
}: DepartmentDriveConfigPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Where the admin left off: the first incomplete step of the saved
  // configuration, as the server computed it.
  const [step, setStep] = useState<DepartmentDriveStepId>(
    drive.readiness.published ? "details" : drive.readiness.resumeAt
  );
  const editable = new Set<DepartmentEditableField>(drive.editableFields);
  const inactive = drive.config?.status === "CANCELLED" || drive.config?.status === "ARCHIVED";

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
  const LOGISTICS_SETTERS: Record<DriveLogisticsField, (value: string) => void> = {
    venue: setVenue,
    reportingTime: setReportingTime,
    seatingAllocation: setSeatingAllocation,
    coordinatorName: setCoordinatorName,
    coordinatorPhone: setCoordinatorPhone,
    coordinatorEmail: setCoordinatorEmail,
    pptLink: setPptLink,
    specialInstructions: setSpecialInstructions,
  };
  // An instance with no form of its own inherits the master's — show what its
  // students actually see today (resolved on the server), not a blank.
  const [fields, setFields] = useState<ApplicationFieldConfig[]>(
    () => drive.applicationForm
  );

  // This department's overrides of the master's content. An empty value means
  // "inherit from the master" and is sent as null. Once published they are
  // locked on the server; the inputs are disabled only for clarity.
  const locked = Boolean(config?.lockedAt);
  const [roleOverride, setRoleOverride] = useState(config?.roleName ?? "");
  const [jdOverride, setJdOverride] = useState(config?.jobDescriptionText ?? "");
  const [requirementsOverride, setRequirementsOverride] = useState(
    config?.requirements ?? ""
  );
  const [skillsOverride, setSkillsOverride] = useState(
    parseJsonArray(config?.skills ?? null).join(", ")
  );
  const [nextStageDateOverride, setNextStageDateOverride] = useState(
    toDateInput(config?.nextStageDate ?? null)
  );
  const [deadlineOverride, setDeadlineOverride] = useState(
    toDateInput(config?.applicationDeadline ?? null)
  );
  const [roundsOverride, setRoundsOverride] = useState(
    parseJsonArray(config?.selectionRounds ?? null).join(", ")
  );
  // Eligibility: the master's defaults (with the legacy columns folded in, so
  // a drive that predates the rule table still shows its real bar), and this
  // department's own rules as editable drafts.
  const masterRules = useMemo(
    () =>
      withLegacyRules(drive.eligibilityRules, {
        minCGPA: drive.minCGPA,
        maxActiveBacklogs: drive.maxActiveBacklogs,
      }),
    [drive]
  );
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>(() =>
    toDrafts(
      config
        ? withLegacyRules(config.eligibilityRules, {
            minCGPA: config.minCGPA,
            maxActiveBacklogs: config.maxActiveBacklogs,
          })
        : []
    )
  );
  const departmentRules = fromDrafts(ruleDrafts);
  // Batch targeting is this department's BATCH_YEAR rule — the picker reads
  // and writes that one rule in the same drafts the rules editor edits.
  const selectedBatches = targetedBatchYears(departmentRules) ?? [];
  const setSelectedBatches = (years: string[]) => {
    const others = ruleDrafts.filter((draft) => draft.ruleType !== "BATCH_YEAR");
    const batchRule = withTargetedBatchYears([], years);
    setRuleDrafts([...others, ...toDrafts(batchRule)]);
    setDirty(true);
    setSaved(false);
  };
  // The CGPA / backlog values this rule set implies, for the header and the
  // student previews, which still show those two figures.
  const ruleMirrors = legacyColumnsFromRules(departmentRules);

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setSaved(false);
    };
  }

  // The unsaved form, as instance columns: blank means inherit (null).
  const draftOverrides = {
    roleName: roleOverride.trim() || null,
    jobDescriptionText: jdOverride.trim() || null,
    requirements: requirementsOverride.trim() || null,
    skills: listToJson(skillsOverride),
    // The instants the server will store for these days (see department-overrides).
    nextStageDate: nextStageDateOverride ? startOfIndiaDay(nextStageDateOverride) : null,
    applicationDeadline: deadlineOverride ? endOfIndiaDay(deadlineOverride) : null,
    selectionRounds: listToJson(roundsOverride),
    minCGPA: ruleMirrors.minCGPA,
    maxActiveBacklogs: ruleMirrors.maxActiveBacklogs,
  };

  // The same resolver the student pages go through, run on the live form — so
  // the preview is exactly what this department's students will see, before
  // it is even saved.
  const preview = resolveDepartmentDrive(
    {
      ...drive,
      nextStageDate: new Date(drive.nextStageDate),
      applicationDeadline: new Date(drive.applicationDeadline),
    },
    {
      ...config,
      ...draftOverrides,
      applicationFields: config?.applicationFields ?? null,
      venue: venue.trim() || null,
      reportingTime: reportingTime.trim() || null,
      coordinatorName: coordinatorName.trim() || null,
      coordinatorPhone: coordinatorPhone.trim() || null,
    }
  );
  const overridden = new Set(overriddenFields(draftOverrides));

  const status = getDriveStatus(preview);
  const eligibleCodes = useMemo(
    () =>
      eligibleDepartmentIdsOf(drive)
        .map((id) => departmentCodesById[id])
        .filter((code): code is string => Boolean(code)),
    [drive, departmentCodesById]
  );

  const packageText = formatPackage(drive);

  // Previews read the live form state, so the admin sees unsaved edits too.
  const previewLogistics = {
    venue: venue.trim(),
    reportingTime: reportingTime.trim(),
    coordinatorName: coordinatorName.trim(),
    coordinatorPhone: coordinatorPhone.trim(),
    specialInstructions: specialInstructions.trim(),
  };

  function handleSave(then?: () => void) {
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
        // Omitted once locked: the published form is frozen, and not sending
        // it keeps logistics-only saves working.
        fields: locked
          ? undefined
          : fields.map((field) => ({
              key: field.fieldKey,
              required: field.isRequired,
              enabled: field.isEnabled,
              permission: field.permission,
              label: field.label,
              description: field.description ?? undefined,
            })),
        // Omitted entirely once locked: the server would refuse any change,
        // and not sending them means a logistics-only save cannot trip it.
        // Only the fields the Super Admin opened to departments; the server
        // refuses any other override whatever is sent.
        overrides: locked
          ? undefined
          : Object.fromEntries(
              Object.entries({
                roleName: draftOverrides.roleName,
                jobDescriptionText: draftOverrides.jobDescriptionText,
                requirements: draftOverrides.requirements,
                skills: splitList(skillsOverride),
                nextStageDate: nextStageDateOverride || null,
                applicationDeadline: deadlineOverride || null,
              }).filter(([field]) => editable.has(field as DepartmentEditableField))
            ),
        // Omitted once locked for the same reason: a published rule set is
        // frozen, and not sending it keeps logistics saves working.
        eligibilityRules: locked ? undefined : departmentRules,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to save configuration");
        return;
      }

      setDirty(false);
      setSaved(true);
      router.refresh();
      then?.();
    });
  }

  const stepIndex = DEPARTMENT_DRIVE_STEPS.findIndex((candidate) => candidate.id === step);
  const nextStep = DEPARTMENT_DRIVE_STEPS[stepIndex + 1]?.id ?? null;
  const stepState = new Map(drive.readiness.steps.map((entry) => [entry.id, entry]));

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
                {preview.roleName} · <strong>{packageText}</strong>
              </div>
            </div>
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
          <MetaCell label="Min CGPA Criteria" value={`≥ ${preview.minCGPA}`} />
          <MetaCell
            label="Max Backlogs"
            value={`≤ ${preview.maxActiveBacklogs} active`}
          />
          <MetaCell
            label="Eligible Depts"
            value={eligibleCodes.join(", ") || "—"}
          />
          <MetaCell
            label="Next Stage Date"
            value={toDateInput(preview.nextStageDate) || "—"}
          />
          <MetaCell
            label="App Deadline"
            value={toDateInput(preview.applicationDeadline) || "—"}
          />
          <MetaCell
            label={`${departmentCode} Applicants`}
            value={`${drive.departmentApplicantCount} applicant${
              drive.departmentApplicantCount === 1 ? "" : "s"
            }`}
          />
        </div>

        {preview.jobDescriptionText && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Job Scope &amp; Description (
              {overridden.has("jobDescriptionText")
                ? `${departmentCode} version`
                : "from Super Admin"}
              ):
            </div>
            <p
              className="text-secondary"
              style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}
            >
              {preview.jobDescriptionText}
            </p>
          </div>
        )}
      </div>

      {/* Steps — the saved configuration's completion, from the server */}
      <nav
        aria-label="Configuration steps"
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      >
        {DEPARTMENT_DRIVE_STEPS.map((entry, index) => {
          const state = stepState.get(entry.id);
          const current = entry.id === step;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStep(entry.id)}
              className={`btn btn-sm ${current ? "btn-primary" : "btn-outline"}`}
              style={{ fontSize: 12 }}
              aria-current={current ? "step" : undefined}
              title={state?.issues.join(" ") || undefined}
            >
              {index + 1}. {entry.label}
              {state?.complete ? " ✓" : state && state.issues.length > 0 ? " ⚠" : ""}
            </button>
          );
        })}
      </nav>

      {step === "details" && (
        <>
          {/* This department's version of the offer */}
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <h3 className="section-title" style={{ margin: 0 }}>
                  🎯 {departmentCode} version of this drive
                </h3>
                <p
                  className="text-secondary"
                  style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 720 }}
                >
                  Leave a field blank to inherit the Super Admin&apos;s value. Anything
                  you set here applies to {departmentCode} students only — other
                  departments running this drive are unaffected, and the master
                  drive itself is never changed.
                </p>
              </div>
              <span
                className={`badge ${locked ? "badge-gray" : "badge-purple"}`}
                style={{ fontSize: 10 }}
              >
                {locked
                  ? "🔒 Locked — published"
                  : `${overridden.size} field${overridden.size === 1 ? "" : "s"} overridden`}
              </span>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <OverrideRow
                label="Role / job title"
                masterValue={drive.roleName}
                isOverridden={overridden.has("roleName")}
                lockedByMaster={!editable.has("roleName")}
                locked={locked}
                onReset={() => touch(setRoleOverride)("")}
              >
                <input
                  style={inputStyle}
                  value={roleOverride}
                  placeholder={drive.roleName}
                  disabled={locked}
                  onChange={(e) => touch(setRoleOverride)(e.target.value)}
                />
              </OverrideRow>

              <OverrideRow
                label="Job description"
                masterValue={drive.jobDescriptionText || "—"}
                isOverridden={overridden.has("jobDescriptionText")}
                lockedByMaster={!editable.has("jobDescriptionText")}
                locked={locked}
                onReset={() => touch(setJdOverride)("")}
              >
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  value={jdOverride}
                  placeholder={drive.jobDescriptionText || "No master JD"}
                  disabled={locked}
                  onChange={(e) => touch(setJdOverride)(e.target.value)}
                />
              </OverrideRow>

              <OverrideRow
                label="Requirements"
                masterValue={drive.requirements || "—"}
                isOverridden={overridden.has("requirements")}
                lockedByMaster={!editable.has("requirements")}
                locked={locked}
                onReset={() => touch(setRequirementsOverride)("")}
              >
                <textarea
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                  value={requirementsOverride}
                  placeholder={drive.requirements || "No master requirements"}
                  disabled={locked}
                  onChange={(e) => touch(setRequirementsOverride)(e.target.value)}
                />
              </OverrideRow>

              <OverrideRow
                label="Skills"
                hint="Comma-separated"
                masterValue={parseJsonArray(drive.skills).join(", ") || "—"}
                isOverridden={overridden.has("skills")}
                lockedByMaster={!editable.has("skills")}
                locked={locked}
                onReset={() => touch(setSkillsOverride)("")}
              >
                <input
                  style={inputStyle}
                  value={skillsOverride}
                  placeholder={
                    parseJsonArray(drive.skills).join(", ") || "e.g. Java, SQL"
                  }
                  disabled={locked}
                  onChange={(e) => touch(setSkillsOverride)(e.target.value)}
                />
              </OverrideRow>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14,
                }}
              >
                <OverrideRow
                  label="Next stage date"
                  masterValue={toDateInput(drive.nextStageDate)}
                  isOverridden={overridden.has("nextStageDate")}
                lockedByMaster={!editable.has("nextStageDate")}
                  locked={locked}
                  onReset={() => touch(setNextStageDateOverride)("")}
                >
                  <input
                    type="date"
                    style={inputStyle}
                    value={nextStageDateOverride}
                    disabled={locked}
                    onChange={(e) => touch(setNextStageDateOverride)(e.target.value)}
                  />
                </OverrideRow>

                <OverrideRow
                  label="Application end date"
                  masterValue={toDateInput(drive.applicationDeadline)}
                  isOverridden={overridden.has("applicationDeadline")}
                lockedByMaster={!editable.has("applicationDeadline")}
                  locked={locked}
                  onReset={() => touch(setDeadlineOverride)("")}
                >
                  <input
                    type="date"
                    style={inputStyle}
                    value={deadlineOverride}
                    disabled={locked}
                    onChange={(e) => touch(setDeadlineOverride)(e.target.value)}
                  />
                </OverrideRow>
              </div>

              {/* Selection rounds are the recruitment pipeline now — configured on
                  the drive's Recruitment page, versioned, and changed after
                  publishing only with Super Admin approval. */}
              <div className="text-secondary" style={{ fontSize: 12 }}>
                <strong>Selection rounds:</strong>{" "}
                {parseJsonArray(config?.selectionRounds ?? drive.selectionRounds).join(" → ") || "—"}
                {" · "}
                <a href={`/admin-dashboard/drives/${drive.id}?tab=pipeline`} style={{ color: "var(--accent)" }}>
                  Configure the recruitment pipeline →
                </a>
              </div>
            </div>
          </div>

          {/* Drive Day Logistics — the same card a department uses on its own drives. */}
          <DriveLogisticsCard
            idPrefix="ddc-logistics"
            values={{
              venue,
              reportingTime,
              seatingAllocation,
              coordinatorName,
              coordinatorPhone,
              coordinatorEmail,
              pptLink,
              specialInstructions,
            }}
            onChange={(field, value) => touch(LOGISTICS_SETTERS[field])(value)}
          />

        </>
      )}

      {step === "fields" && (
        <>
          <StudentApplicationPreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            companyName={drive.companyName}
            roleName={preview.roleName}
            packageText={packageText}
            nextStageDate={preview.nextStageDate}
            applicationDeadline={preview.applicationDeadline}
            departmentCode={departmentCode}
            logistics={previewLogistics}
            fields={fields}
          />

          {/* Application form */}
          <div className="card">
            <h3 className="section-title" style={{ margin: 0 }}>
              📋 Student Application Form
            </h3>
            <p
              className="text-secondary"
              style={{ fontSize: 12, margin: "6px 0 14px", maxWidth: 700 }}
            >
              Decide exactly which fields {departmentCode} students see when they
              apply, which they must fill, and which they may edit. Read-only fields
              are taken from the student's verified profile.
              {!drive.applicationFormOrigin.startsWith("DEPARTMENT") &&
                " Until you save, this department uses the drive's default form."}
            </p>
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
              >
                👁 Preview the form
              </button>
            </div>
            <ApplicationFormEditor
              fields={fields}
              onChange={(next) => {
                setFields(next);
                setDirty(true);
                setSaved(false);
              }}
              locked={locked}
              departmentCode={departmentCode}
            />
          </div>

        </>
      )}

      {step === "eligibility" && (
        <>
          {/* Eligibility rules for this department */}
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <h3 className="section-title" style={{ margin: 0 }}>
                  ✅ Eligibility rules
                </h3>
                <p
                  className="text-secondary"
                  style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 720 }}
                >
                  Who among {departmentCode} students can see and apply to this
                  drive. Evaluated server-side against each student&apos;s own
                  records — the same rules decide the drive list, the apply button
                  and the notification.
                </p>
              </div>
              {locked && (
                <span className="badge badge-gray" style={{ fontSize: 10 }}>
                  🔒 Locked — published
                </span>
              )}
            </div>

            <EligibilityRulesEditor
              masterRules={masterRules}
              drafts={ruleDrafts}
              onChange={touch(setRuleDrafts)}
              locked={locked}
              departmentCode={departmentCode}
            />
          </div>

        </>
      )}

      {step === "batches" && (
        <>
          <div className="card">
            <h3 className="section-title" style={{ margin: "0 0 10px" }}>
              🎓 Eligible batches
            </h3>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  🎓 Eligible batches{" "}
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                    Required to publish
                  </span>
                </div>
                <BatchTargetingPicker
                  available={batchYears}
                  selected={selectedBatches}
                  onChange={setSelectedBatches}
                  locked={locked}
                  inherited={targetedBatchYears(masterRules)}
                />
              </div>
      
          </div>

          <EligibleStudentsCard driveId={drive.id} dirty={dirty} />
        </>
      )}

      {step === "pipeline" && (
        <PipelineReviewStep driveId={drive.id} pipeline={drive.pipeline} locked={locked} />
      )}

      {step === "preview" && <StudentPreviewStep driveId={drive.id} dirty={dirty} />}

      {step === "publish" && (
        <PublishStep driveId={drive.id} readiness={drive.readiness} dirty={dirty} />
      )}

      {/* Save draft / continue */}
      {!inactive && step !== "preview" && step !== "publish" && (
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {error
              ? `⛔ ${error}`
              : dirty
                ? "✏️ Unsaved changes"
                : saved
                  ? "✅ Saved as a draft — you can leave and continue later"
                  : "✅ Up to date"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isPending}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12 }}
            >
              {isPending ? "Saving…" : "💾 Save draft"}
            </button>
            {nextStep && (
              <button
                type="button"
                onClick={() => handleSave(() => setStep(nextStep))}
                disabled={isPending}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12 }}
              >
                Save &amp; continue →
              </button>
            )}
          </div>
        </div>
      )}
      {(step === "preview" || step === "publish") && nextStep && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(nextStep)}>
            Continue →
          </button>
        </div>
      )}

    </div>
  );
}
