import {
  SkeletonCardGrid,
  SkeletonPageHeader,
} from "@/components/shared/skeletons";

/**
 * Shown while this route's data is in flight. Its real purpose is that Next
 * prefetches a dynamic route only as far as its nearest `loading.tsx`, so this
 * file is what makes the sidebar's link prefetch useful here.
 */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonCardGrid count={6} />
    </div>
  );
}
