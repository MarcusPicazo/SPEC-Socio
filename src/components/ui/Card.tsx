import type { ReactNode } from 'react'

// Patrón de tarjeta/sección repetido en BusinessFormPage y
// BusinessDetailPage — BRAND-PANEL.md §4 define la tipografía de "Título
// de sección o tarjeta" (Geist 500, 18px) para justo este caso.
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border border-linea bg-superficie p-4 min-[900px]:p-6">
      {title && <h2 className="mb-3 text-[18px] font-medium text-tinta">{title}</h2>}
      {children}
    </section>
  )
}
