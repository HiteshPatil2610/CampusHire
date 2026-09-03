import { useToastStore } from '@/store/toastStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import clsx from 'clsx'

const icons = {
  success: <CheckCircle size={16} className="text-teal flex-shrink-0" />,
  error:   <XCircle    size={16} className="text-danger flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber flex-shrink-0" />,
  default: <Info       size={16} className="text-text-secondary flex-shrink-0" />,
}

const bgMap = {
  success: 'bg-teal-light border-teal/20',
  error:   'bg-danger-light border-danger/20',
  warning: 'bg-amber-light border-amber/20',
  default: 'bg-surface-2 border-border',
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg',
            'text-sm font-medium text-text-primary',
            'pointer-events-auto min-w-[260px] max-w-sm',
            bgMap[t.type],
            'animate-[toastIn_.25s_ease_both]',
          )}
        >
          {icons[t.type]}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="ml-1 p-0.5 rounded hover:bg-black/5 transition-colors"
          >
            <X size={13} className="text-text-muted" />
          </button>
        </div>
      ))}
    </div>
  )
}
