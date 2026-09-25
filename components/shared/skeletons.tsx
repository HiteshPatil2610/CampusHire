/**
 * Route-transition skeletons.
 *
 * These exist for more than looks. Every dashboard route is `force-dynamic`,
 * and Next only prefetches a dynamic route *as far as its nearest
 * `loading.tsx`* — a segment without one has nothing to prefetch, so the click
 * blocks on the full server render before anything paints. Giving each segment
 * a `loading.tsx` is what lets the sidebar's `<Link>` prefetch do its job: the
 * shell is already in the client cache when the user clicks, and only the data
 * is still in flight.
 *
 * They are shared rather than hand-written per route so the shapes stay
 * consistent and a layout change lands in one place. A skeleton should echo
 * the real layout's blocks — a skeleton that does not match causes a visible
 * jump when the data arrives.
 *
 * All of these are server components: they ship no JavaScript.
 */

interface LineProps {
  width?: number | string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** One shimmering bar. The building block for everything below. */
export function SkeletonLine({ width = "100%", height = 12, style }: LineProps) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

/** Page title plus optional subtitle, matching `.page-title` spacing. */
export function SkeletonPageHeader({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <SkeletonLine height={24} width={220} />
      {subtitle && <SkeletonLine height={14} width={420} style={{ marginTop: 8 }} />}
    </div>
  );
}

/** A row of KPI cards, as the three dashboard homes use. */
export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        gap: 16,
        marginBottom: 28,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <SkeletonLine height={28} width="50%" />
          <SkeletonLine height={12} width="75%" style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

/** A card holding a short list of rows. */
export function SkeletonListCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card">
      <SkeletonLine height={16} width="40%" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ marginTop: 14 }}>
          <SkeletonLine height={12} width={`${80 - i * 7}%`} />
          <SkeletonLine height={10} width={`${55 - i * 5}%`} style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** Two equal cards side by side — the common dashboard lower half. */
export function SkeletonTwoColumn({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <SkeletonListCard rows={rows} />
      <SkeletonListCard rows={rows} />
    </div>
  );
}

/** A filter bar above a table, as every roster and list screen has. */
export function SkeletonTable({
  rows = 8,
  columns = 6,
  filters = true,
}: {
  rows?: number;
  columns?: number;
  filters?: boolean;
}) {
  return (
    <>
      {filters && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <SkeletonLine height={34} width={260} />
          <SkeletonLine height={34} width={140} />
          <SkeletonLine height={34} width={120} />
        </div>
      )}
      <div className="table-wrap" style={{ padding: "14px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            marginBottom: 14,
          }}
        >
          {Array.from({ length: columns }, (_, i) => (
            <SkeletonLine key={i} height={11} width="70%" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            {Array.from({ length: columns }, (_, c) => (
              <SkeletonLine key={c} height={12} width={c === 0 ? "85%" : "60%"} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** A responsive grid of cards — drives lists and similar. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SkeletonLine height={38} width={38} style={{ borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <SkeletonLine height={14} width="70%" />
              <SkeletonLine height={11} width="45%" style={{ marginTop: 6 }} />
            </div>
          </div>
          <SkeletonLine height={11} width="90%" style={{ marginTop: 14 }} />
          <SkeletonLine height={11} width="65%" style={{ marginTop: 7 }} />
          <SkeletonLine height={30} width="100%" style={{ marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

/** A stack of form sections, for profile and settings screens. */
export function SkeletonForm({ sections = 3, fieldsPerSection = 4 }: { sections?: number; fieldsPerSection?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: sections }, (_, s) => (
        <div className="card" key={s}>
          <SkeletonLine height={15} width="30%" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginTop: 16,
            }}
          >
            {Array.from({ length: fieldsPerSection }, (_, f) => (
              <div key={f}>
                <SkeletonLine height={10} width="40%" />
                <SkeletonLine height={32} width="100%" style={{ marginTop: 6 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
