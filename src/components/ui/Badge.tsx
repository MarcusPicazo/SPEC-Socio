import type { ReactNode } from 'react'
import type { CallStatus, QuoteStatus, SubscriptionStatus } from '../../types'

// BRAND-PANEL.md §3/§5 — etiquetas de estado: fondo suave, texto del
// estado, mono mayúsculas de 11px, radio de 2px, punto de 6px a la
// izquierda. "neutral" es el gris liso que pide §3 para "Normal"/casos sin
// estado marcado — no es uno de los 4 estados con nombre.
export type BadgeVariant = 'exito' | 'alerta' | 'error' | 'info' | 'neutral'

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  exito: 'text-exito bg-exito-bg',
  alerta: 'text-alerta bg-alerta-bg',
  error: 'text-error bg-error-bg',
  info: 'text-info bg-info-bg',
  neutral: 'text-gris-texto bg-arena/20',
}

const DOT_CLASSES: Record<BadgeVariant, string> = {
  exito: 'bg-exito',
  alerta: 'bg-alerta',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-gris-texto',
}

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${BADGE_CLASSES[variant]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[variant]}`} aria-hidden="true" />
      {children}
    </span>
  )
}

// --- Mappers por dominio. El texto siempre viene de src/lib/format.ts (una
// sola fuente de verdad para las etiquetas en español), estos componentes
// solo deciden el color. ---

const SUBSCRIPTION_VARIANT: Record<SubscriptionStatus, BadgeVariant> = {
  trialing: 'info',
  active: 'exito',
  past_due: 'alerta',
  canceled: 'error',
}

export function SubscriptionStatusBadge({ status, label }: { status: SubscriptionStatus; label: string }) {
  return <Badge variant={SUBSCRIPTION_VARIANT[status]}>{label}</Badge>
}

const CALL_STATUS_VARIANT: Record<CallStatus, BadgeVariant> = {
  new: 'info',
  confirmed: 'exito',
  owner_will_call: 'alerta',
  ignored: 'neutral',
}

export function CallStatusBadge({ status, label }: { status: CallStatus; label: string }) {
  return <Badge variant={CALL_STATUS_VARIANT[status]}>{label}</Badge>
}

const QUOTE_STATUS_VARIANT: Record<QuoteStatus, BadgeVariant> = {
  draft: 'neutral',
  sending: 'info',
  sent: 'info',
  viewed: 'alerta',
  accepted: 'exito',
  declined: 'error',
  expired: 'error',
}

export function QuoteStatusBadge({ status, label }: { status: QuoteStatus; label: string }) {
  return <Badge variant={QUOTE_STATUS_VARIANT[status]}>{label}</Badge>
}

// "Urgencia de llamadas: la etiqueta Urgente va con el estilo de Error.
// Normal va en gris." (BRAND-PANEL.md §3). No hay columna de urgencia hoy
// en ninguna tabla — se agrega en la Parte 5, donde ya hay un dato real
// (calls.extracted.urgency) para mostrar.
export function UrgencyBadge({ urgency }: { urgency: 'emergency' | 'soon' | 'flexible' | null }) {
  if (urgency === 'emergency') return <Badge variant="error">Urgente</Badge>
  if (urgency === 'soon') return <Badge variant="alerta">Pronto</Badge>
  if (urgency === 'flexible') return <Badge variant="neutral">Flexible</Badge>
  return <Badge variant="neutral">Normal</Badge>
}
