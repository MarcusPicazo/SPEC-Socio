import type { ReactNode } from 'react'

// BRAND-PANEL.md §5 — vista de llamada/chat: burbuja "Socio" en superficie
// con borde de 1px, "el dueño" en arena, radio de 2px. Usada en la Parte 5
// para mostrar el resumen de una llamada (summary_es), que es lo único que
// hoy tiene un formato de "mensaje" — no hay un log de WhatsApp dueño↔Socio
// en el panel, así que la variante "dueno" queda lista pero sin uso todavía.
export function CallBubble({ speaker, children }: { speaker: 'socio' | 'dueno'; children: ReactNode }) {
  return (
    <div
      className={[
        'max-w-prose rounded-badge px-3 py-2 text-sm',
        speaker === 'socio' ? 'border border-linea bg-superficie text-tinta' : 'bg-arena text-tinta',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
