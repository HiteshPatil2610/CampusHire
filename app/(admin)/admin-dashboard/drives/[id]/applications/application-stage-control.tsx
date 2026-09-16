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
 * selection process. This is the only place stage and status are written.
 *
 * A withdrawn application is read-only — withdrawal is the student's call.
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
  const [draftStatus, setDraftStatus] = useState<ApplicationStatus>(status);

  const isLocked = status === "WITHDRAWN";
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
        // Put the controls back to what the server still holds.
        setDraftStage(stage);
        setDraftStatus(status);
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
          const nextStatus = e.target.value as ApplicationStatus;
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
        {(["IN_PROGRESS", "SELECTED", "REJECTED"] as const).map((value) => (
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
