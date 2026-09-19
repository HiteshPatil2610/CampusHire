import { SkeletonPageHeader, SkeletonTable } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
