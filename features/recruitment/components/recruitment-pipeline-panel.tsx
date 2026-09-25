"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { STAGE_TYPE_LABELS, validatePipelineStages } from "../domain/pipeline";
import { proposePipelineChange, saveDraftPipeline } from "../actions/manage-pipeline";
import type { DriveRecruitment } from "../queries/get-drive-recruitment";
import { PipelineEditor, fromStageDrafts, toStageDrafts, type StageDraft } from "./pipeline-editor";

/**
 * A department drive's recruitment, for its department admin: the counts by
 * configured stage, the active pipeline, and how to change it.
 *
 * A Super Admin drive's stages are the Super Admin's: the department admin
 * reviews them and proposes changes, with a reason, that wait for approval.
 * A department's own drive is edited directly until it is published, then
 * the same way. The panel never activates anything itself, and the server
 * enforces the same rule regardless of what this component shows.
 */
export function RecruitmentPipelinePanel({
  driveId,
  recruitment,
}: {
  driveId: string;
  recruitment: DriveRecruitment;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<StageDraft[]>([]);
  const [reason, setReason] = useState("");

  const { counts, activeVersion, plannedStages } = recruitment;
  // Proposal mode: the change waits for the Super Admin.
  const locked = recruitment.requiresApproval;
  const shownStages = activeVersion?.stages ?? plannedStages ?? [];
  const pending = recruitment.requests.find((request) => request.status === "PENDING");

  const startEditing = () => {
    setDrafts(
      toStageDrafts(
        shownStages.length > 0
          ? shownStages
          : [
              { name: "Application", stageType: "APPLICATION" },
              { name: "Offer", stageType: "OFFER" },
            ]
      )
    );
    setReason("");
    setEditing(true);
  };

  const submit = () =>
    startTransition(async () => {
      const stages = fromStageDrafts(drafts);
      const result = locked
        ? await proposePipelineChange({ driveId, stages, reason })
        : await saveDraftPipeline({ driveId, stages });

      if (!result.success) {
        toast({
          title: locked ? "Could not submit the proposal" : "Could not save the pipeline",
          description: [result.error, ...(result.errors ?? [])].join(" "),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: locked ? "Proposal sent for approval" : "Pipeline saved",
        description: locked ? "It takes effect only once the Super Admin approves it." : undefined,
      });
      setEditing(false);
      router.refresh();
    });

  const valid = validatePipelineStages(fromStageDrafts(drafts)).ok;
  const tile = (label: string, value: number) => (
    <div className="dash-stat-card" style={{ minWidth: 100 }}>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>🧭 Recruitment pipeline</h3>
          <p className="text-secondary" style={{ fontSize: 12, margin: "4px 0 0" }}>
            {activeVersion
              ? `Version ${activeVersion.version}`
              : "Not started yet — these stages become version 1 when the drive is published."}
            {locked
              ? " · Changes need Super Admin approval."
              : " · Not published yet: you can edit it directly."}
          </p>
        </div>
        {!editing && (
          <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 12 }}
            disabled={Boolean(pending)} onClick={startEditing}
            title={pending ? "A proposal is already waiting for approval" : undefined}>
            {locked ? "Propose a change" : "Edit pipeline"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tile("Eligible", counts.eligible)}
        {tile("Applied", counts.applied)}
        {tile("Shortlisted", counts.shortlisted)}
        {tile("Selected", counts.selected)}
        {tile("Rejected", counts.rejected)}
        {tile("Placed", counts.placed)}
      </div>

      {counts.byStage.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>In progress</th>
                <th style={{ textAlign: "right" }}>Selected</th>
                <th style={{ textAlign: "right" }}>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {counts.byStage.map((row) => (
                <tr key={row.stageId ?? "unmapped"}>
                  <td>
                    {row.name}
                    {!row.active && row.version !== null && (
                      <span className="badge badge-gray" style={{ fontSize: 10, marginLeft: 6 }}>v{row.version}</span>
                    )}
                  </td>
                  <td className="text-muted">{row.stageType ? STAGE_TYPE_LABELS[row.stageType] : "—"}</td>
                  <td style={{ textAlign: "right" }}>{row.inProgress}</td>
                  <td style={{ textAlign: "right" }}>{row.selected}</td>
                  <td style={{ textAlign: "right" }}>{row.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "var(--amber-surface, var(--surface-2))" }}>
          ⏳ A change proposed by {pending.requestedBy} on {new Date(pending.createdAt).toLocaleDateString("en-IN")} is
          waiting for the Super Admin: “{pending.reason}”. The current pipeline stays in effect until it is approved.
        </div>
      )}

      {editing && (
        <div style={{ display: "grid", gap: 10 }}>
          <PipelineEditor drafts={drafts} onChange={setDrafts} />
          {locked && (
            <textarea
              rows={2}
              value={reason}
              maxLength={1000}
              placeholder="Why this change is needed (required — the Super Admin sees this)"
              onChange={(e) => setReason(e.target.value)}
              style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)" }}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 12 }}
              disabled={isPending || !valid || (locked && reason.trim().length < 5)} onClick={submit}>
              {isPending ? "Saving…" : locked ? "Submit for approval" : "Save pipeline"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 12 }}
              disabled={isPending} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && shownStages.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, display: "grid", gap: 4 }}>
          {shownStages.map((stage) => (
            <li key={stage.id} style={{ opacity: stage.isEnabled ? 1 : 0.55 }}>
              <strong>{stage.name}</strong>{" "}
              <span className="text-muted" style={{ fontSize: 11 }}>
                {STAGE_TYPE_LABELS[stage.stageType]}
                {!stage.isEnabled && " · inactive"}
                {!stage.visibleToStudents && " · hidden from students"}
                {stage.scheduledAt && ` · ${new Date(stage.scheduledAt).toLocaleString("en-IN")}`}
                {stage.location && ` · ${stage.location}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {(recruitment.versions.length > 1 || recruitment.requests.length > 0) && (
        <details>
          <summary style={{ fontSize: 12, cursor: "pointer" }}>History</summary>
          <ul style={{ fontSize: 12, margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
            {recruitment.versions.map((version) => (
              <li key={version.id}>
                v{version.version} · {version.status.toLowerCase()} · {new Date(version.createdAt).toLocaleDateString("en-IN")}
                {version.createdBy ? ` · ${version.createdBy}` : ""}{version.note ? ` — ${version.note}` : ""}
              </li>
            ))}
            {recruitment.requests.map((request) => (
              <li key={request.id}>
                Request by {request.requestedBy} · {request.status.toLowerCase()}
                {request.reviewNote ? ` — ${request.reviewNote}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
