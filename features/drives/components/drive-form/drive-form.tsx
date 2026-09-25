"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import UrlField from "@/components/ui/url-field";
import CompanyLogoField from "@/components/shared/company-logo-field";
import { DriveLogisticsCard } from "../drive-logistics-card";
import {
  AdminApplicationFieldsPanel,
  type ApplicationFieldConfig,
} from "@/components/admin/drives/admin-application-fields-panel";
import { AdminDrivePreviewCard } from "@/components/admin/drives/admin-drive-preview-card";
import {
  PipelineEditor,
  fromStageDrafts,
  toStageDrafts,
  type StageDraft,
} from "@/features/recruitment/components/pipeline-editor";
import type { DepartmentBatchYear } from "@/features/students/queries/department-batch-years";
import { DriveDateFields } from "../drive-date-fields";
import { BatchTargetingPicker } from "../batch-targeting-picker";
import { postDrive, saveDrive } from "../../actions/drive-form-actions";
import {
  DEPARTMENT_EDITABLE_FIELDS,
  DEPARTMENT_EDITABLE_FIELD_LABELS,
} from "../../domain/drive-lifecycle";
import type { DriveFormFieldErrors } from "../../schemas/drive-form";
import {
  EMPTY_DRIVE_FORM_VALUES,
  checkDriveForm,
  type DriveFormExtras,
  type DriveFormValues,
} from "./drive-form-values";
import { readDriveFormDraft, writeDriveFormDraft } from "./drive-form-draft";

/**
 * The one drive-posting form.
 *
 * The Super Admin's Post Drive and a department admin's Post Drive / Edit
 * Drive are this component; only what the role decides differs:
 *
 *                        Super Admin              Department admin
 *   Departments          All, or a selection      own department, locked
 *   Eligible batches     optional                 required
 *   Rounds               recruitment stages       selection rounds
 *   Edit permissions     yes                      —
 *   Logistics, form      each department's own    yes
 *
 * Everything is checked here with the server's own schema and rules
 * (`checkDriveForm`), and again by `postDrive` / `saveDrive`, which also
 * decide the drive's origin from the session — nothing on this form can.
 */

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export type DriveFormScope =
  | { role: "SUPER_ADMIN"; departments: DepartmentOption[] }
  | { role: "DEPARTMENT_ADMIN"; department: DepartmentOption; allDepartments: DepartmentOption[] };

export type DriveFormMode = { kind: "create" } | { kind: "edit"; driveId: string };

interface DriveFormProps {
  scope: DriveFormScope;
  mode?: DriveFormMode;
  /** Batches (passout years) students hold: the department's, or the institution's. */
  batchYears: DepartmentBatchYear[];
  /** Saved defaults for a new drive, or the drive being edited. */
  initialValues?: Partial<DriveFormValues>;
  /** Department drives: the application form to start from. */
  initialApplicationFields?: ApplicationFieldConfig[];
  /** Super Admin: the recruitment stages to start from. */
  initialStages?: StageDraft[];
  /** Keep unsent work in this browser under this key. */
  draftKey?: string;
  /** Where to go after saving, or on Cancel. */
  doneHref: string;
}

/** The fields a department's application form starts with. */
export const DEFAULT_APPLICATION_FIELDS: ApplicationFieldConfig[] = [
  { key: "name", label: "Full Name", source: "profile", category: "Basic Identity", icon: "👤", required: true, enabled: true },
  { key: "rollNo", label: "Roll Number", source: "profile", category: "Basic Identity", icon: "🪪", required: true, enabled: true },
  { key: "email", label: "College Email", source: "profile", category: "Contact Info", icon: "✉️", required: true, enabled: true },
  { key: "phone", label: "Mobile Number", source: "profile", category: "Contact Info", icon: "📞", required: true, enabled: true },
  { key: "cgpa", label: "Current CGPA", source: "profile", category: "Academic Records", icon: "🎓", required: true, enabled: true },
  { key: "backlogs", label: "Active Backlogs", source: "profile", category: "Academic Records", icon: "⚠️", required: true, enabled: true },
  { key: "department", label: "Department", source: "profile", category: "Academic Records", icon: "🏛️", required: true, enabled: true },
];

const DEFAULT_STAGES = () =>
  toStageDrafts([
    { name: "Application", stageType: "APPLICATION" },
    { name: "Offer", stageType: "OFFER" },
  ]);

/** A URL input that stores a full URL but lets the admin type a bare host. */
const withScheme = (value: string) => (value ? (value.startsWith("http") ? value : `https://${value}`) : "");
const withoutScheme = (value: string) => (value || "").replace(/^https?:\/\//i, "");

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }} role="alert">
      {message}
    </p>
  );
}

const checkboxTile = (active: boolean, enabled = true): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: active ? "var(--accent-light)" : "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled || active ? 1 : 0.5,
});

export function DriveForm({
  scope,
  mode = { kind: "create" },
  batchYears,
  initialValues,
  initialApplicationFields,
  initialStages,
  draftKey,
  doneHref,
}: DriveFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const isSuperAdmin = scope.role === "SUPER_ADMIN";

  const [values, setValues] = useState<DriveFormValues>(() => ({
    ...EMPTY_DRIVE_FORM_VALUES,
    ...(isSuperAdmin ? {} : { selectionRounds: ["Aptitude Test", "Technical Interview", "HR Interview"] }),
    ...initialValues,
  }));
  // An edit's start, as stored: left alone it is not re-judged against today.
  const originalStart = useRef(mode.kind === "edit" ? initialValues?.applicationStartDate ?? "" : "");
  const startNotBeforeToday = mode.kind === "create" || values.applicationStartDate !== originalStart.current;

  const [applicationFields, setApplicationFields] = useState<ApplicationFieldConfig[]>(
    () => initialApplicationFields ?? DEFAULT_APPLICATION_FIELDS
  );
  const [stages, setStages] = useState<StageDraft[]>(() => initialStages ?? DEFAULT_STAGES());
  const [roundInput, setRoundInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<DriveFormFieldErrors>({});

  const set = <K extends keyof DriveFormValues>(key: K, value: DriveFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  // ── Draft: restore once, then keep it current while there is content ──
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const restored = useRef(false);
  useEffect(() => {
    if (!draftKey || restored.current) return;
    restored.current = true;
    const draft = readDriveFormDraft(draftKey);
    if (!draft) return;
    setValues(draft.values);
    if (draft.stages) setStages(toStageDrafts(draft.stages as Parameters<typeof toStageDrafts>[0]));
    setDraftSavedAt(new Date(draft.savedAt));
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !restored.current) return;
    const hasContent =
      values.companyName.trim() !== "" || values.roleName.trim() !== "" || values.packageOffered.trim() !== "";
    if (!hasContent) return;
    const savedAt = new Date();
    writeDriveFormDraft(draftKey, {
      values,
      stages: isSuperAdmin ? fromStageDrafts(stages) : undefined,
      savedAt: savedAt.toISOString(),
    });
    setDraftSavedAt(savedAt);
  }, [draftKey, values, stages, isSuperAdmin]);

  function discardDraft() {
    if (!draftKey) return;
    writeDriveFormDraft(draftKey, null);
    setValues({ ...EMPTY_DRIVE_FORM_VALUES, ...initialValues });
    setStages(initialStages ?? DEFAULT_STAGES());
    setDraftSavedAt(null);
    setSubmitted(false);
  }

  // ── Validation: the server's schema and rules, run live after a first submit ──
  const extras: DriveFormExtras = isSuperAdmin
    ? { recruitmentStages: fromStageDrafts(stages) }
    : { applicationFields: applicationFields.length > 0 ? JSON.stringify(applicationFields) : undefined };
  const check = checkDriveForm(values, scope.role, {
    startNotBeforeToday,
    ownDepartmentId: scope.role === "DEPARTMENT_ADMIN" ? scope.department.id : undefined,
    extras,
  });
  const errors: DriveFormFieldErrors = { ...(submitted && !check.ok ? check.fieldErrors : {}), ...serverErrors };
  const errorOf = (field: string) => errors[field] ?? undefined;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!check.ok) {
      toast({ title: "Check the form", description: check.error, variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result =
        mode.kind === "edit" ? await saveDrive(mode.driveId, check.input) : await postDrive(check.input);

      if (!result.success) {
        setServerErrors(result.fieldErrors ?? {});
        toast({ title: "Not saved", description: result.error ?? "Failed to save the drive", variant: "destructive" });
        return;
      }

      if (draftKey) writeDriveFormDraft(draftKey, null);
      toast({
        title: mode.kind === "edit" ? "Drive updated" : isSuperAdmin ? "Drive created" : "Drive posted",
        description:
          mode.kind === "edit"
            ? "The drive's details were updated."
            : isSuperAdmin
              ? "Assigned to its departments. Each configures and publishes it before its students can see it."
              : "Students it is open to will see it in their eligible drives.",
      });
      router.push(doneHref);
      router.refresh();
    });
  }

  function addRound() {
    const round = roundInput.trim();
    if (!round) return;
    set("selectionRounds", [...values.selectionRounds, round]);
    setRoundInput("");
  }

  const previewDeptCode = isSuperAdmin
    ? values.departmentMode === "ALL"
      ? "All departments"
      : scope.departments
          .filter((dept) => values.departmentIds.includes(dept.id))
          .map((dept) => dept.code)
          .join(", ") || "—"
    : scope.department.code;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {draftKey && draftSavedAt && (
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span>
            Draft saved in this browser at{" "}
            {draftSavedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — you can leave and
            continue later.
          </span>
          <button
            type="button"
            onClick={discardDraft}
            disabled={isPending}
            style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: 12 }}
          >
            Discard draft
          </button>
        </div>
      )}

      {/* Section 1: Company & Role Details */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Company & Role Details</h3>

        <div className="field-row">
          <div className="field">
            <label htmlFor="df-company">Company Name *</label>
            <input
              id="df-company"
              value={values.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="e.g. Google, Microsoft, Amazon"
              disabled={isPending}
            />
            <FieldError message={errorOf("companyName")} />
          </div>
          <div className="field">
            <label htmlFor="df-role">Role / Job Title *</label>
            <input
              id="df-role"
              value={values.roleName}
              onChange={(e) => set("roleName", e.target.value)}
              placeholder="e.g. Software Engineer, Data Analyst"
              disabled={isPending}
            />
            <FieldError message={errorOf("roleName")} />
          </div>
        </div>

        <CompanyLogoField
          value={values.companyLogoUrl}
          onChange={(companyLogoUrl) => set("companyLogoUrl", companyLogoUrl)}
          disabled={isPending}
        />

        <div className="field-row">
          <div className="field">
            <label htmlFor="df-package">Package Offered (in LPA) *</label>
            <input
              id="df-package"
              type="number"
              step="0.01"
              min="0"
              max="1000"
              value={values.packageOffered}
              onChange={(e) => set("packageOffered", e.target.value)}
              placeholder="e.g. 12.5"
              disabled={isPending}
            />
            <FieldError message={errorOf("packageOffered")} />
          </div>
          <div className="field">
            <label htmlFor="df-package-display">Package Display (optional)</label>
            <input
              id="df-package-display"
              value={values.packageDisplay}
              onChange={(e) => set("packageDisplay", e.target.value)}
              placeholder="e.g. 12-16 LPA or 12.5 LPA + 2 LPA joining bonus"
              disabled={isPending}
            />
            <FieldError message={errorOf("packageDisplay")} />
          </div>
        </div>

        <div className="field">
          <label>Job Description URL (optional)</label>
          <UrlField
            placeholder="careers.company.com/job-12345"
            value={withoutScheme(values.jobDescriptionUrl)}
            onChange={(value) => set("jobDescriptionUrl", withScheme(value))}
            disabled={isPending}
          />
          <FieldError message={errorOf("jobDescriptionUrl")} />
        </div>

        <div className="field">
          <label htmlFor="df-jd">Job Description &amp; Instructions (optional)</label>
          <textarea
            id="df-jd"
            rows={4}
            value={values.jobDescriptionText}
            onChange={(e) => set("jobDescriptionText", e.target.value)}
            placeholder="Role responsibilities, selection process, documents to carry…"
            disabled={isPending}
          />
          <FieldError message={errorOf("jobDescriptionText")} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="df-requirements">Requirements (optional)</label>
            <textarea
              id="df-requirements"
              rows={3}
              value={values.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              placeholder={isSuperAdmin ? "Default for every department — each can set its own" : "e.g. Strong DSA fundamentals"}
              disabled={isPending}
            />
            <FieldError message={errorOf("requirements")} />
          </div>
          <div className="field">
            <label htmlFor="df-skills">Skills (optional)</label>
            <input
              id="df-skills"
              value={values.skills}
              onChange={(e) => set("skills", e.target.value)}
              placeholder="Comma-separated, e.g. Java, SQL, React"
              disabled={isPending}
            />
            <FieldError message={errorOf("skills")} />
          </div>
        </div>
      </div>

      {/* Section 2: Eligibility Criteria */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Eligibility Criteria</h3>

        <div className="field-row">
          <div className="field">
            <label htmlFor="df-cgpa">Minimum CGPA *</label>
            <input
              id="df-cgpa"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={values.minCGPA}
              onChange={(e) => set("minCGPA", e.target.value)}
              placeholder="e.g. 7.00"
              disabled={isPending}
            />
            <FieldError message={errorOf("minCGPA")} />
          </div>
          <div className="field">
            <label htmlFor="df-backlogs">Max Active Backlogs *</label>
            <input
              id="df-backlogs"
              type="number"
              min="0"
              max="10"
              value={values.maxActiveBacklogs}
              onChange={(e) => set("maxActiveBacklogs", e.target.value)}
              disabled={isPending}
            />
            <FieldError message={errorOf("maxActiveBacklogs")} />
          </div>
        </div>

        <div className="field">
          <label>Eligible Batches {isSuperAdmin ? "(optional)" : "*"}</label>
          <BatchTargetingPicker
            available={batchYears}
            selected={values.batchYears}
            onChange={(years) => set("batchYears", years)}
            locked={isPending}
          />
          {isSuperAdmin && (
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Every assigned department inherits these batches unless it sets its own. A department must have
              batches before it can publish.
            </p>
          )}
          <FieldError message={errorOf("batchYears")} />
        </div>

        <div className="field">
          <label>Eligible Departments {isSuperAdmin ? "(optional)" : "*"}</label>
          {isSuperAdmin ? (
            <>
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="df-department-mode"
                    checked={values.departmentMode === "ALL"}
                    onChange={() => set("departmentMode", "ALL")}
                    disabled={isPending}
                  />
                  <span>All departments</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="df-department-mode"
                    checked={values.departmentMode === "SELECTED"}
                    onChange={() => set("departmentMode", "SELECTED")}
                    disabled={isPending}
                  />
                  <span>Specific departments</span>
                </label>
              </div>
              {values.departmentMode === "SELECTED" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 8 }}>
                  {scope.departments.map((dept) => {
                    const checked = values.departmentIds.includes(dept.id);
                    return (
                      <label key={dept.id} style={checkboxTile(checked)}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPending}
                          onChange={(e) =>
                            set(
                              "departmentIds",
                              e.target.checked
                                ? [...values.departmentIds, dept.id]
                                : values.departmentIds.filter((id) => id !== dept.id)
                            )
                          }
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {dept.code} - {dept.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {values.departmentMode === "ALL"
                  ? `Every active department (${scope.departments.length}) receives this drive to configure and publish for its students.`
                  : "Only the departments you select receive this drive to configure. Others never see it."}
              </p>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 8 }}>
                {scope.allDepartments.map((dept) => {
                  const isOwn = dept.id === scope.department.id;
                  return (
                    <label key={dept.id} style={checkboxTile(isOwn, false)}>
                      <input type="checkbox" checked={isOwn} disabled readOnly />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {dept.code} - {dept.name}
                        {isOwn && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>(your dept)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                A department drive reaches your own department only. To open a drive to several departments, ask the
                Super Admin to post a central drive.
              </p>
            </>
          )}
          <FieldError message={errorOf("departmentScope")} />
        </div>
      </div>

      {/* Section 3: Dates & Application Method */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Dates & Application Method</h3>

        <DriveDateFields
          values={values}
          onChange={(dates) => setValues((current) => ({ ...current, ...dates }))}
          startNotBeforeToday={startNotBeforeToday}
          showMissing={submitted}
          disabled={isPending}
        />

        <div className="field">
          <label>Application Method *</label>
          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="df-apply-method"
                checked={values.applyMethod === "IN_APP"}
                onChange={() => set("applyMethod", "IN_APP")}
                disabled={isPending}
              />
              <span>In-App (Students apply through CampusHire)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="df-apply-method"
                checked={values.applyMethod === "EXTERNAL"}
                onChange={() => set("applyMethod", "EXTERNAL")}
                disabled={isPending}
              />
              <span>External Link (company portal)</span>
            </label>
          </div>
        </div>

        {values.applyMethod === "EXTERNAL" && (
          <div className="field">
            <label>External Application URL *</label>
            <UrlField
              placeholder="apply.company.com/careers"
              value={withoutScheme(values.externalApplyUrl)}
              onChange={(value) => set("externalApplyUrl", withScheme(value))}
              disabled={isPending}
            />
            <FieldError message={errorOf("externalApplyUrl")} />
          </div>
        )}

        {/* A department's PPT link is part of its logistics below. */}
        {isSuperAdmin && (
          <div className="field">
            <label>Pre-Placement Talk (PPT) Link (optional)</label>
            <UrlField
              placeholder="meet.google.com/xyz-abcd"
              value={withoutScheme(values.pptLink)}
              onChange={(value) => set("pptLink", withScheme(value))}
              disabled={isPending}
            />
            <FieldError message={errorOf("pptLink")} />
          </div>
        )}
      </div>

      {/* Section 4: Rounds */}
      {isSuperAdmin ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="section-title">Recruitment Stages</h3>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            The stages every department&apos;s students go through. Departments review them and can only propose
            changes, which you approve.
          </p>
          <PipelineEditor drafts={stages} onChange={setStages} />
          <FieldError message={errorOf("recruitmentStages")} />
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="section-title">Selection Rounds</h3>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            Define the interview/assessment stages for this drive
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={roundInput}
              onChange={(e) => setRoundInput(e.target.value)}
              placeholder="e.g. Group Discussion"
              style={{ flex: 1 }}
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRound();
                }
              }}
            />
            <button type="button" onClick={addRound} className="btn btn-primary btn-sm" disabled={isPending}>
              Add Round
            </button>
          </div>

          {values.selectionRounds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {values.selectionRounds.map((round, index) => (
                <div
                  key={`${index}-${round}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {index + 1}. {round}
                  </span>
                  <button
                    type="button"
                    onClick={() => set("selectionRounds", values.selectionRounds.filter((_, i) => i !== index))}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--red)", padding: "2px 6px" }}
                    disabled={isPending}
                    aria-label={`Remove ${round}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <FieldError message={errorOf("selectionRounds")} />
        </div>
      )}

      {/* Section 5: role-specific configuration */}
      {isSuperAdmin ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="section-title">Department Edit Permissions</h3>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            Choose which details each assigned department may change for its own students. Everything else stays
            exactly as you set it — the server enforces this whatever a department&apos;s form sends. Eligibility,
            batches, the student application form and logistics are always each department&apos;s own.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {DEPARTMENT_EDITABLE_FIELDS.map((field) => {
              const isEditable = values.departmentEditableFields.includes(field);
              return (
                <label
                  key={field}
                  style={{ ...checkboxTile(isEditable), justifyContent: "space-between", fontSize: 13 }}
                >
                  <span>{DEPARTMENT_EDITABLE_FIELD_LABELS[field]}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${isEditable ? "badge-teal" : "badge-gray"}`} style={{ fontSize: 10 }}>
                      {isEditable ? "EDITABLE" : "LOCKED"}
                    </span>
                    <input
                      type="checkbox"
                      checked={isEditable}
                      disabled={isPending}
                      onChange={(e) =>
                        set(
                          "departmentEditableFields",
                          e.target.checked
                            ? [...values.departmentEditableFields, field]
                            : values.departmentEditableFields.filter((entry) => entry !== field)
                        )
                      }
                    />
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError message={errorOf("departmentEditableFields")} />
        </div>
      ) : (
        <>
          <DriveLogisticsCard
            idPrefix="df-logistics"
            disabled={isPending}
            values={{
              venue: values.venue,
              reportingTime: values.reportingTime,
              seatingAllocation: values.seatingAllocation,
              coordinatorName: values.contactPerson,
              coordinatorPhone: values.contactPhone,
              coordinatorEmail: values.coordinatorEmail,
              pptLink: values.pptLink,
              specialInstructions: values.specialInstructions,
            }}
            // The drive's own columns are contactPerson / contactPhone.
            onChange={(field, value) =>
              set(
                field === "coordinatorName" ? "contactPerson" : field === "coordinatorPhone" ? "contactPhone" : field,
                value
              )
            }
            errors={{
              venue: errorOf("venue"),
              reportingTime: errorOf("reportingTime"),
              coordinatorName: errorOf("contactPerson"),
              coordinatorPhone: errorOf("contactPhone"),
              coordinatorEmail: errorOf("coordinatorEmail"),
              seatingAllocation: errorOf("seatingAllocation"),
              pptLink: errorOf("pptLink"),
              specialInstructions: errorOf("specialInstructions"),
            }}
          />

          <AdminApplicationFieldsPanel fields={applicationFields} onChange={setApplicationFields} />
          <FieldError message={errorOf("applicationFields")} />
        </>
      )}

      {/* Preview */}
      <AdminDrivePreviewCard
        drive={{
          companyName: values.companyName || "Company Name",
          roleName: values.roleName || "Role Name",
          packageOffered: Number.parseFloat(values.packageOffered) || 0,
          packageDisplay: values.packageDisplay,
          minCGPA: Number.parseFloat(values.minCGPA),
          applicationStartDate: values.applicationStartDate || null,
          nextStageDate: values.nextStageDate || null,
          applicationDeadline: values.applicationDeadline || null,
        }}
        venue={isSuperAdmin ? undefined : values.venue}
        reportingTime={isSuperAdmin ? undefined : values.reportingTime}
        deptCode={previewDeptCode}
      />

      {errors.form && <FieldError message={errors.form} />}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button type="button" onClick={() => router.push(doneHref)} className="btn btn-outline" disabled={isPending}>
          {draftKey ? "Save & close" : "Cancel"}
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending
            ? mode.kind === "edit"
              ? "Saving…"
              : "Posting…"
            : mode.kind === "edit"
              ? "Save Changes"
              : isSuperAdmin
                ? "Create & Assign Drive"
                : "Post Drive"}
        </button>
      </div>
    </form>
  );
}
