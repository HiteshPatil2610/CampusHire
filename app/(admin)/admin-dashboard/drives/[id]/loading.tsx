import { SkeletonLine, SkeletonPageHeader, SkeletonTable } from "@/components/shared/skeletons";

/** The drive workspace: header, tab bar, then the open tab's content. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonLine key={index} height={14} width={90} />
        ))}
      </div>
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
