import Link from "next/link";
import type { ActionItem, ActionPriority } from "../domain/action-items";

const BADGE: Record<ActionPriority, { className: string; label: string }> = {
  URGENT: { className: "badge-red", label: "Urgent" },
  HIGH: { className: "badge-amber", label: "Soon" },
  NORMAL: { className: "badge-gray", label: "To do" },
};

/**
 * What needs the viewer's attention, most urgent first.
 *
 * The items are computed from current state on every render (see
 * `action-items.ts`), so this panel only ever lists things still open. When
 * there is nothing, it says so — an empty panel is good news, and a blank one
 * would look broken.
 */
export function ActionRequiredPanel({
  items,
  emptyMessage = "Nothing needs your attention right now.",
}: {
  items: ActionItem[];
  emptyMessage?: string;
}) {
  return (
    <section className="card" aria-label="Action required" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Action required
        </h2>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-secondary" style={{ fontSize: 13, margin: 0 }}>
          ✓ {emptyMessage}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderLeft:
                    item.priority === "URGENT" ? "3px solid var(--red)" : "3px solid transparent",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  background: "var(--surface-1)",
                }}
              >
                <span className={`badge ${BADGE[item.priority].className}`}>
                  {BADGE[item.priority].label}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                  <span className="text-secondary" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
                    {item.detail}
                  </span>
                </span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
