import type { InputHTMLAttributes } from 'react'

// BRAND-PANEL.md §5 — inputs: fondo superficie, borde 1px línea, 40px de
// alto, label visible arriba en mono gris. El foco (contorno terracota de
// 2px) ya lo pone :focus-visible global en index.css.
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block font-mono text-xs uppercase tracking-[0.08em] text-gris-texto"
      >
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={[
          'mt-1 h-10 w-full border bg-superficie px-3 text-sm text-tinta',
          'placeholder:text-gris-texto/60',
          error ? 'border-error' : 'border-linea',
          className,
        ].join(' ')}
      />
      {error && <p className="mt-1 text-[13px] text-error">{error}</p>}
    </div>
  )
}
