"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus, RecruitmentStageType } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { updateApplicationStage } from "../actions/update-application-stage";
import { PlacementConfirmDialog } from "@/features/students/components/placement-confirm-dialog";
import {
  STATUS_LABELS,
  WRITABLE_STATUSES,
  isWritableStatus,
  type WritableApplicationStatus,
} from "@/features/applications/utils/application-progress";

export interface StageOption {
  id: string;
  name: string;
  stageType: RecruitmentStageType;
  isEnabled: boolean;
}

interface ApplicationStageControlProps {
  applicationId: string;
  /** The stage the application is in; null if not yet mapped to a pipeline. */
  currentStage: { id: string; name: string; stageType: RecruitmentStageType } | null;
  status: ApplicationStatus;
  /** The drive's active pipeline, in order — the only stages it can move to. */
  stages: StageOption[];
  /**
   * What a selection records, shown in the confirmation before the student is
   * placed. Selecting always asks; without this the dialog shows what it can.
   */
  placement?: { studentName: string; companyName: string; roleName: string; packageText: string | null };
}

/** Badge colour per outcome, using the existing badge tokens. */
const STATUS_BADGE: Record<ApplicationStatus, string> = {
  IN_PROGRESS: "badge-purple",
  SELECTED: "badge-green",
  REJECTED: "badge-red",
  WITHDRAWN: "badge-gray",
};

/**
 * The department admin's control for moving one application through this
 * drive's recruitment pipeline. The stages offered are the drive's own
 * (active version, active stages); the server checks the chosen stage again —
 * this list is a convenience, not a permission.
 *
 * An application still in an earlier version's stage shows that stage, and
 * joins the current pipeline when it is next moved. A SELECTED application is
 * final and a historical withdrawn one is closed: both render read-only.
 */
export function ApplicationStageControl({
  applicationId,
  currentStage,
  status,
  stages,
  placement,
}: ApplicationStageControlProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [draftStageId, setDraftStageId] = useState<string>(currentStage?.id ?? "");
  const [draftStatus, setDraftStatus] = useState<WritableApplicationStatus>(
    isWritableStatus(status) ? status : "IN_PROGRESS"
  );
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const selectable = stages.filter((stage) => stage.isEnabled);
  const currentInActive = currentStage ? selectable.some((stage) => stage.id === currentStage.id) : false;
  const options = [
    ...(currentStage && !currentInActive
      ? [{ id: currentStage.id, name: `${currentStage.name} (earlier pipeline)`, stageType: currentStage.stageType }]
      : []),
    ...selectable,
  ];
  const draftStage = options.find((stage) => stage.id === draftStageId);

  const isClosed = !isWritableStatus(status) || status === "SELECTED";
  const isDirty = draftStageId !== (currentStage?.id ?? "") || draftStatus !== status;

  /** Selecting places the student permanently, so it is confirmed first. */
  function handleSave() {
    if (!draftStageId) return;
    if (draftStatus === "SELECTED") {
      setConfirming(true);
      return;
    }
    submit();
  }

  function submit() {
    if (!draftStageId) return;
    startTransition(async () => {
      const result = await updateApplicationStage({
        applicationId,
        stageId: draftStageId,
        status: draftStatus,
        note: note.trim() || undefined,
      });

      setConfirming(false);
      if (!result.success) {
        toast({ title: "Could not update", description: result.error, variant: "destructive" });
        setDraftStageId(currentStage?.id ?? "");
        if (isWritableStatus(status)) setDraftStatus(status);
        return;
      }

      toast({
        title: "Application updated",
        description: `Moved to ${draftStage?.name ?? "the selected stage"} · ${STATUS_LABELS[draftStatus]}.`,
      });
      setNote("");
      router.refresh();
    });
  }

  if (isClosed) {
    return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {currentStage && <span style={{ fontSize: 12 }}>{currentStage.name}</span>}
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABELS[status]}</span>
      </span>
    );
  }

  const selectStyle: React.CSSProperties = {
    padding: "4px 6px",
    fontSize: 12,
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    background: "var(--surface)",
    color: "var(--text-primary)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select
        value={draftStageId}
        disabled={isPending}
        aria-label="Stage"
        onChange={(e) => {
          const next = options.find((stage) => stage.id === e.target.value);
          setDraftStageId(e.target.value);
          // Selected only at an Offer stage: moving away reopens it.
          if (draftStatus === "SELECTED" && next?.stageType !== "OFFER") setDraftStatus("IN_PROGRESS");
        }}
        style={selectStyle}
      >
        {!currentStage && <option value="">— choose a stage —</option>}
        {options.map((stage) => (
          <option key={stage.id} value={stage.id}>{stage.name}</option>
        ))}
      </select>

      <select
        value={draftStatus}
        disabled={isPending}
        aria-label="Outcome"
        onChange={(e) => {
          const nextStatus = e.target.value as WritableApplicationStatus;
          setDraftStatus(nextStatus);
          if (nextStatus === "SELECTED") {
            const offer = selectable.find((stage) => stage.stageType === "OFFER");
            if (offer) setDraftStageId(offer.id);
          }
        }}
        style={selectStyle}
      >
        {WRITABLE_STATUSES.map((value) => (
          <option key={value} value={value}>{STATUS_LABELS[value]}</option>
        ))}
      </select>

      {isDirty ? (
        <>
          <input
            value={note}
            maxLength={500}
            placeholder="Note (optional)"
            onChange={(e) => setNote(e.target.value)}
            style={{ ...selectStyle, width: 140 }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11, padding: "4px 8px" }}
            disabled={isPending || !draftStageId}
            onClick={handleSave}
          >
            {isPending ? "Saving…" : draftStatus === "SELECTED" ? "Select…" : "Save"}
          </button>
          <PlacementConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            studentName={placement?.studentName ?? "this student"}
            companyName={placement?.companyName ?? "the company"}
            roleName={placement?.roleName ?? "the role"}
            packageText={placement?.packageText ?? null}
            pending={isPending}
            onConfirm={submit}
          />
        </>
      ) : (
        <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 10 }}>
          {STATUS_LABELS[status]}
        </span>
      )}
    </div>
  );
}
