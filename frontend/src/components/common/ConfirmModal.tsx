import { useEffect, useRef } from 'react'
import Button from './Button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm',
  confirmVariant = 'danger', onConfirm, onCancel, loading,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 anim-fade-in">
      <div
        className="bg-surface-2 rounded-2xl shadow-2xl p-7 max-w-sm w-full anim-scale-in"
        role="dialog"
        aria-modal
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-danger-light flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-danger" />
          </div>
          <div>
            <h3 id="confirm-title" className="text-sm font-semibold text-text-primary">{title}</h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
