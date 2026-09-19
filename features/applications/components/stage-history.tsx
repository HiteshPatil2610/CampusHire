"use client";

import { useEffect, useState } from "react";
import {
  getApplicationStageHistory,
  type StageHistoryEntry,
} from "../queries/get-application-stage-history";
import { STATUS_LABELS } from "../utils/application-progress";

/**
 * One application's stage history, loaded when opened: every move, the
 * pipeline version it happened under, who made it and any note. Read-only.
 */
export function StageHistory({ applicationId }: { applicationId: string }) {
  const [entries, setEntries] = useState<StageHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setFailed(false);
    getApplicationStageHistory(applicationId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (failed) {
    return <div style={{ fontSize: 12, color: "var(--red, #c0392b)" }}>Could not load the history.</div>;
  }
  if (entries === null) {
    return <div className="skeleton" style={{ height: 48, borderRadius: 6 }} />;
  }
  if (entries.length === 0) {
    return <div className="text-muted" style={{ fontSize: 12 }}>No moves recorded yet.</div>;
  }

  return (
    <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 12 }}>
      {entries.map((entry) => (
        <li key={entry.id}>
          {entry.fromStage ? `${entry.fromStage} → ` : ""}
          <strong>{entry.toStage}</strong>
          <span className="text-muted">
            {" "}
            · {STATUS_LABELS[entry.toStatus]} ·{" "}
            {new Date(entry.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {entry.actor ? ` · ${entry.actor}` : ""}
            {` · pipeline v${entry.pipelineVersion}`}
          </span>
          {entry.note && <div className="text-secondary">“{entry.note}”</div>}
        </li>
      ))}
    </ol>
  );
}
