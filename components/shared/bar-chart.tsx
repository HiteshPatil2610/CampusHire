export interface BarChartDatum {
  label: string;
  value: number;
  color: string;
}

/**
 * A plain horizontal bar chart for comparing a handful of counts side by
 * side (Phase 9, Item 20's "bar for comparison"). No charting library: a
 * handful of bars is simpler as a few `<div>`s than as a new dependency.
 */
export default function BarChart({
  data,
  max: sharedMax,
}: {
  data: BarChartDatum[];
  /** Scale against this instead of this chart's own largest value — so
   *  several charts side by side (one per department) stay comparable. */
  max?: number;
}) {
  const max = Math.max(1, sharedMax ?? 0, ...data.map((d) => d.value));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
            <strong>{d.value}</strong>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: "var(--surface-1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(d.value / max) * 100}%`,
                background: d.color,
                borderRadius: 5,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
