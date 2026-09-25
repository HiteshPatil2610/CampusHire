import { SkeletonLine } from "@/components/shared/skeletons";

/**
 * Super Admin central drives loading skeleton.
 * Mirrors the CentralDrivesView master-detail layout:
 * header + KPI strip → search → list (left) + tabbed detail panel (right).
 */
export default function Loading() {
  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div>
          <SkeletonLine height={24} width={180} />
          <SkeletonLine height={14} width={360} style={{ marginTop: 8 }} />
        </div>
        <SkeletonLine height={36} width={160} style={{ borderRadius: 8 }} />
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div className="card" key={i} style={{ padding: "12px 16px" }}>
            <SkeletonLine height={10} width="60%" />
            <SkeletonLine height={22} width="40%" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Master list + detail panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 340px) 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left: drive list */}
        <div>
          <SkeletonLine height={34} width="100%" style={{ marginBottom: 10, borderRadius: 8 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                marginBottom: 8,
                background: "var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <SkeletonLine height={14} width="55%" />
                <SkeletonLine height={18} width={50} style={{ borderRadius: 10 }} />
              </div>
              <SkeletonLine height={11} width="75%" style={{ marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((j) => (
                  <SkeletonLine key={j} height={16} width={55} style={{ borderRadius: 8 }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail panel with tab bar */}
        <div>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 4,
              borderBottom: "1px solid var(--border)",
              marginBottom: 16,
              paddingBottom: 2,
            }}
          >
            {[120, 110, 160, 120, 80].map((w, i) => (
              <SkeletonLine key={i} height={30} width={w} style={{ borderRadius: 4 }} />
            ))}
          </div>

          {/* Overview content */}
          {[0, 1, 2].map((i) => (
            <div className="card" key={i} style={{ marginBottom: 16, padding: 20 }}>
              <SkeletonLine height={15} width="30%" style={{ marginBottom: 12 }} />
              <SkeletonLine height={12} width="90%" style={{ marginBottom: 8 }} />
              <SkeletonLine height={12} width="70%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
