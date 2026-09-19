import { SkeletonPageHeader, SkeletonTable } from "@/components/shared/skeletons";
import { SkeletonLine } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div>
      {/* Back link */}
      <SkeletonLine height={14} width={160} style={{ marginBottom: 20 }} />
      <SkeletonPageHeader />

      {/* Department summary tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div className="card" key={i} style={{ padding: "12px 16px" }}>
            <SkeletonLine height={13} width="40%" />
            <SkeletonLine height={10} width="70%" style={{ marginTop: 4 }} />
            <SkeletonLine height={22} width="30%" style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      <SkeletonTable rows={10} columns={7} />
    </div>
  );
}
