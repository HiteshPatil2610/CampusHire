import clsx from 'clsx'

type Color = 'green' | 'amber' | 'red' | 'purple' | 'gray' | 'blue'

interface Props {
  color?: Color
  children: React.ReactNode
  className?: string
}

const colorMap: Record<Color, string> = {
  green:  'badge-green',
  amber:  'badge-amber',
  red:    'badge-red',
  purple: 'badge-purple',
  gray:   'badge-gray',
  blue:   'bg-blue-50 text-blue-700',
}

export default function Badge({ color = 'gray', children, className }: Props) {
  return (
    <span className={clsx(colorMap[color], className)}>{children}</span>
  )
}

// Readiness score → badge color
export function readinessBadge(score: number): Color {
  if (score >= 75) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

// Status → badge color
export function statusBadge(status: string): Color {
  const map: Record<string, Color> = {
    ACTIVE: 'green', active: 'green',
    INACTIVE: 'red',  inactive: 'red',
    PENDING: 'amber', pending: 'amber',
    SUSPENDED: 'red',
  }
  return map[status] ?? 'gray'
}
