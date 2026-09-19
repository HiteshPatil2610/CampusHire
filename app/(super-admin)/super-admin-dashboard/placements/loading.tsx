import { SkeletonKpiRow, SkeletonPageHeader, SkeletonTable } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonKpiRow count={3} />
      <SkeletonTable rows={8} columns={7} />
    </div>
  );
}
