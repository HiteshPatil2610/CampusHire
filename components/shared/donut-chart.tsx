export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * A plain donut chart for a proportion split (Phase 9, Item 20's
 * "pie/donut for proportion-based metrics"). Built with `conic-gradient`
 * rather than SVG arc math or a charting library — a CSS gradient is enough
 * for a handful of slices.
 */
export default function DonutChart({ data }: { data: DonutSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cursor = 0;
  const stops = data.map((d) => {
    const start = total > 0 ? (cursor / total) * 360 : 0;
    cursor += d.value;
    const end = total > 0 ? (cursor / total) * 360 : 0;
    return `${d.color} ${start}deg ${end}deg`;
  });

  const gradient =
    total > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--surface-1)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: gradient,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 22,
            borderRadius: "50%",
            background: "var(--surface-0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {total}
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: d.color,
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
            <strong>{d.value}</strong>
            {total > 0 && (
              <span style={{ color: "var(--text-muted)" }}>({Math.round((d.value / total) * 100)}%)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
