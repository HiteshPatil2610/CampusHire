import clsx from 'clsx'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export default function Card({ className, padding = true, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={clsx(
        'bg-surface-2 border border-border rounded-xl transition-shadow duration-200 hover:shadow-sm',
        padding && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down'
  className?: string
}

export function MetricCard({ label, value, sub, trend, className }: MetricCardProps) {
  return (
    <div className={clsx(
      'bg-surface-1 rounded-xl p-4 anim-fade-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
      className
    )}>
      <p className="text-xs text-text-secondary mb-1.5">{label}</p>
      <p className="text-xl font-semibold text-text-primary">{value}</p>
      {sub && (
        <p className={clsx('text-xs mt-1', trend === 'up' ? 'text-teal' : trend === 'down' ? 'text-danger' : 'text-text-secondary')}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
