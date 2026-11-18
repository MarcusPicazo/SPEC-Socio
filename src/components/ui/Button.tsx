import type { ButtonHTMLAttributes, ReactNode } from 'react'

// BRAND-PANEL.md §5 — botones. Radio 0, Geist Mono en mayúsculas, sin sombras.
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Alto de 36px en vez de 40px, para tablas densas. No aplica a "ghost". */
  dense?: boolean
  /** Agrega la flecha final usada en el botón principal. */
  arrow?: boolean
  children: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-tinta text-papel hover:bg-tinta-hover',
  secondary: 'border border-tinta bg-transparent text-tinta hover:bg-tinta hover:text-papel',
  // "Siempre pide confirmación": eso lo decide quien use el botón (por
  // ejemplo un window.confirm o un diálogo) — este componente solo pone el
  // estilo de alerta.
  destructive: 'border border-error bg-transparent text-error hover:bg-error hover:text-papel',
  ghost: 'text-gris-texto hover:text-tinta',
}

export function Button({
  variant = 'primary',
  dense = false,
  arrow = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const boxed = variant !== 'ghost'
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none',
        'font-mono text-xs uppercase tracking-[0.08em]',
        'transition-colors duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        boxed ? `px-4 ${dense ? 'h-9' : 'h-10'}` : '',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  )
}
