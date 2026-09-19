import { SkeletonPageHeader, SkeletonForm } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <SkeletonPageHeader />
      <SkeletonForm sections={4} fieldsPerSection={4} />
    </div>
  );
}
