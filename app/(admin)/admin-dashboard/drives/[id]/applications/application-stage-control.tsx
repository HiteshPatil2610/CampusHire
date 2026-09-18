"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStage, ApplicationStatus } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { updateApplicationStage } from "@/features/applications/actions/update-application-stage";
import {
  STAGE_SEQUENCE,
  STAGE_LABELS,
  STATUS_LABELS,
  WRITABLE_STATUSES,
  isWritableStatus,
  type WritableApplicationStatus,
} from "@/features/applications/utils/application-progress";

interface ApplicationStageControlProps {
  applicationId: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
}

/** Badge colour per outcome, using the existing badge tokens. */
const STATUS_BADGE: Record<ApplicationStatus, string> = {
  IN_PROGRESS: "badge-purple",
  SELECTED: "badge-green",
  REJECTED: "badge-red",
  WITHDRAWN: "badge-gray",
};

/**
 * The department admin's control for moving one application through the
 * selection process. This is the only place stage and status are written —
 * the applicant's submitted content is immutable and has no control at all.
 *
 * A historical withdrawn application predates the final-application rule and
 * is read-only: nothing can move it any more.
 */
export function ApplicationStageControl({
  applicationId,
  stage,
  status,
}: ApplicationStageControlProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [draftStage, setDraftStage] = useState<ApplicationStage>(stage);
  const [draftStatus, setDraftStatus] = useState<WritableApplicationStatus>(
    isWritableStatus(status) ? status : "IN_PROGRESS"
  );

  const isLocked = !isWritableStatus(status);
  const isDirty = draftStage !== stage || draftStatus !== status;

  function handleSave() {
    startTransition(async () => {
      const result = await updateApplicationStage({
        applicationId,
        stage: draftStage,
        status: draftStatus,
      });

      if (!result.success) {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "destructive",
        });
        // Put the controls back to what the server still holds. A non-writable
        // status never reaches here — the control renders as a badge instead.
        setDraftStage(stage);
        if (isWritableStatus(status)) setDraftStatus(status);
        return;
      }

      toast({
        title: "Application updated",
        description: `Moved to ${STAGE_LABELS[draftStage]} · ${STATUS_LABELS[draftStatus]}.`,
      });
      router.refresh();
    });
  }

  if (isLocked) {
    return (
      <span className={`badge ${STATUS_BADGE.WITHDRAWN}`}>
        {STATUS_LABELS.WITHDRAWN}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select
        value={draftStage}
        disabled={isPending}
        onChange={(e) => {
          const nextStage = e.target.value as ApplicationStage;
          setDraftStage(nextStage);
          // A selected candidate is at Offer by definition — moving the stage
          // back off Offer reopens the application rather than silently
          // contradicting the outcome.
          if (draftStatus === "SELECTED" && nextStage !== "OFFER") {
            setDraftStatus("IN_PROGRESS");
          }
        }}
        style={{
          padding: "4px 6px",
          fontSize: 12,
          border: "0.5px solid var(--border-strong)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--text-primary)",
        }}
      >
        {STAGE_SEQUENCE.map((value) => (
          <option key={value} value={value}>
            {STAGE_LABELS[value]}
          </option>
        ))}
      </select>

      <select
        value={draftStatus}
        disabled={isPending}
        onChange={(e) => {
          const nextStatus = e.target.value as WritableApplicationStatus;
          setDraftStatus(nextStatus);
          if (nextStatus === "SELECTED") {
            setDraftStage("OFFER");
          }
        }}
        style={{
          padding: "4px 6px",
          fontSize: 12,
          border: "0.5px solid var(--border-strong)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--text-primary)",
        }}
      >
        {WRITABLE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>

      {isDirty ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ fontSize: 11, padding: "4px 8px" }}
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      ) : (
        <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 10 }}>
          {STATUS_LABELS[status]}
        </span>
      )}
    </div>
  );
}
