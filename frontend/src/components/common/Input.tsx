import clsx from 'clsx'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, containerClassName, className, ...props }, ref) => {
    return (
      <div className={clsx('w-full', containerClassName)}>
        {label && <label className="ch-label">{label}</label>}
        <input
          ref={ref}
          {...props}
          className={clsx(
            'ch-input',
            error && 'border-danger focus:border-danger focus:ring-danger/10',
            className
          )}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        {!error && hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export default Input

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="ch-label">{label}</label>}
      <select
        ref={ref}
        {...props}
        className={clsx(
          'ch-input',
          error && 'border-danger focus:border-danger focus:ring-danger/10',
          className
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

// ── Textarea ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="ch-label">{label}</label>}
      <textarea
        ref={ref}
        rows={3}
        {...props}
        className={clsx(
          'ch-input resize-none',
          error && 'border-danger focus:border-danger',
          className
        )}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
