import { Bell, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface Props {
  onMenuClick?: () => void
  title?: string
  subtitle?: string
}

export default function Topbar({ onMenuClick, title, subtitle }: Props) {
  const { user } = useAuthStore()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'CH'

  return (
    <header className="flex items-center justify-between gap-4 px-7 py-3.5 border-b border-border bg-surface-2 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Hamburger — shown on mobile via CSS */}
        <button
          className="md:hidden p-1.5 rounded hover:bg-surface-1 transition-colors"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu size={18} className="text-text-secondary" />
        </button>

        {title && (
          <div>
            <h1 className="text-base font-semibold text-text-primary leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-1.5 rounded hover:bg-surface-1 transition-colors" aria-label="Notifications">
          <Bell size={17} className="text-text-secondary" />
        </button>
        <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center text-accent-dark text-xs font-semibold">
          {initials}
        </div>
      </div>
    </header>
  )
}
