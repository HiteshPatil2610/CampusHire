"use client";

import { batchLabel } from "@/features/students/utils/batch";

/**
 * Pick the batches a drive is open to.
 *
 * Offers only the batches students actually hold (passout years from the
 * student database, with how many students are in each) plus any batch the
 * drive already targets, so an existing selection is never silently dropped.
 * Nothing is typed in or hard-coded; the server refuses any other year
 * (`unavailableBatchYears`) and stores the selection as the drive's
 * `BATCH_YEAR` rule.
 */
export function BatchTargetingPicker({
  available,
  selected,
  onChange,
  locked = false,
  inherited = null,
}: {
  /** Batches present among the relevant students (a department's, or all). */
  available: { year: number; students: number }[];
  selected: string[];
  onChange: (years: string[]) => void;
  locked?: boolean;
  /** The master's targeting, shown when this department sets none. */
  inherited?: string[] | null;
}) {
  const counts = new Map(available.map((entry) => [String(entry.year), entry.students]));
  const years = [...new Set([...available.map((entry) => String(entry.year)), ...selected])].sort();
  const chosen = new Set(selected);
  const label = (year: string) => batchLabel(Number(year));

  const toggle = (year: string) => {
    const next = new Set(chosen);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    onChange([...next].sort());
  };

  const targetedCount = selected.reduce((sum, year) => sum + (counts.get(year) ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {years.length === 0 && (
          <span className="text-muted" style={{ fontSize: 12 }}>
            No student has a batch recorded yet. Batches appear here once students are imported
            with their batch.
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
              aria-label={`Batch ${label(year)}`}
            />
            <strong>{label(year)}</strong>
            <span className="text-muted">
              {counts.get(year) ?? 0} student{counts.get(year) === 1 ? "" : "s"}
            </span>
          </label>
        ))}
      </div>

      <div className="text-muted" style={{ fontSize: 11 }}>
        {selected.length > 0
          ? `Open to batch${selected.length > 1 ? "es" : ""} ${selected.map(label).join(", ")} — ${targetedCount} student${targetedCount === 1 ? "" : "s"}.`
          : inherited && inherited.length > 0
            ? `Inheriting the drive's default: ${inherited.map(label).join(", ")}.`
            : "No batch selected."}
      </div>
    </div>
  );
}
