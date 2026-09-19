import type { OperationsActivityItem } from "../queries/get-drive-operations-activity";

const KIND_COLOR: Record<OperationsActivityItem["kind"], string> = {
  APPLICATION: "var(--accent)",
  STAGE: "var(--purple, var(--accent))",
  PLACEMENT: "var(--teal)",
  DRIVE: "var(--text-muted)",
};

/**
 * The drive's activity for this department, newest first. A plain list of
 * what was recorded (see `getDriveOperationsActivity`) with an empty state.
 */
export function DriveActivityList({ items }: { items: OperationsActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>No activity yet</div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Applications, stage changes, placements and drive events will appear here as they happen.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{ fontSize: 12, padding: "10px 12px", borderRadius: 8, background: "var(--surface-1)", display: "flex", gap: 10 }}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: "50%", background: KIND_COLOR[item.kind], marginTop: 5, flexShrink: 0 }}
            />
            <div>
              <div>{item.summary}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                {new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {" · "}
                {item.actor}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
