"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { reviewPipelineChange } from "@/features/recruitment/actions/manage-pipeline";
import { STAGE_TYPE_LABELS, type RecruitmentStageType } from "@/features/recruitment/domain/pipeline";
import type { PipelineRequestView } from "@/features/recruitment/queries/get-pipeline-requests";

const STATUS_BADGE = {
  PENDING: "badge-amber",
  APPROVED: "badge-green",
  REJECTED: "badge-red",
} as const;

function StageList({ stages }: { stages: { name: string; stageType: string; isEnabled: boolean }[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: "grid", gap: 2 }}>
      {stages.map((stage, index) => (
        <li key={`${stage.name}-${index}`} style={{ opacity: stage.isEnabled ? 1 : 0.55 }}>
          {stage.name}{" "}
          <span className="text-muted">
            ({STAGE_TYPE_LABELS[stage.stageType as RecruitmentStageType] ?? stage.stageType}
            {stage.isEnabled ? "" : ", inactive"})
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Review pipeline change requests. The decision is made on the server: only
 * a Super Admin, never the requester, and approval is refused if the drive's
 * pipeline has changed since the proposal.
 */
export function PipelineRequestsClient({ requests }: { requests: PipelineRequestView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = (requestId: string, decision: "APPROVE" | "REJECT") =>
    startTransition(async () => {
      const result = await reviewPipelineChange({ requestId, decision, note: notes[requestId] });
      if (!result.success) {
        toast({ title: "Could not review", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: decision === "APPROVE" ? "Approved — new pipeline active" : "Rejected — pipeline unchanged" });
      router.refresh();
    });

  if (requests.length === 0) {
    return <div className="card text-muted" style={{ fontSize: 13 }}>No pipeline change requests yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {requests.map((request) => {
        const changes = request.changes;
        const summary = [
          changes.added.length ? `Added: ${changes.added.join(", ")}` : null,
          changes.removed.length ? `Removed: ${changes.removed.join(", ")}` : null,
          changes.edited.length ? `Edited: ${changes.edited.join(", ")}` : null,
          changes.deactivated.length ? `Deactivated: ${changes.deactivated.join(", ")}` : null,
          changes.reordered ? "Reordered" : null,
        ].filter(Boolean);

        return (
          <div key={request.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {request.companyName} — {request.roleName}{" "}
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{request.departmentCode}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Proposed by {request.requestedBy} · {new Date(request.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
              <span className={`badge ${STATUS_BADGE[request.status]}`}>{request.status}</span>
            </div>

            <div style={{ fontSize: 13 }}><strong>Reason:</strong> {request.reason}</div>
            {summary.length > 0 && <div style={{ fontSize: 12 }}>{summary.join(" · ")}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>CURRENT (v{request.baseVersion})</div>
                <StageList stages={request.baseStages} />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>PROPOSED</div>
                <StageList stages={request.proposedStages} />
              </div>
            </div>

            {request.status === "PENDING" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!request.current && (
                  <span style={{ fontSize: 12, color: "var(--red)" }}>
                    The pipeline changed since this was proposed — it can only be rejected.
                  </span>
                )}
                <input
                  value={notes[request.id] ?? ""}
                  maxLength={1000}
                  placeholder="Note (required to reject)"
                  onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })}
                  style={{ flex: 1, minWidth: 200, padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)" }}
                />
                <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 12 }}
                  disabled={isPending || !request.current} onClick={() => decide(request.id, "APPROVE")}>
                  Approve
                </button>
                <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 12, color: "var(--red)" }}
                  disabled={isPending || (notes[request.id] ?? "").trim().length < 5}
                  onClick={() => decide(request.id, "REJECT")}>
                  Reject
                </button>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: 12 }}>
                {request.status === "APPROVED" ? "Approved" : "Rejected"} by {request.reviewedBy ?? "—"}
                {request.reviewedAt ? ` · ${new Date(request.reviewedAt).toLocaleString("en-IN")}` : ""}
                {request.reviewNote ? ` — ${request.reviewNote}` : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
