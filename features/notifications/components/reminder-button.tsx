"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { sendDeadlineReminder } from "../actions/send-deadline-reminder";

/**
 * "Remind eligible students" — with a confirmation, because it tells real
 * people. It states who it reaches (eligible students of this department who
 * have not applied) and that it goes out at most once a day.
 */
export function ReminderButton({ driveId }: { driveId: string }) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendDeadlineReminder({ driveId });
      setConfirming(false);
      if (!result.success) {
        toast({ title: "Not sent", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Reminder sent", description: result.message });
    });
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
        Remind eligible students
      </button>
    );
  }

  return (
    <span role="alertdialog" aria-label="Confirm reminder" style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="text-secondary" style={{ fontSize: 12 }}>
        Notify eligible students of your department who have not applied? One reminder a day at most.
      </span>
      <button type="button" className="btn btn-primary btn-sm" disabled={isPending} onClick={send}>
        {isPending ? "Sending…" : "Send reminder"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={isPending} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
