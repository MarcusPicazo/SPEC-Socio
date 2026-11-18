import type { ReactNode, SelectHTMLAttributes } from 'react'

// Mismo tratamiento visual que Input — BRAND-PANEL.md §5.
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: ReactNode
}

export function Select({ label, error, id, className = '', children, ...props }: SelectProps) {
  const selectId = id ?? props.name
  return (
    <div>
      <label
        htmlFor={selectId}
        className="block font-mono text-xs uppercase tracking-[0.08em] text-gris-texto"
      >
        {label}
      </label>
      <select
        id={selectId}
        {...props}
        className={[
          'mt-1 h-10 w-full border bg-superficie px-3 text-sm text-tinta',
          error ? 'border-error' : 'border-linea',
          className,
        ].join(' ')}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-[13px] text-error">{error}</p>}
    </div>
  )
}
