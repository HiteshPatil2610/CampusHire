"use client";

import { useState } from "react";

/**
 * Pick the batches a drive is open to.
 *
 * Offers the batch years this department's students actually have, with how
 * many students are in each, plus any year already selected (so a year with
 * no students yet can still be targeted and is never silently dropped). A
 * different year can be added by hand. Values are validated again on the
 * server as a `BATCH_YEAR` rule.
 */
export function BatchTargetingPicker({
  available,
  selected,
  onChange,
  locked = false,
  inherited = null,
}: {
  /** Batch years present among this department's students. */
  available: { year: number; students: number }[];
  selected: string[];
  onChange: (years: string[]) => void;
  locked?: boolean;
  /** The master's targeting, shown when this department sets none. */
  inherited?: string[] | null;
}) {
  const [extra, setExtra] = useState("");
  const counts = new Map(available.map((entry) => [String(entry.year), entry.students]));
  const years = [...new Set([...available.map((entry) => String(entry.year)), ...selected])].sort();
  const chosen = new Set(selected);

  const toggle = (year: string) => {
    const next = new Set(chosen);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    onChange([...next].sort());
  };

  const addExtra = () => {
    const year = extra.trim();
    if (!/^\d{4}$/.test(year)) return;
    onChange([...new Set([...selected, year])].sort());
    setExtra("");
  };

  const targetedCount = selected.reduce((sum, year) => sum + (counts.get(year) ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {years.length === 0 && (
          <span className="text-muted" style={{ fontSize: 12 }}>
            No student in this department has a batch year recorded yet.
          </span>
        )}
        {years.map((year) => (
          <label
            key={year}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              border: `0.5px solid ${chosen.has(year) ? "var(--accent)" : "var(--border)"}`,
              background: chosen.has(year) ? "var(--accent-surface, var(--surface-2))" : "var(--surface-1)",
              cursor: locked ? "default" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={chosen.has(year)}
              disabled={locked}
              onChange={() => toggle(year)}
              aria-label={`Batch of ${year}`}
            />
            <strong>{year}</strong>
            <span className="text-muted">
              {counts.get(year) ?? 0} student{counts.get(year) === 1 ? "" : "s"}
            </span>
          </label>
        ))}
      </div>

      {!locked && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Another year, e.g. 2029"
            inputMode="numeric"
            maxLength={4}
            style={{
              width: 180,
              padding: "5px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "0.5px solid var(--border-strong)",
              background: "var(--surface-2)",
            }}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11 }}
            disabled={!/^\d{4}$/.test(extra.trim())}
            onClick={addExtra}
          >
            ＋ Add year
          </button>
        </div>
      )}

      <div className="text-muted" style={{ fontSize: 11 }}>
        {selected.length > 0
          ? `Open to the ${selected.join(", ")} batch${selected.length > 1 ? "es" : ""} — ${targetedCount} student${targetedCount === 1 ? "" : "s"} in this department.`
          : inherited && inherited.length > 0
            ? `Inheriting the drive's default: ${inherited.join(", ")}.`
            : "No batch selected — required before publishing."}
      </div>
    </div>
  );
}
