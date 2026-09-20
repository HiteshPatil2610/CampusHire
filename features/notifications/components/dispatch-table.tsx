"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { retryNotificationDispatch } from "../actions/retry-notification-dispatch";
import type { DispatchRow } from "../queries/get-notification-dispatches";

const STATUS_BADGE: Record<string, string> = {
  SENT: "badge-green",
  FAILED: "badge-red",
  PENDING: "badge-amber",
  RETRYING: "badge-amber",
};

/**
 * Notification deliveries, and the retry for the ones that failed.
 *
 * Re-sending resolves the recipients again and skips everyone who was
 * already notified, so it is safe to press more than once.
 */
export function DispatchTable({ rows }: { rows: DispatchRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function retry(id: string) {
    startTransition(async () => {
      const result = await retryNotificationDispatch({ dispatchId: id });
      if (!result.success) {
        toast({ title: "Not re-sent", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Re-sent", description: result.message });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
        No notification deliveries recorded yet.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th>Notified</th>
            <th>Attempts</th>
            <th>When</th>
            <th>Triggered by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.eventLabel}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {row.departmentCode ? `${row.departmentCode} · ` : ""}
                  {row.key}
                </div>
                {row.lastError && (
                  <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>
                    {row.lastError}
                  </div>
                )}
                {row.note && (
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {row.note}
                  </div>
                )}
              </td>
              <td>
                <span className={`badge ${STATUS_BADGE[row.status] ?? "badge-gray"}`}>
                  {row.status.toLowerCase()}
                </span>
              </td>
              <td>{row.recipientCount}</td>
              <td>{row.attempts}</td>
              <td className="text-muted" style={{ fontSize: 12 }}>
                {new Date(row.completedAt ?? row.updatedAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                })}
              </td>
              <td className="text-muted" style={{ fontSize: 12 }}>
                {row.triggeredBy ?? "—"}
              </td>
              <td>
                {row.canRetry && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={isPending}
                    onClick={() => retry(row.id)}
                  >
                    Re-send
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
