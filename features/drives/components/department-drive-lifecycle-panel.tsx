"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { DepartmentDriveStatus } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { setDepartmentDriveStatus } from "../actions/set-department-drive-status";
import { cancelDepartmentDrive } from "../actions/cancel-drive";

/**
 * The department admin's lifecycle control for their own instance of a drive.
 *
 *   ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED, or → CANCELLED
 *
 * Publishing is the last step of the configuration wizard (it is validated
 * there, step by step). This panel shows where the drive is and handles the
 * transitions after it: close, archive and cancel. The buttons mirror the
 * server's transition rules for clarity, but the rules are enforced in the
 * actions — a hidden button is not a lock.
 */

interface DepartmentDriveLifecyclePanelProps {
  driveId: string;
  status: DepartmentDriveStatus;
  publishedAt: Date | string | null;
  cancellationReason?: string | null;
}

const STATUS_BADGE: Record<DepartmentDriveStatus, string> = {
  ASSIGNED: "badge-gray",
  CONFIGURED: "badge-purple",
  PUBLISHED: "badge-green",
  CLOSED: "badge-red",
  ARCHIVED: "badge-gray",
  CANCELLED: "badge-red",
};

const STATUS_HELP: Record<DepartmentDriveStatus, string> = {
  ASSIGNED:
    "Assigned to your department by the Super Admin. Configure it, then publish to make it visible to your students.",
  CONFIGURED:
    "Saved as a draft, not yet visible. Complete every step, then publish to release it to your eligible students.",
  PUBLISHED:
    "Live for your eligible students. Its content, eligibility, batches and application form are locked; venue and coordinator details can still be updated.",
  CLOSED:
    "Administratively closed — no new applications. This is separate from the application deadline.",
  ARCHIVED: "Archived. This drive is historical for your department.",
  CANCELLED:
    "Cancelled. Students can no longer apply or find it; applications already made are kept on record.",
};

export function DepartmentDriveLifecyclePanel({
  driveId,
  status,
  publishedAt,
  cancellationReason,
}: DepartmentDriveLifecyclePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelDepartmentDrive({ driveId, reason });
      if (!result.success) {
        toast({ title: "Could not cancel", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Drive cancelled",
        description: `${result.notified} applicant${result.notified === 1 ? "" : "s"} notified.`,
      });
      setCancelling(false);
      router.refresh();
    });
  }

  function handleStatus(next: "CLOSED" | "ARCHIVED") {
    startTransition(async () => {
      const result = await setDepartmentDriveStatus({ driveId, status: next });

      if (!result.success) {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Drive ${next.toLowerCase()}` });
      router.refresh();
    });
  }

  const canCancel = ["ASSIGNED", "CONFIGURED", "PUBLISHED", "CLOSED"].includes(status);
  const publishedLabel =
    publishedAt !== null
      ? new Date(publishedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 14,
        border: "0.5px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface-1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 10 }}>
            {status}
          </span>
          {status === "PUBLISHED" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <Lock size={11} aria-hidden />
              Form locked{publishedLabel ? ` · published ${publishedLabel}` : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {status === "PUBLISHED" && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => handleStatus("CLOSED")}
            >
              Close applications
            </button>
          )}

          {(status === "CLOSED" || status === "PUBLISHED") && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => handleStatus("ARCHIVED")}
            >
              Archive
            </button>
          )}

          {canCancel && !cancelling && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: "var(--red, #c0392b)" }}
              disabled={isPending}
              onClick={() => setCancelling(true)}
            >
              Cancel drive
            </button>
          )}
        </div>
      </div>

      {cancelling && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <textarea
            rows={2}
            maxLength={1000}
            value={reason}
            placeholder="Why is this drive cancelled? Applicants are told this reason."
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "0.5px solid var(--border-strong)" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending || reason.trim().length < 5}
              onClick={handleCancel}
            >
              {isPending ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => setCancelling(false)}
            >
              Keep drive
            </button>
          </div>
        </div>
      )}

      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {STATUS_HELP[status]}
        {status === "CANCELLED" && cancellationReason ? ` Reason: ${cancellationReason}` : ""}
      </p>
    </section>
  );
}
