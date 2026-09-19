"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkUpdateApplicationStage,
  validateBulkStageMove,
  type BulkMoveOutcome,
} from "../actions/bulk-update-application-stage";

/**
 * Moving several applications at once, in three visible steps:
 *
 *   1. Review — the server judges every selected application (dry run) and
 *      lists which would move and which would not, and why.
 *   2. Confirm — the admin sees the count that will actually move and applies.
 *   3. Result — every success and every failure, with the reasons. A partial
 *      failure is explained, never hidden.
 *
 * Nothing here decides who may move: the server does, per application, with
 * the same checks a single move gets.
 */

type Step = "review" | "result";

function OutcomeList({ outcomes, title, tone }: { outcomes: BulkMoveOutcome[]; title: string; tone: string }) {
  if (outcomes.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }} className={tone}>
        {title} ({outcomes.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, maxHeight: 160, overflowY: "auto", display: "grid", gap: 2 }}>
        {outcomes.map((outcome) => (
          <li key={outcome.applicationId}>
            {outcome.studentName}
            {outcome.rollNumber ? ` (${outcome.rollNumber})` : ""}
            {outcome.error && <span className="text-muted"> — {outcome.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulkStageMoveDialog({
  open,
  onOpenChange,
  driveId,
  applicationIds,
  stageId,
  stageName,
  status,
  note,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driveId: string;
  applicationIds: string[];
  stageId: string;
  stageName: string;
  status: "IN_PROGRESS" | "REJECTED";
  note: string;
  /** Called once a result has been shown and the dialog is closed. */
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("review");
  const [outcomes, setOutcomes] = useState<BulkMoveOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const input = { driveId, applicationIds, stageId, status, note: note.trim() || undefined };

  function review() {
    setError(null);
    setOutcomes(null);
    startTransition(async () => {
      const result = await validateBulkStageMove(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOutcomes(result.outcomes);
      setChecked(true);
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await bulkUpdateApplicationStage(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOutcomes(result.outcomes);
      setStep("result");
      router.refresh();
    });
  }

  function close(next: boolean) {
    if (isPending) return;
    if (!next) {
      const wasResult = step === "result";
      setStep("review");
      setOutcomes(null);
      setChecked(false);
      setError(null);
      onOpenChange(false);
      if (wasResult) onDone();
      return;
    }
    onOpenChange(true);
  }

  const ok = outcomes?.filter((outcome) => outcome.ok) ?? [];
  const failed = outcomes?.filter((outcome) => !outcome.ok) ?? [];
  const verb = status === "REJECTED" ? "Reject at" : "Move to";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "result"
              ? "Bulk move finished"
              : `${verb} ${stageName} — ${applicationIds.length} application${applicationIds.length === 1 ? "" : "s"}`}
          </DialogTitle>
          <DialogDescription>
            {step === "result"
              ? "Every move is recorded in each application's history."
              : "Each application is checked on the server before anything changes."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" style={{ fontSize: 13, color: "var(--red, #c0392b)" }}>
            {error}
          </div>
        )}

        {step === "review" && !checked && (
          <div className="text-secondary" style={{ fontSize: 13 }}>
            Students are notified of each move. Nothing changes until you confirm.
          </div>
        )}

        {outcomes && (
          <div style={{ display: "grid", gap: 10 }}>
            {step === "review" ? (
              <div style={{ fontSize: 13 }}>
                <strong>{ok.length}</strong> can be moved
                {failed.length > 0 && (
                  <>
                    , <strong>{failed.length}</strong> cannot — they will be left as they are.
                  </>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13 }}>
                <strong>{ok.length}</strong> moved
                {failed.length > 0 && (
                  <>
                    , <strong>{failed.length}</strong> could not be moved.
                  </>
                )}
              </div>
            )}
            <OutcomeList
              outcomes={failed}
              title={step === "review" ? "Would not move" : "Not moved"}
              tone="text-secondary"
            />
            <OutcomeList outcomes={ok} title={step === "review" ? "Would move" : "Moved"} tone="text-secondary" />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {step === "result" ? (
            <button type="button" className="btn btn-primary" onClick={() => close(false)}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-outline" disabled={isPending} onClick={() => close(false)}>
                Cancel
              </button>
              {!checked ? (
                <button type="button" className="btn btn-primary" disabled={isPending} onClick={review}>
                  {isPending ? "Checking…" : "Review"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isPending || ok.length === 0}
                  onClick={apply}
                >
                  {isPending ? "Moving…" : `Move ${ok.length}`}
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
