import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-white border-transparent hover:bg-accent-dark',
  outline: 'bg-surface-2 text-text-primary border-border-strong hover:bg-surface-1',
  ghost:   'bg-transparent text-text-secondary border-transparent hover:bg-surface-1',
  danger:  'bg-danger-light text-danger border-danger/20 hover:bg-danger/10',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export default function Button({
  variant = 'outline', size = 'md', loading, icon, children,
  className, disabled, ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded border',
        'transition-all duration-150 cursor-pointer',
        'hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:shadow-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}
