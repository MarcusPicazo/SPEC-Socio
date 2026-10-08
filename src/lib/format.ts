import type { CallStatus, QuoteStatus, SubscriptionStatus } from '../types'

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago atrasado',
  canceled: 'Cancelado',
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  new: 'Nueva',
  confirmed: 'Confirmada',
  owner_will_call: 'Dueño llama',
  ignored: 'Ignorada (spam)',
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  accepted: 'Aceptada',
  declined: 'Rechazada',
  expired: 'Vencida',
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

export function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

const dateEnFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

/** English, date-only — for customer-facing pages like /q/:token. */
export function formatDateEn(value: string | null): string {
  if (!value) return '—'
  return dateEnFormatter.format(new Date(value))
}
