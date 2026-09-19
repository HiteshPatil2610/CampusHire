"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import UrlField from "@/components/ui/url-field";
import CompanyLogoField from "@/components/shared/company-logo-field";
import { createCentralDrive } from "../actions/create-central-drive";
import {
  DEPARTMENT_EDITABLE_FIELDS,
  DEPARTMENT_EDITABLE_FIELD_LABELS,
  normalizeEditableFields,
  type DepartmentEditableField,
} from "../domain/drive-lifecycle";
import {
  PipelineEditor,
  fromStageDrafts,
  toStageDrafts,
  type StageDraft,
} from "@/features/recruitment/components/pipeline-editor";
import { STAGE_TYPE_LABELS, validatePipelineStages } from "@/features/recruitment/domain/pipeline";

interface PostCentralDriveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active departments the drive can be assigned to — none are preselected. */
  departments: { id: string; name: string; code: string }[];
  onCreated: (driveId: string) => void;
}

/**
 * Creating a Master Drive, in the Super Admin's order:
 *
 *   Master details → Admin edit permissions → Recruitment stages → Review
 *   → Department assignment
 *
 * Student application fields are not configured here: each department sets
 * its own. Only the departments selected in the last step receive the drive
 * as work to configure; the rest never see it. Everything is validated again
 * by `createCentralDrive` — this wizard only guides.
 */
const STEPS = [
  "Master details",
  "Admin edit permissions",
  "Recruitment stages",
  "Review",
  "Department assignment",
] as const;

/**
 * The wizard's unsent work, kept in this browser so a Super Admin can leave
 * and continue later. It is a convenience only: nothing is created until the
 * last step, the server re-validates everything, and a missing or unreadable
 * draft just means starting fresh.
 */
const DRAFT_KEY = "campushire:master-drive-draft:v1";

interface StoredDraft {
  form: Omit<typeof EMPTY_FORM, "driveDate" | "applicationDeadline"> & {
    driveDate: string | null;
    applicationDeadline: string | null;
  };
  step: number;
  editable: DepartmentEditableField[];
  stages: ReturnType<typeof fromStageDrafts>;
  selectedDepartments: string[];
  savedAt: string;
}

function readDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: StoredDraft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked or full: the wizard works without a draft.
  }
}

const DEFAULT_STAGES = () =>
  toStageDrafts([
    { name: "Application", stageType: "APPLICATION" },
    { name: "Offer", stageType: "OFFER" },
  ]);

const EMPTY_FORM = {
  companyName: "",
  companyLogoUrl: null as string | null,
  roleName: "",
  packageDisplay: "",
  minCGPA: "",
  driveDate: null as Date | null,
  applicationDeadline: null as Date | null,
  externalApplyUrl: "",
  pptLink: "",
  jobDescriptionText: "",
  requirements: "",
  skills: "",
};

export function PostCentralDriveModal({
  open,
  onOpenChange,
  departments,
  onCreated,
}: PostCentralDriveModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const restored = useRef(false);
  const [step, setStep] = useState(0);
  // Locked unless opened: a department may override only what is ticked here.
  const [editable, setEditable] = useState<DepartmentEditableField[]>([]);
  const [stages, setStages] = useState<StageDraft[]>(DEFAULT_STAGES);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const pipelineCheck = validatePipelineStages(fromStageDrafts(stages));

  function setField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(EMPTY_FORM);
    setStep(0);
    setEditable([]);
    setStages(DEFAULT_STAGES());
    setSelectedDepartments([]);
    setDraftSavedAt(null);
  }

  // Restore an earlier draft the first time the wizard opens.
  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    const draft = readDraft();
    if (!draft) return;
    setForm({
      ...EMPTY_FORM,
      ...draft.form,
      driveDate: draft.form.driveDate ? new Date(draft.form.driveDate) : null,
      applicationDeadline: draft.form.applicationDeadline ? new Date(draft.form.applicationDeadline) : null,
    });
    setStep(Math.min(Math.max(draft.step ?? 0, 0), STEPS.length - 1));
    setEditable(normalizeEditableFields(draft.editable));
    // Rebuilt through the draft factory so every stage gets a fresh key.
    setStages(toStageDrafts(draft.stages));
    // Only departments that still exist as options.
    setSelectedDepartments(
      (draft.selectedDepartments ?? []).filter((id) => departments.some((dept) => dept.id === id))
    );
    setDraftSavedAt(new Date(draft.savedAt));
  }, [open, departments]);

  // Keep the draft current while the wizard is open and has content.
  useEffect(() => {
    if (!open || !restored.current) return;
    const hasContent =
      form.companyName.trim() !== "" ||
      form.roleName.trim() !== "" ||
      form.packageDisplay.trim() !== "" ||
      editable.length > 0 ||
      selectedDepartments.length > 0;
    if (!hasContent) return;
    const savedAt = new Date();
    writeDraft({
      form: {
        ...form,
        driveDate: form.driveDate ? form.driveDate.toISOString() : null,
        applicationDeadline: form.applicationDeadline ? form.applicationDeadline.toISOString() : null,
      },
      step,
      editable,
      stages: fromStageDrafts(stages),
      selectedDepartments,
      savedAt: savedAt.toISOString(),
    });
    setDraftSavedAt(savedAt);
  }, [open, form, step, editable, stages, selectedDepartments]);

  /** Closing keeps the draft: the Super Admin can continue later. */
  function handleClose() {
    onOpenChange(false);
  }

  /** Throwing the draft away is its own, explicit action. */
  function discardDraft() {
    writeDraft(null);
    reset();
  }

  function clearAfterCreate() {
    writeDraft(null);
    reset();
  }

  /** What stops a step from being left, or null. The server checks again. */
  function stepProblem(index: number): string | null {
    if (index === 0) {
      if (!form.companyName.trim() || !form.roleName.trim() || !form.packageDisplay.trim()) {
        return "Company, role and package are required";
      }
      if (Number.isNaN(Number.parseFloat(form.minCGPA))) return "Enter a valid minimum CGPA cutoff";
      if (!form.driveDate || !form.applicationDeadline) {
        return "Drive date and application deadline are required";
      }
      if (form.applicationDeadline >= form.driveDate) {
        return "Application deadline must be before the drive date";
      }
    }
    if (index === 2 && !pipelineCheck.ok) {
      return pipelineCheck.errors.join(" ");
    }
    if (index === 4 && selectedDepartments.length === 0) {
      return "Select at least one department";
    }
    return null;
  }

  function goNext() {
    const problem = stepProblem(step);
    if (problem) {
      toast({ title: "Not yet", description: problem, variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function handleSubmit() {
    const problem = [0, 2, 4].map(stepProblem).find(Boolean);
    if (problem) {
      toast({ title: "Error", description: problem, variant: "destructive" });
      return;
    }

    const minCGPA = Number.parseFloat(form.minCGPA);

    startTransition(async () => {
      const result = await createCentralDrive({
        companyName: form.companyName.trim(),
        companyLogoUrl: form.companyLogoUrl,
        roleName: form.roleName.trim(),
        packageDisplay: form.packageDisplay.trim(),
        minCGPA,
        maxActiveBacklogs: 0,
        driveDate: form.driveDate!.toISOString(),
        applicationDeadline: form.applicationDeadline!.toISOString(),
        externalApplyUrl: form.externalApplyUrl.trim(),
        pptLink: form.pptLink.trim(),
        jobDescriptionText: form.jobDescriptionText.trim(),
        requirements: form.requirements.trim(),
        skills: form.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        departmentEditableFields: editable,
        recruitmentStages: fromStageDrafts(stages),
        eligibleDepartments: selectedDepartments,
      });

      if (result.success && result.driveId) {
        toast({
          title: "Master drive created",
          description: `${form.companyName.trim()} is assigned to ${selectedDepartments.length} department${selectedDepartments.length === 1 ? "" : "s"}. Each configures and publishes it before its students can see it.`,
        });
        clearAfterCreate();
        onOpenChange(false);
        onCreated(result.driveId);
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent style={{ maxWidth: 640 }}>
        <DialogHeader>
          <DialogTitle>Create Master Drive</DialogTitle>
        </DialogHeader>

        <ol
          style={{ display: "flex", gap: 6, flexWrap: "wrap", listStyle: "none", padding: 0, margin: "0 0 8px" }}
          aria-label="Steps"
        >
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={`badge ${index === step ? "badge-purple" : index < step ? "badge-teal" : "badge-gray"}`}
              style={{ fontSize: 10 }}
            >
              {index < step ? "✓" : index + 1}. {label}
            </li>
          ))}
        </ol>

        {draftSavedAt && (
          <div
            className="text-muted"
            style={{ fontSize: 11, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}
          >
            <span>
              Draft saved in this browser at{" "}
              {draftSavedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — you can close this
              and continue later.
            </span>
            <button
              type="button"
              onClick={discardDraft}
              disabled={isPending}
              style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: 11 }}
            >
              Discard draft
            </button>
          </div>
        )}

        <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 4 }}>
          {step === 0 && (
            <>
              <div className="field">
                <label htmlFor="cd-company">Company Name *</label>
                <input
                  id="cd-company"
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                  placeholder="e.g. Infosys"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-role">Role / Designation *</label>
                <input
                  id="cd-role"
                  type="text"
                  value={form.roleName}
                  onChange={(e) => setField("roleName", e.target.value)}
                  placeholder="e.g. Systems Engineer"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-package">Package / CTC *</label>
                <input
                  id="cd-package"
                  type="text"
                  value={form.packageDisplay}
                  onChange={(e) => setField("packageDisplay", e.target.value)}
                  placeholder="e.g. 14 – 22 LPA"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-cgpa">Min CGPA Cutoff *</label>
                <input
                  id="cd-cgpa"
                  type="number"
                  min={0}
                  max={10}
                  step={0.01}
                  value={form.minCGPA}
                  onChange={(e) => setField("minCGPA", e.target.value)}
                  placeholder="e.g. 7.00"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label>Drive Date *</label>
                <DatePicker
                  value={form.driveDate}
                  onChange={(date) => setField("driveDate", date)}
                  placeholder="Select drive date"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label>Application Deadline *</label>
                <DatePicker
                  value={form.applicationDeadline}
                  onChange={(date) => setField("applicationDeadline", date)}
                  placeholder="Select application deadline"
                  disabled={isPending}
                />
              </div>

              <CompanyLogoField
                value={form.companyLogoUrl}
                onChange={(companyLogoUrl) =>
                  setField("companyLogoUrl", companyLogoUrl)
                }
                disabled={isPending}
              />

              <div className="field">
                <label>Company Portal / Registration URL (Optional)</label>
                <UrlField
                  value={form.externalApplyUrl}
                  onChange={(value) => setField("externalApplyUrl", value)}
                  platform="url"
                  placeholder="careers.company.com/apply"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label>Pre-Placement Talk (PPT) Link (Optional)</label>
                <UrlField
                  value={form.pptLink}
                  onChange={(value) => setField("pptLink", value)}
                  platform="url"
                  placeholder="meet.google.com/xyz-abcd"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-jd">Job Description &amp; Instructions</label>
                <textarea
                  id="cd-jd"
                  rows={5}
                  value={form.jobDescriptionText}
                  onChange={(e) => setField("jobDescriptionText", e.target.value)}
                  placeholder="Role responsibilities, selection process, documents to carry…"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-requirements">Requirements (Optional)</label>
                <textarea
                  id="cd-requirements"
                  rows={3}
                  value={form.requirements}
                  onChange={(e) => setField("requirements", e.target.value)}
                  placeholder="Default for every department — each can set its own"
                  disabled={isPending}
                />
              </div>

              <div className="field">
                <label htmlFor="cd-skills">Skills (Optional)</label>
                <input
                  id="cd-skills"
                  type="text"
                  value={form.skills}
                  onChange={(e) => setField("skills", e.target.value)}
                  placeholder="Comma-separated, e.g. Java, SQL, React"
                  disabled={isPending}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="text-secondary" style={{ fontSize: 12, margin: 0 }}>
                Choose which details each assigned department may change for its own students.
                Everything else stays exactly as you set it. The server enforces this whatever a
                department&apos;s form sends. Eligibility, batches, student application fields and
                logistics are always each department&apos;s own.
              </p>
              {DEPARTMENT_EDITABLE_FIELDS.map((field) => {
                const isEditable = editable.includes(field);
                return (
                  <label
                    key={field}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      border: "0.5px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <span>{DEPARTMENT_EDITABLE_FIELD_LABELS[field]}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`badge ${isEditable ? "badge-teal" : "badge-gray"}`} style={{ fontSize: 10 }}>
                        {isEditable ? "EDITABLE" : "LOCKED"}
                      </span>
                      <input
                        type="checkbox"
                        checked={isEditable}
                        onChange={(e) =>
                          setEditable((current) =>
                            e.target.checked
                              ? [...current, field]
                              : current.filter((entry) => entry !== field)
                          )
                        }
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="text-secondary" style={{ fontSize: 12, margin: 0 }}>
                The stages every department&apos;s students go through. Departments review them and
                can only propose changes, which you approve.
              </p>
              <PipelineEditor drafts={stages} onChange={setStages} />
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <div>
                <strong>{form.companyName || "—"}</strong> · {form.roleName || "—"} · {form.packageDisplay || "—"}
              </div>
              <div>
                Drive date: {form.driveDate ? form.driveDate.toLocaleDateString("en-IN") : "—"} · Apply by:{" "}
                {form.applicationDeadline ? form.applicationDeadline.toLocaleDateString("en-IN") : "—"} · Min CGPA:{" "}
                {form.minCGPA || "—"}
              </div>
              {form.jobDescriptionText && (
                <div style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{form.jobDescriptionText}</div>
              )}
              <div>
                <strong>Departments may edit:</strong>{" "}
                {editable.length > 0
                  ? editable.map((field) => DEPARTMENT_EDITABLE_FIELD_LABELS[field]).join(", ")
                  : "nothing — every detail is locked"}
              </div>
              <div>
                <strong>Recruitment stages:</strong>{" "}
                {fromStageDrafts(stages)
                  .map((stage) => `${stage.name} (${STAGE_TYPE_LABELS[stage.stageType]})`)
                  .join(" → ")}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="text-secondary" style={{ fontSize: 12, margin: 0 }}>
                Only the departments you select receive this drive to configure. Others never see it.
              </p>
              {departments.map((dept) => (
                <label
                  key={dept.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    border: "0.5px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    background: selectedDepartments.includes(dept.id) ? "var(--accent-light)" : undefined,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={(e) =>
                      setSelectedDepartments((current) =>
                        e.target.checked ? [...current, dept.id] : current.filter((id) => id !== dept.id)
                      )
                    }
                  />
                  {dept.code} — {dept.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={step === 0 ? handleClose : () => setStep((current) => current - 1)}
            disabled={isPending}
          >
            {step === 0 ? "Save & close" : "← Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={goNext} disabled={isPending}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isPending || selectedDepartments.length === 0}
            >
              {isPending ? "Creating…" : "Create & assign"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
