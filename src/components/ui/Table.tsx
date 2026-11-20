import type { ReactNode, ThHTMLAttributes } from 'react'

// BRAND-PANEL.md §5 — tablas: fondo superficie, encabezado mono gris sobre
// papel, filas de 48px separadas por línea de 1px, hover #F7F5F0.

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-linea bg-superficie">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-papel">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({
  children,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return (
    <th
      {...props}
      className={`h-10 px-4 font-mono text-xs uppercase tracking-[0.08em] text-gris-texto ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function Tr({
  children,
  onClick,
  selected = false,
}: {
  children: ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      className={[
        'border-t border-linea',
        onClick ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracota' : '',
        selected ? 'bg-arena/30' : 'hover:bg-[#F7F5F0]',
      ].join(' ')}
    >
      {children}
    </tr>
  )
}

export function Td({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td
      className={`h-12 px-4 align-middle text-tinta ${
        numeric ? 'text-right font-mono tabular-nums' : ''
      }`}
    >
      {children}
    </td>
  )
}
