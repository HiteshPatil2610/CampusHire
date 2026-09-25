import { SkeletonLine, SkeletonPageHeader } from "@/components/shared/skeletons";

/**
 * Dept admin drives loading skeleton.
 * Mirrors the tabbed master-detail layout used by AdminDrivesView:
 * two tab buttons → KPI tiles → master list (left) + config panel (right).
 */
export default function Loading() {
  return (
    <div>
      {/* Scope banner skeleton */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          marginBottom: 20,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <SkeletonLine height={14} width={280} />
      </div>

      {/* Tab bar skeleton */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
          paddingBottom: 2,
        }}
      >
        <SkeletonLine height={34} width={220} style={{ borderRadius: 4 }} />
        <SkeletonLine height={34} width={180} style={{ borderRadius: 4 }} />
      </div>

      {/* KPI tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div className="card" key={i} style={{ padding: "12px 16px" }}>
            <SkeletonLine height={10} width="60%" />
            <SkeletonLine height={24} width="40%" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Master list + detail panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 320px) 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left: drive list */}
        <div>
          <SkeletonLine height={34} width="100%" style={{ marginBottom: 10, borderRadius: 8 }} />
          {[0, 1, 2, 3].map((i) => (
            <div
              className="card"
              key={i}
              style={{ marginBottom: 8, padding: "12px 14px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <SkeletonLine height={14} width="55%" />
                <SkeletonLine height={18} width={50} style={{ borderRadius: 10 }} />
              </div>
              <SkeletonLine height={11} width="70%" style={{ marginBottom: 6 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <SkeletonLine height={16} width={60} style={{ borderRadius: 8 }} />
                <SkeletonLine height={16} width={80} style={{ borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: config panel skeleton */}
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <SkeletonLine height={42} width={42} style={{ borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <SkeletonLine height={18} width="50%" style={{ marginBottom: 6 }} />
                <SkeletonLine height={13} width="35%" />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <SkeletonLine height={10} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLine height={14} width="80%" />
                </div>
              ))}
            </div>
          </div>

          {/* Step nav skeleton */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonLine
                key={i}
                height={30}
                width={90}
                style={{ borderRadius: 6 }}
              />
            ))}
          </div>

          {/* Content card skeleton */}
          <div className="card" style={{ padding: 20 }}>
            <SkeletonLine height={15} width="30%" style={{ marginBottom: 14 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <SkeletonLine height={10} width="25%" style={{ marginBottom: 6 }} />
                <SkeletonLine height={34} width="100%" style={{ borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
