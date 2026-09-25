"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { STAGE_TYPE_LABELS, validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import { proposePipelineChange } from "@/features/recruitment/actions/manage-pipeline";
import {
  PipelineEditor,
  fromStageDrafts,
  toStageDrafts,
  type StageDraft,
} from "@/features/recruitment/components/pipeline-editor";
import { publishDepartmentDrive } from "../actions/publish-department-drive";
import {
  getDepartmentDrivePreview,
  type DepartmentDrivePreview,
} from "../queries/get-department-drive-preview";
import type { DepartmentCentralDrive } from "../queries/get-department-central-drives";
import type { DepartmentDriveReadiness } from "../domain/department-drive-readiness";

/**
 * The department configuration wizard's last three steps: reviewing the
 * recruitment stages, previewing the drive as students will get it, and
 * publishing. Each calls the server for what matters — proposals, the
 * preview and the publish decision — and trusts nothing it computes itself.
 */

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

// ---------------------------------------------------------------------------
// Step 5 — Recruitment stage review
// ---------------------------------------------------------------------------

export function PipelineReviewStep({
  driveId,
  pipeline,
  locked,
}: {
  driveId: string;
  pipeline: DepartmentCentralDrive["pipeline"];
  locked: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<StageDraft[]>([]);
  const [reason, setReason] = useState("");

  const valid = validatePipelineStages(fromStageDrafts(drafts)).ok;

  const submit = () =>
    startTransition(async () => {
      const result = await proposePipelineChange({
        driveId,
        stages: fromStageDrafts(drafts),
        reason,
      });
      if (!result.success) {
        toast({
          title: "Could not submit the proposal",
          description: [result.error, ...(result.errors ?? [])].join(" "),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Proposal sent to the Super Admin",
        description: "The stages below stay in effect until it is approved.",
      });
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div>
        <h3 className="section-title" style={{ margin: 0 }}>🧭 Recruitment stages</h3>
        <p className="text-secondary" style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 720 }}>
          The stages your students will go through
          {pipeline.version ? ` (version ${pipeline.version})` : ", as set by the Super Admin"}.
          {pipeline.requiresApproval
            ? " To change them, propose a change with a reason — it takes effect only once the Super Admin approves it. Your other configuration never needs approval."
            : " You can change them on the drive's recruitment page until the drive is published."}
        </p>
      </div>

      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, display: "grid", gap: 4 }}>
        {pipeline.stages.map((stage) => (
          <li key={`${stage.sortOrder}-${stage.name}`} style={{ opacity: stage.isEnabled ? 1 : 0.55 }}>
            <strong>{stage.name}</strong>{" "}
            <span className="text-muted" style={{ fontSize: 11 }}>
              {STAGE_TYPE_LABELS[stage.stageType]}
              {!stage.isEnabled && " · inactive"}
              {!stage.visibleToStudents && " · hidden from students"}
              {stage.scheduledAt && ` · ${formatDate(stage.scheduledAt)}`}
              {stage.location && ` · ${stage.location}`}
            </span>
          </li>
        ))}
      </ol>

      {pipeline.pending && (
        <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)" }}>
          ⏳ A change proposed on {formatDate(pipeline.pending.createdAt)} is waiting for the Super Admin:
          “{pipeline.pending.reason}”.
        </div>
      )}

      {pipeline.requiresApproval && !pipeline.pending && !locked && !editing && (
        <div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12 }}
            onClick={() => {
              setDrafts(toStageDrafts(pipeline.stages));
              setReason("");
              setEditing(true);
            }}
          >
            Propose a change
          </button>
        </div>
      )}

      {pipeline.requiresApproval && locked && !pipeline.pending && (
        <div className="text-muted" style={{ fontSize: 12 }}>
          This drive is published — propose stage changes from its{" "}
          <a href={`/admin-dashboard/drives/${driveId}?tab=pipeline`} style={{ color: "var(--accent)" }}>
            recruitment page
          </a>
          .
        </div>
      )}

      {editing && (
        <div style={{ display: "grid", gap: 10 }}>
          <PipelineEditor drafts={drafts} onChange={setDrafts} />
          <textarea
            rows={2}
            value={reason}
            maxLength={1000}
            placeholder="Why this change is needed (required — the Super Admin sees this)"
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
              disabled={isPending || !valid || reason.trim().length < 5}
              onClick={submit}
            >
              {isPending ? "Sending…" : "Submit for approval"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12 }}
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Final student preview
// ---------------------------------------------------------------------------

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

export function StudentPreviewStep({ driveId, dirty }: { driveId: string; dirty: boolean }) {
  const [preview, setPreview] = useState<DepartmentDrivePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setError(null);
    getDepartmentDrivePreview(driveId)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the preview.");
      });
    return () => {
      cancelled = true;
    };
  }, [driveId]);

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <div>
        <h3 className="section-title" style={{ margin: 0 }}>👁 What your students will see</h3>
        <p className="text-secondary" style={{ fontSize: 12, margin: "6px 0 0", maxWidth: 720 }}>
          Built on the server from your saved configuration, by the same code that builds the
          student&apos;s drive page.
          {dirty && " You have unsaved changes — save them to see them here."}
        </p>
      </div>

      {error && <div style={{ color: "var(--red, #c0392b)", fontSize: 13 }}>{error}</div>}
      {!preview && !error && <div className="skeleton" style={{ height: 240, borderRadius: 8 }} />}

      {preview && (
        <div style={{ display: "grid", gap: 16, padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>{preview.roleName}</div>
            <div className="text-secondary" style={{ fontSize: 14 }}>
              {preview.companyName} · {preview.packageText}
            </div>
          </div>

          <PreviewSection title="Dates">
            Drive: {formatDate(preview.nextStageDate)} · Apply by: {formatDate(preview.applicationDeadline)}
          </PreviewSection>

          <PreviewSection title="Job description">
            <div style={{ whiteSpace: "pre-wrap" }}>{preview.jobDescriptionText || "—"}</div>
            {preview.jobDescriptionUrl && (
              <a href={preview.jobDescriptionUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                Job description document ↗
              </a>
            )}
          </PreviewSection>

          <PreviewSection title="Requirements">
            <div style={{ whiteSpace: "pre-wrap" }}>{preview.requirements || "—"}</div>
          </PreviewSection>

          <PreviewSection title="Skills">{preview.skills.join(", ") || "—"}</PreviewSection>

          <PreviewSection title="Logistics">
            <div style={{ display: "grid", gap: 2 }}>
              <span>Venue: {preview.logistics.venue || "—"}</span>
              <span>Reporting time: {preview.logistics.reportingTime || "—"}</span>
              {preview.logistics.coordinatorName && (
                <span>
                  Coordinator: {preview.logistics.coordinatorName}
                  {preview.logistics.coordinatorPhone && ` (${preview.logistics.coordinatorPhone})`}
                  {preview.logistics.coordinatorEmail && ` · ${preview.logistics.coordinatorEmail}`}
                </span>
              )}
              {preview.logistics.seatingAllocation && <span>Seating: {preview.logistics.seatingAllocation}</span>}
              {preview.logistics.specialInstructions && (
                <span style={{ whiteSpace: "pre-wrap" }}>Instructions: {preview.logistics.specialInstructions}</span>
              )}
              {preview.logistics.pptLink && <span>Pre-placement talk: {preview.logistics.pptLink}</span>}
            </div>
          </PreviewSection>

          <PreviewSection title="Who can apply">
            <div>Batches: {preview.batches?.join(", ") ?? "none selected"}</div>
            {preview.eligibility.length > 0 && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {preview.eligibility.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            )}
            <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Students who are already placed never see the drive.
            </div>
          </PreviewSection>

          <PreviewSection title="Recruitment process">
            {preview.recruitmentStages.length === 0 ? (
              "—"
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {preview.recruitmentStages.map((stage) => (
                  <li key={stage.name}>
                    {stage.name}
                    {stage.scheduledAt && ` · ${formatDate(stage.scheduledAt)}`}
                    {stage.location && ` · ${stage.location}`}
                  </li>
                ))}
              </ol>
            )}
          </PreviewSection>

          <PreviewSection title="Application form">
            {preview.applyMethod === "EXTERNAL" && preview.externalApplyUrl && (
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Students also register on the company portal.
              </div>
            )}
            {preview.applicationFields.length === 0 ? (
              "No fields"
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {preview.applicationFields.map((field) => (
                  <li key={field.fieldKey}>
                    {field.label}
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      {field.autoFilled ? " · filled from profile" : " · answered by the student"}
                      {field.required ? " · required" : ""}
                      {field.autoFilled && field.editable ? " · student may edit" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PreviewSection>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 7 — Publish
// ---------------------------------------------------------------------------

export function PublishStep({
  driveId,
  readiness,
  dirty,
}: {
  driveId: string;
  readiness: DepartmentDriveReadiness;
  dirty: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const publish = () =>
    startTransition(async () => {
      setError(null);
      const result = await publishDepartmentDrive({ driveId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast({
        title: "Drive published",
        description:
          result.notified > 0
            ? `${result.notified} eligible student${result.notified === 1 ? "" : "s"} notified.`
            : "No eligible students to notify yet.",
      });
      router.refresh();
    });

  const contentSteps = readiness.steps.filter((step) => step.id !== "publish");

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <h3 className="section-title" style={{ margin: 0 }}>🚀 Publish</h3>

      {readiness.published ? (
        <p style={{ fontSize: 13, margin: 0 }}>
          Published. Its content, eligibility, batches and application form are now read-only.
        </p>
      ) : (
        <>
          <p className="text-secondary" style={{ fontSize: 12, margin: 0, maxWidth: 720 }}>
            Publishing releases this drive to your eligible students and notifies them. The server
            checks everything again when you press publish.
          </p>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {contentSteps.map((step) => (
              <li key={step.id} style={{ fontSize: 13 }}>
                {step.complete ? "✅" : "⚠️"} {step.label}
                {step.issues.length > 0 && (
                  <ul className="text-muted" style={{ margin: "2px 0 0 22px", fontSize: 12 }}>
                    {step.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {readiness.steps
              .find((step) => step.id === "publish")
              ?.issues.map((issue) => (
                <li key={issue} style={{ fontSize: 13 }}>
                  ⛔ {issue}
                </li>
              ))}
          </ul>
          {dirty && (
            <div style={{ fontSize: 12 }}>✏️ Save your changes first — what is published is what is saved.</div>
          )}
          {error && <div style={{ fontSize: 12, color: "var(--red, #c0392b)" }}>{error}</div>}
          <div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending || dirty || !readiness.ready}
              onClick={publish}
            >
              {isPending ? "Publishing…" : "Publish to students"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
