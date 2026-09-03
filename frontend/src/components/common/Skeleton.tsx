import clsx from 'clsx'

interface Props { className?: string; height?: string; width?: string }

export default function Skeleton({ className, height = 'h-4', width = 'w-full' }: Props) {
  return <div className={clsx('skeleton', height, width, className)} />
}

export function SkeletonCard() {
  return (
    <div className="ch-card space-y-3">
      <Skeleton height="h-5" width="w-1/3" />
      <Skeleton height="h-3" width="w-2/3" />
      <Skeleton height="h-3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ch-card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <Skeleton height="h-4" width="w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
          <Skeleton height="h-3" width="w-32" />
          <Skeleton height="h-3" width="w-20" />
          <Skeleton height="h-3" width="w-16" />
          <Skeleton height="h-3" width="w-12 ml-auto" className="ml-auto" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-1 rounded-xl p-4 space-y-2">
          <Skeleton height="h-3" width="w-20" />
          <Skeleton height="h-7" width="w-16" />
          <Skeleton height="h-3" width="w-24" />
        </div>
      ))}
    </div>
  )
}
